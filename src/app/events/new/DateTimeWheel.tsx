"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Apple-style wheel picker for a date and a time. It writes two hidden inputs so the
// server action reads the same fields it did before (date/time or end_date/end_time).

const ITEM = 44; // height of one row in px
const VISIBLE = 5; // rows visible at once (the middle one is selected)
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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

// "2026-11-14" -> "Sat 14 Nov", computed without the device locale so server and client match.
function formatDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[dt.getUTCDay()]} ${d} ${MONTHS[m - 1]}`;
}

function formatTime(time: string) {
  const [h, min] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${pad2(min)} ${period}`;
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

// Today plus the next year, plus the chosen date if it has since passed.
function dayOptions(selected: string): Option<string>[] {
  const [y, m, d] = todayIso().split("-").map(Number);
  const start = Date.UTC(y, m - 1, d);
  const opts: Option<string>[] = [];
  for (let i = 0; i <= DAYS_AHEAD; i++) {
    const dt = new Date(start + i * 86400000);
    const iso = `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
    opts.push({ value: iso, label: formatDay(iso) });
  }
  if (selected && !opts.some((o) => o.value === selected)) {
    opts.unshift({ value: selected, label: formatDay(selected) });
  }
  return opts;
}

const HOURS: Option<number>[] = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
const MINUTES: Option<number>[] = Array.from({ length: 12 }, (_, i) => ({ value: i * 5, label: pad2(i * 5) }));
const PERIODS: Option<string>[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

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
            <span className="wheel-trigger-day">{formatDay(date)}</span>
            <span className="wheel-trigger-time">{formatTime(time)}</span>
          </>
        ) : (
          <span className="wheel-trigger-empty">Choose {label.toLowerCase()}</span>
        )}
      </button>

      {open && (
        <div className="wheel-panel">
          <div className="wheel-columns">
            <div className="wheel-group wide">
              <div className="wheel-head">Day</div>
              <Wheel label="Day" options={dayOptions(draftDate)} value={draftDate} onChange={setDraftDate} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">Hour</div>
              <Wheel label="Hour" options={HOURS} value={draft.hour} onChange={(hour) => setDraft({ ...draft, hour })} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">Min</div>
              <Wheel label="Minute" options={MINUTES} value={draft.minute} onChange={(minute) => setDraft({ ...draft, minute })} />
            </div>
            <div className="wheel-group">
              <div className="wheel-head">&nbsp;</div>
              <Wheel label="AM or PM" options={PERIODS} value={draft.period} onChange={(period) => setDraft({ ...draft, period })} />
            </div>
          </div>
          <div className="wheel-foot">
            <span className="muted small">{formatDay(draftDate)} · {formatTime(joinTime(draft.hour, draft.minute, draft.period))}</span>
            <button type="button" className="btn-grad wheel-done" onClick={done}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
