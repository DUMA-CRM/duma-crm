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
export type UiSound = 'unlock' | 'success' | 'error';

export const UI_SOUNDS: Record<UiSound, Note[]> = {
  // A latch: two very short knocks, the second higher.
  unlock: [
    { freq: 1200, at: 0, dur: 0.06, gain: 0.12, attack: 0.002 },
    { freq: 1800, at: 0.05, dur: 0.08, gain: 0.1, attack: 0.002 },
  ],
  // Rising fifth — done.
  success: [
    { freq: 659, at: 0, dur: 0.32, gain: 0.14, attack: 0.01 },
    { freq: 988, at: 0.11, dur: 0.45, gain: 0.12, attack: 0.01 },
  ],
  // One low tone falling away — not done, without sounding like an alarm.
  error: [{ freq: 330, glideTo: 220, at: 0, dur: 0.4, gain: 0.16, attack: 0.01 }],
};

export function uiSound(sound: UiSound) {
  playNotes(UI_SOUNDS[sound]);
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
