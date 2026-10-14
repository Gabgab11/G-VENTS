"use client";

import { useEffect, useRef, useState } from "react";
import { startJazz, type JazzHandle } from "@/lib/jazz";

const DISMISS_KEY = "gvents-music-banner-dismissed";

// Site-wide jazz, off until the visitor turns it on with the music button.
// It never starts by itself: unexpected sound is an accessibility problem and
// costs data on mobile.
export default function SiteMusic() {
  const handle = useRef<JazzHandle | null>(null);
  const [state, setState] = useState<"off" | "playing" | "paused">("off");
  const [welcome, setWelcome] = useState(false);

  useEffect(() => {
    try {
      setWelcome(localStorage.getItem(DISMISS_KEY) !== "1");
    } catch {
      setWelcome(true);
    }
    return () => {
      handle.current?.stop();
      handle.current = null;
    };
  }, []);

  function dismissWelcome() {
    setWelcome(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable: the banner just shows again next visit.
    }
  }

  function toggle() {
    const h = handle.current;
    if (!h) {
      const started = startJazz();
      if (!started) return;
      handle.current = started;
      setState("playing");
      dismissWelcome();
      return;
    }
    if (state === "playing") {
      h.pause();
      setState("paused");
    } else {
      h.resume();
      setState("playing");
    }
  }

  return (
    <>
      {welcome && (
        <div className="welcome-banner" role="status">
          <div>
            <b>Welcome to G-vents</b>
            <div className="muted small">Press ♪ to play some jazz while you browse.</div>
          </div>
          <button type="button" className="welcome-close" aria-label="Close" onClick={dismissWelcome}>✕</button>
        </div>
      )}
      <button
        type="button"
        className="music-fab"
        onClick={toggle}
        aria-label={state === "playing" ? "Pause music" : "Play music"}
        aria-pressed={state === "playing"}
      >
        {state === "playing" ? "❚❚" : "♪"}
      </button>
    </>
  );
}
