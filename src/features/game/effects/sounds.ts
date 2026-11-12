/**
 * Reward sounds, synthesized with the Web Audio API (no audio files, no network). Short,
 * soft and warm: sine and triangle notes with quick fades. Honors the shared sound toggle,
 * the shared volume (`settings.sound_volume`) and Game's own reward volume.
 */
import { create } from 'zustand';

export type SoundName = 'step' | 'gold' | 'level' | 'loot' | 'achievement' | 'purchase' | 'redeem';

export interface FxPrefs {
  /** Game reward volume, 0..1, multiplied by the shared volume. */
  volume: number;
  /** `calm`: no confetti and no sound for small rewards. */
  celebrations: 'full' | 'calm';
}

const KEY = 'ql.game.fx';
const DEFAULTS: FxPrefs = { volume: 0.8, celebrations: 'full' };

function read(): FxPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<FxPrefs>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

/** Game's own effect preferences (this device). */
export const useFxPrefs = create<FxPrefs>(() => read());

export function setFxPrefs(patch: Partial<FxPrefs>): void {
  useFxPrefs.setState(patch);
  try {
    localStorage.setItem(KEY, JSON.stringify(useFxPrefs.getState()));
  } catch {
    /* private mode: keep it in memory */
  }
}

type Note = { f: number; at: number; dur: number; type?: OscillatorType; gain?: number };

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const A5 = 880;
const C6 = 1046.5;
const E6 = 1318.5;
const G4 = 392;

const SOUNDS: Record<SoundName, Note[]> = {
  step: [
    { f: E5, at: 0, dur: 0.12 },
    { f: A5, at: 0.07, dur: 0.18 },
  ],
  gold: [
    { f: C6, at: 0, dur: 0.08, type: 'triangle', gain: 0.6 },
    { f: E6, at: 0.06, dur: 0.16, type: 'triangle', gain: 0.6 },
  ],
  level: [
    { f: C5, at: 0, dur: 0.16, type: 'triangle' },
    { f: E5, at: 0.11, dur: 0.16, type: 'triangle' },
    { f: G5, at: 0.22, dur: 0.16, type: 'triangle' },
    { f: C6, at: 0.33, dur: 0.42, type: 'triangle' },
    { f: G4, at: 0.33, dur: 0.5, gain: 0.5 },
  ],
  loot: [
    { f: G5, at: 0, dur: 0.07, type: 'triangle', gain: 0.5 },
    { f: C6, at: 0.05, dur: 0.07, type: 'triangle', gain: 0.5 },
    { f: E6, at: 0.1, dur: 0.2, type: 'triangle', gain: 0.5 },
  ],
  achievement: [
    { f: E5, at: 0, dur: 0.5, gain: 0.6 },
    { f: G5, at: 0.02, dur: 0.5, gain: 0.5 },
    { f: C6, at: 0.12, dur: 0.6, gain: 0.5 },
  ],
  purchase: [
    { f: A5, at: 0, dur: 0.08, type: 'triangle', gain: 0.5 },
    { f: E5, at: 0.07, dur: 0.16, type: 'triangle', gain: 0.5 },
  ],
  redeem: [
    { f: C5, at: 0, dur: 0.12 },
    { f: G5, at: 0.1, dur: 0.12 },
    { f: E6, at: 0.2, dur: 0.3 },
  ],
};

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Plays a reward sound at `volume` (0..1). Silent when audio is unavailable. */
export function playSound(name: SoundName, volume: number): void {
  if (volume <= 0) return;
  const ac = context();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = Math.min(1, volume) * 0.18;
  master.connect(ac.destination);
  const t0 = ac.currentTime + 0.01;
  for (const n of SOUNDS[name]) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.value = n.f;
    const start = t0 + n.at;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(n.gain ?? 1, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);
    osc.connect(g).connect(master);
    osc.start(start);
    osc.stop(start + n.dur + 0.05);
  }
}

/** A short buzz on phones that support it. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
  } catch {
    /* not supported */
  }
}
