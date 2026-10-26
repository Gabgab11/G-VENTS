"use client";

import { useEffect } from "react";

// Registers public/sw.js (PWA). Production builds only, so local development never serves stale code.
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Not supported or blocked: the site works the same, just without offline tickets.
    });
  }, []);
  return null;
}
