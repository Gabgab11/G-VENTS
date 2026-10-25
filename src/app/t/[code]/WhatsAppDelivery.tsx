"use client";

import { useState } from "react";
import { normalizePhone, ticketWhatsAppMessage, whatsappLink } from "@/lib/whatsapp";

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
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function open() {
    const number = normalizePhone(phone);
    if (!number) {
      setError("Enter your WhatsApp number with its country code, for example +234 801 234 5678.");
      return;
    }
    const link = whatsappLink(businessNumber, ticketWhatsAppMessage(eventTitle, displayCode, ticketUrl));
    if (!link) {
      setError("WhatsApp delivery isn't available right now. Use the ticket link instead.");
      return;
    }
    setError("");
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="tk-wa" aria-label="Send ticket to WhatsApp">
      <p><b>Get your ticket on WhatsApp</b> Enter your WhatsApp number, then send the message that opens.</p>
      <label className="tk-wa-label" htmlFor="tk-wa-phone">Your WhatsApp number</label>
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
        <button type="button" className="tk-btn tk-go" onClick={open}>Open WhatsApp</button>
      </div>
      {error && <p id="tk-wa-error" className="tk-wa-error" role="alert">{error}</p>}
    </section>
  );
}
