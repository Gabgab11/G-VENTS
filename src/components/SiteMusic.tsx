"use client";

import { useEffect, useRef, useState } from "react";
import { createTrack } from "@/lib/jazz";

// Starts on every visit. If the browser blocks sound until the visitor
// interacts, it starts on their first tap or key press. The button pauses
// and resumes.
const UNLOCK_EVENTS = ["pointerdown", "keydown", "touchstart"] as const;

export default function SiteMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const audio = createTrack();
    if (!audio) return;
    audioRef.current = audio;

    const onPlay = () => setPlaying(true);
    const onStop = () => setPlaying(false);

    function attach() {
      UNLOCK_EVENTS.forEach((e) => window.addEventListener(e, unlock));
    }
    function detach() {
      UNLOCK_EVENTS.forEach((e) => window.removeEventListener(e, unlock));
    }
    function unlock() {
      detach();
      audio!.play().catch(() => {});
    }

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onStop);
    audio.addEventListener("ended", onStop);

    // Try to start now. If the browser blocks it, wait for the first touch or key press.
    audio.play().catch(attach);

    return () => {
      detach();
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onStop);
      audio.removeEventListener("ended", onStop);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, []);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }

  return (
    <button
      type="button"
      className="music-fab"
      onClick={toggle}
      aria-label={playing ? "Pause music" : "Play music"}
      aria-pressed={playing}
    >
      {playing ? "❚❚" : "♪"}
    </button>
  );
}
