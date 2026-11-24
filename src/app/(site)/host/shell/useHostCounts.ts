"use client";

import { useEffect, useState } from "react";
import { NO_COUNTS, normalizeCounts, type HostCounts } from "./nav";

const EVERY_MS = 60_000;

/**
 * The sidebar's counts (FR-36.6): fetched once on load, then every 60 s while the page is visible,
 * and again when the tab comes back after a minute or more away. A failed fetch keeps the last counts.
 */
export function useHostCounts(): HostCounts {
  const [counts, setCounts] = useState<HostCounts>(NO_COUNTS);

  useEffect(() => {
    let last = 0;
    let alive = true;
    const load = async () => {
      last = Date.now();
      try {
        const res = await fetch("/api/host/counts", { cache: "no-store" });
        if (res.ok && alive) setCounts(normalizeCounts(await res.json()));
      } catch {
        // Offline or the API is down: keep what is shown.
      }
    };
    const tick = () => {
      if (document.visibilityState === "visible" && Date.now() - last >= EVERY_MS - 1000) void load();
    };
    void load();
    const timer = window.setInterval(tick, EVERY_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  return counts;
}
