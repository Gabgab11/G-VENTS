"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { TicketPercent } from "lucide-react";
import { Button, Field, Input } from "@/design";
import b from "./Booking.module.css";

type Props = {
  /** The code in use ("" for none); `confirmed` once the API's quote carries it. */
  code: string;
  confirmed: boolean;
  error: string;
  applying: boolean;
  /** Pre-fills the field (a `?code=` link). */
  initialInput?: string;
  onApply: (code: string) => Promise<boolean>;
  onRemove: () => void;
};

// "Got a discount code?" on the paid summary card (D91): a toggle that opens a field and Apply; once
// applied, the code with Remove. The code goes with the order as a hidden field (PaidOrderForm), so
// the API checks it again when the tickets are held.
export default function DiscountCode({ code, confirmed, error, applying, initialInput = "", onApply, onRemove }: Props) {
  const t = useTranslations("event.discount");
  const [open, setOpen] = useState(!!initialInput || !!error);
  // Kept after Apply, so a code dropped later (the tickets changed) is still there to see.
  const [input, setInput] = useState(initialInput);
  const id = useId();

  if (code) {
    return (
      <div className={b.code}>
        <p className={b.codeApplied} role="status">
          <TicketPercent size={16} strokeWidth={1.75} aria-hidden />
          <span>{confirmed ? t("applied", { code }) : t("checking", { code })}</span>
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setInput(""); onRemove(); }} aria-label={t("removeLabel", { code })}>
          {t("remove")}
        </Button>
      </div>
    );
  }

  if (!open && !error) {
    return (
      <Button type="button" variant="ghost" size="sm" className={b.codeToggle} aria-expanded={false} aria-controls={id} onClick={() => setOpen(true)}>
        {t("toggle")}
      </Button>
    );
  }

  const apply = () => void onApply(input);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    // Enter applies the code instead of submitting the order.
    if (e.key === "Enter") {
      e.preventDefault();
      apply();
    }
  };

  return (
    <div className={b.codeRow} id={id}>
      <Field label={t("label")} error={error || undefined} className={b.codeField}>
        <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} autoComplete="off" autoCapitalize="characters"
          spellCheck={false} maxLength={32} autoFocus={!initialInput} />
      </Field>
      <Button type="button" variant="secondary" onClick={apply} loading={applying} disabled={!input.trim()} className={b.codeApply}>
        {t("apply")}
      </Button>
    </div>
  );
}
