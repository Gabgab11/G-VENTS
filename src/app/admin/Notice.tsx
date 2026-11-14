// The message a staff action came back with (?ok= or ?err=). Text only, shown as text.
export default function Notice({ ok, err }: { ok?: string; err?: string }) {
  if (err) return <p className="error" role="alert">{err.slice(0, 300)}</p>;
  if (ok) return <p className="ok-note" role="status">{ok.slice(0, 200)}</p>;
  return null;
}
