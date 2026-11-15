import { NextResponse, type NextRequest } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { apiFetch } from "@/lib/api/server";
import { isUuid } from "@/lib/forms";

// The fixed columns of gventz-api's export, in its order (guest-export.service.ts); question labels
// follow them and are the host's own words.
const COLUMNS = ["code", "number", "guest", "buyer", "email", "type", "status", "registeredAt", "checkedInAt"] as const;
const ENGLISH_COLUMNS = ["Ticket code", "Ticket number", "Guest name", "Buyer name", "Buyer email", "Ticket type", "Status", "Registered at", "Checked in at"];
const BOM = new Uint8Array([0xef, 0xbb, 0xbf]);

/** One CSV cell, as the API writes them: formula-looking text gets a `'`; quoted when needed. */
function csvCell(value: string): string {
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
function translateHeader(body: ReadableStream<Uint8Array>, header: string[]): ReadableStream<Uint8Array> {
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

// The guest list as CSV (I3), streamed from gventz-api with the signed-in user's token. The API
// allows owners, admins and finance; it audits each export and caps it at 50,000 rows. The header
// row's fixed columns are shown in the reader's language; the data stays as the API writes it.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dashboard.csv");
  if (!isUuid(id)) return new NextResponse(t("notFound"), { status: 404 });
  const res = await apiFetch(`/v1/events/${id}/guests.csv`);
  if (!res.ok || !res.body) {
    const message = res.status === 403 ? t("forbidden") : res.status === 404 ? t("notFound") : t("failed");
    return new NextResponse(message, { status: res.status === 403 || res.status === 404 ? res.status : 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const lang = await getLocale();
  const body = lang === "en" ? res.body : translateHeader(res.body, COLUMNS.map((c) => t(`header.${c}`)));
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": res.headers.get("content-disposition") ?? 'attachment; filename="guests.csv"',
      "cache-control": "no-store",
    },
  });
}
