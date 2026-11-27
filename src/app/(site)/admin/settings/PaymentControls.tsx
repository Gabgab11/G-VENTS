"use client";

import { useActionState, useRef, useState, type ComponentProps } from "react";
import { useFormStatus } from "react-dom";
import { Badge, Button, Field, Input, Textarea } from "@/design";
import { Dialog, DialogClose, DialogContent, Switch } from "@/design/client";
import { formatMinor, majorToMinor, minorToMajor, percentToBps, bpsToPercent, providerCharge, type ChargeSchedule } from "@/lib/money";
import { PROVIDER_NAMES, type ProviderId } from "@/lib/payment-text";
import { saveChargeSchedule, setActiveProvider, type ActiveProviderState } from "./payment-actions";
import s from "./payments.module.css";

// The interactive parts of Admin → Settings → Payments (Change 5 chunk 4). Staff pages are English.

/** A switch that submits its form at once (a server action that comes back to the page). */
export function SwitchForm({ action, fields, checked, disabled, label, describedBy }: {
  action: (formData: FormData) => Promise<void>;
  fields: Record<string, string>;
  checked: boolean;
  disabled?: boolean;
  /** The switch's accessible name, e.g. "Flutterwave in Uganda". */
  label: string;
  /** Id of the text saying why it can't be changed (rendered by the caller). */
  describedBy?: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className={s.switchForm}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="enabled" value={checked ? "false" : "true"} />
      <PendingSwitch checked={checked} disabled={disabled} aria-label={label} aria-describedby={describedBy}
        onCheckedChange={() => form.current?.requestSubmit()} />
    </form>
  );
}

/** The switch, disabled while its form is being sent. */
function PendingSwitch({ disabled, ...rest }: ComponentProps<typeof Switch>) {
  const { pending } = useFormStatus();
  return <Switch {...rest} disabled={disabled || pending} />;
}

/** A submit button that shows it is working while its form is sent. */
function SubmitButton({ disabled, ...rest }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return <Button {...rest} type="submit" loading={pending} disabled={disabled || pending} />;
}

/** A typical ticket price per currency, for the example line. */
const EXAMPLE_MAJOR: Record<string, number> = { NGN: 10_000, GHS: 200, KES: 2_000, ZAR: 300, UGX: 50_000, TZS: 30_000, RWF: 15_000, ZMW: 300, XAF: 10_000, XOF: 10_000 };

/** PS15: one country's charge schedule, typed in the main unit; the example updates as you type. */
export function ChargeScheduleForm({ provider, country, countryName, currency, exponent, charges }: {
  provider: ProviderId;
  country: string;
  countryName: string;
  currency: string;
  exponent: number;
  charges: (ChargeSchedule & { confirmed: boolean }) | null;
}) {
  const [percent, setPercent] = useState(charges ? bpsToPercent(charges.percentBps) : "");
  const [fixed, setFixed] = useState(charges ? minorToMajor(charges.fixedMinor, currency) : "0");
  const [waive, setWaive] = useState(charges ? minorToMajor(charges.waiveFixedBelow, currency) : "0");
  const [cap, setCap] = useState(charges?.capMinor != null ? minorToMajor(charges.capMinor, currency) : "");

  const schedule: ChargeSchedule | null = (() => {
    const percentBps = percentToBps(percent);
    const fixedMinor = majorToMinor(fixed || "0", currency);
    const waiveFixedBelow = majorToMinor(waive || "0", currency);
    const capMinor = cap.trim() === "" ? null : majorToMinor(cap, currency);
    if (percentBps === null || fixedMinor === null || waiveFixedBelow === null || (cap.trim() !== "" && capMinor === null)) return null;
    return { percentBps, fixedMinor, waiveFixedBelow, capMinor };
  })();
  const example = (EXAMPLE_MAJOR[currency] ?? 10_000) * 10 ** exponent;
  const id = `${provider}-${country}`;
  const unit = exponent === 0 ? `${currency}, whole units` : currency;

  return (
    <form action={saveChargeSchedule} className={s.chargeForm} aria-labelledby={`${id}-charges`}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="country" value={country} />
      <p id={`${id}-charges`} className={s.formTitle}>
        {PROVIDER_NAMES[provider]}&apos;s charge in {countryName}{" "}
        {charges?.confirmed ? <Badge tone="success">Confirmed</Badge> : <Badge tone="warning">Unconfirmed</Badge>}
      </p>
      <div className={s.chargeFields}>
        <Field label="Percentage (%)">
          <Input name="percent" inputMode="decimal" value={percent} onChange={(e) => setPercent(e.target.value)} placeholder="1.5" required />
        </Field>
        <Field label={`Fixed amount (${unit})`}>
          <Input name="fixed" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} />
        </Field>
        <Field label={`Fixed part applies from (${unit})`} hint="0 = always">
          <Input name="waive_below" inputMode="decimal" value={waive} onChange={(e) => setWaive(e.target.value)} />
        </Field>
        <Field label={`Cap (${unit})`} hint="Empty = no cap">
          <Input name="cap" inputMode="decimal" value={cap} onChange={(e) => setCap(e.target.value)} />
        </Field>
      </div>
      <p className={s.example} aria-live="polite">
        {schedule
          ? `On ${formatMinor(example, currency)} the estimate is ${formatMinor(providerCharge(example, schedule), currency)}.`
          : `Enter a percentage (up to 2 decimals) and amounts with no more decimals than ${currency} has.`}
      </p>
      <div>
        <SubmitButton variant="secondary" size="sm" disabled={!schedule}>
          {charges?.confirmed ? "Save charge" : "Save and confirm charge"}
        </SubmitButton>
      </div>
    </form>
  );
}

/** PS1, PS2: the active provider, limited to the candidates, confirmed with a reason. */
export function ActiveProviderForm({ active, candidates, why }: {
  active: ProviderId | null;
  candidates: ProviderId[];
  /** Why each provider that isn't a candidate can't be made active. */
  why: Partial<Record<ProviderId, string>>;
}) {
  const [choice, setChoice] = useState<ProviderId | null>(active);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action] = useActionState<ActiveProviderState, FormData>(setActiveProvider, undefined);
  const providers = Object.keys(PROVIDER_NAMES) as ProviderId[];

  return (
    <div className={s.active}>
      <fieldset className={s.radios}>
        <legend className={s.formTitle}>Active provider</legend>
        {providers.map((p) => {
          const allowed = candidates.includes(p) || p === active;
          return (
            <label key={p} className={s.radio} data-disabled={!allowed || undefined}>
              <input type="radio" name="active-provider" value={p} checked={choice === p} disabled={!allowed}
                aria-describedby={!allowed ? `why-${p}` : undefined}
                onChange={() => { setChoice(p); if (p !== active) { setReason(""); setOpen(true); } }} />
              <span>
                <b>{PROVIDER_NAMES[p]}</b>{p === active && <> <Badge tone="success">Active</Badge></>}
                {!allowed && <span id={`why-${p}`} className={s.hint}>{why[p] ?? "Not ready to be the active provider."}</span>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {active === null && <p className={s.hint}>None chosen: checkouts use whichever provider qualifies for the country.</p>}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setChoice(active); }}>
        {choice && (
          <DialogContent
            title={`Make ${PROVIDER_NAMES[choice]} the active provider?`}
            description="New checkouts start on it wherever it is switched on. Orders already started finish on their current provider."
            closeLabel="Close"
          >
            <form action={action} className={s.dialogForm}>
              <input type="hidden" name="provider" value={choice} />
              <Field label="Reason (kept in the audit log)" hint="10 to 500 characters" required>
                <Textarea name="reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={10} maxLength={500} rows={3} required />
              </Field>
              {state?.error && <p className={s.error} role="alert">{state.error}</p>}
              <div className={s.dialogButtons}>
                <DialogClose><Button variant="ghost" type="button">Cancel</Button></DialogClose>
                <SubmitButton variant="primary" disabled={reason.trim().length < 10}>Switch to {PROVIDER_NAMES[choice]}</SubmitButton>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
