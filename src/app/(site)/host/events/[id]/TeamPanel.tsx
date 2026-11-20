"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Mail, UserPlus } from "lucide-react";
import { useFormat } from "@/i18n/format-hooks";
import { Avatar, Badge, Banner, Button, Card, CardHeader, Field, Input, Select } from "@/design";
import { Dialog, DialogClose, DialogContent, ToastProvider, useToast } from "@/design/client";
import { changeMemberRole, inviteMember, removeMember, resendInvite, revokeInvite } from "./team-actions";
import { MEMBER_ROLES, PRIMARY_ROLES, roleOptions, type MemberRole, type TeamInvite, type TeamMember } from "./team-roles";
import styles from "./tools.module.css";

type Props = {
  eventId: string;
  eventTitle: string;
  members: TeamMember[];
  invites: TeamInvite[];
  canManage: boolean;
  selfId: string;
  timeZone: string;
};

const ICON = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

export default function TeamPanel(props: Props) {
  const t = useTranslations("dashboard");
  return (
    <ToastProvider closeLabel={t("tools.close")}>
      <Team {...props} />
    </ToastProvider>
  );
}

function Team({ eventId, members, invites, canManage, selfId, timeZone }: Props) {
  const t = useTranslations("dashboard.team");
  const tools = useTranslations("dashboard.tools");
  const format = useFormat();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const roleName = (role: string) => ((MEMBER_ROLES as readonly string[]).includes(role) || role === "owner" ? t(`roles.${role}.name`) : role);
  const nameOf = (m: TeamMember) => m.name || m.email || t("unnamed");

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    startTransition(async () => {
      const r = await work();
      toast(r.ok ? { title: success, tone: "success" } : { title: r.error ?? "", tone: "danger" });
    });

  return (
    <div className={styles.stack}>
      <Card as="section">
        <CardHeader title={t("title")} />
        <p className={styles.muted}>{t("intro")}</p>
        {!canManage && <Banner tone="info" title={t("readOnly")} />}
        <ul className={styles.rows}>
          {members.map((m) => {
            const name = nameOf(m);
            const editable = canManage && m.role !== "owner";
            return (
              <li key={m.userId} className={styles.row}>
                <Avatar name={name} size={36} />
                <span className={styles.rowMain}>
                  <strong>{name}{m.userId === selfId ? ` ${t("you")}` : ""}</strong>
                  <span className={styles.muted}>
                    {[m.name && m.email ? m.email : null, m.joinedAt ? t("joined", { date: format.dateTime(m.joinedAt, timeZone, "compact") }) : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className={styles.rowSide}>
                  {editable ? (
                    <Select
                      aria-label={t("roleLabel", { name })}
                      className={styles.roleSelect}
                      value={m.role}
                      disabled={pending}
                      onChange={(e) => {
                        const role = e.target.value as MemberRole;
                        run(() => changeMemberRole(eventId, m.userId, role), t("changedToast", { name, role: roleName(role) }));
                      }}
                    >
                      {MEMBER_ROLES.map((r) => <option key={r} value={r}>{roleName(r)}</option>)}
                    </Select>
                  ) : (
                    <Badge tone={m.role === "owner" ? "accent" : "neutral"} plain>{roleName(m.role)}</Badge>
                  )}
                  {editable && (
                    <Button size="sm" variant="ghost" onClick={() => setRemoving(m)} aria-label={t("removeLabel", { name })}>{t("remove")}</Button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage && <InviteForm eventId={eventId} roleName={roleName} />}

      {canManage && (
        <Card as="section">
          <CardHeader title={t("pending.title")} />
          {invites.length === 0 ? (
            <p className={styles.muted}>{t("pending.none")}</p>
          ) : (
            <ul className={styles.rows}>
              {invites.map((i) => (
                <li key={i.id} className={styles.row}>
                  <Avatar name={i.email} size={36} />
                  <span className={styles.rowMain}>
                    <strong><bdi>{i.email}</bdi></strong>
                    <span className={styles.muted}>
                      {[roleName(i.role), t("pending.expires", { date: format.dateTime(i.expiresAt, timeZone, "compact") }), i.invitedBy?.name ? t("pending.invitedBy", { name: i.invitedBy.name }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className={styles.rowSide}>
                    <Button size="sm" variant="secondary" disabled={pending} aria-label={t("pending.resendLabel", { email: i.email })}
                      onClick={() => run(() => resendInvite(eventId, i.id), t("pending.resentToast", { email: i.email }))}>
                      <Mail {...ICON} />{t("pending.resend")}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={pending} aria-label={t("pending.revokeLabel", { email: i.email })}
                      onClick={() => run(() => revokeInvite(eventId, i.id), t("pending.revokedToast", { email: i.email }))}>
                      {t("pending.revoke")}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        {removing && (
          <DialogContent
            title={t("removeTitle", { name: nameOf(removing) })}
            description={t("removeBody")}
            closeLabel={tools("close")}
            footer={
              <>
                <DialogClose><Button variant="secondary">{tools("cancel")}</Button></DialogClose>
                <Button
                  variant="danger"
                  loading={pending}
                  onClick={() => {
                    const m = removing;
                    startTransition(async () => {
                      const r = await removeMember(eventId, m.userId);
                      setRemoving(null);
                      toast(r.ok ? { title: t("removedToast", { name: nameOf(m) }), tone: "success" } : { title: r.error, tone: "danger" });
                    });
                  }}
                >
                  {t("removeConfirm")}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function InviteForm({ eventId, roleName }: { eventId: string; roleName: (role: string) => string }) {
  const t = useTranslations("dashboard.team");
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<MemberRole>("checkin");
  const [more, setMore] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await inviteMember(eventId, email, role);
      if (r.ok) {
        toast({ title: t("invite.sentToast", { email: email.trim() }), tone: "success" });
        setEmail("");
      } else {
        setError({ message: r.error, field: r.field });
      }
    });
  };

  return (
    <Card as="section">
      <CardHeader title={t("invite.title")} />
      <form className={styles.form} onSubmit={submit} noValidate>
        {error && error.field !== "email" && <Banner tone="danger" title={error.message} />}
        <Field label={t("invite.email")} hint={t("invite.emailHint")} error={error?.field === "email" ? error.message : undefined} required>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" inputMode="email" dir="ltr" maxLength={254} />
        </Field>
        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>{t("invite.role")}</legend>
          <div className={styles.choices}>
            {roleOptions(more, role).map((r) => (
              <label key={r} className={styles.choice}>
                <input type="radio" name="team-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span className={styles.choiceName}>{roleName(r)}</span>
                <span className={styles.choiceHelp}>{t(`roles.${r}.help`)}</span>
              </label>
            ))}
          </div>
          <Button size="sm" variant="ghost" type="button" aria-expanded={more} onClick={() => {
            if (more && !(PRIMARY_ROLES as readonly string[]).includes(role)) setRole("checkin");
            setMore(!more);
          }} className={styles.moreButton}>
            {t(more ? "invite.fewerRoles" : "invite.moreRoles")}
          </Button>
        </fieldset>
        <div className={styles.actions}>
          <Button variant="primary" type="submit" loading={pending}><UserPlus {...ICON} />{t("invite.send")}</Button>
        </div>
      </form>
    </Card>
  );
}

