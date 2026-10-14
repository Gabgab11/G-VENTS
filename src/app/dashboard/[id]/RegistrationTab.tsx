import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addQuestion, deleteQuestion } from "./actions";

const KIND_LABEL: Record<string, string> = {
  text: "Short text", options: "Multiple choice", social: "Social profile", company: "Company",
  terms: "Checkbox (terms)", phone: "Phone", website: "Website",
};

export default async function RegistrationTab({ id, url }: { id: string; url: string }) {
  const supabase = await createSupabaseServerClient();
  const { data: questions } = await supabase
    .from("event_questions")
    .select("id, label, kind, options, required")
    .eq("event_id", id)
    .order("position", { ascending: true });

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-label">Guests fill in</div>
        <div className="q-row"><b>Name</b><span className="muted small">Required</span></div>
        <div className="q-row"><b>Email</b><span className="muted small">Required</span></div>
        <div className="q-row"><b>Ticket</b><span className="muted small">Chosen on the event page</span></div>
        {(questions ?? []).map((q) => (
          <div className="q-row" key={q.id}>
            <span><b>{q.label}</b> <span className="muted small">· {KIND_LABEL[q.kind] ?? q.kind}{q.kind === "options" ? `: ${(q.options as string[]).join(", ")}` : ""}</span></span>
            <span className="q-actions">
              <span className="muted small">{q.required ? "Required" : "Optional"}</span>
              <form action={deleteQuestion}>
                <input type="hidden" name="event_id" value={id} />
                <input type="hidden" name="question_id" value={q.id} />
                <button className="link-btn" type="submit" aria-label={`Remove question: ${q.label}`}>Remove</button>
              </form>
            </span>
          </div>
        ))}
      </section>

      <section className="panel">
        <div className="panel-label">Add a question</div>
        <form action={addQuestion} className="form">
          <input type="hidden" name="event_id" value={id} />
          <label className="field"><span>Question</span>
            <input className="input" name="label" maxLength={200} placeholder="e.g. Which church do you attend?" /></label>
          <label className="field"><span>Type</span>
            <select className="input" name="kind" defaultValue="text">
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <label className="field"><span>Options (for multiple choice, one per line)</span>
            <textarea className="input" name="options" rows={3} placeholder={"Adult\nYouth\nChild"} /></label>
          <label className="check"><input type="checkbox" name="required" /> <span>Required</span></label>
          <button className="btn-white" type="submit">Add question</button>
        </form>
      </section>

      <p className="muted small">Registration link: <span className="gold">{url}</span></p>
    </div>
  );
}
