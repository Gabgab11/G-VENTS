// Site-wide music: plays the 90-second clip from public/images/new_song.mp3.
// Playback starts only when a visitor presses the music button.

export type JazzHandle = { pause: () => void; resume: () => void; stop: () => void };

const TRACK = "/images/new_song.mp3";

export function startJazz(): JazzHandle | null {
  if (typeof Audio === "undefined") return null;

  const audio = new Audio(TRACK);
  audio.preload = "auto";
  audio.volume = 0.6;
  audio.play().catch(() => {
    // Blocked or failed to load: the button stays in the off state.
  });

  return {
    pause: () => {
      audio.pause();
    },
    resume: () => {
      // Once the clip has finished, start it again from the beginning.
      if (audio.ended) audio.currentTime = 0;
      audio.play().catch(() => {});
    },
    stop: () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    },
  };
}
