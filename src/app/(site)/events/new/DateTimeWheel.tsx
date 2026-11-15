"use client";

import { useLocale, useTranslations } from "next-intl";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { intlLocale } from "@/lib/format";
import type { Locale } from "@/i18n/languages";

// Apple-style wheel picker for a date and a time. It writes two hidden inputs so the
// server action reads the same fields it did before (date/time or end_date/end_time).

const ITEM = 44; // height of one row in px
const VISIBLE = 5; // rows visible at once (the middle one is selected)
const DAYS_AHEAD = 365;

type Option<T extends string | number> = { value: T; label: string };

function Wheel<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  // Place the chosen row in the middle when the wheel opens or the value changes from outside.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && Math.round(el.scrollTop / ITEM) !== index) el.scrollTop = index * ITEM;
  }, [index]);

  function onScroll() {
    const el = ref.current;
    if (!el) return;
    const i = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / ITEM)));
    if (options[i] && options[i].value !== value) onChange(options[i].value);
  }

  const pad = ((VISIBLE - 1) / 2) * ITEM;

  return (
    <div className="wheel-col" role="listbox" aria-label={label} ref={ref} onScroll={onScroll}
      style={{ paddingTop: pad, paddingBottom: pad }}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          role="option"
          aria-selected={o.value === value}
          className={`wheel-item ${o.value === value ? "on" : ""}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

const isEnglish = (lang: Locale) => lang === "en" || lang === "en-XA";

// "2026-11-14" -> "Sat 14 Nov" in English (names from Intl's en-US data, which match the old
// "Sep" abbreviations), the page language's own short date otherwise. The page language, not the
// device's, so server and client match.
function formatDay(iso: string, lang: Locale) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (!isEnglish(lang)) {
    return new Intl.DateTimeFormat(intlLocale(lang, "date"), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(dt);
  }
  const part = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...o, timeZone: "UTC" }).format(dt);
  return `${part({ weekday: "short" })} ${d} ${part({ month: "short" })}`;
}

// "AM" / "PM" in English; the language's own morning and afternoon marks otherwise.
function periodLabel(period: string, lang: Locale) {
  if (isEnglish(lang)) return period;
  const dt = new Date(Date.UTC(2000, 0, 1, period === "PM" ? 15 : 9));
  return new Intl.DateTimeFormat(intlLocale(lang, "date"), { hour: "numeric", hour12: true, timeZone: "UTC" })
    .formatToParts(dt).find((p) => p.type === "dayPeriod")?.value ?? period;
}

function formatTime(time: string, lang: Locale) {
  const [h, min] = time.split(":").map(Number);
  if (!isEnglish(lang)) {
    return new Intl.DateTimeFormat(intlLocale(lang, "date"), { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "UTC" })
      .format(new Date(Date.UTC(2000, 0, 1, h, min)));
  }
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(min)} ${period}`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Today plus the next year, plus the chosen date if it has since passed.
function dayOptions(selected: string, lang: Locale): Option<string>[] {
  const [y, m, d] = todayIso().split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const opts: Option<string>[] = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const dt = new Date(start + i * 86400000);
    const iso = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    opts.push({ value: iso, label: formatDay(iso, lang) });
  }
  if (selected && !opts.some((o) => o.value === selected)) {
    opts.unshift({ value: selected, label: formatDay(selected, lang) });
  }
  return opts;
}

const HOURS: Option<number>[] = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const MINUTES: Option<number>[] = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad2(i * 5) }));

// Turns "19:30" into the parts the wheels show.
function splitTime(time: string) {
  if (!time) return { hour: 7, minute: 0, period: "PM" };
  const [h, min] = time.split(":").map(Number);
  return { hour: h % 12 === 0 ? 12 : h % 12, minute: Math.floor(min / 5) * 5, period: h >= 12 ? "PM" : "AM" };
}

function joinTime(hour: number, minute: number, period: string) {
  const h24 = (hour % 12) + (period === "PM" ? 12 : 0);
  return `${pad2(h24)}:${pad2(minute)}`;
}

export default function DateTimeWheel({
  label,
  dateName,
  timeName,
  date,
  time,
  onChange,
  invalid,
}: {
  label: string;
  dateName: string;
  timeName: string;
  date: string;
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("createEvent.wheel");
  const lang = useLocale() as Locale;
  const periods = useMemo<Option<string>[]>(() => ["AM", "PM"].map((p) => ({ value: p, label: periodLabel(p, lang) })), [lang]);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState(date || todayIso());
  const [draft, setDraft] = useState(() => splitTime(time));

  const filled = Boolean(date && time);

  function openPicker() {
    setDraftDate(date || todayIso());
    setDraft(splitTime(time));
    setOpen(true);
  }

  function done() {
    onChange({ date: draftDate, time: joinTime(draft.hour, draft.minute, draft.period) });
    setOpen(false);
  }

  return (
    <div className="wheel-field">
      <input type="hidden" name={dateName} value={filled ? date : ""} />
      <input type="hidden" name={timeName} value={filled ? time : ""} />

      <button type="button" className={`wheel-trigger ${invalid && !filled ? "bad" : ""}`}
        onClick={() => (open ? setOpen(false) : openPicker())} aria-expanded={open}>
        {filled ? (
          <>
            <span className="wheel-trigger-day">{formatDay(date, lang)}</span>
            <span className="wheel-trigger-time">{formatTime(time, lang)}</span>
          </>
        ) : (
          <span className="wheel-trigger-empty">{t("choose", { label })}</span>
        )}
      </button>

      {open && (
        <div className="wheel-panel">
          <div className="wheel-columns">
            <div className="wheel-group wide">
              <div className="wheel-head">{t("day")}</div>
              <Wheel label={t("day")} options={dayOptions(draftDate, lang)} value={draftDate} onChange={setDraftDate} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">{t("hour")}</div>
              <Wheel label={t("hour")} options={HOURS} value={draft.hour} onChange={(hour) => setDraft({ ...draft, hour })} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">{t("min")}</div>
              <Wheel label={t("minute")} options={MINUTES} value={draft.minute} onChange={(minute) => setDraft({ ...draft, minute })} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">&nbsp;</div>
              <Wheel label={t("period")} options={periods} value={draft.period} onChange={(period) => setDraft({ ...draft, period })} />
            </div>
          </div>
          <div className="wheel-foot">
            <span className="muted small">{formatDay(draftDate, lang)} · {formatTime(joinTime(draft.hour, draft.minute, draft.period), lang)}</span>
            <button type="button" className="btn-grad wheel-done" onClick={done}>{t("done")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
