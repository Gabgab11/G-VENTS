import { getLocale, getTranslations } from "next-intl/server";
import { Download, ReceiptText } from "lucide-react";
import { api, data } from "@/lib/api/server";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/i18n/languages";
import { Button, Card, CardHeader, EmptyState, Table, Td, Th } from "@/design";
import styles from "./payouts.module.css";

// Settlements by event (D84): what guests paid, Paystack's and G-ventZ's fees, refunds and what is
// left for the host, per event and currency, from the ledger (GET /v1/host/settlements). Paystack
// pays each sale into the host's bank; G-ventZ holds nothing.
export default async function Settlements() {
  const result = await (await api()).GET("/v1/host/settlements").then(data).catch((error) => {
    console.error("[host] settlements:", error);
    return null;
  });
  const [t, lang] = await Promise.all([getTranslations("host.payouts"), getLocale() as Promise<Locale>]);
  if (!result) return <Card as="section"><CardHeader title={t("title")} /><p className={styles.muted} role="alert">{t("failed")}</p></Card>;
  const money = (minor: number, currency: string) => formatMoney(minor, currency, lang);
  const refunds = result.rows.some((r) => r.refundsMinor + r.disputesLostMinor > 0);

  return (
    <Card as="section">
      <CardHeader
        title={t("title")}
        action={result.rows.length > 0 ? <Button href="/host/payouts/settlements.csv" size="sm" variant="secondary" download><Download size={16} strokeWidth={1.75} aria-hidden /> {t("csv")}</Button> : undefined}
      />
      {result.rows.length === 0 ? (
        <EmptyState icon={<ReceiptText size={20} strokeWidth={1.75} aria-hidden />} title={t("none")}>{t("noneHint")}</EmptyState>
      ) : (
        <>
          <Table caption={t("caption")}>
            <thead>
              <tr>
                <Th>{t("col.event")}</Th>
                <Th numeric>{t("col.orders")}</Th>
                <Th numeric>{t("col.gross")}</Th>
                <Th numeric>{t("col.paystack")}</Th>
                <Th numeric>{t("col.gventz")}</Th>
                {refunds && <Th numeric>{t("col.refunds")}</Th>}
                <Th numeric>{t("col.net")}</Th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r) => (
                <tr key={`${r.eventId}-${r.currency}`}>
                  <Td label={t("col.event")}><a href={`/host/events/${r.eventId}`} className={styles.event}>{r.eventTitle}</a></Td>
                  <Td label={t("col.orders")} numeric>{r.ordersPaid.toLocaleString(lang)}</Td>
                  <Td label={t("col.gross")} numeric>{money(r.grossMinor, r.currency)}</Td>
                  <Td label={t("col.paystack")} numeric>{money(r.paystackFeesMinor, r.currency)}</Td>
                  <Td label={t("col.gventz")} numeric>{money(r.gventzFeesMinor + r.vatMinor, r.currency)}</Td>
                  {refunds && <Td label={t("col.refunds")} numeric>{money(r.refundsMinor + r.disputesLostMinor, r.currency)}</Td>}
                  <Td label={t("col.net")} numeric><strong>{money(r.netMinor, r.currency)}</strong></Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {result.totals.map((s) => (
                <tr key={s.currency} className={styles.total}>
                  <Th scope="row">{result.totals.length > 1 ? t("totalIn", { currency: s.currency }) : t("total")}</Th>
                  <Td label={t("col.orders")} numeric>{s.ordersPaid.toLocaleString(lang)}</Td>
                  <Td label={t("col.gross")} numeric>{money(s.grossMinor, s.currency)}</Td>
                  <Td label={t("col.paystack")} numeric>{money(s.paystackFeesMinor, s.currency)}</Td>
                  <Td label={t("col.gventz")} numeric>{money(s.gventzFeesMinor + s.vatMinor, s.currency)}</Td>
                  {refunds && <Td label={t("col.refunds")} numeric>{money(s.refundsMinor + s.disputesLostMinor, s.currency)}</Td>}
                  <Td label={t("col.net")} numeric><strong>{money(s.netMinor, s.currency)}</strong></Td>
                </tr>
              ))}
            </tfoot>
          </Table>
          <p className={styles.muted}>{t("note")}</p>
        </>
      )}
    </Card>
  );
}
