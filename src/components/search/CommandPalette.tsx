"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowRight, BadgeCheck, Clock, LoaderCircle, MapPin, Search, Tag } from "lucide-react";
import { Avatar, Badge } from "@/design";
import { Dialog, DialogContent } from "@/design/client";
import type { Locale } from "@/i18n/languages";
import { categoryLabelKey, isCategory } from "@/lib/categories";
import { countryLabel, formatDateTime } from "@/lib/format";
import { priceLabel } from "@/lib/price-label";
import { themeBackground } from "@/lib/themes";
import { buildGroups, moveActive, type GroupKey, type PaletteOption } from "./options";
import { addRecent, clearRecent, readRecent } from "./recent";
import { cleanQuery, isEmpty, MAX_QUERY, normalizeResults, type SearchResults } from "./types";
import styles from "./CommandPalette.module.css";

const DEBOUNCE_MS = 250;

type Status = "idle" | "loading" | "done" | "error";

// The ⌘K command palette (FR-34, D92). Loaded on first open (SiteHeader's SearchLauncher), so it
// costs nothing until someone searches. Each typing pause sends one request to the website's
// /api/search (never the API directly); a newer keystroke aborts the older request. The input is a
// combobox over one listbox: arrow keys move, Enter opens, Escape closes and focus goes back.
export default function CommandPalette({
  open,
  onOpenChange,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The element to focus again on close (the dialog has no Radix trigger to return to). */
  returnFocus?: () => HTMLElement | null;
}) {
  const t = useTranslations("common.search");
  const root = useTranslations();
  const shared = useTranslations("shared");
  const lang = useLocale() as Locale;
  const router = useRouter();
  const listId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [recent, setRecent] = useState<string[]>([]);
  const [active, setActive] = useState(-1);
  const query = cleanQuery(input);

  useEffect(() => { if (open) setRecent(readRecent()); }, [open]);

  // One debounced request per typing pause; the previous one is aborted.
  useEffect(() => {
    if (!query) { setResults(null); setStatus("idle"); return; }
    const controller = new AbortController();
    setStatus("loading");
    const timer = window.setTimeout(() => {
      fetch(`/api/search?${new URLSearchParams({ q: query, lang })}`, { signal: controller.signal, credentials: "omit" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          setResults(normalizeResults(await r.json()));
          setStatus("done");
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          console.warn("[search]", e);
          setResults(null);
          setStatus("error");
        });
    }, DEBOUNCE_MS);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, lang]);

  const groups = useMemo(() => buildGroups({ query, results, recent, lang }), [query, results, recent, lang]);
  const options = useMemo(() => groups.flatMap((g) => g.options), [groups]);

  // New rows: the first one is ready for Enter (none for recent searches until an arrow key).
  useEffect(() => { setActive(query && results ? 0 : -1); }, [query, results]);
  const activeOption: PaletteOption | undefined = options[active];

  useEffect(() => {
    if (!activeOption) return;
    listRef.current?.querySelector(`[id="${CSS.escape(activeOption.id)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [activeOption]);

  const remember = () => { if (query) setRecent(addRecent(query)); };

  const choose = (option: PaletteOption | undefined) => {
    if (!option) {
      if (!query) return;
      option = options.find((o) => o.kind === "all");
    }
    if (!option) return;
    if (option.kind === "recent") { setInput(option.query); return; }
    remember();
    onOpenChange(false);
    router.push(option.href);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => moveActive(a, options.length, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(activeOption);
    }
  };

  const groupLabel: Record<GroupKey, string> = {
    recent: t("groups.recent"),
    events: t("groups.events"),
    hosts: t("groups.hosts"),
    categories: t("groups.categories"),
    cities: t("groups.cities"),
    all: t("groups.discover"),
  };

  const found = results ? results.events.length + results.hosts.length + results.categories.length + results.cities.length : 0;
  const announcement =
    status === "loading" ? t("loading")
    : status === "error" ? ""
    : status === "done" && results ? (isEmpty(results) ? t("noResults", { query }) : t("count", { count: found }))
    : "";

  const row = (o: PaletteOption) => {
    const common = {
      id: o.id,
      role: "option" as const,
      "aria-selected": o === activeOption,
      className: styles.option,
      onMouseMove: () => { if (o !== activeOption) setActive(options.indexOf(o)); },
    };
    switch (o.kind) {
      case "recent":
        return (
          <div key={o.id} {...common} onClick={() => choose(o)}>
            <span className={styles.icon} aria-hidden><Clock size={16} strokeWidth={1.75} /></span>
            <span className={styles.text}><span className={styles.title}>{o.query}</span></span>
          </div>
        );
      case "event": {
        const e = o.event;
        const price = e.minPriceMinor != null && e.minPriceMinor > 0 && e.currency ? { minor: e.minPriceMinor, currency: e.currency } : null;
        const meta = [formatDateTime(e.startsAt, e.timeZone, lang), e.isOnline ? t("online") : e.city].filter(Boolean).join(" · ");
        return (
          <Link key={o.id} {...common} href={o.href} tabIndex={-1} onClick={() => { remember(); onOpenChange(false); }}>
            <span className={styles.thumb} style={{ background: themeBackground(e.coverTheme) }} aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element -- flyers come from storage at arbitrary sizes */}
              {e.coverUrl ? <img src={e.coverUrl} alt="" loading="lazy" /> : null}
            </span>
            <span className={styles.text}>
              <span className={styles.title}>
                <span className={styles.clip}>{e.title}</span>
                {e.hostVerified ? (
                  <span className={styles.verified} title={t("verifiedHost")}>
                    <BadgeCheck size={16} strokeWidth={1.75} aria-hidden />
                    <span className={styles.srOnly}>{t("verifiedHost")}</span>
                  </span>
                ) : null}
              </span>
              <span className={styles.meta}>{meta}</span>
            </span>
            <Badge plain className={styles.price}>{priceLabel(price, lang, (k, v) => shared(k, v))}</Badge>
          </Link>
        );
      }
      case "host":
        return (
          <Link key={o.id} {...common} href={o.href} tabIndex={-1} onClick={() => { remember(); onOpenChange(false); }}>
            <Avatar name={o.host.name} src={o.host.avatarUrl} size={36} className={styles.avatar} aria-hidden />
            <span className={styles.text}>
              <span className={styles.title}>
                <span className={styles.clip}>{o.host.name}</span>
                {o.host.verified ? (
                  <span className={styles.verified} title={t("verified")}>
                    <BadgeCheck size={16} strokeWidth={1.75} aria-hidden />
                    <span className={styles.srOnly}>{t("verified")}</span>
                  </span>
                ) : null}
              </span>
              <span className={styles.meta} dir="ltr">{`@${o.host.handle}`}</span>
            </span>
          </Link>
        );
      case "category":
        return (
          <Link key={o.id} {...common} href={o.href} tabIndex={-1} onClick={() => { remember(); onOpenChange(false); }}>
            <span className={styles.icon} aria-hidden><Tag size={16} strokeWidth={1.75} /></span>
            <span className={styles.text}>
              <span className={styles.title}>{isCategory(o.category) ? root(categoryLabelKey(o.category)) : o.category}</span>
              {o.count > 0 ? <span className={styles.meta}>{t("events", { count: o.count })}</span> : null}
            </span>
          </Link>
        );
      case "city": {
        const country = o.country && /^[A-Z]{2}$/.test(o.country) ? countryLabel(o.country, lang) : o.country;
        return (
          <Link key={o.id} {...common} href={o.href} tabIndex={-1} onClick={() => { remember(); onOpenChange(false); }}>
            <span className={styles.icon} aria-hidden><MapPin size={16} strokeWidth={1.75} /></span>
            <span className={styles.text}>
              <span className={styles.title}>{[o.city, country].filter(Boolean).join(", ")}</span>
              {o.count > 0 ? <span className={styles.meta}>{t("events", { count: o.count })}</span> : null}
            </span>
          </Link>
        );
      }
      case "all":
        return (
          <Link key={o.id} {...common} href={o.href} tabIndex={-1} onClick={() => { remember(); onOpenChange(false); }}>
            <span className={styles.icon} aria-hidden><Search size={16} strokeWidth={1.75} /></span>
            <span className={styles.text}><span className={styles.title}>{t("all", { query: o.query })}</span></span>
            <ArrowRight size={16} strokeWidth={1.75} aria-hidden className={styles.arrow} />
          </Link>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("title")}
        closeLabel={t("close")}
        className={styles.panel}
        // Straight into the search field (Radix would focus the close button first).
        onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); }}
        onCloseAutoFocus={(e) => {
          const target = returnFocus?.();
          if (target?.isConnected) { e.preventDefault(); target.focus(); }
        }}
      >
        <div className={styles.field}>
          <span className={styles.fieldIcon} aria-hidden>
            {status === "loading" ? <LoaderCircle size={20} strokeWidth={1.75} className={styles.spin} /> : <Search size={20} strokeWidth={1.75} />}
          </span>
          <input
            ref={inputRef}
            className={styles.input}
            type="search"
            role="combobox"
            aria-label={t("inputLabel")}
            aria-expanded={options.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeOption?.id}
            placeholder={t("placeholder")}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={MAX_QUERY}
          />
        </div>

        <p className={styles.srOnly} aria-live="polite">{announcement}</p>

        {status === "error" ? <p role="alert" className={styles.error}>{t("error")}</p> : null}

        <div ref={listRef} id={listId} role="listbox" aria-label={t("resultsLabel")} className={styles.list}>
          {groups.map((g) => (
            <div key={g.key} role="group" aria-labelledby={`${listId}-${g.key}`} className={styles.group}>
              <div className={styles.groupHead}>
                <span id={`${listId}-${g.key}`} className={styles.groupLabel}>{groupLabel[g.key]}</span>
              </div>
              {g.options.map(row)}
            </div>
          ))}
        </div>

        {!query && recent.length > 0 ? (
          <button type="button" className={styles.clear} onClick={() => { clearRecent(); setRecent([]); }}>{t("clearRecent")}</button>
        ) : null}
        {!query && recent.length === 0 ? <p className={styles.hint}>{t("hint")}</p> : null}
        {status === "done" && results && isEmpty(results) ? <p className={styles.hint}>{t("noResults", { query })}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
