"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { normalizePhone, whatsappLink } from "@/lib/whatsapp";

// Fallback delivery: the guest types their WhatsApp number, then WhatsApp opens
// with a ready-made message to G-ventZ's business number. Nothing is sent by us,
// and the number isn't stored yet (automatic delivery needs the WhatsApp Cloud API).
export default function WhatsAppDelivery({
  businessNumber,
  eventTitle,
  displayCode,
  ticketUrl,
}: {
  businessNumber: string;
  eventTitle: string;
  displayCode: string;
  ticketUrl: string;
}) {
  const t = useTranslations("tickets.whatsapp");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function open() {
    const number = normalizePhone(phone);
    if (!number) {
      setError(t("invalid"));
      return;
    }
    // The ready-made message is in the page's language (same lines as ticketWhatsAppMessage in English).
    const link = whatsappLink(businessNumber, t("message", { title: eventTitle, code: displayCode, url: ticketUrl }));
    if (!link) {
      setError(t("unavailable"));
      return;
    }
    setError("");
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="tk-wa" aria-label={t("label")}>
      <p>{t.rich("intro", { b: (c) => <b>{c}</b> })}</p>
      <label className="tk-wa-label" htmlFor="tk-wa-phone">{t("numberLabel")}</label>
      <div className="tk-wa-row">
        <input
          id="tk-wa-phone"
          className="tk-wa-input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+234 801 234 5678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "tk-wa-error" : undefined}
        />
        <button type="button" className="tk-btn tk-go" onClick={open}>{t("open")}</button>
      </div>
      {error && <p id="tk-wa-error" className="tk-wa-error" role="alert">{error}</p>}
    </section>
  );
}
