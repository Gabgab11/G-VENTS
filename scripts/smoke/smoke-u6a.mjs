// U6a smoke: the built website (next start, :3000) against gventz-api (:4000) and local Supabase.
// Signs in with an email code (read from Mailpit), then calls the real Server Actions by id and
// fetches the rendered pages.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const APP = process.env.APP_DIR ?? process.cwd();
const require = createRequire(`${APP}/package.json`);
const { createServerClient } = require("@supabase/ssr");
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");

const SITE = "http://localhost:3000";
const SUPABASE = "http://127.0.0.1:54321";
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
const actions = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(`${APP}/.next/server/server-reference-manifest.json`, "utf8")).node).map(([id, v]) => [v.exportedName, id]),
);

let failures = 0;
const ok = (label, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "ok " : "BAD"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ---- Sign in with an email code, exactly as the browser client stores the session ----
const jar = new Map();
const supabase = createServerClient(SUPABASE, KEY, {
  cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
});
const email = `u6a-${Date.now()}@example.com`;
// The local admin API hands out the same one-time code the email would carry.
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(SUPABASE, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
const code = link.data?.properties?.email_otp ?? null;
const { error: otpError } = await supabase.auth.verifyOtp({ email, token: code ?? "", type: "email" });
ok("sign in with an email code", !otpError && jar.size > 0, otpError?.message ?? `${jar.size} cookie(s)`);
const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");

const page = (path) => fetch(`${SITE}${path}`, { headers: { cookie }, redirect: "manual" });
/** Rendered HTML without React's text separators, so sentences can be matched whole. */
const text = async (res) => (await res.text()).replace(/<!-- -->/g, "");
/** A useActionState action (prevState, formData), encoded like React's encodeReply. */
async function formAction(name, path, fields) {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  const body = await encodeReply([undefined, fd]);
  return fetch(`${SITE}${path}`, { method: "POST", body, redirect: "manual", headers: { cookie, "next-action": actions[name], origin: SITE, accept: "text/x-component" } });
}
async function plainAction(name, path, args) {
  const body = await encodeReply(args);
  return fetch(`${SITE}${path}`, { method: "POST", body, redirect: "manual", headers: { cookie, "next-action": actions[name], origin: SITE, accept: "text/x-component", ...(typeof body === "string" ? { "content-type": "text/plain;charset=UTF-8" } : {}) } });
}
const redirectOf = (res) => res.headers.get("x-action-redirect")?.split(";")[0] ?? null;

// ---- Create and publish ----
const created = await formAction("createEvent", "/events/new", [
  ["title", "U6a Smoke Night"], ["category", "Music"], ["date", "2027-06-05"], ["time", "19:00"],
  ["country_code", "NG"], ["region", "Lagos"], ["venue", "Eko Hotel"],
  ["tier_name", "Regular"], ["tier_qty", ""], ["tier_name", "VIP"], ["tier_qty", "20"],
  ["per_buyer_limit", "4"], ["show_attendee_count", "on"], ["cover_theme", "ocean"], ["intent", "publish"],
]);
const eventPath = redirectOf(created);
ok("create + publish through the API", !!eventPath?.startsWith("/e/"), eventPath ?? `${created.status} ${(await created.text()).slice(0, 200)}`);

// ---- Public page ----
const html = await text(await page(eventPath));
const eventId = /name="event_id" value="([0-9a-f-]{36})"/.exec(html)?.[1];
const types = [...html.matchAll(/name="qty_([0-9a-f-]{36})"/g)].map((m) => m[1]);
ok("public page shows the order form", !!eventId && types.length === 2 && html.includes("U6a Smoke Night") && html.includes("Up to 4 tickets per person"), `${types.length} ticket types`);

// ---- Order 3 tickets ----
const ordered = await formAction("placeOrder", eventPath, [
  ["event_id", eventId], [`qty_${types[0]}`, "2"], [`qty_${types[1]}`, "1"], ["guest_2", "Tolu Ade"], ["guest_3", ""], ["buyer_name", "Ada Obi"],
]);
const orderPath = redirectOf(ordered);
ok("get 3 tickets", !!orderPath?.startsWith("/orders/"), orderPath ?? `${ordered.status} ${(await ordered.text()).slice(0, 300)}`);

const over = await formAction("placeOrder", eventPath, [["event_id", eventId], [`qty_${types[0]}`, "2"], ["buyer_name", "Ada Obi"]]);
const overText = await over.text();
ok("over the per-person limit shows the API's message", !redirectOf(over) && overText.includes("You can get 1 more ticket(s) for this event."));

const orderHtml = await (await page(orderPath)).text();
const codes = [...new Set([...orderHtml.matchAll(/href="\/t\/([0-9a-f]{24})"/g)].map((m) => m[1]))];
ok("order page lists every ticket with a QR", orderHtml.includes("You&#x27;re in") && codes.length === 3 && orderHtml.includes("Tolu Ade") && orderHtml.includes("<svg"), `${codes.length} tickets`);

// ---- Ticket page ----
const tolu = codes[1];
const ticketHtml = await text(await page(`/t/${tolu}`));
ok("ticket page: guest, n of m, staff check-in button", ticketHtml.includes("Tolu Ade") && ticketHtml.includes("2 of 3") && ticketHtml.includes("Check in Tolu"));

// ---- Door scanner ----
const scanPage = await page(`/dashboard/${eventId}/scan`);
ok("scanner page for the host", scanPage.status === 200 && (await scanPage.text()).includes("Scan tickets"));
const first = await (await plainAction("scanTicket", `/dashboard/${eventId}/scan`, [eventId, `${SITE}/t/${tolu}`])).text();
ok("scan: green", first.includes('"result":"green"') && first.includes("checked_in"));
const second = await (await plainAction("scanTicket", `/dashboard/${eventId}/scan`, [eventId, tolu])).text();
ok("scan again: already used", second.includes('"reason":"already_used"'));

// ---- My tickets ----
const mine = await (await page("/my-tickets")).text();
ok("my tickets lists the order", mine.includes("U6a Smoke Night") && mine.includes("Open ticket"));

// ---- Signed out ----
const anon = await (await fetch(`${SITE}${eventPath}`)).text();
ok("signed-out visitors see the sign-up card", anon.includes("Sign up to get tickets") && !anon.includes('name="event_id"'));

process.exit(failures === 0 ? 0 : 1);
