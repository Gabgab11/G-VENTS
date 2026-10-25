// WhatsApp helpers for the ticket page. No server calls: these only build a
// wa.me link, which opens WhatsApp on the guest's phone with a message ready to send.

// Accepts "+234 801 234 5678", "0023480…" or "+2348012345678" and returns
// international format (E.164), or null when the number can't be valid.
export function normalizePhone(input: string): string | null {
  let s = input.trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(s)) return null;
  return s;
}

// wa.me takes digits only, no "+" or spaces.
export function whatsappLink(businessNumber: string, message: string): string | null {
  const digits = businessNumber.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function ticketWhatsAppMessage(eventTitle: string, displayCode: string, ticketUrl: string): string {
  return [
    `Hi G-ventZ, please send my ticket for ${eventTitle}.`,
    `Ticket code: ${displayCode}`,
    `Ticket link: ${ticketUrl}`,
  ].join("\n");
}
