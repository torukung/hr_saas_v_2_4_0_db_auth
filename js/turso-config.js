/* ============================================================
   ADEPTIO · v2.4.0.db.auth — Turso cloud-sync configuration
   Leave url/token empty → the app runs exactly as before
   (localStorage only, no network calls, no badge).
   Fill both → js/turso-sync.js goes live: hybrid offline-first,
   localStorage stays the working cache, Turso is the cloud copy.

   v2.4.0 syncs to its OWN database (adeptio-hr-v240, provisioned
   2026-06-12) — deliberately separate from adeptio-hr-v232, which
   the deployed v2.3.2 app still uses. Sharing one DB would make the
   two builds overwrite each other (seed v6 vs v7) and would land
   db_identity in the old database.
   Custody note: even with sync on, live sessions & tokens never
   leave the device (see js/turso-sync.js).
   ⚠ Demo trade-off: this token ships to every visitor's browser.
   It is scoped to this one database only. For production, move
   writes behind an edge function (see README §Cloud sync).
   ============================================================ */
window.TURSO_CONFIG = {
  url: "https://adeptio-hr-v240-torukung.aws-ap-northeast-1.turso.io",
  token: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODEyNDA3MjAsImlkIjoiMDE5ZWJhMzgtNDQwMS03ZjI0LThhOTMtNmEyMGRiYzFmYzI0IiwicmlkIjoiMTViNzc0NzMtMjBhYi00N2I3LWFkNzUtYTg3NDI3N2I4NTExIn0.Ih1B0fbAs5lh4xpBjF0bDZZbZ9W5jNalfokWHb5MrEMfaPoI-oKO9lst5mSPsIxU_wh_xtEcRqg5_OhKDU3MCw"
};
