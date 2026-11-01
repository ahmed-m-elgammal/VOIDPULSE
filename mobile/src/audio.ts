/**
 * VOIDPULSE MOBILE — AudioPort.
 * Mobile browsers block WebAudio until a user gesture: unlock() must be called
 * from the first pointerdown. All SFX are procedural (zero asset files).
 * Node creation happens per-event (never in the sim tick), so the zero-alloc
 * hot-path contract is respected.
 */

let ctx: AudioContext | null = null;
let masterG: GainNode | null = null;
let sfxG: GainNode | null = null;
let musicG: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
let musicOn = false;

function vol(cur: GainNode | null, v: number): void {
  if (cur) cur.gain.value = v;
}

export function applyVolumes(master: number, sfx: number, music: number): void {
  vol(masterG, master);
  vol(sfxG, sfx);
  vol(musicG, music * 0.5);
}

/** Call from the first user gesture (pointerdown). Idempotent. */
export function unlock(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      masterG = ctx.createGain(); masterG.gain.value = 0.8; masterG.connect(ctx.destination);
      sfxG = ctx.createGain(); sfxG.gain.value = 0.8; sfxG.connect(masterG);
      musicG = ctx.createGain(); musicG.gain.value = 0.22; musicG.connect(masterG);
      const len = ctx.sampleRate * 0.35;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      startMusic();
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* audio unavailable — game stays silent */ }
}

function env(node: GainNode, t0: number, peak: number, dur: number): void {
  node.gain.setValueAtTime(0.0001, t0);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t0 + 0.008);
  node.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number): void {
  if (!ctx || !sfxG) return;
  const t0 = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  env(g, t0, peak, dur);
  o.connect(g); g.connect(sfxG);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise(dur: number, peak: number, filterFrom: number, filterTo: number): void {
  if (!ctx || !sfxG || !noiseBuf) return;
  const t0 = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(filterFrom, t0);
  f.frequency.exponentialRampToValueAtTime(Math.max(20, filterTo), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, peak, dur);
  src.connect(f); f.connect(g); g.connect(sfxG);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

// ---------------------------------------------------------------- SFX bank
export function sfxShoot(): void { tone('square', 640 + Math.random() * 140, 240, 0.06, 0.10); }
export function sfxDash(): void { noise(0.22, 0.30, 900, 2400); }
export function sfxGem(): void { tone('sine', 820, 1500, 0.09, 0.14); }
export function sfxHurt(): void { tone('sawtooth', 170, 55, 0.20, 0.30); noise(0.14, 0.2, 400, 150); }
export function sfxOverdrive(): void { tone('sawtooth', 180, 920, 0.42, 0.26); noise(0.4, 0.16, 600, 3000); }
export function sfxLevelUp(): void {
  tone('square', 523, 523, 0.09, 0.16);
  setTimeout(() => tone('square', 659, 659, 0.09, 0.16), 90);
  setTimeout(() => tone('square', 784, 784, 0.14, 0.16), 180);
}
export function sfxWave(): void { tone('triangle', 392, 392, 0.14, 0.2); setTimeout(() => tone('triangle', 587, 587, 0.2, 0.2), 130); }
export function sfxBossDown(): void { tone('sine', 110, 38, 0.7, 0.4); noise(0.6, 0.3, 500, 60); }
export function sfxDeath(): void { tone('sawtooth', 320, 42, 0.9, 0.32); }
export function sfxUi(): void { tone('square', 980, 900, 0.035, 0.08); }

// ---------------------------------------------------------------- ambient music
function startMusic(): void {
  if (!ctx || !musicG || musicOn) return;
  musicOn = true;
  try {
    const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
    const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 55.6;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 6;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoG = ctx.createGain(); lfoG.gain.value = 140;
    lfo.connect(lfoG); lfoG.connect(f.frequency);
    o1.connect(f); o2.connect(f); f.connect(musicG);
    o1.start(); o2.start(); lfo.start();

    // sparse pentatonic plucks on a lookahead timer (event-driven, not hot path)
    const scale = [220, 261.6, 329.6, 392, 523.3];
    setInterval(() => {
      if (!ctx || !musicG) return;
      if (Math.random() < 0.4) {
        const t0 = ctx.currentTime;
        const o = ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = scale[(Math.random() * scale.length) | 0] * (Math.random() < 0.3 ? 2 : 1);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
        o.connect(g); g.connect(musicG);
        o.start(t0); o.stop(t0 + 1.5);
      }
    }, 1500);
  } catch { /* music optional */ }
}
