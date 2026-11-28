"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link2, MoreHorizontal, Plus } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Table, Td, Th } from "@/design";
import { Dialog, DialogClose, DialogContent, Menu, MenuContent, MenuItem, MenuTrigger, ToastProvider, useToast } from "@/design/client";
import { archiveRegistrationLink, rotateLinkToken, saveRegistrationLink } from "./registration-links-actions";
import { linkShareUrl, type LinkInput, type RegistrationLink } from "./registration-links";
import styles from "./tools.module.css";

type TicketOption = { id: string; name: string };
type Props = {
  eventId: string;
  eventUrl: string;
  links: RegistrationLink[];
  ticketTypes: TicketOption[];
};

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export default function RegistrationLinks(props: Props) {
  const t = useTranslations("dashboard");
  return (
    <ToastProvider closeLabel={t("tools.close")}>
      <LinksTable {...props} />
    </ToastProvider>
  );
}

function LinksTable({ eventId, eventUrl, links, ticketTypes }: Props) {
  const t = useTranslations("dashboard.links");
  const { toast } = useToast();
  const [editing, setEditing] = useState<RegistrationLink | "new" | null>(null);
  const [, startTransition] = useTransition();

  const copy = async (link: RegistrationLink) => {
    const url = linkShareUrl(eventUrl, link.token, link.isDefault);
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t("copied"), description: t("copiedHint", { name: link.name }), tone: "success" });
    } catch {
      toast({ title: t("copyFailed"), description: url, tone: "warning" });
    }
  };
  const rotate = (link: RegistrationLink) =>
    startTransition(async () => {
      const r = await rotateLinkToken(eventId, link.id);
      toast(r.ok ? { title: t("rotatedToast", { name: link.name }), tone: "success" } : { title: r.error, tone: "danger" });
    });
  const archive = (link: RegistrationLink) =>
    startTransition(async () => {
      const r = await archiveRegistrationLink(eventId, link.id);
      toast(r.ok ? { title: t("archivedToast", { name: link.name }), tone: "success" } : { title: r.error, tone: "danger" });
    });

  const capText = (link: RegistrationLink) =>
    link.cap === null ? t("capNone", { count: link.activeCount }) : t("capOf", { count: link.activeCount, cap: link.cap });

  const newButton = <Button size="sm" variant="primary" onClick={() => setEditing("new")}><Plus {...ICON} />{t("newLink")}</Button>;

  return (
    <div className={styles.stack}>
      <Card as="section">
        <CardHeader title={t("title")} action={newButton} />
        <p className={styles.muted}>{t("intro")}</p>
        {links.length === 0 ? (
          <EmptyState
            icon={<Link2 size={20} strokeWidth={1.75} aria-hidden />}
            title={t("empty")}
            action={<Button variant="secondary" onClick={() => setEditing("new")}><Plus {...ICON} />{t("newLink")}</Button>}
          >
            {t("emptyHint")}
          </EmptyState>
        ) : (
          <Table caption={<span className="sr-only">{t("title")}</span>}>
            <thead>
              <tr>
                <Th>{t("cols.name")}</Th>
                <Th numeric>{t("cols.registrations")}</Th>
                <Th>{t("cols.code")}</Th>
                <Th><span className="sr-only">{t("cols.actions")}</span></Th>
              </tr>
            </thead>
            <tbody>
              {links.map((link) => (
                <tr key={link.id}>
                  <Td label={t("cols.name")}>
                    <span className={styles.cell}>
                      <span>
                        {link.name}
                        {link.isDefault && <> <Badge tone="info" plain>{t("defaultBadge")}</Badge></>}
                      </span>
                      <span className={styles.muted}>{link.isDefault ? eventUrl : `?r=${link.token}`}</span>
                    </span>
                  </Td>
                  <Td label={t("cols.registrations")} numeric>{capText(link)}</Td>
                  <Td label={t("cols.code")}>
                    <Badge tone={link.hasCode ? "success" : "neutral"} plain>{t(link.hasCode ? "codeOn" : "codeOff")}</Badge>
                  </Td>
                  <Td label={t("cols.actions")} className={styles.menuCell}>
                    <Menu>
                      <MenuTrigger>
                        <Button size="sm" variant="ghost" icon={<MoreHorizontal {...ICON} />} aria-label={t("menuLabel", { name: link.name })} />
                      </MenuTrigger>
                      <MenuContent>
                        <MenuItem onSelect={() => void copy(link)}>{t("copyLink")}</MenuItem>
                        <MenuItem onSelect={() => setEditing(link)}>{t("edit")}</MenuItem>
                        {!link.isDefault && <MenuItem onSelect={() => rotate(link)}>{t("rotate")}</MenuItem>}
                        {!link.isDefault && <MenuItem onSelect={() => archive(link)}>{t("archive")}</MenuItem>}
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
          <LinkDialog
            key={editing === "new" ? "new" : editing.id}
            eventId={eventId}
            link={editing === "new" ? null : editing}
            ticketTypes={ticketTypes}
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

function LinkDialog({ eventId, link, ticketTypes, onDone }: {
  eventId: string;
  link: RegistrationLink | null;
  ticketTypes: TicketOption[];
  onDone: (message: string) => void;
}) {
  const t = useTranslations("dashboard.links");
  const tools = useTranslations("dashboard.tools");
  const [form, setForm] = useState<LinkInput>(() => ({
    name: link?.name ?? "",
    cap: link?.cap === null || link?.cap === undefined ? "" : String(link.cap),
    accessCode: "",
    tierId: "",
  }));
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<LinkInput>) => {
    setForm((f) => ({ ...f, ...patch }));
    if (error?.field && error.field in patch) setError(null);
  };
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveRegistrationLink(eventId, link?.id ?? null, form);
      if (r.ok) onDone(link ? t("savedToast", { name: form.name.trim() }) : t("createdToast", { name: form.name.trim() }));
      else setError({ message: r.error, field: r.field });
    });
  };

  const formId = "registration-link-form";
  return (
    <DialogContent
      title={link ? t("dialog.editTitle", { name: link.name }) : t("dialog.newTitle")}
      closeLabel={tools("close")}
      footer={
        <>
          <DialogClose><Button variant="secondary">{tools("cancel")}</Button></DialogClose>
          <Button variant="primary" type="submit" form={formId} loading={pending}>{t(link ? "dialog.save" : "dialog.create")}</Button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        {error && !error.field && <p className={styles.fieldError} role="alert">{error.message}</p>}
        <Field label={t("dialog.name")} hint={t("dialog.nameHint")} error={fieldError("name")} required>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={60} autoComplete="off" />
        </Field>
        <div className={styles.twoCol}>
          <Field label={t("dialog.cap")} hint={t("dialog.capHint")} error={fieldError("cap")}>
            <Input value={form.cap} onChange={(e) => set({ cap: e.target.value })} inputMode="numeric" dir="ltr" placeholder={t("dialog.capPlaceholder")} />
          </Field>
          <Field
            label={t("dialog.code")}
            hint={link?.hasCode ? t("dialog.codeHintSet") : t("dialog.codeHint")}
            error={fieldError("accessCode")}
          >
            <Input
              value={form.accessCode}
              onChange={(e) => set({ accessCode: e.target.value.replace(/\s/g, "") })}
              maxLength={32}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              dir="ltr"
              className={styles.code}
              placeholder={link?.hasCode ? t("dialog.codePlaceholderSet") : undefined}
            />
          </Field>
        </div>
        {!link && ticketTypes.length > 0 && (
          <Field label={t("dialog.tier")} hint={t("dialog.tierHint")}>
            <Select value={form.tierId} onChange={(e) => set({ tierId: e.target.value })}>
              <option value="">{t("dialog.tierNone")}</option>
              {ticketTypes.map((tt) => <option key={tt.id} value={tt.id}>{tt.name}</option>)}
            </Select>
          </Field>
        )}
      </form>
    </DialogContent>
  );
}
