"use client";

import { useEffect, useRef, useState } from "react";
import { startJazz, type JazzHandle } from "@/lib/jazz";

// Site-wide music, off until the visitor turns it on with the music button.
// It never starts by itself: unexpected sound is an accessibility problem and
// costs data on mobile.
export default function SiteMusic() {
  const handle = useRef<JazzHandle | null>(null);
  const [state, setState] = useState<"off" | "playing" | "paused">("off");

  useEffect(() => {
    return () => {
      handle.current?.stop();
      handle.current = null;
    };
  }, []);

  function toggle() {
    const h = handle.current;
    if (!h) {
      const started = startJazz();
      if (!started) return;
      handle.current = started;
      setState("playing");
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
    <button
      type="button"
      className="music-fab"
      onClick={toggle}
      aria-label={state === "playing" ? "Pause music" : "Play music"}
      aria-pressed={state === "playing"}
    >
      {state === "playing" ? "❚❚" : "♪"}
    </button>
  );
}
