// Site-wide music: the 90-second clip at /images/new_song.mp3.
// SiteMusic decides when it plays.

const TRACK = "/images/new_song.mp3";

export function createTrack(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  const audio = new Audio(TRACK);
  audio.preload = "auto";
  audio.volume = 0.6;
  return audio;
}
