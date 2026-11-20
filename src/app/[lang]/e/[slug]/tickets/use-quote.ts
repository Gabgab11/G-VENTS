"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { quotePaid, type Quote } from "../actions";
import { cleanCode, quoteKey, quoteLines, type QuoteLine } from "./discount-code";

/**
 * The paid form's live quote (CK2) and its discount code (D91). The quote follows the chosen tickets
 * (debounced); a code is applied by asking for a quote with it, so the API checks it and its error
 * shows under the code box. When the tickets change and the code no longer applies, the code is
 * dropped with its message and the quote comes back without it. `initialCode` (from `?code=`) is
 * applied straight away. The same request is never sent twice in a row (code tries are rate-limited).
 */
export function useQuote(eventId: string, qty: Readonly<Record<string, number>>, initialCode: string | null) {
  const te = useTranslations("event.errors");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [codeError, setCodeError] = useState("");
  const [applying, setApplying] = useState(false);
  const linesKey = useMemo(() => JSON.stringify(quoteLines(qty)), [qty]);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const lines = JSON.parse(linesKey) as QuoteLine[];
    if (lines.length === 0) {
      setQuote(null);
      setQuoteError("");
      last.current = null;
      return;
    }
    const key = quoteKey(lines, code);
    if (key === last.current) return;
    let live = true;
    const timer = setTimeout(() => {
      quotePaid(eventId, lines, code || null)
        .catch(() => ({ error: te("quoteFailed") }))
        .then((res) => {
          if (!live) return;
          if (!("error" in res)) {
            last.current = key;
            setQuote(res);
            setQuoteError("");
          } else if ("discount" in res && res.discount && code) {
            setCodeError(res.error);
            setCode("");
          } else {
            setQuote(null);
            setQuoteError(res.error);
          }
        });
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [eventId, linesKey, code, te]);

  /** Applies a typed code; true when the API accepted it. */
  const apply = useCallback(
    async (raw: string) => {
      const candidate = cleanCode(raw);
      if (!candidate) {
        setCodeError(te("codeFormat"));
        return false;
      }
      const lines = JSON.parse(linesKey) as QuoteLine[];
      if (lines.length === 0) {
        setCodeError(te("chooseTicket"));
        return false;
      }
      setApplying(true);
      setCodeError("");
      const res = await quotePaid(eventId, lines, candidate).catch(() => ({ error: te("quoteFailed") }));
      setApplying(false);
      if ("error" in res) {
        setCodeError(res.error);
        return false;
      }
      last.current = quoteKey(lines, candidate);
      setQuote(res);
      setQuoteError("");
      setCode(candidate);
      return true;
    },
    [eventId, linesKey, te],
  );

  const remove = useCallback(() => {
    setCode("");
    setCodeError("");
  }, []);

  /** Puts back a code from a draft (after the inline sign-in remounted the form). */
  const restore = useCallback((saved: string) => {
    const clean = cleanCode(saved);
    if (clean) setCode(clean);
  }, []);

  return { quote, quoteError, code, codeError, applying, apply, remove, restore };
}
