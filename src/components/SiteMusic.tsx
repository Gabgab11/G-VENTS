"use client";

import { useEffect, useRef, useState } from "react";
import { startJazz, type JazzHandle } from "@/lib/jazz";

// Plays on every page. Browsers only allow sound after the visitor touches the page,
// so the music starts on their first tap or key press.
export default function SiteMusic() {
  const handle = useRef<JazzHandle | null>(null);
  const [state, setState] = useState<"waiting" | "playing" | "paused">("waiting");
  const [welcome, setWelcome] = useState(true);

  function startMusic() {
    if (handle.current) return;
    const h = startJazz();
    if (!h) return;
    handle.current = h;
    setState("playing");
    setWelcome(false);
  }

  function toggle() {
    const h = handle.current;
    if (!h) return startMusic();
    if (state === "playing") {
      h.pause();
      setState("paused");
    } else {
      h.resume();
      setState("playing");
    }
  }

  useEffect(() => {
    window.addEventListener("pointerdown", startMusic, { once: true });
    window.addEventListener("keydown", startMusic, { once: true });
    return () => {
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
      handle.current?.stop();
      handle.current = null;
    };
    // startMusic only touches refs and state setters, which are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {welcome && (
        <div className="welcome-banner" role="status">
          <div>
            <b>Welcome to G-vents</b>
            <div className="muted small">Tap anywhere to start the music.</div>
          </div>
          <button type="button" className="welcome-close" aria-label="Close" onClick={() => setWelcome(false)}>✕</button>
        </div>
      )}
      <button
        type="button"
        className="music-fab"
        onClick={toggle}
        aria-label={state === "playing" ? "Pause music" : "Play music"}
      >
        {state === "playing" ? "❚❚" : "♪"}
      </button>
    </>
  );
}
