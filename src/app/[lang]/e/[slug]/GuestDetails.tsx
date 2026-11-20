import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { PageQuestion } from "@/lib/event-page";
import { splitPhone } from "@/lib/phone";
import { Button, Checkbox, Field, Input, Select } from "@/design";
import EmailCodeStep from "./tickets/EmailCodeStep";
import { GENDER_FIELD, PHONE_COUNTRY_FIELD, PHONE_FIELD } from "./order-input";
import { FOR_FIELD, checkRecipient, emailField, nameField, recipientRoom, type RecipientError } from "./tickets/recipients";
import b from "./tickets/Booking.module.css";

/** Who is buying: the account (signed in) or nobody yet (the inline email code, D88). */
export type Buyer = {
  signedIn: boolean;
  /** The account email (empty when signed out). */
  email: string;
  /** The account's name, if it has one. */
  name: string;
  /** The phone and gender given at the last checkout (GET /v1/me), to prefill (4b). */
  phone?: string | null;
  gender?: "female" | "male" | "unspecified" | null;
};

/** The phone's country picker: its options (from the server, in the reader's language) and the default. */
export type PhoneSetup = { countries: { value: string; label: string }[]; country: string };

/** "Who are these tickets for?" (D89), kept by the form so a saved draft can put it back. */
export type People = { forOthers: boolean; people: number; setForOthers: (v: boolean) => void; setPeople: (n: number) => void };

type Props = {
  idPrefix: string;
  /** The order's ticket types, one per ticket in API order (index 0 is ticket 1): labels the people's rows. */
  ticketNames: string[];
  questions: PageQuestion[];
  buyer: Buyer;
  phone: PhoneSetup;
  people: People;
  /** The inline email code signed the buyer in (shows "Email confirmed"). */
  justVerified?: boolean;
  onSignedIn: () => void;
};

// The part of an order form after the ticket picker, shared by free and paid orders: the buyer
// (name, email, phone, gender), who the tickets are for, the event's questions.
export default function GuestDetails({ idPrefix, ticketNames, questions, buyer, phone, people, justVerified, onSignedIn }: Props) {
  return (
    <>
      <BuyerFields idPrefix={idPrefix} buyer={buyer} phone={phone} justVerified={justVerified} onSignedIn={onSignedIn} />
      <Recipients idPrefix={idPrefix} ticketNames={ticketNames} buyerEmail={buyer.email} people={people} />
      <Questions questions={questions} />
    </>
  );
}

const NAME_FIELD = "buyer_name";
const GENDERS = ["female", "male", "unspecified"] as const;

/**
 * The buyer's name, and the email tickets go to: the account email, read-only, when signed in;
 * otherwise an email field with Continue and the 6-digit code (EmailCodeStep). Then the phone
 * (required, with a country picker) and the gender (optional), both remembered for next time (4b).
 */
function BuyerFields({ idPrefix, buyer, phone, justVerified, onSignedIn }: Pick<Props, "idPrefix" | "buyer" | "phone" | "justVerified" | "onSignedIn">) {
  const t = useTranslations("event.guest");
  const tv = useTranslations("event.verify");
  const saved = splitPhone(buyer.phone, phone.country);
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
      <div className={b.phone}>
        <Field label={t("phoneCountry")} id={`${idPrefix}-phone-country`}>
          <Select name={PHONE_COUNTRY_FIELD} defaultValue={saved?.country ?? phone.country} autoComplete="tel-country-code">
            {phone.countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </Select>
        </Field>
        <Field label={t("phone")} hint={t("phoneHint")} id={`${idPrefix}-phone`}>
          <Input name={PHONE_FIELD} type="tel" inputMode="tel" autoComplete="tel-national" required minLength={5} maxLength={40}
            defaultValue={saved?.national ?? ""} placeholder={t("phonePlaceholder")} dir="ltr" />
        </Field>
      </div>
      <Field label={t("gender")} id={`${idPrefix}-gender`}>
        <Select name={GENDER_FIELD} defaultValue={buyer.gender ?? ""} autoComplete="sex">
          <option value="">{t("genderNone")}</option>
          {GENDERS.map((g) => <option key={g} value={g}>{t(`genders.${g}`)}</option>)}
        </Select>
      </Field>
    </>
  );
}

/**
 * "Who are these tickets for?" (D89): all for the buyer, or some for other people. The buyer adds
 * people one at a time; person k gets ticket k+1 with their name and, if given, the ticket by email.
 * Every ticket also stays in the buyer's My tickets.
 */
function Recipients({ idPrefix, ticketNames, buyerEmail, people }: { idPrefix: string; ticketNames: string[]; buyerEmail: string; people: People }) {
  const t = useTranslations("event.guest");
  const room = recipientRoom(ticketNames.length);
  const { forOthers, people: count, setForOthers, setPeople } = people;
  const [errors, setErrors] = useState<Record<number, RecipientError | null>>({});

  // Fewer tickets than people (a quantity went down): drop the rows that no longer have a ticket.
  useEffect(() => {
    if (count > room) setPeople(room);
  }, [count, room, setPeople]);

  if (room < 1) return null;
  const shown = forOthers ? Math.max(1, Math.min(count, room)) : 0;

  const checkEmail = (ticket: number, input: HTMLInputElement) => {
    const error = input.value.trim() ? checkRecipient("ok", input.value, buyerEmail) : null;
    input.setCustomValidity(error ? t(`recipientErrors.${error}`) : "");
    setErrors((e) => ({ ...e, [ticket]: error }));
  };

  return (
    <fieldset className={b.fieldset}>
      <legend className={b.legendStrong}>{t("forWho")}</legend>
      <div className={b.segment}>
        {(["me", "others"] as const).map((v) => (
          <label key={v} className={b.segmentOption}>
            <input type="radio" name={FOR_FIELD} value={v} className="sr-only" checked={forOthers === (v === "others")}
              onChange={() => {
                setForOthers(v === "others");
                if (v === "others" && count < 1) setPeople(1);
              }} />
            <span>{t(v === "me" ? "forMe" : "forOthers")}</span>
          </label>
        ))}
      </div>
      {forOthers && (
        <>
          <p className={b.note}>{t("forOthersHint")}</p>
          {Array.from({ length: shown }, (_, i) => {
            const ticket = i + 2;
            const error = errors[ticket];
            return (
              <div key={ticket} className={b.person} role="group" aria-labelledby={`${idPrefix}-person-${ticket}`}>
                <div className={b.personHead}>
                  <span className={b.personTitle} id={`${idPrefix}-person-${ticket}`}>
                    {t("ticketFor", { number: ticket, type: ticketNames[ticket - 1] ?? "" })}
                  </span>
                  {i === shown - 1 && shown > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => setPeople(shown - 1)}>{t("removePerson")}</Button>
                  )}
                </div>
                <div className={b.personFields}>
                  <Field label={t("personName")}>
                    <Input name={nameField(ticket)} required minLength={2} maxLength={120} autoComplete="off" />
                  </Field>
                  <Field label={t("personEmail")} hint={t("personEmailHint")} error={error ? t(`recipientErrors.${error}`) : undefined}>
                    <Input name={emailField(ticket)} type="email" maxLength={254} autoComplete="off" dir="ltr"
                      onBlur={(e) => checkEmail(ticket, e.currentTarget)}
                      onChange={(e) => (errors[ticket] ? checkEmail(ticket, e.currentTarget) : e.currentTarget.setCustomValidity(""))} />
                  </Field>
                </div>
              </div>
            );
          })}
          {shown < room && (
            <Button variant="secondary" size="sm" className={b.addPerson} onClick={() => setPeople(shown + 1)}>{t("addPerson")}</Button>
          )}
          {shown < ticketNames.length - 1 && <p className={b.note}>{t("restYours")}</p>}
        </>
      )}
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
