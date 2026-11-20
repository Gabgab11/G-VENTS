// Tickets for other people (Change 4 chunk 3d, D89). "Who are these tickets for?": all for the buyer
// (the default), or some for other people. The buyer adds people one by one; person k gets ticket
// k+1 (ticket 1 is always the buyer's), with a name and an optional email the ticket is sent to.
// Pure parts (unit-tested); the API checks everything again.

/** The API's cap on people per order. */
export const MAX_RECIPIENTS = 20;

export const FOR_FIELD = "tickets_for";
export const nameField = (ticket: number) => `recipient_name_${ticket}`;
export const emailField = (ticket: number) => `recipient_email_${ticket}`;

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** How many people the buyer can send tickets to: every ticket but their own, at most 20. */
export function recipientRoom(tickets: number): number {
  return Math.max(0, Math.min(MAX_RECIPIENTS, tickets - 1));
}

export type Recipient = { name: string; email?: string };
export type RecipientError = "recipientName" | "recipientEmail" | "recipientIsBuyer" | "recipientsTooMany";

/** One person's row: the name (2-120 characters) is required; the email is optional, valid and not the buyer's. */
export function checkRecipient(name: string, email: string, buyerEmail?: string | null): RecipientError | null {
  const n = name.trim();
  if (n.length < 2 || n.length > 120) return "recipientName";
  const e = email.trim().toLowerCase();
  if (!e) return null;
  if (e.length > 254 || !EMAIL.test(e)) return "recipientEmail";
  if (buyerEmail && e === buyerEmail.trim().toLowerCase()) return "recipientIsBuyer";
  return null;
}

type Readable = { get(name: string): FormDataEntryValue | null };
const text = (fd: Readable, name: string) => {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
};

/**
 * The people from the form, for tickets 2, 3, ... in order (the rows have no gaps). Nothing when
 * "All for me" is chosen. The rows past the order's tickets are refused by the API
 * (order.recipients_exceed_tickets); the form never shows them.
 */
export function readRecipients(fd: Readable, buyerEmail?: string | null): { recipients: Recipient[] } | { error: RecipientError } {
  if (text(fd, FOR_FIELD) !== "others") return { recipients: [] };
  const recipients: Recipient[] = [];
  for (let ticket = 2; fd.get(nameField(ticket)) !== null; ticket++) {
    if (recipients.length >= MAX_RECIPIENTS) return { error: "recipientsTooMany" };
    const name = text(fd, nameField(ticket)).trim();
    const email = text(fd, emailField(ticket)).trim().toLowerCase();
    const error = checkRecipient(name, email, buyerEmail);
    if (error) return { error };
    recipients.push(email ? { name, email } : { name });
  }
  return { recipients };
}

/** The rows to show again after a refresh: how many people a saved draft had. */
export function draftPeople(fields: Readonly<Record<string, string>>): { forOthers: boolean; people: number } {
  let people = 0;
  while (Object.hasOwn(fields, nameField(people + 2)) && people < MAX_RECIPIENTS) people++;
  return { forOthers: fields[FOR_FIELD] === "others", people };
}
