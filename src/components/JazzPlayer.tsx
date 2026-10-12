"use client";

import { useEffect, useRef, useState } from "react";

// A slow jazz loop made in the browser: soft chords, a walking bass, and brushed hi-hats.
// No audio file is downloaded. It starts only when the visitor presses the button.

const BPM = 72;
const BEAT = 60 / BPM;

// One bar per chord, four bars per loop (Dm7 - G7 - Cmaj7 - Am7).
type Chord = { name: string; bass: number; third: number; notes: number[] };
const CHORDS: Chord[] = [
  { name: "Dm7", bass: 38, third: 3, notes: [50, 53, 57, 60] },
  { name: "G7", bass: 43, third: 4, notes: [55, 59, 62, 65] },
  { name: "Cmaj7", bass: 36, third: 4, notes: [52, 55, 59, 62] },
  { name: "Am7", bass: 33, third: 3, notes: [57, 60, 64, 67] },
];

type Engine = {
  ctx: AudioContext;
  out: GainNode;
  noise: AudioBuffer;
  timer: number;
  next: number;
  beat: number;
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function makeNoise(ctx: AudioContext) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function tone(ctx: AudioContext, out: AudioNode, freq: number, start: number, dur: number, type: OscillatorType, peak: number, attack: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(g).connect(out);
  osc.start(start);
  osc.stop(start + dur + 0.05);
}

function brush(ctx: AudioContext, out: AudioNode, noise: AudioBuffer, start: number, peak: number) {
  const src = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = noise;
  hp.type = "highpass";
  hp.frequency.value = 7000;
  g.gain.setValueAtTime(peak, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
  src.connect(hp).connect(g).connect(out);
  src.start(start);
  src.stop(start + 0.06);
}

function scheduleBeat(e: Engine, beat: number, t: number) {
  const { ctx, out, noise } = e;
  const bar = Math.floor(beat / 4) % 4;
  const inBar = beat % 4;
  const chord = CHORDS[bar];
  const nextRoot = CHORDS[(bar + 1) % 4].bass;

  // Soft pad that sustains across each bar
  if (inBar === 0) {
    for (const n of chord.notes) tone(ctx, out, mtof(n), t, BEAT * 4, "sine", 0.02, 0.8);
  }

  // Piano comping on beats 1 and 3
  if (inBar === 0 || inBar === 2) {
    for (const n of chord.notes) tone(ctx, out, mtof(n + 12), t, 1.2, "triangle", 0.03, 0.01);
  }

  // Walking bass: root, fifth, third, then a step into the next chord
  const bassLine = [chord.bass, chord.bass + 7, chord.bass + chord.third, nextRoot - 1];
  tone(ctx, out, mtof(bassLine[inBar]), t, BEAT * 0.9, "triangle", 0.12, 0.01);

  // Brushed hi-hats: stronger on beats 2 and 4, lighter swung ticks in between
  if (inBar % 2 === 1) brush(ctx, out, noise, t, 0.05);
  brush(ctx, out, noise, t + BEAT * 0.66, 0.018);
}

export default function JazzPlayer() {
  const [playing, setPlaying] = useState(false);
  const engine = useRef<Engine | null>(null);

  function start() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 1.5);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 2200;
    out.connect(lowpass).connect(ctx.destination);

    const e: Engine = { ctx, out, noise: makeNoise(ctx), timer: 0, next: ctx.currentTime + 0.1, beat: 0 };
    e.timer = window.setInterval(() => {
      while (e.next < ctx.currentTime + 0.2) {
        scheduleBeat(e, e.beat, e.next);
        e.next += BEAT;
        e.beat++;
      }
    }, 25);
    engine.current = e;
    setPlaying(true);
  }

  function stop() {
    const e = engine.current;
    if (!e) return;
    clearInterval(e.timer);
    e.out.gain.linearRampToValueAtTime(0.0001, e.ctx.currentTime + 0.6);
    setTimeout(() => e.ctx.close(), 800);
    engine.current = null;
    setPlaying(false);
  }

  useEffect(() => () => stop(), []);

  return (
    <div className="jazz-player">
      <button type="button" className="btn-ghost" onClick={playing ? stop : start}>
        {playing ? "Pause jazz" : "Play slow jazz"}
      </button>
      <span className="muted small">Made live in your browser. Nothing is downloaded.</span>
    </div>
  );
}
