/* ============================================================
   ADEPTIO · v2.4.0.db.auth — portal views + shared auth screens
   - Login / Activate / Reset pages (clean Atelier-Pastel stage,
     no effects): one frame per persona with the demo account and
     password pre-filled — click Sign in, or pick any account the
     HR flow has created (new users appear in the list).
   - Landing stays the persona page (launcher); the wall only
     rises when a persona is entered without a session.
   - Shared builders: My security · Identity console · HR access
     · demo outbox · security roadmap (registry-driven, D1)
   ============================================================ */
window.AUTHV = (function () {
  const { icon, badge, idtag, kpi, card, rowitem, rowlist, table, avatar, bars, esc } = UI;

  /* ================= portal copy — EN · ລາວ ================= */
  const L = {
    en: {
      suite: "Adaptive HR", portal: "One door for every persona", account: "Account", pw: "Password",
      signin: "Sign in", forgot: "Forgot password?", send: "Send reset link",
      strip: "Demo seed passwords (D4 — reseed wipes them)", personaPage: "Persona page",
      activate: "Activate your account", setpw: "Set a password", confirm: "Confirm password", doActivate: "Activate & continue",
      reset: "Set a new password", doReset: "Save new password", outbox: "Demo outbox", toLogin: "Back to sign-in",
      locked: "Locked — try again in", landing: "Username decides the landing — one URL for everyone.",
      pickHint: "Demo credentials are pre-filled — or pick any account created from HR → Access."
    },
    lo: {
      suite: "ລະບົບ HR ປັບຕົວ", portal: "ປະຕູດຽວ ສຳລັບທຸກບົດບາດ", account: "ບັນຊີ", pw: "ລະຫັດຜ່ານ",
      signin: "ເຂົ້າສູ່ລະບົບ", forgot: "ລືມລະຫັດຜ່ານ?", send: "ສົ່ງລິ້ງຣີເຊັດ",
      strip: "ລະຫັດຜ່ານເດໂມ (D4 — reseed ລ້າງອອກ)", personaPage: "ໜ້າບົດບາດ",
      activate: "ເປີດໃຊ້ບັນຊີຂອງທ່ານ", setpw: "ຕັ້ງລະຫັດຜ່ານ", confirm: "ຢືນຢັນລະຫັດຜ່ານ", doActivate: "ເປີດໃຊ້ ແລະ ດຳເນີນຕໍ່",
      reset: "ຕັ້ງລະຫັດຜ່ານໃໝ່", doReset: "ບັນທຶກລະຫັດໃໝ່", outbox: "ກ່ອງເມວເດໂມ", toLogin: "ກັບໄປໜ້າເຂົ້າສູ່ລະບົບ",
      locked: "ຖືກລັອກ — ລອງໃໝ່ໃນ", landing: "ຊື່ຜູ້ໃຊ້ກຳນົດໜ້າທີ່ລົງ — URL ດຽວສຳລັບທຸກຄົນ.",
      pickHint: "ຂໍ້ມູນເດໂມຖືກຕື່ມໄວ້ແລ້ວ — ຫຼື ເລືອກບັນຊີທີ່ສ້າງຈາກ HR → Access."
    }
  };
  const state = { error: "", info: "", mode: "login", lang: "en", focus: "", prefill: null };
  const S = () => L[state.lang] || L.en;

  const ORDER = ["staff", "manager", "hr", "ceo", "sysadmin"];
  const PVARS = {
    staff: "--pc:var(--staff);--pd:var(--staff-d);--pb:var(--staff-bg);--pl:var(--staff-ln)",
    manager: "--pc:var(--mgr);--pd:var(--mgr-d);--pb:var(--mgr-bg);--pl:var(--mgr-ln)",
    hr: "--pc:var(--hr);--pd:var(--hr-d);--pb:var(--hr-bg);--pl:var(--hr-ln)",
    ceo: "--pc:var(--ceo);--pd:var(--ceo-d);--pb:var(--ceo-bg);--pl:var(--ceo-ln)",
    sysadmin: "--pc:var(--sys);--pd:var(--sys-d);--pb:var(--sys-bg);--pl:var(--sys-ln)"
  };

  /* ================= shared bits ================= */
  const statusOf = (a) => AUTH.lockRemainMs(a) > 0 ? "locked" : a.status;
  const stBadge = (a) => {
    const s = statusOf(a);
    return s === "active" ? badge("active") : s === "invited" ? `<span class="badge warn">Invited</span>` : s === "locked" ? `<span class="badge bad">Locked</span>` : `<span class="badge plain">Disabled</span>`;
  };
  const scopeChips = (scopes) => scopes.map(s => `<span class="badge plain scope-${s}">${esc(s)}</span>`).join(" ");
  const mmss = (ms) => { const t2 = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t2 / 60) + ":" + String(t2 % 60).padStart(2, "0"); };

  function meterHTML(pw) {
    const pc = AUTH.policyCheck(pw || "");
    const lv = pw ? pc.score : 0;
    const lbl = !pw ? "min " + pc.minLen + " characters (D3)" : pc.ok ? ["", "okay", "good", "strong", "excellent"][Math.max(1, lv)] : pc.fails[0];
    return `<div class="pw-meter" data-lv="${lv}" data-ok="${pw ? pc.ok : ""}"><i></i><i></i><i></i><i></i><span>${esc(lbl)}</span></div>`;
  }
  if (typeof document !== "undefined") {
    // live policy meter
    document.addEventListener("input", (e) => {
      if (!e.target.matches || !e.target.matches("[data-meter]")) return;
      const m = document.getElementById(e.target.getAttribute("data-meter"));
      if (m) m.outerHTML = `<span id="${e.target.getAttribute("data-meter")}">${meterHTML(e.target.value)}</span>`;
    });
    // persona-frame account picker → auto-fill the printed demo password (D4)
    document.addEventListener("change", (e) => {
      if (!e.target.matches || !e.target.matches("[data-frame-sel]")) return;
      const persona = e.target.getAttribute("data-frame-sel");
      const opt = e.target.selectedOptions && e.target.selectedOptions[0];
      const pwEl = document.getElementById("lp-pw-" + persona);
      if (pwEl) pwEl.value = (opt && opt.getAttribute("data-pw")) || "";
    });
  }

  /* ================= the stage (login · activate · reset) ================= */
  function stage(inner, foot, narrow) {
    return `<div class="login-stage">
      <div class="login-wrap"><div class="login-card ${narrow ? "narrow" : ""} screen-fade">${inner}</div>${foot || ""}</div>
    </div>`;
  }
  function brandHead(sub, backToPersona) {
    return `<div class="lg-head">
      <span class="logo-mark lg">A</span>
      <div><div class="lg-word">Adeptio <span>${esc(S().suite)}</span></div>
      <div class="lg-sub">${esc(sub || S().portal)} · ${esc(DATA.company.name)}</div></div>
      <span class="spacer"></span>
      ${backToPersona ? `<button class="lf-link" data-go="launcher">${icon("chevL")} ${esc(S().personaPage)}</button>` : ""}
      <div class="seg lang sm" role="group" aria-label="Language">
        <button aria-pressed="${state.lang === "en"}" data-act="auth-lang:en">EN</button>
        <button aria-pressed="${state.lang === "lo"}" data-act="auth-lang:lo">ລາວ</button>
      </div>
    </div>`;
  }
  function noteBox() {
    return (state.error ? `<div class="lg-note bad">${icon("alert")}<span>${state.error}</span></div>` : "")
      + (state.info ? `<div class="lg-note ok">${icon("check")}<span>${state.info}</span></div>` : "");
  }
  // lockout countdown rides the error note when the focused account is locked
  function lockNote() {
    const accs = state.focus ? personaAccounts(state.focus) : [];
    const sel = state.prefill && state.prefill.email ? AUTH.account(state.prefill.email) : null;
    const locked = sel && AUTH.lockRemainMs(sel) > 0 ? sel : accs.find(a => AUTH.lockRemainMs(a) > 0);
    if (!locked) return "";
    return `<div class="lg-note bad">${icon("lock")}<span>${esc(locked.email)} — ${esc(S().locked)} <b class="num" id="lk-cd" data-email="${esc(locked.email)}">${mmss(AUTH.lockRemainMs(locked))}</b>, or an admin unlocks it in the console.</span></div>`;
  }
  function personaAccounts(persona) {
    const demo = (AUTH.SEEDPW.find(g => g.persona === persona) || { accounts: [] }).accounts.map(([e]) => e);
    return AUTH.accounts()
      .filter(a => AUTH.primaryScope(a.scopes) === persona && a.status !== "disabled")
      .sort((a, b) => (demo.indexOf(b.email) >= 0 ? 1 : 0) - (demo.indexOf(a.email) >= 0 ? 1 : 0));
  }
  function personaFrame(k) {
    const P = PERSONAS[k];
    const accs = personaAccounts(k);
    const seed = (AUTH.SEEDPW.find(g => g.persona === k) || { accounts: [] }).accounts;
    const pwOf = (email) => { const hit = seed.find(([e]) => e === email); return hit ? hit[1] : ""; };
    const pre = state.prefill && state.prefill.persona === k ? state.prefill.email : null;
    const selEmail = pre && accs.some(a => a.email === pre) ? pre : (accs[0] && accs[0].email) || "";
    const tierLocked = (k === "ceo" || k === "sysadmin") && !DATA.has(k);
    const opts = accs.map(a => `<option value="${esc(a.email)}" data-pw="${esc(pwOf(a.email))}" ${a.email === selEmail ? "selected" : ""}>${esc(a.email)}${a.status === "invited" ? " · invited" : pwOf(a.email) ? "" : " · own password"}</option>`).join("");
    return `<div class="lp-frame ${state.focus === k ? "focus" : ""}" style="${PVARS[k]}">
      <div class="lp-head">
        <span class="swatch">${icon(P.icon)}</span>
        <div><b>${esc(P.label)}</b><span>${esc(P.roleLine)}</span></div>
        ${tierLocked ? `<span class="lp-lock" title="Unlocks at Professional ≤250 — flip the tier below">${icon("lock")} Pro</span>` : ""}
      </div>
      ${accs.length ? `
      <label class="lp-l">${esc(S().account)}</label>
      <select class="input" id="lp-acc-${k}" data-frame-sel="${k}">${opts}</select>
      <label class="lp-l">${esc(S().pw)}</label>
      <input class="input" id="lp-pw-${k}" type="password" value="${esc(pwOf(selEmail))}" placeholder="••••••••" autocomplete="current-password">
      <button class="btn lp-go" data-act="auth-login-p:${k}">${icon("key")} ${esc(S().signin)}</button>`
        : `<p class="small muted" style="margin:6px 0 0">No accounts yet — HR switches access on per person.</p>`}
    </div>`;
  }
  function loginFoot() {
    const ess = DATA.tier() === "essential";
    const on = AUTH.portalOn();
    return `<div class="login-foot">
      <details class="seed-strip"><summary>${icon("key")} ${esc(S().strip)}</summary>
        <div class="seed-grid">${AUTH.SEEDPW.map(g => `<div><b>${esc(g.label)}</b>${g.accounts.map(([em, pw]) => `<div class="mono">${esc(em)} · <span class="pwd">${esc(pw)}</span></div>`).join("")}</div>`).join("")}</div>
        <p class="small muted">It demos architecture, not secrecy — reseed wipes it clean. Stored as salted SHA-256 in db_identity; plain passwords never touch a store or the ledger.</p>
      </details>
      <div class="lf-row">
        <button class="lf-link" data-go="launcher">${icon("grid")} ${esc(S().personaPage)}</button>
        <div class="seg tier sm" role="group" aria-label="License tier">
          <button aria-pressed="${ess}" data-act="set-tier:essential">Essential ≤50</button>
          <button aria-pressed="${!ess}" data-act="set-tier:professional">Pro ≤250</button>
        </div>
        <button class="lf-link" data-act="auth-mode:forgot">${icon("refresh")} ${esc(S().forgot)}</button>
        <button class="lf-link" data-act="auth-mode:outbox">${icon("mail")} ${esc(S().outbox)} <b class="num">${AUTH.mails().length}</b></button>
        <button class="lf-link" data-act="portal-toggle" title="auth_portal — off = persona menu only, on = the portal">${icon("settings")} auth_portal · ${on ? "on" : "off"}</button>
      </div>
      <div class="lf-ver mono">Adeptio Adaptive HR · v2.4.0.db.auth — ${esc(S().landing)}</div>
    </div>`;
  }

  const framesGrid = () => `<div class="lp-grid">${ORDER.map(personaFrame).join("")}</div>`;

  /* landing-page section — the same frames, integrated below the persona cards */
  function landingSection() {
    if (!AUTH.portalOn()) return "";
    const ses = AUTH.session();
    if (ses) {
      const acc = AUTH.account(ses.email) || { email: ses.email, name: ses.name, scopes: ses.scopes };
      const prim = AUTH.primaryScope(ses.scopes);
      return `<section class="landing-auth">
        <div class="la-head"><span class="eyebrow">Signed in · auth_portal</span><h2>${esc(S().portal)}</h2></div>
        <div class="la-session">
          ${avatar(acc.name, 1)}
          <div><b>${esc(acc.name)}</b><div class="mono small muted">${esc(acc.email)}</div></div>
          <span class="lg-scope">${scopeChips(acc.scopes)}</span>
          <span class="spacer"></span>
          <button class="btn" data-go="${prim}/web/home">${icon("chevR")} Open my workspace</button>
          <button class="btn ghost" data-go="${prim}/web/security">${icon("shield")} My security</button>
          <button class="btn danger" data-act="auth-logout">${icon("logout")} Sign out</button>
        </div>
        <p class="small muted" style="margin-top:10px">Personas outside your scopes stay locked above — the username decides the landing. Flip the tier toggle any time to preview locked features.</p>
      </section>`;
    }
    return `<section class="landing-auth">
      <div class="la-head">
        <div><span class="eyebrow">Sign in · ເຂົ້າສູ່ລະບົບ</span><h2>${esc(S().portal)}</h2></div>
        <div class="la-links">
          <button class="lf-link" data-act="auth-goto:forgot">${icon("refresh")} ${esc(S().forgot)}</button>
          <button class="lf-link" data-act="auth-goto:outbox">${icon("mail")} ${esc(S().outbox)} <b class="num">${AUTH.mails().length}</b></button>
        </div>
      </div>
      ${noteBox()}${lockNote()}
      <p class="lp-hint">${esc(S().pickHint)}</p>
      ${framesGrid()}
      <details class="seed-strip" style="margin-top:12px"><summary>${icon("key")} ${esc(S().strip)}</summary>
        <div class="seed-grid">${AUTH.SEEDPW.map(g => `<div><b>${esc(g.label)}</b>${g.accounts.map(([em, pw]) => `<div class="mono">${esc(em)} · <span class="pwd">${esc(pw)}</span></div>`).join("")}</div>`).join("")}</div>
      </details>
    </section>`;
  }

  function loginPage() {
    let body;
    if (state.mode === "outbox") {
      const ms = AUTH.mails();
      body = `${brandHead(S().outbox, true)}
        ${noteBox()}
        <div class="lg-outbox">${ms.length ? ms.map(m => `
          <div class="mailrow">
            <span class="ric n">${icon("mail")}</span>
            <div class="rmain"><div class="rt">${esc(state.lang === "lo" ? (m.subjectLo || m.subject) : m.subject)}</div>
            <div class="rs mono">${esc(m.to)} · ${esc(m.ts)} · ${esc(m.kind)}</div></div>
            ${m.link ? `<button class="btn xs" data-go="${esc(m.link.replace(/^#\//, ""))}">${icon("chevR")} Open link</button>` : ""}
          </div>`).join("") : `<p class="small muted">No mail yet — invites, activation, reset and lockout mails land here.</p>`}
        </div>
        <button class="btn ghost" style="width:100%" data-act="auth-mode:login">${icon("chevL")} ${esc(S().toLogin)}</button>`;
      return stage(body, loginFoot(), true);
    }
    if (state.mode === "forgot") {
      body = `${brandHead(S().forgot, true)}
        ${noteBox()}
        <div class="field"><label>Work e-mail</label><input class="input lg" id="fg-email" type="email" value="${esc((state.prefill && state.prefill.email) || "")}" placeholder="name@${AUTH.DOMAIN}"></div>
        <button class="btn lgbtn" data-act="auth-reset-request">${icon("send")} ${esc(S().send)}</button>
        <div class="lg-links"><button class="lf-link" data-act="auth-mode:login">${icon("chevL")} ${esc(S().toLogin)}</button>
        <button class="lf-link" data-act="auth-mode:outbox">${icon("mail")} ${esc(S().outbox)}</button></div>
        <p class="small muted" style="margin-top:10px">Local passwords reset here; directory accounts (LDAP/SSO, roadmap) see a "managed by your company" pointer — the portal never resets what it doesn't own.</p>`;
      return stage(body, loginFoot(), true);
    }
    body = `${brandHead(null, true)}
      ${noteBox()}${lockNote()}
      <p class="lp-hint">${esc(S().pickHint)}</p>
      ${framesGrid()}`;
    return stage(body, loginFoot());
  }

  function activatePage(tok) {
    const v = AUTH.token(tok);
    let body;
    if (!v.ok || v.tk.kind !== "invite") {
      body = `${brandHead(S().activate, true)}
        <div class="lg-note bad">${icon("alert")}<span>${v.why === "expired" ? "This activation link expired (72 h). Ask HR to resend the invite — the pending list has a one-click resend." : v.why === "used" ? "This link was already used. Sign in instead, or ask HR to resend." : "Unknown activation link — open the latest invite from the demo outbox."}</span></div>
        <button class="btn lgbtn" data-go="login">${esc(S().toLogin)}</button>`;
    } else {
      const acc = AUTH.account(v.tk.email);
      body = `${brandHead(S().activate, true)}
        <div class="lg-who">${avatar(acc.name, 1)}<div><b>${esc(acc.name)}</b><div class="mono small muted">${esc(acc.email)}</div></div><span class="lg-scope">${scopeChips(acc.scopes)}</span></div>
        ${noteBox()}
        <div class="field"><label>${esc(S().setpw)}</label><input class="input lg" id="ac-pw" type="password" data-meter="ac-meter" placeholder="min ${AUTH.policy().minLen}" autocomplete="new-password"><span id="ac-meter">${meterHTML("")}</span></div>
        <div class="field"><label>${esc(S().confirm)}</label><input class="input lg" id="ac-pw2" type="password" placeholder="••••••••" autocomplete="new-password"></div>
        <button class="btn lgbtn" data-act="auth-activate:${esc(tok)}">${icon("check")} ${esc(S().doActivate)}</button>
        <p class="small muted" style="margin-top:10px">Policy (D3): min ${AUTH.policy().minLen} characters · no forced expiry · lockout ${AUTH.policy().lockoutFails} fails / ${AUTH.policy().lockoutMins} min.</p>`;
    }
    return stage(body, loginFoot(), true);
  }

  function resetPage(tok) {
    const v = AUTH.token(tok);
    let body;
    if (!v.ok || v.tk.kind !== "reset") {
      body = `${brandHead(S().reset, true)}
        <div class="lg-note bad">${icon("alert")}<span>${v.why === "expired" ? "This reset link expired (30 min) — request a fresh one from the sign-in page." : v.why === "used" ? "This link was already used — request a new one." : "Unknown reset link — open the latest mail in the demo outbox."}</span></div>
        <button class="btn lgbtn" data-go="login">${esc(S().toLogin)}</button>`;
    } else {
      const acc = AUTH.account(v.tk.email);
      body = `${brandHead(S().reset, true)}
        <div class="lg-who">${avatar(acc.name, 1)}<div><b>${esc(acc.name)}</b><div class="mono small muted">${esc(acc.email)}</div></div></div>
        ${noteBox()}
        <div class="field"><label>${esc(S().setpw)}</label><input class="input lg" id="rs-pw" type="password" data-meter="rs-meter" placeholder="min ${AUTH.policy().minLen}" autocomplete="new-password"><span id="rs-meter">${meterHTML("")}</span></div>
        <div class="field"><label>${esc(S().confirm)}</label><input class="input lg" id="rs-pw2" type="password" autocomplete="new-password"></div>
        <button class="btn lgbtn" data-act="auth-reset-do:${esc(tok)}">${icon("check")} ${esc(S().doReset)}</button>`;
    }
    return stage(body, loginFoot(), true);
  }

  /* mount/unmount — lockout countdown + autofocus live outside the render cycle */
  let lockTimer = null;
  function mountPortal() {
    clearInterval(lockTimer);
    const cd = typeof document !== "undefined" && document.getElementById("lk-cd");
    if (cd) {
      const acc = AUTH.account(cd.getAttribute("data-email"));
      lockTimer = setInterval(() => {
        const el = document.getElementById("lk-cd");
        if (!el || !acc) { clearInterval(lockTimer); return; }
        const rem = AUTH.lockRemainMs(acc);
        el.textContent = mmss(rem);
        if (rem <= 0) { clearInterval(lockTimer); state.error = ""; DATA.pulse(); }
      }, 1000);
    }
    const f = typeof document !== "undefined" && (document.getElementById("ac-pw") || document.getElementById("rs-pw") || document.getElementById("fg-email"));
    if (f) setTimeout(() => f.focus(), 60);
  }
  function unmountPortal() { clearInterval(lockTimer); }

  /* ================= shared app screens ================= */

  // Security menu — registry-driven greyed rows (D1: LDAP/RADIUS Pro · SSO/SCIM Ent)
  function roadmapCard() {
    const rows = AUTH.roadmap().map(f => {
      if (f.state === "live") return rowitem({ icon: "check", title: f.label, sub: f.note, side: badge("live") });
      const tierBadge = f.tier === "professional" ? UI.lockTag("Professional · ≤250") : f.tier === "enterprise" ? UI.lockTag("Enterprise · ≤600") : `<span class="badge plain">roadmap</span>`;
      return `<div class="rowitem row-locked"><span class="ric n">${icon("lock")}</span><div class="rmain"><div class="rt">${esc(f.label)}</div><div class="rs">${esc(f.note || "")}</div></div><div class="rside">${tierBadge}</div></div>`;
    });
    return card("Sign-in methods — greyed, never hidden", rowlist(rows) + `<p class="small muted" style="margin-top:10px">Identity ≠ credential: one account per person, e-mail is the username; ways-to-prove are plug-ins. Rows read from db_platform.flags — the demo sells the future without building it.</p>`, { icon: "key" });
  }
  function policyCard() {
    const p = AUTH.policy();
    return card("Password & session policy (D3 — adopted)", table([{ h: "Rule" }, { h: "Value" }], [
      { cells: ["Minimum length", `<b class="num">${p.minLen}</b> characters <span class="small muted">— the one change from the NIST-shaped proposal</span>`] },
      { cells: ["Forced expiry", "none"] },
      { cells: ["Lockout", `<span class="num">${p.lockoutFails}</span> fails → <span class="num">${p.lockoutMins}</span> min`] },
      { cells: ["Idle session", `<span class="num">${p.idleMins}</span> min`] },
      { cells: ["Invite link", `<span class="num">${p.inviteHours}</span> h`] },
      { cells: ["Reset link", `<span class="num">${p.resetMins}</span> min`] },
      { cells: ["Directory outage", esc(p.directoryOutage || "fail-closed + break-glass")] }
    ]) + `<p class="small muted" style="margin-top:8px">Stored in db_identity.policies — tenants tune later ${UI.lockTag("Professional · ≤250")}. Never logged anywhere: passwords, tokens, secrets, session values.</p>`, { icon: "shield" });
  }

  // My security — every persona gets it (change password · my sessions · revoke)
  function mySecurity(personaKey) {
    const ses = AUTH.session();
    if (!AUTH.portalOn()) {
      return card("Portal flag is off", `<p class="small muted">auth_portal is currently <b>off</b> — the persona menu stands in for login, so there is no live session to manage. Flip the flag from the sign-in page footer or the identity console to walk the full auth demo.</p>`, { icon: "key" });
    }
    if (!ses) return card("Not signed in", `<p class="small muted">No live session — open the portal to sign in.</p><button class="btn" data-go="login">${icon("key")} Go to sign-in</button>`, { icon: "lock" });
    const acc = AUTH.account(ses.email) || { email: ses.email, name: ses.name, scopes: ses.scopes, status: "active" };
    const mine = AUTH.mySessions();
    return `
    <div class="grid cols-3">
      <div style="display:flex;flex-direction:column;gap:16px" class="span-2">
        ${card("Account", `<div class="lg-who" style="margin:0 0 12px">${avatar(acc.name, 1)}<div><b>${esc(acc.name)}</b><div class="mono small muted">${esc(acc.email)}</div></div><span class="lg-scope">${scopeChips(acc.scopes)}</span></div>` +
        table([{ h: "Field" }, { h: "Value" }], [
          { cells: ["Status", stBadge(acc)] },
          { cells: ["Person", acc.emp ? idtag(acc.emp) : "—"] },
          { cells: ["Last sign-in", acc.lastLogin || "—"] },
          { cells: ["Credential", "local password · salted SHA-256 (db_identity)"] }
        ]), { icon: "user" })}
        ${card("My sessions", (mine.length ? table([{ h: "Session" }, { h: "Device" }, { h: "Started" }, { h: "", r: 1 }],
          mine.map(s => ({ cells: [`<span class="mono small">${s.id}</span>${s.id === ses.id ? ` <span class="badge ok plain">this one</span>` : ""}`, esc(s.device), esc(s.started), s.id === ses.id ? "" : `<button class="btn xs danger" data-act="auth-revoke:${s.id}">Revoke</button>`] }))) : "") +
          `<div style="display:flex;gap:9px;margin-top:10px;flex-wrap:wrap">
            <button class="btn sm ghost" data-act="auth-revoke-others">${icon("x")} Revoke all other sessions</button>
            <button class="btn sm danger" data-act="auth-logout">${icon("logout")} Sign out</button>
          </div><p class="small muted" style="margin-top:10px">Sessions idle out after ${AUTH.policy().idleMins} min and are <b>never restored</b> from backups (sensitive custody).</p>`, { icon: "globe" })}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${card("Change password", `
          <div class="field"><label>Current password</label><input class="input" id="sec-old" type="password" autocomplete="current-password"></div>
          <div class="field"><label>New password</label><input class="input" id="sec-new" type="password" data-meter="sec-meter" autocomplete="new-password"><span id="sec-meter">${meterHTML("")}</span></div>
          <button class="btn" style="width:100%" data-act="auth-pw-change">${icon("key")} Update password</button>
          <p class="small muted" style="margin-top:8px">Min ${AUTH.policy().minLen} characters (D3) · a confirmation mail lands in the outbox.</p>`, { icon: "key" })}
        ${card("Safety floor", `<p class="small muted">Lockout ${AUTH.policy().lockoutFails}/${AUTH.policy().lockoutMins} min · self-reset for local passwords · every auth event is a fact on db_audit · break-glass admin stays out of band. ${personaKey === "sysadmin" ? "Console actions live in Identity console." : "Lost access? HR or the Sys Admin can unlock / force-reset from the console."}</p>`, { icon: "shield" })}
      </div>
    </div>`;
  }

  // Identity console — Sys Admin (HR doubles on Essential)
  function consoleTable(filter) {
    const f = filter || "all";
    const rows = AUTH.accounts().filter(a => f === "all" ? true : statusOf(a) === f);
    return table(
      [{ h: "Account" }, { h: "Person" }, { h: "Role" }, { h: "Status" }, { h: "Last sign-in" }, { h: "Actions", r: 1 }],
      rows.map(a => {
        const s = statusOf(a);
        const act = s === "invited" ? `<button class="btn xs soft" data-act="auth-resend:${a.email}">Resend</button><button class="btn xs ghost" data-act="auth-revoke-access:${a.email}">Revoke</button>`
          : s === "locked" ? `<button class="btn xs soft" data-act="auth-unlock:${a.email}">Unlock</button><button class="btn xs ghost" data-act="auth-force-reset:${a.email}">Force reset</button>`
            : s === "disabled" ? `<button class="btn xs soft" data-act="auth-reinvite:${a.email}">Re-invite</button>`
              : `<button class="btn xs ghost" data-act="auth-force-reset:${a.email}">Force reset</button><button class="btn xs danger" data-act="auth-revoke-access:${a.email}">Revoke</button>`;
        return {
          cells: [
            `<div style="display:flex;align-items:center;gap:9px">${avatar(a.name)}<div><div class="strong">${esc(a.name)}</div><div class="mono small muted">${esc(a.email)}</div></div></div>`,
            a.emp ? idtag(a.emp) : "—",
            scopeChips(a.scopes),
            stBadge(a),
            a.lastLogin ? `<span class="small">${esc(a.lastLogin)}</span>` : `<span class="small muted">never</span>`,
            `<div class="row-acts">${act}</div>`
          ]
        };
      })
    );
  }
  function identityBody(filter) {
    const st = AUTH.stats();
    const f = ["all", "active", "invited", "locked", "disabled"].includes(filter) ? filter : "all";
    const chips = ["all", "active", "invited", "locked", "disabled"].map(x =>
      `<button class="choice" ${x === f ? 'aria-pressed="true"' : ""} data-go="sysadmin/web/identity${x === "all" ? "" : "/" + x}">${x[0].toUpperCase() + x.slice(1)}</button>`).join("");
    const ses = AUTH.sessions();
    return `
    <div class="grid cols-4">
      ${kpi("Accounts", `${st.active} / ${st.accounts}`, `${st.invited} invited · ${st.disabled} off`, { hero: 1 })}
      ${kpi("Live sessions", String(st.sessions), "idle 30 min · revocable")}
      ${kpi("Sign-ins (ledger)", String(st.loginsToday), st.failsToday + " failed")}
      ${kpi("Lockouts", String(st.lockoutsToday), st.locked + " locked right now")}
    </div>
    ${card("Directory — status-filtered, inline fixes", `<div class="choice-row" style="margin-bottom:12px">${chips}</div>` + consoleTable(f), { icon: "users" })}
    <div class="grid cols-3">
      <div class="span-2" style="display:flex;flex-direction:column;gap:16px">
        ${card("Live sessions", ses.length ? table([{ h: "Session" }, { h: "Account" }, { h: "Started" }, { h: "", r: 1 }],
          ses.map(s => ({ cells: [`<span class="mono small">${s.id}</span>`, `<span class="small">${esc(s.email)}</span>`, esc(s.started), `<button class="btn xs danger" data-act="auth-revoke:${s.id}">Revoke</button>`] })))
          : UI.empty("globe", "No live sessions", "Sign in from the portal and it appears here"), { icon: "globe" })}
        ${roadmapCard()}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${card("Portal flag — auth_portal", `<p class="small muted" style="margin-bottom:10px"><b>${AUTH.portalOn() ? "On — personas open through the portal." : "Off — persona menu stands in for login."}</b> One flag, kernel-owned (db_platform.flags); the persona page stays the landing either way.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn sm ${AUTH.portalOn() ? "ghost" : "soft"}" data-act="portal-toggle">${icon("key")} Flip ${AUTH.portalOn() ? "off" : "on"}</button>
            <button class="btn sm ghost" data-go="sysadmin/web/outbox">${icon("mail")} Demo outbox</button>
          </div>`, { icon: "settings" })}
        ${policyCard()}
      </div>
    </div>`;
  }

  // HR — Access & invites (the option on every person + adoption tiles)
  function accessBody() {
    const st = AUTH.stats();
    const fn = AUTH.funnel();
    const invited = AUTH.accounts().filter(a => a.status === "invited");
    const never = AUTH.neverLogged();
    const noAccess = DATA.employees.filter(e => !AUTH.byEmp(e.id)).slice(0, 8);
    const ess = DATA.tier() === "essential";
    return `
    <div class="grid cols-4">
      ${kpi("With access", `${st.active + st.invited}`, `of ${DATA.employees.length + 2} people · option per person`, { hero: 1 })}
      ${kpi("Pending invites", String(st.invited), "72 h links · resend below")}
      ${kpi("Never signed in", String(st.neverLogged), "the adoption number")}
      ${kpi("Locked", String(st.locked), st.lockoutsToday + " lockout(s) on the ledger")}
    </div>
    <div class="grid cols-3" style="margin-top:16px">
      <div class="span-2" style="display:flex;flex-direction:column;gap:16px">
        ${card("Pending access — invited, not yet activated", invited.length ? rowlist(invited.map(a => rowitem({
      avatar: a.name, title: esc(a.name) + ` <span class="mono small muted">${esc(a.email)}</span>`, sub: "invited " + esc(a.created) + " · link valid " + AUTH.policy().inviteHours + " h · role " + esc(a.scopes[0]),
      side: `<div class="row-acts"><button class="btn xs soft" data-act="auth-resend:${a.email}">Resend</button><button class="btn xs ghost" data-act="auth-revoke-access:${a.email}">Revoke</button></div>`
    }))) : UI.empty("check", "No pending invites", "Switch access on from any person page"), { icon: "send", badge: `<span class="badge warn plain">${invited.length}</span>` })}
        ${card("Never signed in — nudge or shrug", never.length ? rowlist(never.map(a => rowitem({
      avatar: a.name, title: esc(a.name), sub: esc(a.email) + " · activated, zero sign-ins", side: a.emp ? `<button class="btn xs ghost" data-go="hr/web/person/${a.emp}">Open person</button>` : ""
    }))) : UI.empty("check", "Everyone with access has signed in", "Adoption: 100%"), { icon: "bell" })}
        ${ess ? card("Identity console — HR doubles on Essential", consoleTable("all") + `<p class="small muted" style="margin-top:10px">On Essential one trained HR person runs access from here; Professional adds the separate Sys Admin persona — that is the upgrade pitch.</p>`, { icon: "key" }) :
        card("Console moved", `<p class="small muted">On Professional the Sys Admin persona owns the identity console (status filters, unlock, force-reset, sessions). HR keeps the access option on every person and this adoption view.</p><button class="btn sm ghost" data-go="sysadmin/web/identity">${icon("chevR")} Open identity console</button>`, { icon: "key" })}
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        ${card("Invite funnel", bars([
      { l: "Invited", v: fn.invited, vt: String(fn.invited) },
      { l: "Activated", v: fn.activated, vt: String(fn.activated) },
      { l: "Signed in", v: fn.loggedIn, vt: String(fn.loggedIn), tone: fn.loggedIn < fn.activated ? "warn" : undefined }
    ], { values: 1, h: 130 }) + `<p class="small muted" style="margin-top:6px">invite → activate → first sign-in. Auth facts flow ledger → projector → tiles, like every other number.</p>`, { icon: "chart" })}
        ${card("People without access", noAccess.length ? rowlist(noAccess.map(e => rowitem({
      avatar: e.name, title: esc(e.name), sub: e.id + " · " + esc(e.pos), side: `<button class="btn xs soft" data-go="hr/web/person/${e.id}">Switch on</button>`
    }))) + `<p class="small muted" style="margin-top:8px">No access ≠ no employee — the record exists either way; e-mail becomes required only the moment access is switched on.</p>` : UI.empty("check", "Everyone has access", ""), { icon: "users" })}
      </div>
    </div>`;
  }

  // person page card — the Access option on every person (HR)
  function personAccessCard(p) {
    const acc = AUTH.byEmp(p.id);
    const suggest = (p.name.split(" ")[0] || "user").toLowerCase().replace(/[^a-z0-9]/g, "") + "@" + AUTH.DOMAIN;
    if (!acc || acc.status === "disabled") {
      return card("Access — portal option", `
        ${acc ? `<p class="small" style="margin-bottom:8px">${stBadge(acc)} <span class="muted">previous account ${esc(acc.email)} was revoked — re-invite below.</span></p>` : ""}
        <div class="field"><label>Work e-mail <span class="muted">(required the moment access is on)</span></label><input class="input" id="ax-email" type="email" value="${acc ? esc(acc.email) : ""}" placeholder="${esc(suggest)}"></div>
        <div class="field"><label>Portal role — from the persona</label><select class="input" id="ax-scope">
          ${["staff", "manager", "hr", "ceo", "sysadmin"].map(s => `<option value="${s}">${s}${s === "manager" || s === "hr" ? " (+ staff scope)" : ""}</option>`).join("")}
        </select></div>
        <button class="btn" style="width:100%" data-act="auth-invite:${p.id}">${icon("send")} Switch on access — send invite</button>
        <p class="small muted" style="margin-top:8px">Creates the account in db_identity (store 11), drops a bilingual invite in the demo outbox (72 h link) and appends auth.invited to the ledger. Once activated, the account appears in its persona frame on the sign-in page.</p>`, { icon: "key" });
    }
    const s = statusOf(acc);
    return card("Access — portal option", `
      <div class="lg-who" style="margin:0 0 10px">${avatar(acc.name)}<div><div class="mono small">${esc(acc.email)}</div><div class="small muted">role ${esc(acc.scopes.join(" + "))} · ${acc.lastLogin ? "last sign-in " + esc(acc.lastLogin) : "never signed in"}</div></div><span style="margin-left:auto">${stBadge(acc)}</span></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${s === "invited" ? `<button class="btn soft" data-act="auth-resend:${acc.email}">${icon("send")} Resend invite (new 72 h link)</button>` : ""}
        ${s === "locked" ? `<button class="btn soft" data-act="auth-unlock:${acc.email}">${icon("key")} Unlock now</button>` : ""}
        ${s === "active" ? `<button class="btn ghost" data-act="auth-force-reset:${acc.email}">${icon("refresh")} Force password reset</button>` : ""}
        <button class="btn danger" data-act="auth-revoke-access:${acc.email}">${icon("x")} Switch off access</button>
      </div>
      <p class="small muted" style="margin-top:8px">Switching off revokes every live session and mails the person — the employee record stays. Offboarding does this automatically.</p>`, { icon: "key" });
  }

  // demo outbox — a reader over the db_comms sent log (kind: mail)
  function outboxBody(prefix, selectedId) {
    const ms = AUTH.mails();
    const sel = ms.find(m => m.id === selectedId) || null;
    const kindIcon = { invite: "send", activated: "check", reset_request: "refresh", reset_done: "key", lockout: "lock", revoked: "x" };
    const list = card("Outbox — newest first", ms.length ? rowlist(ms.map(m => rowitem({
      icon: kindIcon[m.kind] || "mail", neutral: m.kind === "revoked",
      title: esc(m.subject), sub: `<span class="mono">${esc(m.to)}</span> · ${esc(m.ts)} · ${esc(m.kind)}`,
      side: icon("chevR"), go: `${prefix}/outbox/${m.id}`
    }))) : UI.empty("mail", "No mail yet", "Invite someone from a person page — the mail lands here"), { icon: "mail", badge: `<span class="badge plain">${ms.length}</span>` });
    const view = sel ? card("", `
      <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:6px">${idtag(sel.id)}<span class="badge plain">${esc(sel.kind)}</span></div>
      <h3 style="font-size:15.5px;margin:4px 0 2px">${esc(sel.subject)}</h3>
      <div class="small muted" style="margin-bottom:10px">to <span class="mono">${esc(sel.to)}</span> · ${esc(sel.ts)} · EN below, ລາວ after</div>
      <pre class="mailbody">${esc(sel.body)}</pre>
      <pre class="mailbody lo">${esc(sel.bodyLo || "")}</pre>
      ${sel.link ? `<button class="btn" style="width:100%;margin-top:10px" data-go="${esc(sel.link.replace(/^#\//, ""))}">${icon("chevR")} Open the link in this app</button>` : ""}`) : "";
    return `<div class="grid cols-4" style="margin-bottom:0">
      ${kpi("Mails", String(ms.length), "6 bilingual templates · EN + ລາວ", { hero: 1 })}
      ${kpi("Invites", String(ms.filter(m => m.kind === "invite").length), "72 h activation links")}
      ${kpi("Resets", String(ms.filter(m => m.kind.startsWith("reset")).length), "30 min links")}
      ${kpi("Lockouts", String(ms.filter(m => m.kind === "lockout").length), "5 fails / 15 min")}
    </div>
    <div class="grid ${sel ? "cols-2" : "cols-1"}" style="margin-top:16px">${list}${view}</div>
    ${card("Why an outbox", `<p class="small muted">The demo is file:// safe — no SMTP, no backend. Every auth mail is a real row on the db_comms sent log (the comms cell's store), so the flow is honest: invite → outbox → activation link → portal. Per-tenant mail domains arrive at ${UI.lockTag("Professional · ≤250")}.</p>`, { icon: "sparkle" })}`;
  }

  return {
    state, loginPage, activatePage, resetPage, mountPortal, unmountPortal, landingSection,
    mySecurity, identityBody, accessBody, personAccessCard, outboxBody,
    roadmapCard, policyCard, meterHTML
  };
})();
