"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal, Plus, TicketPercent } from "lucide-react";
import { useFormat } from "@/i18n/format-hooks";
import { currencySymbol } from "@/lib/money";
import { Badge, Banner, Button, Card, CardHeader, Checkbox, EmptyState, Field, Input, Select, Table, Td, Th, type BadgeTone } from "@/design";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, ToastProvider, useToast } from "@/design/client";
import { saveDiscountCode, setDiscountPaused } from "./promote-actions";
import { DISCOUNT_KINDS, percentLabel, shareUrl, valueText, zonedInput, type DiscountCode, type DiscountInput, type DiscountKind } from "./promote-form";
import styles from "./tools.module.css";

type TicketOption = { id: string; name: string };
type Props = {
  eventId: string;
  codes: DiscountCode[];
  ticketTypes: TicketOption[];
  currency: string;
  timeZone: string;
  origin: string;
  eventPath: string;
  published: boolean;
};

const STATE_TONE: Record<DiscountCode["state"], BadgeTone> = { active: "success", paused: "neutral", scheduled: "info", ended: "neutral", used_up: "warning" };
const STATE_LABEL = { active: "active", paused: "paused", scheduled: "scheduled", ended: "ended", used_up: "usedUp" } as const;
const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export default function DiscountCodes(props: Props) {
  const t = useTranslations("dashboard");
  return (
    <ToastProvider closeLabel={t("tools.close")}>
      <CodesTable {...props} />
    </ToastProvider>
  );
}

function CodesTable({ eventId, codes, ticketTypes, currency, timeZone, origin, eventPath, published }: Props) {
  const t = useTranslations("dashboard.promote");
  const format = useFormat();
  const { toast } = useToast();
  const [editing, setEditing] = useState<DiscountCode | "new" | null>(null);
  const [, startTransition] = useTransition();
  const typeName = new Map(ticketTypes.map((tt) => [tt.id, tt.name]));

  const discountText = (c: DiscountCode) =>
    c.kind === "free" ? t("free") : c.kind === "percent" ? percentLabel(c.value, format.lang) : format.money(c.value, currency);
  const validText = (c: DiscountCode) => {
    const d = (iso: string) => format.dateTime(iso, timeZone, "compact");
    if (c.startsAt && c.endsAt) return t("valid.between", { start: d(c.startsAt), end: d(c.endsAt) });
    if (c.endsAt) return t("valid.until", { date: d(c.endsAt) });
    if (c.startsAt) return t("valid.from", { date: d(c.startsAt) });
    return t("valid.always");
  };
  const scopeText = (c: DiscountCode) =>
    c.ticketTypeIds.length === 0 ? t("allTickets") : c.ticketTypeIds.map((id) => typeName.get(id) ?? t("removedType")).join(", ");

  const copy = async (c: DiscountCode) => {
    const url = shareUrl(origin, eventPath, c.code);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("copied"), description: t("copiedHint", { code: c.code }), tone: "success" });
    } catch {
      toast({ title: t("copyFailed"), description: url, tone: "warning" });
    }
  };
  const pause = (c: DiscountCode, paused: boolean) =>
    startTransition(async () => {
      const r = await setDiscountPaused(eventId, c.id, paused);
      toast(r.ok ? { title: t(paused ? "pausedToast" : "resumedToast", { code: c.code }), tone: "success" } : { title: r.error, tone: "danger" });
    });

  const newButton = ticketTypes.length > 0 && (
    <Button size="sm" variant="primary" onClick={() => setEditing("new")}><Plus {...ICON} />{t("newCode")}</Button>
  );

  return (
    <div className={styles.stack}>
      <Card as="section">
        <CardHeader title={t("title")} action={newButton || undefined} />
        <p className={styles.muted}>{t("intro")}</p>
        {ticketTypes.length > 0 && !published && <Banner tone="info" title={t("draftNote")} />}
        {ticketTypes.length === 0 ? (
          <EmptyState icon={<TicketPercent size={20} strokeWidth={1.75} aria-hidden />} title={t("noPaid")}>{t("noPaidHint")}</EmptyState>
        ) : codes.length === 0 ? (
          <EmptyState
            icon={<TicketPercent size={20} strokeWidth={1.75} aria-hidden />}
            title={t("empty")}
            action={<Button variant="secondary" onClick={() => setEditing("new")}><Plus {...ICON} />{t("newCode")}</Button>}
          >
            {t("emptyHint")}
          </EmptyState>
        ) : (
          <Table caption={<span className="sr-only">{t("title")}</span>}>
            <thead>
              <tr>
                <Th>{t("cols.code")}</Th>
                <Th>{t("cols.discount")}</Th>
                <Th numeric>{t("cols.used")}</Th>
                <Th>{t("cols.valid")}</Th>
                <Th>{t("cols.status")}</Th>
                <Th><span className="sr-only">{t("cols.actions")}</span></Th>
              </tr>
            </thead>
            <tbody>
              {codes.map((c) => (
                <tr key={c.id}>
                  <Td label={t("cols.code")}><span className={styles.code}>{c.code}</span></Td>
                  <Td label={t("cols.discount")}>
                    <span className={styles.cell}>
                      <span>{discountText(c)}</span>
                      <span className={styles.muted}>{scopeText(c)}</span>
                    </span>
                  </Td>
                  <Td label={t("cols.used")} numeric>
                    {c.maxUses === null ? t("usedNoLimit", { uses: c.uses }) : t("usedOf", { uses: c.uses, max: c.maxUses })}
                  </Td>
                  <Td label={t("cols.valid")}>{validText(c)}</Td>
                  <Td label={t("cols.status")}><Badge tone={STATE_TONE[c.state]}>{t(`states.${STATE_LABEL[c.state]}`)}</Badge></Td>
                  <Td label={t("cols.actions")} className={styles.menuCell}>
                    <Menu>
                      <MenuTrigger>
                        <Button size="sm" variant="ghost" icon={<MoreHorizontal {...ICON} />} aria-label={t("menuLabel", { code: c.code })} />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => void copy(c)}>{t("copyLink")}</MenuItem>
                        <MenuItem onSelect={() => pause(c, !c.paused)}>{t(c.paused ? "resume" : "pause")}</MenuItem>
                        <MenuItem onSelect={() => setEditing(c)}>{t("edit")}</MenuItem>
                      </MenuContent>
                    </Menu>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        {editing !== null && (
          <CodeDialog
            key={editing === "new" ? "new" : editing.id}
            eventId={eventId}
            code={editing === "new" ? null : editing}
            ticketTypes={ticketTypes}
            currency={currency}
            timeZone={timeZone}
            onDone={(message) => {
              setEditing(null);
              toast({ title: message, tone: "success" });
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function CodeDialog({ eventId, code, ticketTypes, currency, timeZone, onDone }: {
  eventId: string;
  code: DiscountCode | null;
  ticketTypes: TicketOption[];
  currency: string;
  timeZone: string;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("dashboard.promote");
  const tools = useTranslations("dashboard.tools");
  const format = useFormat();
  const locked = code?.locked === true;
  const [form, setForm] = useState<DiscountInput>(() => ({
    code: code?.code ?? "",
    kind: code?.kind ?? "percent",
    value: code ? valueText(code, currency) : "",
    maxUses: code?.maxUses === null || code?.maxUses === undefined ? "" : String(code.maxUses),
    startsAt: zonedInput(code?.startsAt, timeZone),
    endsAt: zonedInput(code?.endsAt, timeZone),
    ticketTypeIds: code?.ticketTypeIds ?? [],
  }));
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<DiscountInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    // A field's own error clears once it's changed.
    if (error?.field && error.field in patch) setError(null);
  };
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);
  const kind = form.kind as DiscountKind;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveDiscountCode(eventId, code?.id ?? null, form);
      if (r.ok) onDone(code ? t("savedToast", { code: code.code }) : t("createdToast", { code: form.code.trim().toUpperCase() }));
      else setError({ message: r.error, field: r.field === "ticketTypeIds" ? "ticketTypes" : r.field });
    });
  };

  const formId = "discount-code-form";
  return (
    <DialogContent
      title={code ? t("dialog.editTitle", { code: code.code }) : t("dialog.newTitle")}
      closeLabel={tools("close")}
      footer={
        <>
          <DialogClose><Button variant="secondary">{tools("cancel")}</Button></DialogClose>
          <Button variant="primary" type="submit" form={formId} loading={pending}>{t(code ? "dialog.save" : "dialog.create")}</Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        {locked && <Banner tone="info" title={t("dialog.locked")} />}
        {error && !error.field && <Banner tone="danger" title={error.message} />}
        <Field label={t("dialog.code")} hint={code ? undefined : t("dialog.codeHint")} error={fieldError("code")} required={!code}>
          <Input
            value={form.code}
            onChange={(e) => set({ code: e.target.value.toUpperCase().replace(/\s/g, "") })}
            readOnly={code !== null}
            maxLength={32}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            dir="ltr"
            className={styles.code}
          />
        </Field>
        <div className={styles.twoCol}>
          <Field label={t("dialog.kind")}>
            <Select value={form.kind} onChange={(e) => set({ kind: e.target.value })} disabled={locked}>
              {DISCOUNT_KINDS.map((k) => <option key={k} value={k}>{t(`dialog.kinds.${k}`)}</option>)}
            </Select>
          </Field>
          {kind !== "free" && (
            <Field
              label={kind === "percent" ? t("dialog.valuePercent") : t("dialog.valueFixed", { currency: currencySymbol(currency) })}
              hint={kind === "fixed" ? t("dialog.valueFixedHint", { currency }) : undefined}
              error={fieldError("value")}
              required
            >
              <Input value={form.value} onChange={(e) => set({ value: e.target.value })} inputMode={kind === "percent" ? "decimal" : "numeric"} disabled={locked} dir="ltr" />
            </Field>
          )}
        </div>
        <Field label={t("dialog.maxUses")} hint={code && code.uses > 0 ? t("dialog.maxUsesUsed", { uses: code.uses }) : t("dialog.maxUsesHint")} error={fieldError("maxUses")}>
          <Input value={form.maxUses} onChange={(e) => set({ maxUses: e.target.value })} inputMode="numeric" dir="ltr" />
        </Field>
        <div className={styles.twoCol}>
          <Field label={t("dialog.startsAt")} hint={t("dialog.startsHint")} error={fieldError("startsAt")}>
            <Input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} disabled={locked} />
          </Field>
          <Field label={t("dialog.endsAt")} hint={t("dialog.endsHint")} error={fieldError("endsAt")}>
            <Input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} />
          </Field>
        </div>
        <p className={styles.muted}>{t("dialog.zone", { zone: format.zone(timeZone) })}</p>
        <fieldset className={styles.fieldset} disabled={locked} aria-describedby="discount-types-hint">
          <legend className={styles.legend}>{t("dialog.ticketTypes")}</legend>
          <p className={styles.muted} id="discount-types-hint">{t("dialog.ticketTypesHint")}</p>
          <div className={styles.checks}>
            {ticketTypes.map((tt) => (
              <Checkbox
                key={tt.id}
                label={tt.name}
                checked={form.ticketTypeIds.includes(tt.id)}
                onChange={(e) => set({ ticketTypeIds: e.target.checked ? [...form.ticketTypeIds, tt.id] : form.ticketTypeIds.filter((id) => id !== tt.id) })}
              />
            ))}
          </div>
          {fieldError("ticketTypes") && <p className={styles.fieldError} role="alert">{fieldError("ticketTypes")}</p>}
        </fieldset>
      </form>
    </DialogContent>
  );
}
