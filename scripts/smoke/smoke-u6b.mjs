// U6b smoke: dashboard flows, guest list, approvals, waiting list, CSV, flyer, cancel/delete,
// home and Discover, /api/revalidate and the security headers. Built website (:3000) against
// gventz-api (:4000) and local Supabase.
import { createHmac } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const APP = process.env.APP_DIR ?? process.cwd();
const require = createRequire(`${APP}/package.json`);
const { createServerClient } = require("@supabase/ssr");
const { createClient } = require("@supabase/supabase-js");
const { encodeReply } = require("next/dist/compiled/react-server-dom-webpack/client.node");

const SITE = "http://localhost:3000";
const SUPABASE = "http://127.0.0.1:54321";
const actions = Object.fromEntries(
  Object.entries(JSON.parse(readFileSync(`${APP}/.next/server/server-reference-manifest.json`, "utf8")).node).map(([id, v]) => [v.exportedName, id]),
);
const admin = createClient(SUPABASE, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

let failures = 0;
const ok = (label, pass, detail = "") => {
  if (!pass) failures++;
  console.log(`${pass ? "ok " : "BAD"} ${label}${detail ? ` — ${detail}` : ""}`);
};

async function signIn(label) {
  const jar = new Map();
  const supabase = createServerClient(SUPABASE, process.env.SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))) },
  });
  const email = `${label}-${Date.now()}@example.com`;
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  await supabase.auth.verifyOtp({ email, token: link.data.properties.email_otp, type: "email" });
  return [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
}

const text = async (res) => (await res.text()).replace(/<!-- -->/g, "");
const get = (cookie, path) => fetch(`${SITE}${path}`, { headers: cookie ? { cookie } : {}, redirect: "manual" });
async function form(cookie, name, path, fields, stateful) {
  const fd = new FormData();
  for (const [k, v] of fields) fd.append(k, v);
  const body = await encodeReply(stateful ? [undefined, fd] : [fd]);
  return fetch(`${SITE}${path}`, { method: "POST", body, redirect: "manual", headers: { cookie, "next-action": actions[name], origin: SITE, accept: "text/x-component" } });
}
const redirectOf = (res) => res.headers.get("x-action-redirect")?.split(";")[0] ?? null;
const query = (res) => new URL(redirectOf(res) ?? "/", SITE).searchParams;

const host = await signIn("host");
const guest1 = await signIn("guest1");
const guest2 = await signIn("guest2");
const guest3 = await signIn("guest3");

async function createEvent(title, extra = []) {
  const res = await form(host, "createEvent", "/events/new", [
    ["title", title], ["category", "Music"], ["date", "2027-07-10"], ["time", "19:00"], ["country_code", "NG"], ["region", "Lagos"], ["venue", "Eko Hotel"],
    ["tier_name", "Regular"], ["tier_qty", ""], ["per_buyer_limit", "4"], ["show_attendee_count", "on"], ["intent", "publish"], ...extra,
  ], true);
  const path = redirectOf(res);
  const html = await text(await get(host, path));
  return { path, id: /name="event_id" value="([0-9a-f-]{36})"/.exec(html)?.[1] ?? /"\/dashboard\/([0-9a-f-]{36})"/.exec(html)?.[1], tier: /name="qty_([0-9a-f-]{36})"/.exec(html)?.[1] };
}
async function order(cookie, ev, quantity = 1) {
  return redirectOf(await form(cookie, "placeOrder", ev.path, [["event_id", ev.id], [`qty_${ev.tier}`, String(quantity)], ["buyer_name", "Ada Obi"]], true));
}

// ---- Event A: settings, questions, flyer, capacity, waiting list ----
const a = await createEvent("U6b Main Night");
ok("create event A", !!a.id && !!a.tier, a.path ?? "");
const dash = `/dashboard/${a.id}`;
const list = await text(await get(host, "/dashboard"));
ok("dashboard lists the event with its role-based controls", list.includes("U6b Main Night") && list.includes("Manage"));

let r = await form(host, "updateEventDetails", dash, [["event_id", a.id], ["title", "U6b Main Night Live"], ["description", "Bring friends"], ["visibility", "public"], ["refund_policy", ""]]);
ok("edit details", query(r).get("ok") === "details_saved");
r = await form(host, "updateEventDetails", dash, [["event_id", a.id], ["title", "No"]]);
ok("a too-short title is refused before the API", query(r).get("err") === "title_length");

r = await form(host, "addQuestion", dash, [["event_id", a.id], ["label", "T-shirt size"], ["kind", "options"], ["options", "S\nM\nL"]]);
ok("add a question", query(r).get("ok") === "question_added");
r = await form(host, "addQuestion", dash, [["event_id", a.id], ["label", "Pick"], ["kind", "options"], ["options", "Only"]]);
ok("an API rule error comes back as its code", query(r).get("err") === "api.question.options_count");
const regHtml = await text(await get(host, `${dash}?tab=registration`));
const qid = /name="question_id" value="([0-9a-f-]{36})"/.exec(regHtml)?.[1];
r = await form(host, "deleteQuestion", dash, [["event_id", a.id], ["question_id", qid ?? ""]]);
ok("remove the question", query(r).get("ok") === "question_removed");
const errPage = await text(await get(host, `${dash}?tab=registration&err=api.question.options_count`));
ok("the page shows the API's wording for the code", errPage.includes("Add at least 2 different options."));

const png = new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(64).fill(1)])], { type: "image/png" });
const flyerForm = new FormData();
flyerForm.append("event_id", a.id);
flyerForm.append("flyer", png, "flyer.png");
const flyerBody = await encodeReply([flyerForm]);
r = await fetch(`${SITE}${dash}`, { method: "POST", body: flyerBody, redirect: "manual", headers: { cookie: host, "next-action": actions.uploadFlyer, origin: SITE, accept: "text/x-component" } });
ok("upload a flyer (signed upload to local Storage, checked by the API)", query(r).get("ok") === "flyer_uploaded", redirectOf(r) ?? "");
const settingsHtml = await text(await get(host, `${dash}?tab=settings`));
ok("the settings tab shows the flyer from Storage", settingsHtml.includes("/storage/v1/object/public/event-covers/"));

r = await form(host, "setCapacity", dash, [["event_id", a.id], ["capacity", "1"]]);
ok("set capacity 1", query(r).get("ok") === "capacity_set");
ok("guest 1 gets the last place", (await order(guest1, a))?.startsWith("/orders/"));
ok("guest 2 joins the waiting list", (await order(guest2, a))?.startsWith("/orders/"));
let guests = await text(await get(host, `${dash}?tab=guests`));
ok("guest list shows totals and the waiting list", guests.includes("1 confirmed") && guests.includes("1 on the waiting list") && guests.includes("Give the next waiting group tickets"));
r = await form(host, "promoteFromWaitlist", dash, [["event_id", a.id]]);
ok("promote with no free place shows the API's message", query(r).get("err") === "api.waitlist.none_fits");
await form(host, "setCapacity", dash, [["event_id", a.id], ["capacity", "2"]]);
r = await form(host, "promoteFromWaitlist", dash, [["event_id", a.id]]);
ok("promote after raising capacity", query(r).get("ok") === "promoted");
guests = await text(await get(host, `${dash}?tab=guests&q=%40example.com&status=confirmed`));
ok("search by @domain with a status filter", (guests.match(/class="guest-row"/g) ?? []).length === 2);

const csv = await get(host, `${dash}/guests.csv`);
const csvBytes = Buffer.from(await csv.arrayBuffer());
ok("CSV export streams the API's file", csv.status === 200 && csv.headers.get("content-type")?.startsWith("text/csv") && csvBytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])) && csvBytes.toString("utf8").includes("Ticket code"));
const csvGuest = await get(guest1, `${dash}/guests.csv`);
ok("a guest can't export", csvGuest.status === 404 || csvGuest.status === 403, String(csvGuest.status));
// The root loading.tsx streams pages, so "not found" arrives in the body rather than the status.
const outsider = await text(await get(guest1, dash));
ok("a guest sees 'Page not found' and no event data on the dashboard", outsider.includes("Page not found") && !outsider.includes("Give the next waiting group") && !outsider.includes("Export CSV"));

// ---- Announcements on event A (C2): draft, send within the free plan, the event limit ----
r = await form(host, "createAnnouncement", dash, [["event_id", a.id], ["segment", "all"], ["subject", "Doors open at 6"], ["body", "Bring your QR code."]]);
ok("save an announcement draft", query(r).get("ok") === "announcement_saved");
let ann = await text(await get(host, `${dash}?tab=announcements`));
const annId = /name="announcement_id" value="([0-9a-f-]{36})"/.exec(ann)?.[1];
ok("the tab shows the free plan and a send button sized to the audience", ann.includes("2 of 2") && ann.includes("1,000 of 1,000") && ann.includes("Send to 2 guests") && !!annId);
r = await form(host, "sendAnnouncement", dash, [["event_id", a.id], ["announcement_id", annId ?? ""]]);
ok("send it", query(r).get("ok") === "announcement_sending");
r = await form(host, "sendAnnouncement", dash, [["event_id", a.id], ["announcement_id", annId ?? ""]]);
ok("sending twice shows the API's message", query(r).get("err") === "api.announcement.already_sent");
ann = await text(await get(host, `${dash}?tab=announcements`));
ok("the tab counts the send against both allowances", ann.includes("1 of 2") && ann.includes("998 of 1,000") && /Sen(t|ding) · \d of 2 emailed/.test(ann));

// ---- Event B: approvals ----
const b = await createEvent("U6b Approval Night", [["require_approval", "on"]]);
await order(guest1, b);
await order(guest3, b);
const bDash = `/dashboard/${b.id}`;
let pending = await text(await get(host, `${bDash}?tab=guests`));
const orderIds = [...new Set([...pending.matchAll(/name="order_id" value="([0-9a-f-]{36})"/g)].map((m) => m[1]))];
ok("requests waiting for approval are grouped by order", pending.includes("Requests waiting for you") && orderIds.length === 2);
r = await form(host, "approveOrder", bDash, [["event_id", b.id], ["order_id", orderIds[0]]]);
ok("approve", query(r).get("ok") === "approved");
r = await form(host, "declineOrder", bDash, [["event_id", b.id], ["order_id", orderIds[1]], ["message", "Full this time"]]);
ok("decline with a message", query(r).get("ok") === "declined");
r = await form(host, "approveOrder", bDash, [["event_id", b.id], ["order_id", orderIds[0]]]);
ok("approving twice shows the API's message", query(r).get("err") === "api.order.not_pending");
const overview = await text(await get(host, bDash));
ok("overview counts from the API", overview.includes("Waiting for approval"));

// ---- Cancel and delete ----
r = await form(host, "cancelEvent", bDash, [["event_id", b.id], ["confirm", "yes"]]);
ok("cancel event B", query(r).get("ok") === "event_cancelled");
const c = await createEvent("U6b Delete Me");
r = await form(host, "deleteEvent", `/dashboard/${c.id}`, [["event_id", c.id], ["confirm_title", "wrong"]]);
ok("delete with the wrong name is refused", query(r).get("err") === "api.event.delete_confirm");
r = await form(host, "deleteEvent", `/dashboard/${c.id}`, [["event_id", c.id], ["confirm_title", "U6b Delete Me"]]);
ok("delete event C", redirectOf(r) === "/dashboard?deleted=1");

// ---- Venue search without a Google key on the API ----
const places = await (await fetch(`${SITE}/events/new`, { method: "POST", body: await encodeReply(["eko hotel", "NG", "", "session-12345"]), headers: { cookie: host, "next-action": actions.searchPlaces, origin: SITE, accept: "text/x-component", "content-type": "text/plain;charset=UTF-8" } })).text();
ok("venue search answers through the API (not configured locally)", places.includes('"error":"not_configured"'));

// ---- Home, Discover, page refresh, headers ----
const discover = await get(null, "/discover");
const discoverHtml = await text(discover);
ok("Discover lists G-ventZ events, no outside listings", discoverHtml.includes("U6b Main Night Live") && !discoverHtml.includes("Ticketmaster") && !discoverHtml.includes("happening elsewhere"));
const csp = discover.headers.get("content-security-policy") ?? "";
ok("security headers: CSP with the Supabase origin, camera for this site", csp.includes("connect-src 'self' http://127.0.0.1:54321") && csp.includes("frame-ancestors 'none'") && (discover.headers.get("permissions-policy") ?? "").includes("camera=(self)"));

const body = JSON.stringify({ paths: ["/", "/discover"] });
const ts = Math.floor(Date.now() / 1000);
const sig = createHmac("sha256", "local-revalidate-secret-0123456789abcdef").update(`${ts}.${body}`).digest("hex");
const good = await fetch(`${SITE}/api/revalidate`, { method: "POST", body, headers: { "x-gventz-timestamp": String(ts), "x-gventz-signature": sig } });
const forged = await fetch(`${SITE}/api/revalidate`, { method: "POST", body, headers: { "x-gventz-timestamp": String(ts), "x-gventz-signature": "0".repeat(64) } });
ok("/api/revalidate accepts a signed call and refuses a forged one", good.status === 200 && forged.status === 401, `${good.status}/${forged.status}`);
await new Promise((res) => setTimeout(res, 1500));
const home = await text(await get(null, "/"));
ok("home shows the event after a refresh", home.includes("U6b Main Night Live"));

process.exit(failures === 0 ? 0 : 1);
