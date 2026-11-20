import { getLocale, getTranslations } from "next-intl/server";
import { CalendarPlus, CheckCircle2, Circle, ReceiptText } from "lucide-react";
import { api, data } from "@/lib/api/server";
import type { components } from "@/lib/api/schema";
import { formatDateTime, formatMoney, formatRelative } from "@/lib/format";
import { themeBackground } from "@/lib/themes";
import type { Locale } from "@/i18n/languages";
import { Badge, Button, Card, CardHeader, EmptyState, PageHeader, Stat, TabLink, TabLinks } from "@/design";
import { statusTone } from "./orders/query";
import { deltaOf, PERIOD_KEY, PERIODS, periodOf, stepsDone } from "./host-format";
import ProfileSetupBanner from "./ProfileSetupBanner";
import styles from "./host.module.css";

type Home = components["schemas"]["HostHomeDto"];
type Payout = components["schemas"]["HostHomePayoutDto"];

const ICON = { size: 20, strokeWidth: 1.75, "aria-hidden": true } as const;

// Host home (HA2): a setup checklist for new hosts; metrics, the next event, payouts and recent
// orders for active ones. One request (GET /v1/host/home), per NFR-13.
export default async function HostHomePage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const period = periodOf((await searchParams).period);
  const [home, me, profile, t, lang, statusT] = await Promise.all([
    (await api()).GET("/v1/host/home", { params: { query: { period } } }).then(data),
    (await api()).GET("/v1/me").then(data).catch(() => null),
    (await api()).GET("/v1/me/profile").then(data).catch(() => null),
    getTranslations("host.home"),
    getLocale() as Promise<Locale>,
    getTranslations("host.orders.status"),
  ]);
  const first = (me?.fullName ?? "").trim().split(/\s+/)[0];
  // No profile step in the API's checklist yet: a banner until the host has a handle (FR-32).
  const profileBanner = profile && !profile.handle ? (
    <ProfileSetupBanner title={t("profileBanner.title")} body={t("profileBanner.body")} action={t("profileBanner.action")} dismiss={t("profileBanner.dismiss")} />
  ) : null;

  if (home.checklist && !home.checklist.createdEvent) {
    return (
      <>
        <PageHeader title={first ? t("welcomeNamed", { name: first }) : t("welcome")} subtitle={t("welcomeLead")} />
        {profileBanner}
        <Checklist checklist={home.checklist} t={t} />
      </>
    );
  }

  const m = home.metrics;
  const vs = t(`vs.${PERIOD_KEY[period]}`);
  const figure = (f: { current: number; change: number | null }) => {
    const d = deltaOf(f.change, f.current);
    return d ? { delta: { trend: d.trend, text: t(`delta.${d.trend}`, { percent: d.percent, vs }) } } : { context: t("noCompare") };
  };

  return (
    <>
      <PageHeader title={t("title")} actions={<Button href="/host/events/new" variant="primary">{t("create")}</Button>} />
      {profileBanner}

      <TabLinks aria-label={t("periodLabel")} className={styles.periods}>
        {PERIODS.map((p) => <TabLink key={p} href={`/host?period=${p}`} active={p === period}>{t(`period.${PERIOD_KEY[p]}`)}</TabLink>)}
      </TabLinks>

      <section aria-label={t("metricsLabel")} className={styles.metrics}>
        <Stat label={t("metrics.ticketsSold")} value={m.ticketsSold.current.toLocaleString(lang)} {...figure(m.ticketsSold)} />
        {m.revenue.length === 0
            ? <Stat label={t("metrics.revenue")} value={formatMoney(0, home.payout.currency ?? "NGN", lang, true)} context={t("noPaid")} />
            : m.revenue.map((r) => <Stat key={r.currency} label={m.revenue.length > 1 ? `${t("metrics.revenue")} · ${r.currency}` : t("metrics.revenue")} value={formatMoney(r.current, r.currency, lang, true)} {...figure(r)} />)}
        <Stat label={t("metrics.checkIns")} value={m.checkIns.current.toLocaleString(lang)} {...figure(m.checkIns)} />
        <Stat label={t("metrics.upcoming")} value={m.upcomingEvents.current.toLocaleString(lang)} context={t("metrics.upcomingContext")} />
      </section>

      {home.checklist && <Checklist checklist={home.checklist} t={t} compact />}

      <div className={styles.split}>
        <Card as="section">
          <CardHeader title={t("next.title")} action={<Button href="/host/events" variant="ghost" size="sm">{t("next.all")}</Button>} />
          {home.nextEvent ? (
            <div className={styles.next}>
              <span className={styles.thumb} style={{ background: themeBackground(home.nextEvent.coverTheme) }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
                {home.nextEvent.coverUrl && <img src={home.nextEvent.coverUrl} alt="" />}
              </span>
              <div className={styles.nextText}>
                <strong className={styles.nextTitle}>{home.nextEvent.title}</strong>
                <span className={styles.muted}>{formatDateTime(home.nextEvent.startsAt, home.nextEvent.timeZone, lang, "long")}</span>
                <span className={styles.muted}>
                  {home.nextEvent.capacity === null ? t("next.sold", { sold: home.nextEvent.sold }) : t("next.soldOf", { sold: home.nextEvent.sold, capacity: home.nextEvent.capacity })}
                  {home.nextEvent.status === "draft" && <> · <Badge tone="warning">{t("next.draft")}</Badge></>}
                </span>
                <div className={styles.actions}>
                  <Button href={`/host/events/${home.nextEvent.id}`} size="sm" variant="primary">{t("next.manage")}</Button>
                  {home.nextEvent.status === "published" && <Button href={`/host/events/${home.nextEvent.id}/scan`} size="sm" variant="secondary">{t("next.scan")}</Button>}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<CalendarPlus {...ICON} />} title={t("next.none")} action={<Button href="/host/events/new" size="sm">{t("create")}</Button>} />
          )}
        </Card>

        <Card as="section">
          <CardHeader title={t("payout.title")} action={<Button href="/host/payouts" variant="ghost" size="sm">{t("payout.view")}</Button>} />
          <PayoutStatus payout={home.payout} t={t} />
        </Card>
      </div>

      <Card as="section">
        <CardHeader title={t("orders.title")} action={<Button href="/host/orders" variant="ghost" size="sm">{t("orders.all")}</Button>} />
        {home.recentOrders.length === 0 ? (
          <EmptyState icon={<ReceiptText {...ICON} />} title={t("orders.none")} />
        ) : (
          <ul className={styles.orders}>
            {home.recentOrders.map((o) => (
              <li key={o.id} className={styles.order}>
                <span className={styles.orderWho}>
                  <strong>{o.buyerName ?? t("orders.guest")}</strong>
                  <span className={styles.muted}>{o.eventTitle} · {t("orders.tickets", { count: o.tickets })}</span>
                  {o.status !== "completed" && statusT.has(o.status) && <Badge tone={statusTone(o.status)} style={{ justifySelf: "start" }}>{statusT(o.status)}</Badge>}
                </span>
                <span className={styles.orderAmount}>
                  <strong>{o.kind === "free" ? t("orders.free") : formatMoney(o.amountMinor, o.currency, lang, true)}</strong>
                  <span className={styles.muted}>{formatRelative(o.createdAt, new Date(), lang)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

type T = Awaited<ReturnType<typeof getTranslations<"host.home">>>;

function Checklist({ checklist: c, t, compact = false }: { checklist: NonNullable<Home["checklist"]>; t: T; compact?: boolean }) {
  const steps = [
    { key: "createdEvent", done: c.createdEvent, action: <Button href="/host/events/new" size="sm" variant={c.createdEvent ? "ghost" : "primary"}>{t("checklist.createdEventAction")}</Button> },
    { key: "sharedEvent", done: c.sharedEvent, action: <Button href="/host/events" size="sm" variant="secondary">{t("checklist.sharedEventAction")}</Button> },
    { key: "payoutReady", done: c.payoutReady, action: <Button href="/host/payouts" size="sm" variant="secondary">{t("checklist.payoutReadyAction")}</Button> },
    { key: "twoStep", done: c.twoStep, action: <Button href="/host/settings/security" size="sm" variant="secondary">{t("checklist.twoStepAction")}</Button> },
  ] as const;
  const done = stepsDone(c);
  return (
    <Card as="section">
      <CardHeader title={t("checklist.title")} action={<span className={styles.muted}>{t("checklist.progress", { done, total: steps.length })}</span>} />
      {!compact && <progress className={styles.progress} max={steps.length} value={done} aria-label={t("checklist.progress", { done, total: steps.length })} />}
      <ol className={styles.steps}>
        {steps.map((s) => (
          <li key={s.key} className={styles.step} data-done={s.done || undefined}>
            {s.done ? <CheckCircle2 {...ICON} className={styles.stepDone} /> : <Circle {...ICON} className={styles.stepTodo} />}
            <span className={styles.stepText}>
              <strong>{t(`checklist.${s.key}`)}</strong>
              <span className={styles.muted}>{s.done ? t("checklist.done") : t(`checklist.${s.key}Hint`)}</span>
            </span>
            {!s.done && s.action}
          </li>
        ))}
      </ol>
    </Card>
  );
}

function PayoutStatus({ payout: p, t }: { payout: Payout; t: T }) {
  if (p.canSellPaid) return <div className={styles.payout}><Badge tone="success">{t("payout.active")}</Badge><p className={styles.muted}>{t("payout.activeHint")}</p></div>;
  const tone = p.reason === "application_declined" || p.reason === "approval_revoked" || p.reason === "suspended" || p.reason === "owes_money" ? "danger" : p.reason === "application_submitted" || p.reason === "payout_account_pending" ? "info" : "neutral";
  const reason = p.reason ?? "not_applied";
  return (
    <div className={styles.payout}>
      <Badge tone={tone}>{t(`payout.status.${reason}`)}</Badge>
      <p className={styles.muted}>{t(`payout.hint.${reason}`)}</p>
      {reason === "not_applied" && <Button href="/host/payouts" size="sm" variant="primary">{t("payout.apply")}</Button>}
    </div>
  );
}
