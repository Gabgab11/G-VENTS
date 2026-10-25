// "ada.lovelace@gmail.com" -> "a••••••••@gmail.com". Shown on the ticket page so the
// full address isn't exposed to anyone who has the ticket link.
export function maskEmail(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return "your email address";
  const name = email.slice(0, at);
  const domain = email.slice(at + 1);
  return `${name.charAt(0)}${"•".repeat(Math.max(3, name.length - 1))}@${domain}`;
}
