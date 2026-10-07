// Order chimes via WebAudio — no asset files needed.
//
// Browsers only allow an AudioContext created (or resumed) inside a user
// gesture; one created later starts "suspended" and plays silence. So we keep
// ONE context, unlock it on the first gesture-driven call (e.g. toggling the
// chime on in Settings), and reuse it for every chime.
let audioCtx: AudioContext | null = null;

/** Call from any user gesture (the KDS does on the first tap) so a later chime isn't silent. */
export function unlockAudio(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null; // no audio device / unsupported — the visual queue still works
  }
}

/**
 * One note: pitch (Hz), start offset and length (s), peak volume, attack (s),
 * and an optional pitch to glide to. Sine only — staff hear this all day, so
 * every sound is soft-edged, quiet and quick to fade; nothing buzzes or beeps.
 */
interface Note {
  freq: number;
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  glideTo?: number;
}

export type ChimeSound = 'chime' | 'bell' | 'drop' | 'wood' | 'glass' | 'warm';

export const CHIME_SOUNDS: { value: ChimeSound; label: string; detail: string; notes: Note[] }[] = [
  {
    value: 'chime',
    label: 'Chime',
    detail: 'Two soft tones',
    notes: [
      { freq: 880, at: 0, dur: 0.5 },
      { freq: 1174, at: 0.18, dur: 0.5 },
    ],
  },
  {
    // A small bell: a fundamental with two quiet overtones, fading slowly.
    value: 'bell',
    label: 'Soft bell',
    detail: 'One gentle ring',
    notes: [
      { freq: 784, at: 0, dur: 1.6, gain: 0.14, attack: 0.02 },
      { freq: 1568, at: 0, dur: 0.9, gain: 0.04, attack: 0.02 },
      { freq: 2352, at: 0, dur: 0.5, gain: 0.015, attack: 0.02 },
    ],
  },
  {
    // A falling pitch reads as a water drop.
    value: 'drop',
    label: 'Water drop',
    detail: 'A single soft plip',
    notes: [{ freq: 1100, glideTo: 520, at: 0, dur: 0.28, gain: 0.16, attack: 0.008 }],
  },
  {
    value: 'wood',
    label: 'Wood',
    detail: 'Two soft knocks',
    notes: [
      { freq: 440, at: 0, dur: 0.22, gain: 0.2, attack: 0.005 },
      { freq: 587, at: 0.14, dur: 0.26, gain: 0.18, attack: 0.005 },
    ],
  },
  {
    value: 'glass',
    label: 'Glass',
    detail: 'Light, high and brief',
    notes: [
      { freq: 1319, at: 0, dur: 0.7, gain: 0.07, attack: 0.01 },
      { freq: 1760, at: 0.12, dur: 0.8, gain: 0.06, attack: 0.01 },
    ],
  },
  {
    value: 'warm',
    label: 'Warm',
    detail: 'Low, slow and calm',
    notes: [
      { freq: 392, at: 0, dur: 0.9, gain: 0.16, attack: 0.06 },
      { freq: 523, at: 0.2, dur: 1, gain: 0.14, attack: 0.06 },
    ],
  },
];

export function chime(sound: ChimeSound = 'chime') {
  playNotes((CHIME_SOUNDS.find((entry) => entry.value === sound) ?? CHIME_SOUNDS[0]).notes);
}

// Feedback for controls rather than alerts: shorter and quieter than any chime,
// because they answer something the person just did and they are looking at it.
export type UiSound = 'unlock' | 'lock' | 'success' | 'error';

/**
 * A mechanical click: a few milliseconds of noise through a band-pass, so it
 * reads as a latch rather than a tone. `freq` sets how bright it sounds.
 */
interface Click {
  freq: number;
  at: number;
  dur: number;
  gain?: number;
}

interface UiSoundSpec {
  notes?: Note[];
  clicks?: Click[];
}

export const UI_SOUNDS: Record<UiSound, UiSoundSpec> = {
  // The phone's unlock: a light, bright two-part click, the second higher —
  // a latch springing open. Clocking in.
  unlock: {
    clicks: [
      { freq: 2600, at: 0, dur: 0.018, gain: 0.5 },
      { freq: 4200, at: 0.042, dur: 0.014, gain: 0.35 },
    ],
    notes: [{ freq: 1900, at: 0, dur: 0.035, gain: 0.04, attack: 0.001 }],
  },
  // The phone's lock: a deeper "thock" with a little body under it, then a
  // softer catch — a latch closing. Clocking out.
  lock: {
    clicks: [
      { freq: 1500, at: 0, dur: 0.024, gain: 0.55 },
      { freq: 2400, at: 0.036, dur: 0.016, gain: 0.25 },
    ],
    notes: [{ freq: 180, glideTo: 90, at: 0, dur: 0.09, gain: 0.18, attack: 0.002 }],
  },
  // Rising fifth — done.
  success: {
    notes: [
      { freq: 659, at: 0, dur: 0.32, gain: 0.14, attack: 0.01 },
      { freq: 988, at: 0.11, dur: 0.45, gain: 0.12, attack: 0.01 },
    ],
  },
  // One low tone falling away — not done, without sounding like an alarm.
  error: { notes: [{ freq: 330, glideTo: 220, at: 0, dur: 0.4, gain: 0.16, attack: 0.01 }] },
};

export function uiSound(sound: UiSound) {
  const { notes, clicks } = UI_SOUNDS[sound];
  if (notes) playNotes(notes);
  if (clicks) playClicks(clicks);
}

let noise: AudioBuffer | null = null;

function playClicks(clicks: Click[]) {
  const ctx = unlockAudio();
  if (!ctx) return;
  // One short buffer of white noise, reused — every click is a slice of it.
  if (!noise || noise.sampleRate !== ctx.sampleRate) {
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.1), ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  for (const { freq, at, dur, gain: peak = 0.4 } of clicks) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.4;
    const gain = ctx.createGain();
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + at;
    gain.gain.setValueAtTime(peak, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.start(start);
    src.stop(start + dur + 0.02);
  }
}

function playNotes(notes: Note[]) {
  const ctx = unlockAudio();
  if (!ctx) return;
  for (const { freq, at, dur, gain: peak = 0.25, attack = 0.02, glideTo } of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const start = ctx.currentTime + at;
    osc.frequency.setValueAtTime(freq, start);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur * 0.6);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }
}
