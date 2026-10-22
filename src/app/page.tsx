import Link from "next/link";
import { getFeaturedEvents } from "@/lib/events";
import { formatEventDate } from "@/lib/dates";
import AccountLink from "./AccountLink";
import HeroCards from "./HeroCards";
import HeroTilt from "./HeroTilt";
import { pageFonts } from "@/app/fonts";

const CSS = `

.hp {
  --ink: #121212; --muted: #6b6a66; --line: #ebe9e2; --soft: #f6f5f1;
  --coral: #ff5a3c; --sun: #ffc23d; --mint: #7ee0b6; --sky: #8ec5ff; --rose: #ffb3c7;
  --display: var(--font-display), "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif;
  --body: var(--font-body), "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  background: #fff; color: var(--ink); font-family: var(--body);
  min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
}
.hp a { color: inherit; text-decoration: none; }
.hp .hp-btn, .hp .hp-c4, .hp .hp-c5 { color: #fff; }
.hp-wrap { max-width: 1200px; margin: 0 auto; padding: 0 clamp(20px, 5vw, 64px); }

.hp-top { display: flex; justify-content: space-between; align-items: center; padding: 22px clamp(20px, 5vw, 64px); max-width: 1200px; margin: 0 auto; }
.hp-logo { font-family: var(--display); font-weight: 800; font-size: 22px; letter-spacing: -0.4px; }
.hp-logo b { color: var(--coral); }
.hp-signin { font-size: 14px; font-weight: 600; border: 1px solid var(--line); padding: 9px 16px; border-radius: 999px; }

/* padding-block, not padding: the side padding comes from .hp-wrap and must survive on phones */
.hp-hero { padding-block: clamp(36px, 7vw, 96px) 30px; }
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
.hp-card { display: block; transition: transform .35s cubic-bezier(.2,.8,.3,1.2); transform-origin: 50% 100%; border-radius: 14px; }
.hp-card svg { display: block; width: 100%; height: auto; overflow: visible; filter: drop-shadow(0 10px 12px rgba(60,44,20,.2)); }
.hp-card:hover, .hp-card:focus-visible { transform: translateY(-10px) rotate(-2deg) scale(1.04); }
.hp-card:focus-visible { outline: 2px solid var(--ink); outline-offset: 4px; }
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
@media (prefers-reduced-motion: reduce) { .hp-fall { animation: none; } .hp-card { transition: none; } }

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

.hp-closing { text-align: center; padding: 100px 20px 110px; }
.hp-closing h2 { font-family: var(--display); font-weight: 800; font-size: clamp(40px, 7vw, 80px); line-height: 0.98; letter-spacing: -2.5px; margin: 0 0 28px; }

.hp-foot { border-top: 1px solid var(--line); padding: 24px clamp(20px, 5vw, 64px); color: var(--muted); font-size: 13px; max-width: 1200px; margin: 0 auto; }
.hp-foot-row { display: flex; gap: 22px; flex-wrap: wrap; margin-bottom: 10px; }
.hp-foot-legal { display: flex; gap: 18px; flex-wrap: wrap; opacity: 0.8; }

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

// Builds without Supabase settings (CI) render no events; the deployed page
// refreshes with real ones within a minute.
async function featuredEvents() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return [];
  return getFeaturedEvents(6);
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
      <header className="hp-top">
        <Link href="/" className="hp-logo">G-vent<b>Z</b></Link>
        <AccountLink />
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
        <div className="hp-head">
          <h2>Happening soon</h2>
          <p>Public events you can register for right now.</p>
        </div>

        {events.length > 0 ? (
          <div className="hp-grid">
            {events.map((e, i) => (
              <Link
                key={e.id}
                href={`/e/${e.slug}`}
                className={`hp-tile hp-c${i % 6} ${i === 0 ? "hp-wide" : "hp-sq"}`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="hp-tag">{[e.city, e.country].filter(Boolean).join(" · ")}</div>
                <div>
                  <div className="hp-when">{formatEventDate(e.starts_at, e.timezone)}</div>
                  <h3>{e.title}</h3>
                </div>
              </Link>
            ))}
          </div>
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

      <footer className="hp-foot">
        <div className="hp-foot-row">
          <Link href="/discover">Discover</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/help">Help</Link>
        </div>
        <div className="hp-foot-legal">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/refunds">Refunds</Link>
          <span>© G-ventZ</span>
        </div>
      </footer>
    </main>
  );
}
