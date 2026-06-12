# Adeptio Adaptive HR — Platform UI · v2.4.0.db.auth

> **v2.4.0.db.auth — the platform gets its front door.** The v2.3.2.db demo now implements **Blueprint v2.5 §3 (the Auth demo)** end-to-end, inside the same static app: a **clean Atelier-Pastel login portal** (one pre-filled frame per persona; the persona page stays the landing), **`db_identity` as store 11** (accounts · sessions · tokens · policies, on the ladder with *sensitive custody* — sessions/tokens are never restored and never leave the device), an **Access option on every person**, invites/activation/reset/lockout flowing through a viewable **demo outbox** (bilingual EN · ລາວ mails on the `db_comms` sent log), an **identity console**, **My security** on every persona, and the **Security roadmap menu** — greyed, never hidden, registry-driven.
>
> Decisions baked in: **D1 yes** — tier line static on every tier; LDAP/RADIUS badges **Professional ≤250**, SSO/SCIM badge **Enterprise ≤600**. **D2 yes** — directory outage is fail-closed + break-glass (recorded in policy; matters when LDAP lands). **D3** — password policy adopted with **min length 8** (no forced expiry · lockout 5/15 min · idle 30 min · invite 72 h · reset 30 min). **D4 yes** — seed passwords print on the portal strip; **two demo accounts per persona**.
>
> Everything from v2.3.2.db is carried forward unchanged underneath: 11 split stores, one writer each, persisted per tenant × store, backup ladder, drills, replay, Turso hybrid sync, tier toggle (R4 — flags, not forks).

**One flag rules it**: `auth_portal` (kernel, `db_platform.flags`). **On** (default) → the persona page still lands first, but entering a persona raises the sign-in wall; the username decides the landing; persona chips become the scope switcher. **Off** → yesterday's persona menu, no wall anywhere. Flip it from the login footer or the identity console.

## Demo accounts (D4 — printed on the portal strip too)

| Persona | Accounts | Password | Scopes |
|---|---|---|---|
| Staff | `staff@phoungern.la` · `staff2@phoungern.la` | `staff123` | staff |
| Manager | `manager@phoungern.la` · `manager2@phoungern.la` | `manager123` | manager + staff |
| HR | `hr@phoungern.la` · `hr2@phoungern.la` | `hr123456` | hr + staff |
| CEO | `ceo@phoungern.la` · `ceo2@phoungern.la` | `ceo123456` | ceo *(Pro tier)* |
| Sys Admin | `sysadmin@phoungern.la` · `sysadmin2@phoungern.la` | `sysadmin123` | sysadmin *(Pro tier — HR doubles on Essential)* |

Plus one invite in flight: `davone@phoungern.la` (pending activation — its 72 h link is sitting in the demo outbox). Passwords are stored as salted SHA-256 in `db_identity`; plain passwords and tokens never touch a store or the audit ledger (never-log list).

## The portal — persona page first, one frame per persona

Opening `index.html` lands on the **persona page** (persona cards, persona menu + tier toggle on top) with the **sign-in section right below the five cards** — signed out you get the five pre-filled frames inline; signed in it becomes a session bar (open workspace · My security · sign out). Entering a persona without a session still raises the full sign-in wall — the same frames on a soft persona-tinted wash:

- **One frame per persona**, demo account and printed password **pre-filled** — one click signs in
- The account list per frame includes **every account created later** through HR → Access (new users appear automatically; pick one and type its own password)
- **← Persona page** link returns to the landing; the wall rises again on the next persona entry
- After sign-in you see **only your own scopes** (chips lock outside them) but the **tier toggle stays** to preview locked features; sign-out returns to the login page

## The auth walk (Blueprint v2.5 §3 — demo ritual)

1. **Portal** — open the app → persona page → enter a persona → its frame is focused with credentials pre-filled (D4); click Sign in. Wrong password ×5 → **15-min lockout with live countdown** + a lockout mail in the outbox.
2. **HR → People → person → Access card** — switch access **on** (e-mail required at that moment, role from the persona) → invite mail lands in the **demo outbox** with a 72 h activation link.
3. **Outbox → open link → Activate** — set a password against the **live policy meter** (min 8, D3) → account flips to active → sign in.
4. **HR → Access & invites** — pending list (resend / revoke), **invite funnel** and **never-signed-in** adoption tiles. On Essential this page also carries the full console (HR doubles); on Pro it points to Sys Admin.
5. **Sys Admin → Identity console** — status-filtered directory, last sign-in, inline **resend / unlock / force-reset / revoke**, live sessions, the **Security roadmap** (greyed rows: LDAP/RADIUS `Pro` · MFA · SSO `Ent` · door · biometrics · SCIM `Ent`) and the `auth_portal` flag.
6. **Any persona → My security** — change password, see sessions, revoke others, sign out.
7. **HR → person → Offboard** — the account is disabled, sessions revoked, mail sent: the door key goes with the desk.
8. **Sys Admin → Database studio → `db_identity`** — store 11 on the ladder; back it up, restore it: accounts come back, **sessions/tokens never do** (custody fact lands on the ledger).

`?tier=professional` still sets the tier flag at load; `ceo@`/`sysadmin@` sign-ins on Essential demo the tier pitch instead of landing.

## Run / deploy

Local: double-click `index.html` (file:// safe — data persists per browser). GitHub Pages: push the folder, Settings → Pages → deploy from branch → root (`.nojekyll` included).

Verify:

```bash
node tools/smoke.js .        # renders 190 screens both tiers + data-layer integrity
node tools/auth-smoke.js .   # invite → activate → login ×10 → reset → lockout → unlock
                             # → custody → offboard-revokes-session → flag, both tiers
node tools/portal-smoke.js . # boots the whole app in a mini-DOM and clicks the flow:
                             # persona-page landing → wall on entry → frame login →
                             # scope bounce → security/outbox/console → logout→login
node tools/sync-smoke.js .   # Turso layer without a network
```

## Cloud sync (Turso) — optional, hybrid offline-first

Same engine as v2.3.2.db (fill `js/turso-config.js`; tables auto-create — `identity_accounts` etc. join the group). **Custody extension**: `db_identity` pushes accounts + policies only; **live sessions & tokens never leave the device**, and a pull never overwrites them.

## The database, in 60 seconds

| Store | Layer | Holds | Writer |
|---|---|---|---|
| `db_people` | L-OP | employees · divisions | People cell |
| `db_time` | L-OP | punches | Time cell |
| `db_leave` | L-OP | leave types · balances | Leave cell |
| `db_workflow` | L-OP | the shared-ID request ledger (LV/OT/EX/TC) | Workflow cell |
| `db_payroll` | L-OP | payslips · pay runs | Payroll cell |
| `db_comms` | L-OP | templates · channels · sent log (incl. **auth mails**) | Comms cell |
| `db_docs` | L-OP+L-CU | document metadata (Growth+ — lazily provisioned) | Docs cell |
| `db_audit` | L-OP→L-CU | append-only facts (now incl. `auth.*`) | Event bus |
| `dw_reports` | L-DR | org snapshots · series (derived — rebuilds by replay) | Projector |
| `db_platform` | global | placement registry · backup policies · drills · **flags** (`auth_portal` + roadmap rows) | Kernel |
| **`db_identity`** | **L-OP** | **accounts · sessions · tokens · policies — store 11, sensitive custody** | **Identity cell** |

## Structure

```
index.html              entry — loads everything, no bundler
css/tokens.css          design tokens (Atelier Pastel + persona accents)
css/app.css             shell styles (+ clean-pastel portal styles at the end)
js/i18n.js              EN live · ລາວ staged (portal + auth mails ship bilingual already)
js/ui.js                icon set, components, hand-rolled SVG charts
js/db.js                ★ the data layer — 11 stores, persistence, CRUD, audit facts,
                          backup ladder (sensitive custody for store 11), scheduler, drills, replay
js/auth.js              ★ the Identity cell — sync SHA-256, login/lockout/sessions,
                          invites & tokens, bilingual mail templates, stats, flags (node-safe)
js/data.js              DATA — thin lens over DB (offboard now revokes access)
js/screens/authviews.js ★ portal pages (persona frames) + console/access/outbox/My-security builders
js/screens/dbviews.js   shared DB-management views
js/screens/staff.js     Staff — ochre        (+ My security)
js/screens/manager.js   Manager — sage       (+ My security)
js/screens/hr.js        HR — blue            (+ Access & invites · Demo outbox · My security)
js/screens/ceo.js       CEO — plum           (+ My security)
js/screens/sysadmin.js  System Admin — teal  (+ Identity console · Demo outbox · My security)
js/app.js               router (portal guard · scope rule · landing-from-username), shells, auth actions
tools/smoke.js          structural smoke — 190 screens, both tiers
tools/auth-smoke.js     the §3 "Done =" walk, plus custody & never-log checks
```

Routing, menu depth, the mobile contract and persona boundaries are otherwise unchanged from v2.3.2.db — superseded blueprints live in `Backups/`.
