import { useTranslations } from "next-intl";
import type { PageQuestion } from "@/lib/event-page";
import { Checkbox, Field, Input, Select } from "@/design";
import b from "./tickets/Booking.module.css";

// The part of an order form after the ticket picker, shared by free and paid orders: the buyer's
// name, the account email tickets go to (read-only), optional names for the other tickets, the
// event's questions.
export default function GuestDetails({ idPrefix, total, questions, userEmail, defaultName }: { idPrefix: string; total: number; questions: PageQuestion[]; userEmail: string; defaultName: string }) {
  const t = useTranslations("event.guest");
  return (
    <>
      <Field label={t("name")}>
        <Input name="buyer_name" defaultValue={defaultName} minLength={2} maxLength={120} autoComplete="name" required={!defaultName} />
      </Field>
      <Field label={t("email")} hint={t("emailThis")} id={`${idPrefix}-email`}>
        <Input type="email" value={userEmail} readOnly />
      </Field>

      {total > 1 && (
        <fieldset className={b.fieldset}>
          <legend className={b.legend}>{t("othersLegend")}</legend>
          {Array.from({ length: total - 1 }, (_, i) => (
            <Field key={i} label={t("ticketNumber", { number: i + 2 })}>
              <Input name={`guest_${i + 2}`} maxLength={120} placeholder={t("namePlaceholder")} />
            </Field>
          ))}
        </fieldset>
      )}

      {questions.map((q) => {
        const label = `${q.label}${q.required ? " *" : ""}`;
        if (q.kind === "terms") return <Checkbox key={q.id} name={`q_${q.id}`} required={q.required} label={label} className={b.check} />;
        return (
          <Field key={q.id} label={label}>
            {q.kind === "options" ? (
              <Select name={`q_${q.id}`} required={q.required} defaultValue="">
                <option value="" disabled>{t("choose")}</option>
                {q.options.map((o) => <option key={o}>{o}</option>)}
              </Select>
            ) : (
              <Input name={`q_${q.id}`} maxLength={1000}
                type={q.kind === "phone" ? "tel" : q.kind === "website" ? "url" : "text"}
                required={q.required} placeholder={q.kind === "social" ? t("socialPlaceholder") : ""} />
            )}
          </Field>
        );
      })}
    </>
  );
}
