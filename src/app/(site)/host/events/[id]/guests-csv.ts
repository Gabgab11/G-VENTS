// The guest list CSV's header in the reader's language (I3). gventz-api writes fixed English column
// names (guest-export.service.ts), then the host's question labels; only the fixed part is replaced.

/** The fixed columns of gventz-api's export, in its order; ids under dashboard.csv.header. */
export const COLUMNS = ["code", "number", "guest", "buyer", "email", "phone", "gender", "recipient", "type", "status", "registeredAt", "checkedInAt"] as const;
/** The same columns as the API writes them. */
export const ENGLISH_COLUMNS = [
  "Ticket code", "Ticket number", "Guest name", "Buyer name", "Buyer email", "Buyer phone", "Buyer gender", "Recipient email",
  "Ticket type", "Status", "Registered at", "Checked in at",
];
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/** One CSV cell, as the API writes them: formula-looking text gets a `'`; quoted when needed. */
export function csvCell(value: string): string {
  const text = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
}

function startsWith(bytes: Uint8Array, prefix: Uint8Array, at = 0): boolean {
  if (bytes.length < at + prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (bytes[at + i] !== prefix[i]) return false;
  return true;
}

/**
 * The API's CSV with its fixed header cells in the reader's language. Only the start of the first
 * line is replaced; the rest of the file (question labels, every row) passes through as it comes.
 */
export function translateHeader(body: ReadableStream<Uint8Array>, header: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const english = encoder.encode(ENGLISH_COLUMNS.join(","));
  const translated = encoder.encode(header.map(csvCell).join(","));
  let buffered: Uint8Array = new Uint8Array(0);
  let passing = false;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        if (passing) return controller.enqueue(chunk);
        buffered = concat(buffered, chunk);
        const at = startsWith(buffered, BOM) ? BOM.length : 0;
        if (buffered.length < at + english.length) return;
        passing = true;
        controller.enqueue(startsWith(buffered, english, at) ? concat(concat(buffered.subarray(0, at), translated), buffered.subarray(at + english.length)) : buffered);
      },
      flush(controller) {
        if (!passing && buffered.length > 0) controller.enqueue(buffered);
      },
    }),
  );
}

