// Styles for the ticket page. Same palette and fonts as the home page.
// The print rules turn the page into one clean ticket on A4 or Letter paper.
export const TICKET_CSS = `

.tk {
  --ink: #121212; --muted: #6b6a66; --line: #ebe9e2; --soft: #f6f5f1; --page: #f6f5f1;
  --coral: #ff5a3c; --sun: #ffc23d; --mint: #7ee0b6;
  --display: var(--font-display), "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --body: var(--font-body), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  min-height: 100vh; background: var(--page); color: var(--ink); font-family: var(--body);
  padding: 22px 16px 64px;
}
.tk a { color: inherit; }
.tk-top { max-width: 860px; margin: 0 auto 22px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.tk-logo { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.4px; text-decoration: none; }
.tk-logo b { color: var(--coral); }
.tk-small { font-size: 13px; color: var(--muted); }

.tk-note { max-width: 860px; margin: 0 auto 16px; padding: 14px 18px; border-radius: 14px; background: #fff; border: 1px solid var(--line); font-size: 15px; line-height: 1.5; }
.tk-note b { display: block; font-family: var(--display); font-size: 18px; margin-bottom: 2px; }
.tk-note.warn { background: #fff4f1; border-color: #ffd2c7; }
.tk-note.ok { background: #effbf5; border-color: #c4efda; }

/* The ticket */
.tk-ticket { max-width: 860px; margin: 0 auto; display: grid; grid-template-columns: 1fr; background: #fff; border-radius: 26px; box-shadow: 0 1px 0 var(--line), 0 24px 60px rgba(18,18,18,.08); overflow: hidden; position: relative; }
.tk-main { display: flex; flex-direction: column; }
.tk-band { background: var(--sun); padding: 22px 26px 26px; position: relative; }
.tk-band-row { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
.tk-brand { font-family: var(--display); font-weight: 800; font-size: 16px; letter-spacing: -0.2px; }
.tk-brand b { color: var(--coral); }
.tk-admit { font-size: 11px; font-weight: 600; letter-spacing: .14em; text-transform: uppercase; background: var(--ink); color: #fff; padding: 6px 11px; border-radius: 999px; }
.tk-title { font-family: var(--display); font-weight: 800; font-size: clamp(30px, 6vw, 46px); line-height: 0.98; letter-spacing: -1.2px; margin: 22px 0 0; overflow-wrap: anywhere; }

.tk-details { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 22px; padding: 24px 26px 26px; }
.tk-field { min-width: 0; }
.tk-field.wide { grid-column: 1 / -1; }
.tk-label { font-size: 11px; font-weight: 600; letter-spacing: .12em; text-transform: uppercase; color: var(--muted); }
.tk-value { font-size: 16px; font-weight: 600; margin-top: 4px; line-height: 1.35; overflow-wrap: anywhere; }
.tk-value.big { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.4px; }

/* Perforation between the main part and the stub, with cut-out notches */
.tk-stub { position: relative; border-top: 2px dashed var(--line); padding: 26px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
.tk-stub::before, .tk-stub::after { content: ""; position: absolute; top: -15px; width: 28px; height: 28px; border-radius: 50%; background: var(--page); }
.tk-stub::before { left: -14px; }
.tk-stub::after { right: -14px; }
.tk-qr { width: 220px; max-width: 100%; aspect-ratio: 1; }
.tk-qr svg { width: 100%; height: 100%; display: block; }
.tk-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 15px; font-weight: 600; letter-spacing: .08em; }
.tk-hint { font-size: 13px; color: var(--muted); max-width: 240px; line-height: 1.45; }
.tk-void { width: 220px; aspect-ratio: 1; border-radius: 18px; border: 2px dashed var(--line); display: flex; align-items: center; justify-content: center; padding: 18px; font-family: var(--display); font-weight: 800; font-size: 20px; color: var(--muted); }

.tk-stamp { position: absolute; top: 18px; right: 18px; transform: rotate(8deg); border: 3px solid #15925f; color: #15925f; border-radius: 12px; padding: 6px 12px; font-family: var(--display); font-weight: 800; font-size: 16px; letter-spacing: .04em; text-transform: uppercase; background: rgba(255,255,255,.85); }
.tk-stamp small { display: block; font-family: var(--body); font-size: 11px; font-weight: 600; text-transform: none; letter-spacing: 0; }

@media (min-width: 760px) {
  .tk-ticket { grid-template-columns: 1fr 290px; }
  .tk-stub { border-top: 0; border-left: 2px dashed var(--line); justify-content: center; }
  .tk-stub::before { top: -14px; left: -15px; }
  .tk-stub::after { top: auto; bottom: -14px; left: -15px; right: auto; }
  .tk-details { grid-template-columns: 1fr 1fr 1fr; }
}

/* Actions under the ticket */
.tk-actions { max-width: 860px; margin: 22px auto 0; display: flex; gap: 10px; flex-wrap: wrap; }
.tk-wa { max-width: 860px; margin: 18px auto 0; padding: 18px; border-radius: 18px; background: #fff; border: 1px solid var(--line); }
.tk-wa p { margin: 0 0 12px; font-size: 15px; line-height: 1.45; }
.tk-wa-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.tk-wa-row { display: flex; gap: 10px; flex-wrap: wrap; }
.tk-wa-input { flex: 1 1 220px; min-width: 0; font: inherit; font-size: 16px; padding: 13px 14px; border-radius: 14px; border: 1px solid var(--line); }
.tk-wa-error { color: #b42318; margin: 10px 0 0; font-size: 14px; }
@media print { .tk-wa { display: none !important; } }
.tk-btn { appearance: none; border: 0; cursor: pointer; font: inherit; font-weight: 600; font-size: 15px; padding: 14px 22px; border-radius: 14px; background: var(--ink); color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 8px; }
.tk-ghost { background: #fff; color: var(--ink); border: 1px solid var(--line); }
.tk-go { background: #15925f; }
.tk-staff { max-width: 860px; margin: 18px auto 0; padding: 18px; border-radius: 18px; background: #fff; border: 1px solid var(--line); display: flex; justify-content: space-between; align-items: center; gap: 14px; flex-wrap: wrap; }
.tk-staff p { margin: 0; font-size: 15px; line-height: 1.45; }
.tk-foot { max-width: 860px; margin: 26px auto 0; font-size: 13px; color: var(--muted); line-height: 1.6; }

@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; }
  .tk { padding: 0; min-height: 0; background: #fff; }
  .tk-actions, .tk-staff, .tk-top .tk-small, .no-print { display: none !important; }
  .tk-ticket { box-shadow: none; border: 1.5px solid #d9d6cc; grid-template-columns: 1fr 250px; break-inside: avoid; }
  .tk-stub { border-top: 0; border-left: 2px dashed #d9d6cc; justify-content: center; }
  .tk-stub::before, .tk-stub::after { display: none; }
  .tk-details { grid-template-columns: 1fr 1fr 1fr; }
  .tk-qr { width: 190px; }
  .tk-band, .tk-admit, .tk-stamp { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;
