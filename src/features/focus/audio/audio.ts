/**
 * Focus sounds, all synthesized with the Web Audio API: no audio files, no network.
 *
 * - Chimes: soft bell tones (a few sine partials with a long, gentle decay).
 * - Ambience: rain, cafe, a lo-fi-style loop and brown noise. Each track is rendered once
 *   into a buffer (OfflineAudioContext + generated noise) and made seamless with an
 *   equal-power crossfade of its ends, then played with `loop = true`, so it repeats with no
 *   click and no scheduling while the tab is in the background.
 *
 * Every sound respects the sound setting (checked by the callers through `soundOn`).
 */
import type { AmbienceTrack } from '@/data';

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let chimeVolume = 0.8;

function getContext(): Ctx | null {
  if (ctx) return ctx;
  const AC =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
      : undefined;
  if (!AC) return null;
  try {
    ctx = new AC();
  } catch {
    return null;
  }
  return ctx;
}

/** Call from a user gesture so later sounds (timer end, nudges) are allowed to play. */
export function unlockAudio(): void {
  const c = getContext();
  if (c && c.state === 'suspended') void c.resume().catch(() => {});
}

export function setChimeVolume(volume: number): void {
  chimeVolume = Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.8));
}

/* ----------------------------------------------------------------- chimes */

export type ChimeKind = 'focus_end' | 'break_end' | 'nudge' | 'checkin';

const NOTES: Record<ChimeKind, Array<[freq: number, delay: number, level: number]>> = {
  // A warm rising arpeggio: C6 E6 G6, then a low C to settle.
  focus_end: [
    [1046.5, 0, 0.5],
    [1318.5, 0.18, 0.45],
    [1568, 0.36, 0.42],
    [523.25, 0.62, 0.3],
  ],
  // Softer, lower two notes.
  break_end: [
    [783.99, 0, 0.35],
    [1046.5, 0.28, 0.3],
  ],
  // A gentle "hey": two soft notes.
  nudge: [
    [659.25, 0, 0.32],
    [880, 0.22, 0.28],
  ],
  checkin: [[880, 0, 0.25]],
};

const PARTIALS: Array<[ratio: number, amp: number, decay: number]> = [
  [1, 1, 2.6],
  [2.01, 0.32, 1.4],
  [2.76, 0.2, 0.9],
  [4.07, 0.08, 0.5],
];

function bell(c: Ctx, out: AudioNode, freq: number, t0: number, level: number) {
  for (const [ratio, amp, decay] of PARTIALS) {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(level * amp, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + decay + 0.05);
  }
}

/** Plays a chime now. Returns false when audio is unavailable or still locked. */
export function playChime(kind: ChimeKind): boolean {
  const c = getContext();
  if (!c) return false;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  const master = c.createGain();
  master.gain.value = 0.35 * chimeVolume;
  const soften = c.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 5200;
  master.connect(soften).connect(c.destination);
  const t0 = c.currentTime + 0.03;
  for (const [freq, delay, level] of NOTES[kind]) bell(c, master, freq, t0 + delay, level);
  window.setTimeout(() => master.disconnect(), 4000);
  return c.state === 'running';
}

/* ------------------------------------------------------------ generators */

type Channels = [Float32Array, Float32Array];

function white(len: number): Float32Array {
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) out[i] = Math.random() * 2 - 1;
  return out;
}

function brown(len: number): Float32Array {
  const out = new Float32Array(len);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    out[i] = last * 3.5;
  }
  return out;
}

/** Pink noise (Paul Kellet's economy filter). */
function pink(len: number): Float32Array {
  const out = new Float32Array(len);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + w * 0.099046;
    b1 = 0.963 * b1 + w * 0.2965164;
    b2 = 0.57 * b2 + w * 1.0526913;
    out[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2;
  }
  return out;
}

/** A smooth random envelope between `lo` and `hi`, changing about `rate` times a second. */
function smoothEnvelope(len: number, sampleRate: number, rate: number, lo: number, hi: number) {
  const out = new Float32Array(len);
  const step = Math.max(1, Math.floor(sampleRate / rate));
  let from = lo + Math.random() * (hi - lo);
  let to = lo + Math.random() * (hi - lo);
  for (let i = 0; i < len; i++) {
    const k = i % step;
    if (k === 0 && i > 0) {
      from = to;
      to = lo + Math.random() * (hi - lo);
    }
    const x = k / step;
    out[i] = from + (to - from) * (0.5 - 0.5 * Math.cos(Math.PI * x));
  }
  return out;
}

function bufferFrom(c: BaseAudioContext, data: Float32Array): AudioBuffer {
  const b = c.createBuffer(1, data.length, c.sampleRate);
  b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
  return b;
}

/**
 * Makes a loop seamless: the last `fade` samples are crossfaded (equal power) into the
 * first ones, so jumping from the end back to the start is continuous.
 */
export function seamless(data: Float32Array, fade: number): Float32Array {
  const n = data.length;
  const f = Math.max(1, Math.min(fade, Math.floor(n / 2)));
  const out = new Float32Array(n - f);
  for (let i = 0; i < n - f; i++) out[i] = data[i]!;
  for (let i = 0; i < f; i++) {
    const x = i / f;
    out[i] =
      data[i]! * Math.sin((x * Math.PI) / 2) + data[n - f + i]! * Math.cos((x * Math.PI) / 2);
  }
  return out;
}

/** Adds the part after `loopLen` back onto the start (tails of notes wrap around). */
function wrapTail(data: Float32Array, loopLen: number): Float32Array {
  const out = data.slice(0, loopLen);
  for (let i = loopLen; i < data.length; i++) out[(i - loopLen) % loopLen]! += data[i]!;
  return out;
}

function normalize(chs: Channels, peak = 0.6): Channels {
  let max = 0;
  for (const ch of chs) for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]!));
  if (max > 0) {
    const k = peak / max;
    for (const ch of chs) for (let i = 0; i < ch.length; i++) ch[i]! *= k;
  }
  return chs;
}

/** Short decaying ping (cup clink, rain drop) added straight into a channel. */
function addPing(
  ch: Float32Array,
  sampleRate: number,
  at: number,
  freq: number,
  level: number,
  decaySec: number,
) {
  const start = Math.floor(at * sampleRate);
  const len = Math.floor(decaySec * 5 * sampleRate);
  for (let i = 0; i < len && start + i < ch.length; i++) {
    const t = i / sampleRate;
    const env = Math.exp(-t / decaySec) * Math.min(1, i / 24);
    ch[start + i]! +=
      level *
      env *
      (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(2 * Math.PI * freq * 2.7 * t));
  }
}

async function renderOffline(
  seconds: number,
  sampleRate: number,
  build: (c: OfflineAudioContext, out: AudioNode) => void,
): Promise<Channels> {
  const length = Math.floor(seconds * sampleRate);
  const c = new OfflineAudioContext(2, length, sampleRate);
  const out = c.createGain();
  out.connect(c.destination);
  build(c, out);
  const rendered = await c.startRendering();
  return [rendered.getChannelData(0).slice(), rendered.getChannelData(1).slice()];
}

function noiseThrough(
  c: OfflineAudioContext,
  out: AudioNode,
  data: Float32Array,
  filters: Array<{ type: BiquadFilterType; freq: number; q?: number }>,
  level: number,
  pan = 0,
  envelope?: Float32Array,
) {
  const src = c.createBufferSource();
  src.buffer = bufferFrom(c, data);
  let node: AudioNode = src;
  for (const f of filters) {
    const biquad = c.createBiquadFilter();
    biquad.type = f.type;
    biquad.frequency.value = f.freq;
    if (f.q !== undefined) biquad.Q.value = f.q;
    node = node.connect(biquad);
  }
  const g = c.createGain();
  g.gain.value = level;
  if (envelope) g.gain.setValueCurveAtTime(envelope, 0, data.length / c.sampleRate);
  const p = c.createStereoPanner();
  p.pan.value = pan;
  node.connect(g).connect(p).connect(out);
  src.start(0);
}

/* ------------------------------------------------------------- the tracks */

const FADE_SEC = 1.5;

async function renderRain(sr: number): Promise<Channels> {
  const secs = 14;
  const len = Math.floor(secs * sr);
  const chs = await renderOffline(secs, sr, (c, out) => {
    noiseThrough(
      c,
      out,
      pink(len),
      [
        { type: 'highpass', freq: 500 },
        { type: 'lowpass', freq: 6500 },
      ],
      0.9,
      -0.25,
    );
    noiseThrough(
      c,
      out,
      pink(len),
      [
        { type: 'highpass', freq: 700 },
        { type: 'lowpass', freq: 7500 },
      ],
      0.9,
      0.25,
    );
    noiseThrough(
      c,
      out,
      brown(len),
      [{ type: 'lowpass', freq: 220 }],
      0.5,
      0,
      smoothEnvelope(len, sr, 0.3, 0.6, 1),
    );
  });
  // Drops: many tiny, quiet pings scattered across both ears.
  for (let i = 0; i < secs * 30; i++) {
    const ch = chs[Math.random() < 0.5 ? 0 : 1];
    addPing(
      ch,
      sr,
      Math.random() * secs,
      1800 + Math.random() * 3600,
      0.015 + Math.random() * 0.03,
      0.006,
    );
  }
  normalize(chs, 0.55);
  return [seamless(chs[0], FADE_SEC * sr), seamless(chs[1], FADE_SEC * sr)];
}

async function renderCafe(sr: number): Promise<Channels> {
  const secs = 18;
  const len = Math.floor(secs * sr);
  const chs = await renderOffline(secs, sr, (c, out) => {
    // Room tone.
    noiseThrough(c, out, brown(len), [{ type: 'lowpass', freq: 350 }], 0.7, 0);
    // Murmur: several "voices" of band-limited noise with syllable-like envelopes.
    for (let v = 0; v < 6; v++) {
      noiseThrough(
        c,
        out,
        pink(len),
        [
          { type: 'bandpass', freq: 350 + Math.random() * 900, q: 2.2 },
          { type: 'lowpass', freq: 2200 },
        ],
        0.55,
        Math.random() * 1.4 - 0.7,
        smoothEnvelope(len, sr, 3 + Math.random() * 3, 0, 1),
      );
    }
  });
  // Occasional cups and spoons.
  let t = 0.8;
  while (t < secs - 1) {
    const ch = chs[Math.random() < 0.5 ? 0 : 1];
    addPing(ch, sr, t, 2400 + Math.random() * 2400, 0.05 + Math.random() * 0.05, 0.05);
    if (Math.random() < 0.4) addPing(ch, sr, t + 0.09, 3100 + Math.random() * 1500, 0.03, 0.04);
    t += 1.5 + Math.random() * 3.5;
  }
  normalize(chs, 0.5);
  return [seamless(chs[0], FADE_SEC * sr), seamless(chs[1], FADE_SEC * sr)];
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

async function renderLofi(sr: number): Promise<Channels> {
  const bpm = 74;
  const beat = 60 / bpm;
  const bar = beat * 4;
  const bars = 4;
  const loop = bar * bars;
  const tail = 2.5;
  const chords = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  const chs = await renderOffline(loop + tail, sr, (c, out) => {
    const tone = c.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    tone.connect(out);

    const keys = (freq: number, t0: number, dur: number, level: number) => {
      for (const [type, detune] of [
        ['sine', 0],
        ['triangle', 4],
      ] as const) {
        const o = c.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(level, t0 + 0.03);
        g.gain.exponentialRampToValueAtTime(level * 0.35, t0 + 0.9);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.8);
        o.connect(g).connect(tone);
        o.start(t0);
        o.stop(t0 + dur + 1);
      }
    };
    const kick = (t0: number) => {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(42, t0 + 0.14);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.55, t0 + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + 0.35);
    };
    const hiss = (t0: number, dur: number, freq: number, type: BiquadFilterType, level: number) => {
      const src = c.createBufferSource();
      src.buffer = bufferFrom(c, white(Math.floor(dur * sr)));
      const f = c.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      const g = c.createGain();
      g.gain.setValueAtTime(level, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(out);
      src.start(t0);
    };

    chords.forEach((notes, i) => {
      const t0 = i * bar;
      // Chord on 1 and a lighter push on the "and" of 2.
      notes.forEach((n, k) => keys(midi(n), t0 + k * 0.012, beat * 1.4, 0.07));
      notes.forEach((n) => keys(midi(n + 12), t0 + beat * 1.5, beat * 0.9, 0.03));
      // Bass.
      keys(midi(notes[0]! - 12), t0, beat * 1.8, 0.16);
      keys(midi(notes[0]! - 12), t0 + beat * 2.5, beat * 1.2, 0.12);
      // Drums with a little swing.
      kick(t0);
      kick(t0 + beat * 2.5);
      hiss(t0 + beat, 0.18, 1800, 'bandpass', 0.22);
      hiss(t0 + beat * 3, 0.18, 1800, 'bandpass', 0.22);
      for (let e = 0; e < 8; e++) {
        const swing = e % 2 === 1 ? beat * 0.08 : 0;
        hiss(t0 + e * (beat / 2) + swing, 0.05, 7000, 'highpass', e % 2 ? 0.05 : 0.08);
      }
    });
  });
  const loopLen = Math.floor(loop * sr);
  const out: Channels = [wrapTail(chs[0], loopLen), wrapTail(chs[1], loopLen)];
  // Vinyl: soft hiss and sparse crackle.
  const hissL = pink(loopLen);
  const hissR = pink(loopLen);
  for (let i = 0; i < loopLen; i++) {
    out[0][i]! += hissL[i]! * 0.012;
    out[1][i]! += hissR[i]! * 0.012;
    if (Math.random() < 0.00012) {
      const amp = (Math.random() * 2 - 1) * 0.08;
      out[0][i]! += amp;
      out[1][i]! += amp * 0.8;
    }
  }
  return normalize(out, 0.5);
}

async function renderBrown(sr: number): Promise<Channels> {
  const len = Math.floor(12 * sr);
  const chs: Channels = [brown(len), brown(len)];
  normalize(chs, 0.6);
  return [seamless(chs[0], FADE_SEC * sr), seamless(chs[1], FADE_SEC * sr)];
}

const RENDERERS: Record<Exclude<AmbienceTrack, 'none'>, (sr: number) => Promise<Channels>> = {
  rain: renderRain,
  cafe: renderCafe,
  lofi: renderLofi,
  brown_noise: renderBrown,
};

const cache = new Map<string, Promise<AudioBuffer>>();

function trackBuffer(c: Ctx, track: Exclude<AmbienceTrack, 'none'>): Promise<AudioBuffer> {
  const key = `${track}@${c.sampleRate}`;
  let p = cache.get(key);
  if (!p) {
    p = RENDERERS[track](c.sampleRate).then(([l, r]) => {
      const b = c.createBuffer(2, l.length, c.sampleRate);
      b.copyToChannel(l as Float32Array<ArrayBuffer>, 0);
      b.copyToChannel(r as Float32Array<ArrayBuffer>, 1);
      return b;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}

/* --------------------------------------------------------------- ambience */

interface Playing {
  track: Exclude<AmbienceTrack, 'none'>;
  source: AudioBufferSourceNode | null;
  gain: GainNode;
}

let playing: Playing | null = null;
let token = 0;

const AMBIENCE_MAX_GAIN = 0.7;

function fadeOutAndStop(p: Playing, c: Ctx) {
  const now = c.currentTime;
  p.gain.gain.cancelScheduledValues(now);
  p.gain.gain.setValueAtTime(p.gain.gain.value, now);
  p.gain.gain.linearRampToValueAtTime(0, now + 0.8);
  const src = p.source;
  window.setTimeout(() => {
    try {
      src?.stop();
    } catch {
      /* already stopped */
    }
    p.gain.disconnect();
  }, 900);
}

/**
 * Plays an ambience track on a loop at `volume` (0..1), fading smoothly between tracks.
 * `none` fades out whatever is playing.
 */
export function setAmbience(track: AmbienceTrack, volume: number): void {
  const c = track === 'none' && !ctx ? null : getContext();
  if (!c) return;
  const level = Math.min(1, Math.max(0, volume)) * AMBIENCE_MAX_GAIN;
  if (track === 'none') {
    token++;
    if (playing) fadeOutAndStop(playing, c);
    playing = null;
    return;
  }
  if (playing?.track === track) {
    playing.gain.gain.setTargetAtTime(level, c.currentTime, 0.15);
    return;
  }
  if (playing) fadeOutAndStop(playing, c);
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(c.destination);
  const mine: Playing = { track, source: null, gain };
  playing = mine;
  const my = ++token;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  void trackBuffer(c, track)
    .then((buffer) => {
      if (my !== token) return;
      const src = c.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start();
      mine.source = src;
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(level, c.currentTime + 1.5);
    })
    .catch((error) => console.warn('[focus] ambience unavailable', error));
}

export function stopAmbience(): void {
  setAmbience('none', 0);
}

export function currentAmbience(): AmbienceTrack {
  return playing?.track ?? 'none';
}
