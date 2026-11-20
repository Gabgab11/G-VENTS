import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { withAlternates } from "@/i18n/seo";
import { getFeaturedEvents } from "@/lib/events";
import HeroCards from "@/app/HeroCards";
import HeroTilt from "@/app/HeroTilt";
import HeroHover from "@/app/HeroHover";
import HeroActions from "@/app/HeroActions";
import { pageFonts } from "@/app/fonts";
import SiteHeader from "@/components/SiteHeader";
import "./discover/discover.css";
import Rail from "./discover/Rail";
import EventTile from "./discover/EventTile";

const CSS = `

.hp {
  /* Read from the design tokens (src/design/tokens.css), so the home page follows the same light and dark theme as every page. */
  --ink: var(--color-text); --muted: var(--color-text-muted); --line: var(--color-border); --soft: var(--color-surface-raised); --page: var(--color-bg);
  --primary: var(--color-inverse); --primary-text: var(--color-on-inverse);
  --coral: var(--tone-coral); --sun: var(--tone-sun); --mint: var(--tone-mint); --sky: var(--tone-sky); --rose: var(--tone-rose);
  --display: var(--font-display);
  --body: var(--font-sans);
  background: var(--page); color: var(--ink); font-family: var(--body);
  min-height: 100vh; overflow-x: hidden; -webkit-font-smoothing: antialiased;
}
.hp :focus-visible { outline-color: var(--color-focus); }
.hp a { color: inherit; text-decoration: none; }
.hp .hp-btn { color:var(--primary-text); background:var(--primary); }
.hp .hp-c4, .hp .hp-c5 { color: #fff; }
.hp-wrap { max-width: none; margin: 0 auto; padding: 0 clamp(24px, 5vw, 96px); }

.hp-top { padding: var(--space-3) var(--gutter) 0; pointer-events: none; }
.hp-top header > * { pointer-events: auto; }

/* padding-block, not padding: the side padding comes from .hp-wrap and must survive on phones */
.hp-hero { padding-block: clamp(52px, 9vh, 130px) 30px; }
.hp-pill { display: inline-block; font-size: var(--text-body-sm); font-weight: 600; background: var(--soft); border: 1px solid var(--line); padding: 7px 14px; border-radius: var(--radius-full); color: var(--muted); }
.hp-hero h1 { font-family: var(--display); font-weight: 800; font-size: clamp(52px, 9.5vw, 120px); line-height: 0.95; letter-spacing: -3px; margin: 22px 0 0; }
.hp-hl { color: var(--tone-ink); background: var(--sun); padding: 0 0.12em; border-radius: 0.15em; }
.hp-lede { max-width: 520px; color: var(--muted); font-size: clamp(16px, 2vw, 18px); line-height: 1.6; margin: 26px 0 32px; }
.hp-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
.hp-btn { padding: 15px 26px; border-radius: var(--radius-lg); font-weight: 600; font-size: var(--text-body); background: var(--ink); color: #fff; display: inline-block; }
.hp-ghost { padding: 15px 26px; border-radius: var(--radius-lg); font-weight: 600; font-size: var(--text-body); border: 1px solid var(--line); color: var(--ink); display: inline-block; }

.hp-ticker { margin-top: 0; border-block: 1px solid var(--line); overflow: hidden; white-space: nowrap; padding: 16px 0; }
.hp-run { display: inline-flex; gap: 40px; animation: hp-slide 40s linear infinite; font-family: var(--display); font-weight: 800; font-size: var(--text-heading-2); letter-spacing: -0.5px; color: #cfcdc6; }
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
.hp-stage .hp-top { z-index: 3; } /* above the hero, so the Account menu opens over it */
.hp-stage .hp-hero { pointer-events: none; }
.hp-stage .hp-hero > * { pointer-events: auto; }
.hp-fall {
  position: absolute; inset-inline-start: var(--left); bottom: calc(var(--bottom) * var(--s) * 1px);
  width: calc(var(--w) * var(--s) * 1px); transform-origin: 50% 100%;
  transform: rotate(var(--tilt)); pointer-events: auto;
  animation: hp-drop var(--dur) ease-in-out var(--delay) both;
}
.hp-card { display: block; border-radius: var(--radius-lg); pointer-events: none; user-select: none; transform-origin: 50% 100%; transition: transform .45s cubic-bezier(.2,.8,.3,1.25); }
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
.hp-tilt-btn { appearance: none; font: inherit; font-weight: 600; font-size: var(--text-body-sm); color: var(--ink); background: var(--soft); border: 1px solid var(--line); border-radius: var(--radius-full); padding: 10px 16px; cursor: pointer; }
.hp-tilt-btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
@media (max-width: 1099px) { .hp-stage { --s: 0.62; --band: 210px; } .hp-row3 { display: none; } }
@media (max-width: 699px) {
  .hp-stage { --s: 0.46; --band: 104px; }
  .hp-fall { inset-inline-start: var(--left-phone); }
  .hp-row2, .hp-row3, .hp-fall:nth-child(3), .hp-fall:nth-child(4), .hp-fall:nth-child(6) { display: none; }
}
@media (max-width: 360px) { .hp-stage { --s: 0.4; --band: 92px; } }
@media (prefers-reduced-motion: reduce) { .hp-fall { animation: none; } }

.hp-section { padding-block: 56px 20px; }
.hp-head { display: flex; justify-content: space-between; align-items: end; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
.hp-head h2 { font-family: var(--display); font-weight: 800; font-size: clamp(28px, 4vw, 40px); letter-spacing: -1px; margin: 0; }
.hp-head p { color: var(--muted); margin: 0; font-size: var(--text-body); }

.hp-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; }
.hp-tile { position: relative; border-radius: var(--radius-lg); padding: 22px; min-height: 210px; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.3s ease; animation: hp-swing 2.4s ease-in-out; }
.hp-tile:hover { transform: translateY(-4px); }
.hp-wide { grid-column: span 4; }
.hp-sq { grid-column: span 2; }
.hp-tag { font-size: var(--text-caption); font-weight: 600; opacity: 0.7; }
.hp-when { font-size: var(--text-body-sm); opacity: 0.65; }
.hp-tile h3 { font-family: var(--display); font-weight: 800; font-size: var(--text-heading-1); line-height: 1; letter-spacing: -0.8px; margin: 10px 0 0; }
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
  .hp-lede { margin-inline-start: auto; margin-inline-end: auto; }
  .hp-hero .hp-actions { flex-direction: column; align-items: stretch; max-width: 340px; margin: 0 auto; }
  .hp-hero .hp-actions a { text-align: center; }
}

.hp-closing { text-align: center; padding: clamp(100px,14vh,200px) 20px clamp(110px,16vh,220px); }
.hp-closing h2 { font-family: var(--display); font-weight: 800; font-size: clamp(40px, 7vw, 80px); line-height: 0.98; letter-spacing: -2.5px; margin: 0 0 28px; }

@media(max-width:640px) { .hp-wrap { padding-inline:22px; } }

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

export function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  return withAlternates(params, "/");
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations("home");
  const events = await featuredEvents();

  // The page is shared by every visitor, so it can't know who is signed in.
  // /host/events/new sends signed-out visitors to sign-up and then back to the form.
  const createHref = "/host/events/new";

  return (
    <main className={`hp ${pageFonts}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hp-stage">
      <HeroCards />
      <HeroHover />
      <div className="hp-top"><SiteHeader back={false} /></div>

      <section className="hp-wrap hp-hero">
        <span className="hp-pill">{t("hero.pill")}</span>
        <h1>{t("hero.titleStart")}<br /><span className="hp-hl">{t("hero.titleHighlight")}</span></h1>
        <p className="hp-lede">
          {t("hero.lede")}
        </p>
        <HeroActions createHref={createHref} />
        <HeroTilt />
      </section>
      </div>

      <div className="hp-ticker" aria-hidden="true">
        <div className="hp-run">
          {[...TICKER, ...TICKER].map((name, i) => <span key={i}>{name}</span>)}
        </div>
      </div>

      <section className="hp-wrap hp-section">
        {/* Same cards and row as Discover: the event's flyer (or colour style), name, place and date. */}
        {events.length > 0 ? (
          <Rail title={t("soon.title")} id="hp-soon" more={{ href: "/discover", label: t("soon.seeAll") }}>
            {events.map((e) => <EventTile key={e.id} event={e} />)}
          </Rail>
        ) : (
          <p className="hp-empty">
            {t.rich("soon.empty", { link: (c) => <Link href={createHref}>{c}</Link> })}
          </p>
        )}
      </section>

      <section className="hp-closing">
        <h2>{t("closing.titleStart")}<br /><span className="hp-hl">{t("closing.titleHighlight")}</span></h2>
        <div className="hp-actions" style={{ justifyContent: "center" }}>
          <Link href="/discover" className="hp-ghost">{t("closing.discover")}</Link>
          <Link href={createHref} className="hp-btn">{t("closing.create")}</Link>
        </div>
      </section>

    </main>
  );
}
