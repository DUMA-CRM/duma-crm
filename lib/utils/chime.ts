// Short two-tone chime via WebAudio — no asset file needed.
//
// Browsers only allow an AudioContext created (or resumed) inside a user
// gesture; one created later starts "suspended" and plays silence. So we keep
// ONE context, unlock it on the first gesture-driven call (e.g. toggling the
// chime on in Settings), and reuse it for every chime.
let audioCtx: AudioContext | null = null;

function unlockAudio(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    return audioCtx;
  } catch {
    return null; // no audio device / unsupported — the visual queue still works
  }
}

export function chime() {
  const ctx = unlockAudio();
  if (!ctx) return;
  const play = (freq: number, at: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime + at);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5);
    osc.start(ctx.currentTime + at);
    osc.stop(ctx.currentTime + at + 0.55);
  };
  play(880, 0);
  play(1174, 0.18);
}
