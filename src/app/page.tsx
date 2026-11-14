import Link from "next/link";
import { getFeaturedEvents } from "@/lib/events";
import AccountLink from "./AccountLink";
import HeroCards from "./HeroCards";
import HeroTilt from "./HeroTilt";
import HeroHover from "./HeroHover";
import { pageFonts } from "@/app/fonts";
import ColorModeToggle from "@/components/ColorModeToggle";
import SocialLinks from "@/components/SocialLinks";
import FooterWordmark from "./FooterWordmark";
import "./discover/discover.css";
import Rail from "./discover/Rail";
import EventTile from "./discover/EventTile";

const CSS = `

.hp {
  --ink: #121212; --muted: #6b6a66; --line: #ebe9e2; --soft: #f6f5f1; --page: #fff; --primary:#121212; --primary-text:#fff;
  --coral: #ff5a3c; --sun: #ffc23d; --mint: #7ee0b6; --sky: #8ec5ff; --rose: #ffb3c7;
  --display: var(--font-display), "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --body: var(--font-body), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  background: var(--page); color: var(--ink); font-family: var(--body);
  min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
}
.hp :focus-visible { outline-color: var(--coral); }
:root[data-theme="dark"] .hp, :root .hp[data-color-mode="dark"] { --ink:#f4f1eb; --muted:#aaa69f; --line:#343330; --soft:#242321; --page:#151513; --primary:#ffc23d; --primary-text:#17130b; }
:root[data-theme="light"] .hp, :root .hp[data-color-mode="light"] { --ink:#121212; --muted:#6b6a66; --line:#ebe9e2; --soft:#f6f5f1; --page:#fff; --primary:#121212; --primary-text:#fff; }
:root .hp[data-color-mode="dark"] { --ink:#f4f1eb; --muted:#aaa69f; --line:#343330; --soft:#242321; --page:#151513; --primary:#ffc23d; --primary-text:#17130b; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme]) .hp:not([data-color-mode]) { --ink:#f4f1eb; --muted:#aaa69f; --line:#343330; --soft:#242321; --page:#151513; --primary:#ffc23d; --primary-text:#17130b; }
}
.hp a { color: inherit; text-decoration: none; }
.hp .hp-btn { color:var(--primary-text); background:var(--primary); }
.hp .hp-c4, .hp .hp-c5 { color: #fff; }
.hp-wrap { max-width: none; margin: 0 auto; padding: 0 clamp(24px, 5vw, 96px); }

.hp-top { display: flex; justify-content: space-between; align-items: center; padding: 18px clamp(16px, 1.6vw, 28px); width:100%; max-width:none; margin:0; }
.hp-top-actions { display:flex; align-items:center; gap:10px; }
.hp-top-actions, .hp-top-actions .cm, .hp-top-actions button, .hp-top-actions a { position:relative; z-index:5; pointer-events:auto; }
.hp-logo { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.4px; }
.hp-logo b { color: var(--coral); }
.hp-signin { font-size: 14px; font-weight: 600; border: 1px solid var(--line); padding: 9px 16px; border-radius: 999px; }

/* padding-block, not padding: the side padding comes from .hp-wrap and must survive on phones */
.hp-hero { padding-block: clamp(52px, 9vh, 130px) 30px; }
.hp-pill { display: inline-block; font-size: 13px; font-weight: 600; background: var(--soft); border: 1px solid var(--line); padding: 7px 14px; border-radius: 999px; color: var(--muted); }
.hp-hero h1 { font-family: var(--display); font-weight: 800; font-size: clamp(52px, 9.5vw, 120px); line-height: 0.95; letter-spacing: -3px; margin: 22px 0 0; }
.hp-hl { background: var(--sun); padding: 0 0.12em; border-radius: 0.15em; }
.hp-lede { max-width: 520px; color: var(--muted); font-size: clamp(16px, 2vw, 18px); line-height: 1.6; margin: 26px 0 32px; }
.hp-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.hp-btn { padding: 15px 26px; border-radius: 14px; font-weight: 600; font-size: 15px; background: var(--ink); color: #fff; display: inline-block; }
.hp-ghost { padding: 15px 26px; border-radius: 14px; font-weight: 600; font-size: 15px; border: 1px solid var(--line); color: var(--ink); display: inline-block; }

.hp-ticker { margin-top: 0; border-block: 1px solid var(--line); overflow: hidden; white-space: nowrap; padding: 16px 0; }
.hp-run { display: inline-flex; gap: 40px; animation: hp-slide 40s linear infinite; font-family: var(--display); font-weight: 800; font-size: 24px; letter-spacing: -0.5px; color: #cfcdc6; }
.hp-run span:nth-child(4n+1) { color: var(--coral); }
.hp-run span:nth-child(4n+3) { color: var(--sun); }
@keyframes hp-slide { to { transform: translateX(-50%); } }

/* Falling cards: they land in a pile resting on the ticker's top line.
   --s scales the cards, --band is the empty strip under the buttons they land in. */
.hp-stage { position: relative; --s: 0.78; --band: 258px; }
.hp-stage .hp-hero { padding-bottom: calc(30px + var(--band)); }
.hp-drop { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 0; }
/* Text sits above the falling cards; the hero's empty strip lets clicks through to the resting cards. */
.hp-stage .hp-top, .hp-stage .hp-hero { position: relative; z-index: 1; }
.hp-stage .hp-hero { pointer-events: none; }
.hp-stage .hp-hero > * { pointer-events: auto; }
.hp-fall {
  position: absolute; left: var(--left); bottom: calc(var(--bottom) * var(--s) * 1px);
  width: calc(var(--w) * var(--s) * 1px); transform-origin: 50% 100%;
  transform: rotate(var(--tilt)); pointer-events: auto;
  animation: hp-drop var(--dur) ease-in-out var(--delay) both;
}
.hp-card { display: block; border-radius: 14px; pointer-events: none; user-select: none; transform-origin: 50% 100%; transition: transform .45s cubic-bezier(.2,.8,.3,1.25); }
/* Mouse effect (HeroHover.tsx): a card near the pointer leans towards it and its shadow deepens. */
.hp-card svg { transition: filter .45s ease; }
.hp-card.hp-near svg { filter: drop-shadow(0 22px 22px rgba(60,44,20,.32)); }
.hp-card svg { display: block; width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 10px 12px rgba(60,44,20,.2)); }
@keyframes hp-drop {
  0%   { transform: translate(var(--sway), -115vh) rotate(calc(var(--tilt) + var(--spin))); }
  30%  { transform: translate(calc(var(--sway) * -0.6), -70vh) rotate(calc(var(--tilt) - var(--spin) * 0.6)); }
  60%  { transform: translate(calc(var(--sway) * 0.35), -28vh) rotate(calc(var(--tilt) + var(--spin) * 0.3)); }
  84%  { transform: translate(0, 0) rotate(var(--tilt)); }
  91%  { transform: translate(0, -7px) rotate(calc(var(--tilt) + 1.5deg)); }
  100% { transform: translate(0, 0) rotate(var(--tilt)); }
}
/* Tilt game (phones): every card drops onto the line, then slides with the tilt. */
.hp-tilting .hp-fall { bottom: calc(var(--lift) * var(--s) * 1px); transition: bottom .7s cubic-bezier(.5, 0, .75, 0); }
/* The cards move every frame while tilting: keep each on its own layer so its shadow is not repainted. */
.hp-tilting .hp-fall { will-change: translate, rotate; }
.hp-tilt { display: block; margin-top: 14px; }
.hp-tilt:empty { display: none; }
.hp-tilt-btn { appearance: none; font: inherit; font-weight: 600; font-size: 14px; color: var(--ink); background: var(--soft); border: 1px solid var(--line); border-radius: 999px; padding: 10px 16px; cursor: pointer; }
.hp-tilt-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
@media (max-width: 1099px) { .hp-stage { --s: 0.62; --band: 210px; } .hp-row3 { display: none; } }
@media (max-width: 699px) {
  .hp-stage { --s: 0.46; --band: 104px; }
  .hp-fall { left: var(--left-phone); }
  .hp-row2, .hp-row3, .hp-fall:nth-child(3), .hp-fall:nth-child(4), .hp-fall:nth-child(6) { display: none; }
}
@media (max-width: 360px) { .hp-stage { --s: 0.4; --band: 92px; } }
@media (prefers-reduced-motion: reduce) { .hp-fall { animation: none; } }

.hp-section { padding-block: 56px 20px; }
.hp-head { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.hp-head h2 { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 4vw, 40px); letter-spacing: -1px; margin: 0; }
.hp-head p { color: var(--muted); margin: 0; font-size: 15px; }

.hp-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.hp-tile { position: relative; border-radius: 22px; padding: 22px; min-height: 210px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.3s ease; animation: hp-swing 2.4s ease-in-out; }
.hp-tile:hover { transform: translateY(-4px); }
.hp-wide { grid-column: span 4; }
.hp-sq { grid-column: span 2; }
.hp-tag { font-size: 12px; font-weight: 600; opacity: 0.7; }
.hp-when { font-size: 13px; opacity: 0.65; }
.hp-tile h3 { font-family: var(--display); font-weight: 800; font-size: 30px; line-height: 1; letter-spacing: -0.8px; margin: 10px 0 0; }
.hp-c0 { background: var(--sun); }
.hp-c1 { background: var(--rose); }
.hp-c2 { background: var(--mint); }
.hp-c3 { background: var(--sky); }
.hp-c4 { background: var(--ink); color: #fff; }
.hp-c5 { background: var(--coral); color: #fff; }
.hp-empty { color: var(--muted); }
.hp-empty a { font-weight: 600; color: var(--ink); text-decoration: underline; }

@keyframes hp-swing {
  0% { transform: translate(0, 0); }
  8% { transform: translate(-6px, 21px); }
  17% { transform: translate(-21px, 36px); }
  25% { transform: translate(-42px, 42px); }
  33% { transform: translate(-63px, 36px); }
  42% { transform: translate(-78px, 21px); }
  50% { transform: translate(-84px, 0); }
  58% { transform: translate(-78px, -21px); }
  67% { transform: translate(-63px, -36px); }
  75% { transform: translate(-42px, -42px); }
  83% { transform: translate(-21px, -36px); }
  92% { transform: translate(-6px, -21px); }
  100% { transform: translate(0, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .hp-tile, .hp-run { animation: none; }
}

/* Phones: the top section is centred, with buttons stacked at one width. */
@media (max-width: 640px) {
  .hp-hero { text-align: center; }
  .hp-hero h1 { letter-spacing: -2px; }
  .hp-lede { margin-left: auto; margin-right: auto; }
  .hp-hero .hp-actions { flex-direction: column; align-items: stretch; max-width: 340px; margin: 0 auto; }
  .hp-hero .hp-actions a { text-align: center; }
}

.hp-closing { text-align: center; padding: clamp(100px,14vh,200px) 20px clamp(110px,16vh,220px); }
.hp-closing h2 { font-family: var(--display); font-weight: 800; font-size: clamp(40px, 7vw, 80px); line-height: 0.98; letter-spacing: -2.5px; margin: 0 0 28px; }

.hp-foot { border-top: 1px solid var(--line); padding: 24px clamp(20px, 5vw, 64px); color: var(--muted); font-size: 13px; max-width: 1200px; margin: 0 auto; }
.hp-foot-row { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 10px; }
.hp-foot-legal { display: flex; gap: 18px; flex-wrap: wrap; opacity: 0.8; }
.hp-footer { max-width:none; margin:0; padding:clamp(28px,4vw,56px) clamp(20px,5vw,64px) 0; border:0; background:#100d0c; color:#f8f5ef; }
.hp-footer-inner { width:100%; max-width:none; margin:0 auto; padding:0; }
.hp-footer-main { display:grid; grid-template-columns:minmax(300px,1.7fr) repeat(3,minmax(130px,1fr)) minmax(170px,1fr); gap:clamp(24px,4vw,68px); padding-bottom:54px; }
.hp-footer-brand p { max-width:390px; margin:0 0 24px; color:#d1ceca; font-family:var(--display); font-size:clamp(21px,2.2vw,30px); font-weight:700; line-height:1.3; }
.hp-footer-brand .hp-logo { display:inline-block; margin-bottom:18px; color:#fff; font-size:28px; }
.hp-footer-title { margin-bottom:20px; color:var(--sun); font-size:15px; font-weight:700; }
.hp-footer-links { display:grid; gap:14px; color:#f8f5ef; font-size:15px; }
.hp-footer-contact-label { margin:0 0 8px; color:#aaa69f; font-size:13px; }
.hp-footer-contact-group + .hp-footer-contact-group { margin-top:20px; }
.hp-footer-links a:hover,.hp-foot-legal a:hover { color:var(--coral); }
.hp-footer-bottom { display:flex; justify-content:space-between; align-items:center; gap:16px; padding:20px 0; border-top:1px solid #37312f; color:#aaa69f; }
.hp-footer-bottom .hp-foot-legal { gap:20px; }
.hp-footer-bottom p { color:#aaa69f; margin:0; }
.hp-footer-meta { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
.hp-footer .socials { display:flex; gap:8px; margin:0; padding:0; list-style:none; }
.hp-footer .socials a, .hp-footer .socials-soon { display:grid; place-items:center; width:36px; height:36px; border:1px solid #37312f; border-radius:999px; color:#f8f5ef; }
.hp-footer .socials a:hover { color:var(--coral); border-color:var(--coral); }
.hp-footer .socials-soon { opacity:.45; cursor:default; }
/* Big wordmark across the top of the footer, bold cream with the coral Z, fading out only at the very bottom.
   Letters rise into place one by one, driven by the scroll position (FooterWordmark.tsx). */
.hp-footer-wordmark { overflow:hidden; white-space:nowrap; margin:0 calc(-1 * clamp(20px,5vw,64px)) clamp(8px,2vw,28px); padding:.06em clamp(12px,2vw,32px) 0; color:#f8f5ef; font-family:var(--display); font-size:clamp(140px,32vw,980px); font-weight:800; letter-spacing:-.07em; line-height:.8; text-align:right; -webkit-mask-image:linear-gradient(to bottom,#000 78%,transparent 100%); mask-image:linear-gradient(to bottom,#000 78%,transparent 100%); user-select:none; pointer-events:none; }
.hp-footer-wordmark span { display:inline-block; transform-origin:50% 100%; will-change:transform; transition:transform .5s cubic-bezier(.2,.8,.3,1); }
.hp-footer-wordmark .wm-z { color:var(--coral); }
@media(max-width:900px) { .hp-footer-main { grid-template-columns:repeat(4,minmax(0,1fr)); gap:30px 22px; } .hp-footer-brand { grid-column:1/-1; } .hp-footer-wordmark { font-size:33vw; } }
@media(max-width:640px) { .hp-top { padding-inline:16px; } .hp-top-actions { gap:8px; } .hp-wrap { padding-inline:22px; } .hp-footer { padding:38px 20px 0; } .hp-footer-main { grid-template-columns:1fr 1fr; gap:28px 18px; } .hp-footer-brand { grid-column:1/-1; } .hp-footer-bottom { align-items:flex-start; flex-direction:column; } .hp-footer-wordmark { font-size:34vw; margin-inline:-20px; } }

@media (max-width: 820px) {
  .hp-grid { grid-template-columns: 1fr 1fr; }
  .hp-wide, .hp-sq { grid-column: span 2; }
}
`;

const TICKER = [
  "Owambe", "Outdooring", "Braai Day", "Sangeet Night", "Moji's Birthday",
  "Quinceañera", "Festa Junina", "Send-Off", "Naming Ceremony", "Mehndi",
];

// Rendered once and refreshed at most every minute, instead of on every visit.
export const revalidate = 60;

// Builds without the API setting (CI), or while the API isn't reachable yet, render no events; the
// deployed page refreshes with real ones within a minute. At runtime a failure still throws: the
// error page shows it, and a failed refresh keeps serving the last good page.
async function featuredEvents() {
  if (!process.env.API_URL) return [];
  try {
    return await getFeaturedEvents(6);
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.warn("[home] API not reachable during the build; events appear after the first refresh.");
    return [];
  }
}

export default async function HomePage() {
  const events = await featuredEvents();

  // The page is shared by every visitor, so it can't know who is signed in.
  // /events/new sends signed-out visitors to sign-up and then back to the form.
  const createHref = "/events/new";

  return (
    <main className={`hp ${pageFonts}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hp-stage">
      <HeroCards />
      <HeroHover />
      <header className="hp-top">
        <Link href="/" className="hp-logo">G-vent<b>Z</b></Link>
        <div className="hp-top-actions"><ColorModeToggle /><AccountLink /></div>
      </header>

      <section className="hp-wrap hp-hero">
        <span className="hp-pill">Create events in minutes</span>
        <h1>Every celebration,<br /><span className="hp-hl">one place.</span></h1>
        <p className="hp-lede">
          Owambe, outdooring, braai, sangeet or a Saturday birthday. Create your event, share one link, and let guests register from anywhere.
        </p>
        <div className="hp-actions">
          <Link href={createHref} className="hp-btn">Create your first event</Link>
          <Link href="/discover" className="hp-ghost">Browse events</Link>
        </div>
        <HeroTilt />
      </section>
      </div>

      <div className="hp-ticker" aria-hidden="true">
        <div className="hp-run">
          {[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <section className="hp-wrap hp-section">
        {/* Same cards and row as Discover: the event's flyer (or colour style), name, place and date. */}
        {events.length > 0 ? (
          <Rail title="Happening soon" id="hp-soon" more={{ href: "/discover", label: "See all events" }}>
            {events.map((e) => <EventTile key={e.id} event={e} />)}
          </Rail>
        ) : (
          <p className="hp-empty">
            No public events yet. <Link href={createHref}>Be the first to create one.</Link>
          </p>
        )}
      </section>

      <section className="hp-closing">
        <h2>Your guests are<br /><span className="hp-hl">already waiting.</span></h2>
        <div className="hp-actions" style={{ justifyContent: "center" }}>
          <Link href="/discover" className="hp-ghost">Discover events</Link>
          <Link href={createHref} className="hp-btn">Create an event free</Link>
        </div>
      </section>

      <footer className="hp-foot hp-footer">
        <div className="hp-footer-inner">
          <FooterWordmark />
          <div className="hp-footer-main">
            <div className="hp-footer-brand">
              <Link href="/" className="hp-logo">G-vent<b>Z</b></Link>
              <p>Good gatherings start here. Create an event, share one link, and bring everyone together.</p>
            </div>
            <div><p className="hp-footer-title">Discover</p><nav className="hp-footer-links" aria-label="Discover"><Link href="/discover">All events</Link><Link href="/pricing">Pricing</Link><Link href="/events/new">Create event</Link></nav></div>
            <div><p className="hp-footer-title">For hosts</p><nav className="hp-footer-links" aria-label="For hosts"><Link href="/events/new">Host an event</Link><Link href="/help">Help centre</Link><Link href="/refunds">Refunds</Link></nav></div>
            <div><p className="hp-footer-title">Company</p><nav className="hp-footer-links" aria-label="Company"><Link href="/help">About G-ventZ</Link><Link href="/help">Contact</Link></nav></div>
            <div><p className="hp-footer-title">Contact</p><div className="hp-footer-contact-group"><p className="hp-footer-contact-label">Support</p><Link href="/help">Visit help centre</Link></div><div className="hp-footer-contact-group"><p className="hp-footer-contact-label">For event hosts</p><Link href="/events/new">Get started</Link></div></div>
          </div>
          <div className="hp-footer-bottom">
            <div className="hp-footer-meta"><p>© {new Date().getFullYear()} G-ventZ</p><SocialLinks /></div>
            <nav className="hp-foot-legal" aria-label="Legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></nav>
          </div>
        </div>
      </footer>
    </main>
  );
}
