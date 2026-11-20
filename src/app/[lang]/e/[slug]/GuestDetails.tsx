import { useTranslations } from "next-intl";
import type { PageQuestion } from "@/lib/event-page";
import { Checkbox, Field, Input, Select } from "@/design";
import EmailCodeStep from "./tickets/EmailCodeStep";
import b from "./tickets/Booking.module.css";

/** Who is buying: the account (signed in) or nobody yet (the inline email code, D88). */
export type Buyer = {
  signedIn: boolean;
  /** The account email (empty when signed out). */
  email: string;
  /** The account's name, if it has one. */
  name: string;
};

type Props = {
  idPrefix: string;
  total: number;
  questions: PageQuestion[];
  buyer: Buyer;
  /** The inline email code signed the buyer in (shows "Email confirmed"). */
  justVerified?: boolean;
  onSignedIn: () => void;
};

// The part of an order form after the ticket picker, shared by free and paid orders: the buyer
// (name and email), optional names for the other tickets, the event's questions. Each block is its
// own component so later checkout fields slot in beside them.
export default function GuestDetails({ idPrefix, total, questions, buyer, justVerified, onSignedIn }: Props) {
  return (
    <>
      <BuyerFields idPrefix={idPrefix} buyer={buyer} justVerified={justVerified} onSignedIn={onSignedIn} />
      <OtherGuests total={total} />
      <Questions questions={questions} />
    </>
  );
}

const NAME_FIELD = "buyer_name";

/**
 * The buyer's name, and the email tickets go to: the account email, read-only, when signed in;
 * otherwise an email field with Continue and the 6-digit code (EmailCodeStep).
 */
function BuyerFields({ idPrefix, buyer, justVerified, onSignedIn }: Pick<Props, "idPrefix" | "buyer" | "justVerified" | "onSignedIn">) {
  const t = useTranslations("event.guest");
  const tv = useTranslations("event.verify");
  return (
    <>
      <Field label={t("name")}>
        <Input name={NAME_FIELD} defaultValue={buyer.name} minLength={2} maxLength={120} autoComplete="name" required={!buyer.name} />
      </Field>
      {buyer.signedIn ? (
        <Field label={t("email")} hint={justVerified ? tv("confirmed") : t("emailThis")} id={`${idPrefix}-email`}>
          <Input type="email" value={buyer.email} readOnly />
        </Field>
      ) : (
        <EmailCodeStep idPrefix={idPrefix} nameField={NAME_FIELD} onSignedIn={onSignedIn} />
      )}
    </>
  );
}

/** Optional names for tickets 2..n (ticket 1 is the buyer's). */
function OtherGuests({ total }: { total: number }) {
  const t = useTranslations("event.guest");
  if (total < 2) return null;
  return (
    <fieldset className={b.fieldset}>
      <legend className={b.legend}>{t("othersLegend")}</legend>
      {Array.from({ length: total - 1 }, (_, i) => (
        <Field key={i} label={t("ticketNumber", { number: i + 2 })}>
          <Input name={`guest_${i + 2}`} maxLength={120} placeholder={t("namePlaceholder")} />
        </Field>
      ))}
    </fieldset>
  );
}

/** The event's own questions. */
function Questions({ questions }: { questions: PageQuestion[] }) {
  const t = useTranslations("event.guest");
  return (
    <>
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
