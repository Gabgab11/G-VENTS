"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Lock, Plus, Trash2, Undo2 } from "lucide-react";
import Combobox from "@/components/Combobox";
import { CATEGORIES, categoryLabelKey } from "@/lib/categories";
import { zoneOptions } from "@/lib/time-zones";
import { useFormat } from "@/i18n/format-hooks";
import { Banner, Button, Card, CardHeader, Field, Input, Select, Textarea } from "@/design";
import { Dialog, DialogClose, DialogContent } from "@/design/client";
import { saveDetails } from "./actions";
import { isReschedule, localMinute, MAX_TICKET_TYPES, priceText, ticketLock, type EventForPatch, type TicketTypeForPatch } from "./details-form";
import styles from "./workspace.module.css";

type Row = { key: string; id: string; name: string; quantity: string; price: string; sold: number; currency: string; remove: boolean };

let nextKey = 1;

// The Details tab's edit form (HA4): basics, when, and ticket types, saved together with one
// PATCH. Locks follow the API: a sold type's price is fixed and it can't be removed; quantity
// never goes below sold. Moving a published event that has guests asks for confirmation first.
export default function DetailsForm({ eventId, event, guests }: { eventId: string; event: EventForPatch; guests: number }) {
  const t = useTranslations("dashboard.details");
  const root = useTranslations();
  const format = useFormat();
  const [state, action, pending] = useActionState(saveDetails, {});
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description ?? "");
  const [category, setCategory] = useState(event.category);
  const [startsAt, setStartsAt] = useState(localMinute(event.startsAtLocal));
  const [endsAt, setEndsAt] = useState(localMinute(event.endsAtLocal));
  const [zone, setZone] = useState(event.timeZone);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const zones = useMemo(
    () => (ready ? zoneOptions([event.timeZone]).map((z) => ({ value: z, label: format.zone(z) })) : [{ value: event.timeZone, label: event.timeZone.replace(/_/g, " ") }]),
    [ready, event.timeZone, format],
  );

  const currency = event.ticketTypes[0]?.currency ?? "NGN";
  const [rows, setRows] = useState<Row[]>(() => event.ticketTypes.map((tt: TicketTypeForPatch) => ({
    key: tt.id, id: tt.id, name: tt.name, quantity: tt.quantity === null ? "" : String(tt.quantity), price: priceText(tt.priceMinor, tt.currency), sold: tt.sold, currency: tt.currency, remove: false,
  })));
  const kept = rows.filter((r) => !r.remove).length;
  const update = (key: string, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const addRow = () => setRows((list) => [...list, { key: `new-${nextKey++}`, id: "", name: "", quantity: "", price: "", sold: 0, currency, remove: false }]);
  const dropRow = (r: Row) => (r.id ? update(r.key, { remove: true }) : setRows((list) => list.filter((x) => x.key !== r.key)));

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (confirmed.current) { confirmed.current = false; return; }
    if (isReschedule(event, { startsAt, endsAt, timeZone: zone })) {
      e.preventDefault();
      setConfirmOpen(true);
    }
  }

  return (
    <form ref={formRef} action={action} onSubmit={onSubmit} className={styles.stack} aria-describedby={state.error ? "details-error" : undefined}>
      <input type="hidden" name="event_id" value={eventId} />

      <Card as="section">
        <CardHeader title={t("basics")} />
        <Field label={t("title")} required>
          <Input name="title" value={title} onChange={(e) => setTitle(e.target.value)} minLength={3} maxLength={140} /></Field>
        <Field label={t("description")}>
          <Textarea name="description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <Field label={t("category")}>
          <Select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{root(categoryLabelKey(c))}</option>)}
          </Select></Field>
      </Card>

      <Card as="section">
        <CardHeader title={t("when")} />
        <div className={styles.twoCol}>
          <Field label={t("startsAt")} required>
            <Input type="datetime-local" name="starts_at" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></Field>
          <Field label={t("endsAt")} hint={t("endsAtHint")}>
            <Input type="datetime-local" name="ends_at" value={endsAt} min={startsAt || undefined} onChange={(e) => setEndsAt(e.target.value)} /></Field>
        </div>
        <div className={styles.zone}>
          <Combobox name="time_zone" label={t("timeZone")} options={zones} value={zone} onChange={setZone} placeholder={t("timeZoneSearch")} emptyText={t("timeZoneNone")} />
          <p className={styles.muted}>{t("timeZoneHint")}</p>
        </div>
        {event.status === "published" && guests > 0 && <p className={styles.muted}>{t("rescheduleNote", { count: guests })}</p>}
      </Card>

      <Card as="section">
        <CardHeader title={t("tickets")} action={<span className={styles.muted}>{t("pricesIn", { currency })}</span>} />
        {rows.map((r, i) => {
          const lock = ticketLock(r);
          if (r.remove) {
            return (
              <div key={r.key} className={styles.ticketHead}>
                <input type="hidden" name="tt_id" value={r.id} />
                <input type="hidden" name="tt_name" value={r.name} />
                <input type="hidden" name="tt_quantity" value={r.quantity} />
                <input type="hidden" name="tt_price" value={r.price} />
                <input type="hidden" name="tt_remove" value="1" />
                <span className={styles.muted}>{t("willRemove", { name: r.name })}</span>
                <Button size="sm" variant="ghost" onClick={() => update(r.key, { remove: false })}><Undo2 size={16} strokeWidth={1.75} aria-hidden />{t("undo")}</Button>
              </div>
            );
          }
          return (
            <fieldset key={r.key} className={styles.ticket}>
              <legend className="sr-only">{r.name || t("newType", { number: i + 1 })}</legend>
              <input type="hidden" name="tt_id" value={r.id} />
              <input type="hidden" name="tt_remove" value="0" />
              <div className={styles.ticketHead}>
                <strong>{r.id ? r.name || t("untitled") : t("newType", { number: i + 1 })}</strong>
                {r.sold > 0 ? <span className={styles.muted}>{t("sold", { count: r.sold })}</span>
                  : kept > 1 && <Button size="sm" variant="ghost" onClick={() => dropRow(r)} aria-label={t("removeLabel", { name: r.name || t("newType", { number: i + 1 }) })}><Trash2 size={16} strokeWidth={1.75} aria-hidden />{t("remove")}</Button>}
              </div>
              <div className={styles.ticketFields}>
                <Field label={t("typeName")} required>
                  <Input name="tt_name" value={r.name} maxLength={80} onChange={(e) => update(r.key, { name: e.target.value })} /></Field>
                <Field label={t("quantity")} hint={r.sold > 0 ? t("quantityMin", { count: r.sold }) : t("quantityHint")}>
                  <Input name="tt_quantity" type="number" inputMode="numeric" min={lock.minQuantity} step={1} value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} /></Field>
                {lock.priceLocked ? (
                  <Field label={t("price", { currency: r.currency })} hint={<><Lock size={16} strokeWidth={1.75} aria-hidden /> {t("priceLocked")}</>}>
                    <Input value={r.price} disabled readOnly />
                  </Field>
                ) : (
                  <Field label={t("price", { currency: r.currency })} hint={t("priceHint")}>
                    <Input name="tt_price" inputMode="decimal" value={r.price} placeholder="0" onChange={(e) => update(r.key, { price: e.target.value })} /></Field>
                )}
                {lock.priceLocked && <input type="hidden" name="tt_price" value={r.price} />}
              </div>
            </fieldset>
          );
        })}
        {kept < MAX_TICKET_TYPES && (
          <Button variant="secondary" size="sm" onClick={addRow} className={styles.addButton}><Plus size={16} strokeWidth={1.75} aria-hidden />{t("addType")}</Button>
        )}
      </Card>

      {state.error && <div id="details-error"><Banner tone="danger" title={state.error} /></div>}
      <div className={styles.saveBar}>
        <span className={styles.muted}>{t("saveHint")}</span>
        <Button type="submit" variant="primary" loading={pending}>{t("save")}</Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title={t("confirmTitle")}
          description={t("confirmBody", { count: guests })}
          closeLabel={t("close")}
          footer={
            <>
              <DialogClose><Button variant="secondary">{t("confirmCancel")}</Button></DialogClose>
              <Button variant="primary" onClick={() => { confirmed.current = true; setConfirmOpen(false); formRef.current?.requestSubmit(); }}>{t("confirmMove")}</Button>
            </>
          }
        />
      </Dialog>
    </form>
  );
}
