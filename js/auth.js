/* ============================================================
   ADEPTIO · v2.4.0.db.auth — the Identity cell (Blueprint v2.5 §3)
   One writer for db_identity (store 11): accounts · sessions ·
   tokens · policies. Identity ≠ credential — the account is the
   person's e-mail; ways-to-prove are plug-ins (local passwords
   now; LDAP/RADIUS Pro · MFA/SSO/SCIM later — greyed, never hidden).
   Safety floor: lockout 5/15 · self-reset · sessions + revoke ·
   facts on db_audit · never-log list (passwords, tokens, secrets).
   Mail goes to the demo outbox (db_comms sent log, kind: mail).
   No DOM in this file — node-runnable for tools/auth-smoke.js.
   ============================================================ */
window.AUTH = (function () {
  const DOMAIN = "phoungern.la";
  const PEPPER = "·adeptio.v240";
  const SES_KEY = "adeptio.v240.session";

  /* localStorage shim (node) */
  let LS;
  try { window.localStorage.setItem(SES_KEY + ".probe", "1"); window.localStorage.removeItem(SES_KEY + ".probe"); LS = window.localStorage; }
  catch (e) { const m = {}; LS = { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; }

  /* ---------- SHA-256 (sync, dependency-free; UTF-8 safe) ----------
     Local credentials are stored as salted hashes only — the demo
     never persists or logs a plain password (never-log list). */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    const maxWord = Math.pow(2, 32);
    let result = "", words = [], asciiBitLength = ascii.length * 8;
    let hash = sha256.h = sha256.h || [], k = sha256.k = sha256.k || [], primeCounter = k.length;
    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
        hash[primeCounter] = (Math.pow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (Math.pow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return ""; // byte-string expected — callers UTF-8 encode first
      words[i >> 2] |= j << ((3 - i) % 4) * 8;
    }
    words[words.length] = ((asciiBitLength / maxWord) | 0);
    words[words.length] = (asciiBitLength);
    for (let j = 0; j < words.length;) {
      const w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const a = hash[0], e = hash[4];
        const temp1 = hash[7]
          + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + (w[i] = (i < 16) ? w[i] : (
            w[i - 16]
            + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))
          ) | 0);
        const temp2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (let i = 0; i < 8; i++) for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? 0 : "") + b.toString(16);
    }
    return result;
  }
  const utf8 = (s) => unescape(encodeURIComponent(String(s)));
  const hash = (email, pw) => sha256(utf8(email + "·" + pw + PEPPER));

  /* ---------- store accessors (one writer: this cell) ---------- */
  const T = (tb) => DB.list("db_identity", tb);
  const policy = () => T("policies")[0] || { minLen: 8, lockoutFails: 5, lockoutMins: 15, idleMins: 30, inviteHours: 72, resetMins: 30 };
  const accounts = () => T("accounts");
  const account = (email) => accounts().find(a => a.email === String(email || "").trim().toLowerCase());
  const byEmp = (empId) => accounts().find(a => a.emp === empId);
  const save = () => DB.persist("db_identity");
  const fact = (who, act, obj) => DB.audit(who, act, obj, "portal");

  /* ---------- portal flag + roadmap rows — registry-driven (kernel) ---------- */
  const flags = () => DB.list("db_platform", "flags");
  const flag = (key) => flags().find(f => f.key === key);
  function portalOn() { const f = flag("auth_portal"); return !!(f && f.on); }
  function setPortal(on, who) {
    const f = flag("auth_portal");
    if (!f) return;
    f.on = !!on; DB.persist("db_platform");
    fact(who || "Thip N.", "auth.portal_flag", "auth_portal → " + (on ? "on" : "off"));
  }
  // sign-in methods for the Security menu — greyed rows badge by tier (D1: static every tier)
  const roadmap = () => flags().filter(f => f.key.indexOf("auth.") === 0);

  /* ---------- mail — demo outbox (db_comms sent log grows a reader) ----------
     6 bilingual templates (EN · ລາວ). Links are app routes; tokens appear
     ONLY in the mail body (that is the point of the outbox) — never on db_audit. */
  const TPL = {
    invite: {
      en: (d) => ({ subject: "You're invited to Adeptio — activate your account", body: `Sabaidee ${d.name},\n\nHR switched on portal access for you at ${DATA.company.name}.\nYour username is this e-mail address: ${d.email}\n\nActivate your account and set a password (link valid ${d.hours} h):\n→ ${d.link}\n\nIf you didn't expect this, contact HR.` }),
      lo: (d) => ({ subject: "ທ່ານໄດ້ຮັບເຊີນເຂົ້າໃຊ້ Adeptio — ເປີດໃຊ້ບັນຊີຂອງທ່ານ", body: `ສະບາຍດີ ${d.name},\n\nຝ່າຍ HR ໄດ້ເປີດສິດເຂົ້າໃຊ້ພອດທັລໃຫ້ທ່ານແລ້ວ.\nຊື່ຜູ້ໃຊ້ຂອງທ່ານແມ່ນອີເມວນີ້: ${d.email}\n\nເປີດໃຊ້ບັນຊີ ແລະ ຕັ້ງລະຫັດຜ່ານ (ລິ້ງມີອາຍຸ ${d.hours} ຊມ):\n→ ${d.link}` })
    },
    activated: {
      en: (d) => ({ subject: "Your Adeptio account is active", body: `Sabaidee ${d.name},\n\nYour account ${d.email} is now active. Sign in any time:\n→ ${d.link}\n\nIf this wasn't you, reply to HR immediately.` }),
      lo: (d) => ({ subject: "ບັນຊີ Adeptio ຂອງທ່ານເປີດໃຊ້ແລ້ວ", body: `ສະບາຍດີ ${d.name},\n\nບັນຊີ ${d.email} ຂອງທ່ານເປີດໃຊ້ແລ້ວ. ເຂົ້າສູ່ລະບົບໄດ້ທຸກເວລາ:\n→ ${d.link}` })
    },
    reset_request: {
      en: (d) => ({ subject: "Reset your Adeptio password", body: `Sabaidee ${d.name},\n\nA password reset was requested for ${d.email}.\nSet a new password (link valid ${d.mins} min):\n→ ${d.link}\n\nIf you didn't ask for this, you can ignore it — your password is unchanged.` }),
      lo: (d) => ({ subject: "ຣີເຊັດລະຫັດຜ່ານ Adeptio ຂອງທ່ານ", body: `ສະບາຍດີ ${d.name},\n\nມີຄຳຮ້ອງຂໍຣີເຊັດລະຫັດຜ່ານສຳລັບ ${d.email}.\nຕັ້ງລະຫັດຜ່ານໃໝ່ (ລິ້ງມີອາຍຸ ${d.mins} ນາທີ):\n→ ${d.link}` })
    },
    reset_done: {
      en: (d) => ({ subject: "Your Adeptio password was changed", body: `Sabaidee ${d.name},\n\nThe password for ${d.email} was just changed.\nIf this wasn't you, contact HR / your administrator now.` }),
      lo: (d) => ({ subject: "ລະຫັດຜ່ານ Adeptio ຂອງທ່ານຖືກປ່ຽນແລ້ວ", body: `ສະບາຍດີ ${d.name},\n\nລະຫັດຜ່ານຂອງ ${d.email} ຫາກໍຖືກປ່ຽນ.\nຖ້າບໍ່ແມ່ນທ່ານ, ກະລຸນາຕິດຕໍ່ HR ທັນທີ.` })
    },
    lockout: {
      en: (d) => ({ subject: "Account locked after 5 failed sign-ins", body: `Sabaidee ${d.name},\n\n${d.email} was locked for ${d.mins} minutes after ${d.fails} failed attempts.\nIt unlocks automatically, or an administrator can unlock it from the identity console.\nForgot your password? Use the reset link on the sign-in page.` }),
      lo: (d) => ({ subject: "ບັນຊີຖືກລັອກ ຫຼັງຈາກພະຍາຍາມເຂົ້າຜິດ 5 ຄັ້ງ", body: `ສະບາຍດີ ${d.name},\n\n${d.email} ຖືກລັອກ ${d.mins} ນາທີ ຫຼັງຈາກພະຍາຍາມຜິດ ${d.fails} ຄັ້ງ.\nມັນຈະປົດລັອກເອງ ຫຼື ຜູ້ດູແລລະບົບປົດລັອກໃຫ້ໄດ້.` })
    },
    revoked: {
      en: (d) => ({ subject: "Portal access revoked", body: `Sabaidee ${d.name},\n\nPortal access for ${d.email} was switched off (${d.reason}).\nYour employee record stays in HR — no access ≠ no employee.` }),
      lo: (d) => ({ subject: "ການເຂົ້າເຖິງພອດທັລຖືກປິດ", body: `ສະບາຍດີ ${d.name},\n\nສິດເຂົ້າໃຊ້ພອດທັລຂອງ ${d.email} ຖືກປິດແລ້ວ (${d.reason}).\nຂໍ້ມູນພະນັກງານຂອງທ່ານຍັງຄົງຢູ່ໃນລະບົບ HR.` })
    }
  };
  function mail(kind, to, name, data, who) {
    const en = TPL[kind].en({ name, email: to, ...data });
    const lo = TPL[kind].lo({ name, email: to, ...data });
    const n = DB.list("db_comms", "messages").length;
    DB.add("db_comms", "messages", {
      id: "MAIL-0" + (200 + n), mail: true, kind, to, audience: to,
      subject: en.subject, subjectLo: lo.subject, body: en.body, bodyLo: lo.body,
      link: data.link || "", ch: "Email · demo outbox", est: 1, ts: DB.stamp()
    }, who || "identity-cell");
    return true;
  }
  const mails = () => DB.list("db_comms", "messages").filter(m => m.mail);

  /* ---------- password policy — D3: min length 8 is the only hard rule ---------- */
  function policyCheck(pw) {
    const p = policy();
    pw = String(pw || "");
    const fails = [];
    if (pw.length < p.minLen) fails.push("At least " + p.minLen + " characters");
    let score = 0;
    if (pw.length >= p.minLen) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return { ok: fails.length === 0, fails, score: Math.min(4, score), minLen: p.minLen };
  }

  /* ---------- tokens (invite 72 h · reset 30 min) ---------- */
  function makeToken(kind, email) {
    const p = policy();
    const id = "TOK-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 7).toUpperCase();
    const ttl = kind === "invite" ? (p.inviteHours || 72) * 36e5 : (p.resetMins || 30) * 6e4;
    // one live token per kind per account — the old link dies when a new one is sent
    T("tokens").filter(t => t.email === email && t.kind === kind && !t.used).forEach(t => { t.used = true; });
    T("tokens").unshift({ id, kind, email, created: DB.stamp(), expires: Date.now() + ttl, used: false });
    save();
    return id;
  }
  function token(id) {
    const tk = T("tokens").find(t => t.id === id);
    if (!tk) return { ok: false, why: "unknown" };
    if (tk.used) return { ok: false, why: "used", tk };
    if (Date.now() > tk.expires) return { ok: false, why: "expired", tk };
    return { ok: true, tk };
  }

  /* ---------- sessions — idle 30 min · revocable · never restored ---------- */
  function sessions() { return T("sessions"); }
  function mySessions() { const s = session(); return s ? sessions().filter(x => x.email === s.email) : []; }
  function newSession(acc) {
    const id = "SES-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    T("sessions").unshift({
      id, email: acc.email, name: acc.name, emp: acc.emp || "—", scopes: acc.scopes.slice(),
      started: DB.stamp(), seen: Date.now(), device: (typeof navigator !== "undefined" && /Mobile|iPhone|Android/.test(navigator.userAgent)) ? "mobile · this device" : "web · this device"
    });
    if (T("sessions").length > 40) T("sessions").length = 40;
    save();
    LS.setItem(SES_KEY, id);
    return T("sessions")[0];
  }
  function session() {
    const id = LS.getItem(SES_KEY);
    if (!id) return null;
    const s = sessions().find(x => x.id === id);
    if (!s) { LS.removeItem(SES_KEY); return null; }
    const idleMs = (policy().idleMins || 30) * 6e4;
    if (Date.now() - s.seen > idleMs) { // idle timeout — the session dies quietly
      dropSession(s.id);
      LS.removeItem(SES_KEY);
      fact("system", "auth.session_expired", s.email + " · idle " + (policy().idleMins || 30) + " min");
      return null;
    }
    if (Date.now() - s.seen > 30e3) { s.seen = Date.now(); save(); } // throttled touch
    return s;
  }
  function dropSession(id) {
    const arr = T("sessions");
    const i = arr.findIndex(x => x.id === id);
    if (i >= 0) arr.splice(i, 1);
    save();
  }
  function revoke(id, who) {
    const s = sessions().find(x => x.id === id);
    if (!s) return false;
    dropSession(id);
    if (LS.getItem(SES_KEY) === id) LS.removeItem(SES_KEY);
    fact(who || (session() ? session().name : "console"), "auth.session_revoked", s.id + " · " + s.email);
    return true;
  }
  function revokeOthers() {
    const cur = session();
    if (!cur) return 0;
    const gone = sessions().filter(s => s.email === cur.email && s.id !== cur.id);
    gone.forEach(s => dropSession(s.id));
    if (gone.length) fact(cur.name, "auth.session_revoked", gone.length + " other session(s) · " + cur.email);
    return gone.length;
  }
  function revokeAllFor(email, who) {
    const gone = sessions().filter(s => s.email === email);
    gone.forEach(s => { if (LS.getItem(SES_KEY) === s.id) LS.removeItem(SES_KEY); dropSession(s.id); });
    return gone.length;
  }
  function logout() {
    const s = session();
    if (s) { fact(s.name, "auth.logout", s.email); dropSession(s.id); }
    LS.removeItem(SES_KEY);
    return true;
  }

  /* ---------- sign in — identifier first, role read from the account ---------- */
  const lockRemainMs = (acc) => Math.max(0, (acc.lockedUntil || 0) - Date.now());
  function lookup(email) { // step 1 of the portal
    const acc = account(email);
    if (!acc) return { ok: false, code: "unknown", msg: "No account for that address — ask HR to switch on access (e-mail is required at that moment)." };
    if (acc.status === "invited") return { ok: false, code: "invited", msg: "Account not activated yet — open the invite in the demo outbox and set a password.", acc };
    if (acc.status === "disabled") return { ok: false, code: "disabled", msg: "Access is switched off for this person. The employee record still exists — HR can re-invite.", acc };
    return { ok: true, acc };
  }
  function login(email, pw) {
    const lk = lookup(email);
    if (!lk.ok) return lk;
    const acc = lk.acc;
    const p = policy();
    if (lockRemainMs(acc) > 0) {
      return { ok: false, code: "locked", msg: "Locked after " + p.lockoutFails + " failed attempts.", remainMs: lockRemainMs(acc), acc };
    }
    if (acc.provider && acc.provider !== "local") { // reset/verify split — portal never owns directory passwords
      return { ok: false, code: "directory", msg: "This account is managed by your company directory (" + acc.provider + ") — sign-in arrives with the site connector (roadmap).", acc };
    }
    if (hash(acc.email, pw) !== acc.hash) {
      acc.fails = (acc.fails || 0) + 1;
      let out;
      if (acc.fails >= (p.lockoutFails || 5)) {
        acc.lockedUntil = Date.now() + (p.lockoutMins || 15) * 6e4;
        acc.fails = 0;
        mail("lockout", acc.email, acc.name.split(" ")[0], { mins: p.lockoutMins || 15, fails: p.lockoutFails || 5 });
        fact("system", "auth.lockout", acc.email + " · " + (p.lockoutMins || 15) + " min");
        out = { ok: false, code: "locked", msg: "Locked after " + (p.lockoutFails || 5) + " failed attempts — a mail landed in the outbox.", remainMs: lockRemainMs(acc), acc };
      } else {
        fact("system", "auth.login_failed", acc.email + " · attempt " + acc.fails + "/" + (p.lockoutFails || 5));
        out = { ok: false, code: "badpw", msg: "Wrong password — attempt " + acc.fails + " of " + (p.lockoutFails || 5) + ".", acc };
      }
      save();
      return out;
    }
    // tier gate — username decides the landing, but the tier flag still rules personas (R4)
    const prim = acc.scopes[0];
    if ((prim === "ceo" || prim === "sysadmin") && window.DATA && !DATA.has(prim)) {
      return { ok: false, code: "tier", msg: (prim === "ceo" ? "CEO persona" : "Sys Admin separation") + " unlocks at Professional ≤250 — flip the tier on this card (on Essential, HR doubles as admin).", acc };
    }
    acc.fails = 0; acc.lockedUntil = 0; acc.lastLogin = DB.stamp();
    const ses = newSession(acc);
    fact(acc.name, "auth.login", acc.email + " → " + acc.scopes.join("+"));
    // the staff lens follows the signed-in person (one write, many lenses)
    if (acc.scopes.includes("staff") && acc.emp && window.DATA && DATA.employees.find(e => e.id === acc.emp)) DATA.setActingStaff(acc.emp);
    if (window.DATA) DATA.pulse();
    return { ok: true, ses, acc };
  }

  /* ---------- access option on a person (HR) — invite · resend · revoke ---------- */
  function invite(f) { // {emp, name, email, scope, who}
    const email = String(f.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, msg: "A valid e-mail is required the moment access is switched on." };
    if (account(email) && account(email).emp !== f.emp) return { ok: false, msg: "That address already belongs to another account." };
    const scopes = f.scope === "manager" ? ["manager", "staff"] : f.scope === "hr" ? ["hr", "staff"] : [f.scope || "staff"];
    let acc = account(email) || byEmp(f.emp);
    if (acc) { acc.email = email; acc.scopes = scopes; acc.status = "invited"; acc.hash = null; acc.fails = 0; acc.lockedUntil = 0; }
    else { acc = { email, name: f.name, emp: f.emp, scopes, status: "invited", provider: "local", hash: null, fails: 0, lockedUntil: 0, lastLogin: null, created: DB.stamp() }; T("accounts").unshift(acc); }
    save();
    const tok = makeToken("invite", email);
    mail("invite", email, f.name.split(" ")[0], { hours: policy().inviteHours || 72, link: "#/activate/" + tok }, f.who);
    fact(f.who || "Vilayvanh C.", "auth.invited", email + " · role " + scopes[0] + " · " + (f.emp || "—"));
    if (window.DATA) DATA.pulse();
    return { ok: true, acc };
  }
  function resend(email, who) {
    const acc = account(email);
    if (!acc) return false;
    const tok = makeToken("invite", acc.email);
    mail("invite", acc.email, acc.name.split(" ")[0], { hours: policy().inviteHours || 72, link: "#/activate/" + tok }, who);
    fact(who || "console", "auth.invite_resent", acc.email);
    if (window.DATA) DATA.pulse();
    return true;
  }
  function accessOff(email, who, reason) {
    const acc = account(email);
    if (!acc) return false;
    acc.status = "disabled";
    const n = revokeAllFor(acc.email);
    save();
    mail("revoked", acc.email, acc.name.split(" ")[0], { reason: reason || "switched off by HR" }, who);
    fact(who || "Vilayvanh C.", "auth.access_revoked", acc.email + (n ? " · " + n + " session(s) revoked" : ""));
    if (window.DATA) DATA.pulse();
    return true;
  }
  function unlock(email, who) {
    const acc = account(email);
    if (!acc) return false;
    acc.lockedUntil = 0; acc.fails = 0; save();
    fact(who || "console", "auth.unlocked", acc.email);
    if (window.DATA) DATA.pulse();
    return true;
  }
  function forceReset(email, who) {
    const acc = account(email);
    if (!acc) return false;
    const tok = makeToken("reset", acc.email);
    mail("reset_request", acc.email, acc.name.split(" ")[0], { mins: policy().resetMins || 30, link: "#/reset/" + tok }, who);
    fact(who || "console", "auth.reset_requested", acc.email + " · by admin");
    if (window.DATA) DATA.pulse();
    return true;
  }
  // offboarding revokes the door key with the desk (called by the People cell)
  function onOffboard(empId, who) {
    const acc = byEmp(empId);
    if (acc && acc.status !== "disabled") accessOff(acc.email, who || "system", "offboarded — exit checklist");
  }

  /* ---------- activation + self-reset (local passwords only) ---------- */
  function setPassword(acc, pw) { acc.hash = hash(acc.email, pw); acc.fails = 0; acc.lockedUntil = 0; }
  function activate(tokId, pw, pw2) {
    const v = token(tokId);
    if (!v.ok) return { ok: false, msg: v.why === "expired" ? "This activation link expired (72 h) — ask HR to resend the invite." : v.why === "used" ? "This link was already used — sign in, or ask HR to resend." : "Unknown activation link." };
    if (v.tk.kind !== "invite") return { ok: false, msg: "Not an activation link." };
    const pc = policyCheck(pw);
    if (!pc.ok) return { ok: false, msg: pc.fails.join(" · ") };
    if (pw !== pw2) return { ok: false, msg: "Passwords don't match." };
    const acc = account(v.tk.email);
    if (!acc) return { ok: false, msg: "Account vanished — re-invite from HR." };
    setPassword(acc, pw);
    acc.status = "active";
    v.tk.used = true;
    save();
    mail("activated", acc.email, acc.name.split(" ")[0], { link: "#/login" });
    fact(acc.name, "auth.activated", acc.email);
    if (window.DATA) DATA.pulse();
    return { ok: true, acc };
  }
  function resetRequest(email) {
    const acc = account(email);
    if (acc && acc.provider && acc.provider !== "local") return { ok: false, code: "directory", msg: "Passwords for this account are managed by your company (" + acc.provider + ") — the portal never resets what it doesn't own." };
    if (acc && acc.status !== "invited" && acc.status !== "disabled") {
      const tok = makeToken("reset", acc.email);
      mail("reset_request", acc.email, acc.name.split(" ")[0], { mins: policy().resetMins || 30, link: "#/reset/" + tok });
      fact("system", "auth.reset_requested", acc.email + " · self-service");
    }
    // same answer either way — the portal never confirms which addresses exist
    return { ok: true, msg: "If that address has an account, a reset link is now in the demo outbox (valid " + (policy().resetMins || 30) + " min)." };
  }
  function resetDo(tokId, pw, pw2) {
    const v = token(tokId);
    if (!v.ok) return { ok: false, msg: v.why === "expired" ? "This reset link expired (30 min) — request a new one from the sign-in page." : v.why === "used" ? "This link was already used — request a new one." : "Unknown reset link." };
    if (v.tk.kind !== "reset") return { ok: false, msg: "Not a reset link." };
    const pc = policyCheck(pw);
    if (!pc.ok) return { ok: false, msg: pc.fails.join(" · ") };
    if (pw !== pw2) return { ok: false, msg: "Passwords don't match." };
    const acc = account(v.tk.email);
    if (!acc) return { ok: false, msg: "Account vanished." };
    setPassword(acc, pw);
    if (acc.status === "locked") acc.status = "active";
    v.tk.used = true;
    save();
    mail("reset_done", acc.email, acc.name.split(" ")[0], {});
    fact(acc.name, "auth.reset_completed", acc.email);
    if (window.DATA) DATA.pulse();
    return { ok: true, acc };
  }
  function changePassword(email, oldPw, newPw) {
    const acc = account(email);
    if (!acc) return { ok: false, msg: "No account." };
    if (hash(acc.email, oldPw) !== acc.hash) return { ok: false, msg: "Current password is wrong." };
    const pc = policyCheck(newPw);
    if (!pc.ok) return { ok: false, msg: pc.fails.join(" · ") };
    setPassword(acc, newPw);
    save();
    mail("reset_done", acc.email, acc.name.split(" ")[0], {});
    fact(acc.name, "auth.password_changed", acc.email + " · self-service");
    return { ok: true };
  }

  /* ---------- adoption numbers — invite funnel · never-logged-in · console KPIs ---------- */
  function stats() {
    const a = accounts();
    const ev = DB.list("db_audit", "events");
    return {
      accounts: a.length,
      active: a.filter(x => x.status === "active").length,
      invited: a.filter(x => x.status === "invited").length,
      disabled: a.filter(x => x.status === "disabled").length,
      locked: a.filter(x => lockRemainMs(x) > 0).length,
      neverLogged: a.filter(x => x.status === "active" && !x.lastLogin).length,
      sessions: sessions().length,
      loginsToday: ev.filter(e => e.act === "auth.login").length,
      failsToday: ev.filter(e => e.act === "auth.login_failed").length,
      lockoutsToday: ev.filter(e => e.act === "auth.lockout").length
    };
  }
  const neverLogged = () => accounts().filter(x => x.status === "active" && !x.lastLogin);
  function funnel() {
    const a = accounts();
    const invitedEver = a.length; // every account began as an invite
    const activated = a.filter(x => x.status !== "invited").length;
    const loggedIn = a.filter(x => !!x.lastLogin).length;
    return { invited: invitedEver, activated, loggedIn };
  }

  /* ---------- scope helpers — one URL, landing from the username ---------- */
  const primaryScope = (scopes) => (scopes && scopes[0]) || "staff";
  const inScope = (persona) => { const s = session(); return !s || s.scopes.includes(persona); };

  /* ---------- demo seed strip (D4 — yes, passwords print; reseed wipes) ---------- */
  const SEEDPW = [
    { persona: "staff", label: "Staff", accounts: [["staff@" + DOMAIN, "staff123"], ["staff2@" + DOMAIN, "staff123"]] },
    { persona: "manager", label: "Manager", accounts: [["manager@" + DOMAIN, "manager123"], ["manager2@" + DOMAIN, "manager123"]] },
    { persona: "hr", label: "HR", accounts: [["hr@" + DOMAIN, "hr123456"], ["hr2@" + DOMAIN, "hr123456"]] },
    { persona: "ceo", label: "CEO", accounts: [["ceo@" + DOMAIN, "ceo123456"], ["ceo2@" + DOMAIN, "ceo123456"]] },
    { persona: "sysadmin", label: "Sys Admin", accounts: [["sysadmin@" + DOMAIN, "sysadmin123"], ["sysadmin2@" + DOMAIN, "sysadmin123"]] }
  ];

  return {
    DOMAIN, hash, policy, policyCheck,
    portalOn, setPortal, flags, flag, roadmap,
    accounts, account, byEmp,
    session, sessions, mySessions, login, lookup, logout, revoke, revokeOthers, lockRemainMs,
    invite, resend, accessOff, unlock, forceReset, onOffboard,
    activate, resetRequest, resetDo, changePassword, token,
    mails, stats, funnel, neverLogged,
    primaryScope, inScope, SEEDPW
  };
})();
