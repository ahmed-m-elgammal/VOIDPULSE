// ===== VOIDPULSE :: procedural audio engine (WebAudio) =====
// All music and SFX are synthesized at runtime. No audio assets.

type OscType = OscillatorType;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private schedTimer: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private step = 0;
  private bpm = 128;
  private intensity = 0.35; // 0 menu .. 1 overdrive
  private targetIntensity = 0.35;
  muted = false;
  private noiseBuf: AudioBuffer | null = null;
  // volume settings (0..1), applied to buses when ctx exists
  private vol = { master: 1, music: 1, sfx: 1 };

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus || !this.sfxBus) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55 * this.vol.master, t, 0.02);
    this.musicBus.gain.setTargetAtTime(0.42 * this.vol.music, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(0.85 * this.vol.sfx, t, 0.02);
  }

  setVolumes(master: number, music: number, sfx: number): void {
    this.vol.master = Math.max(0, Math.min(1, master));
    this.vol.music = Math.max(0, Math.min(1, music));
    this.vol.sfx = Math.max(0, Math.min(1, sfx));
    this.applyVolumes();
  }

  /** must be called from a user gesture */
  init(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    try {
      const Ctor: typeof AudioContext | undefined =
        typeof window !== 'undefined'
          ? window.AudioContext ??
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          : undefined;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55 * this.vol.master;
      this.master.connect(this.ctx.destination);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85 * this.vol.sfx;
      this.sfxBus.connect(this.master);

      this.musicFilter = this.ctx.createBiquadFilter();
      this.musicFilter.type = 'lowpass';
      this.musicFilter.frequency.value = 900;
      this.musicFilter.Q.value = 0.7;

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.42 * this.vol.music;
      this.musicBus.connect(this.musicFilter);
      this.musicFilter.connect(this.master);

      // pre-baked noise buffer (1s)
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;

      this.nextStepTime = this.ctx.currentTime + 0.06;
      this.schedTimer = setInterval(() => this.scheduler(), 25);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyVolumes();
  }

  setIntensity(v: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  dispose(): void {
    if (this.schedTimer) clearInterval(this.schedTimer);
    this.schedTimer = null;
    if (this.ctx) void this.ctx.close().catch(() => undefined);
    this.ctx = null;
  }

  // ---------------- SFX synth helpers ----------------

  private tone(opts: {
    type: OscType;
    f0: number;
    f1?: number;
    dur: number;
    vol: number;
    delay?: number;
    curve?: 'exp' | 'lin';
    dest?: AudioNode;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(Math.max(1, opts.f0), t0);
    if (opts.f1 !== undefined) {
      if (opts.curve === 'lin') osc.frequency.linearRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    osc.connect(g);
    g.connect(opts.dest ?? this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + opts.dur + 0.05);
  }

  private noise(opts: {
    dur: number;
    vol: number;
    f0?: number;
    f1?: number;
    q?: number;
    type?: BiquadFilterType;
    delay?: number;
  }): void {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noiseBuf) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type ?? 'bandpass';
    filt.frequency.setValueAtTime(opts.f0 ?? 1000, t0);
    if (opts.f1 !== undefined) filt.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
    filt.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(opts.vol, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.05);
  }

  sfx(name: string, vary = 0, rate = 1): void {
    if (!this.ctx || this.muted) return;
    const v = (1 + (Math.random() * 2 - 1) * vary) * rate;
    switch (name) {
      case 'shoot':
        this.tone({ type: 'square', f0: 760 * v, f1: 320, dur: 0.07, vol: 0.05 });
        break;
      case 'lance':
        this.tone({ type: 'sawtooth', f0: 1400, f1: 180, dur: 0.16, vol: 0.09 });
        this.noise({ dur: 0.1, vol: 0.05, f0: 3000, f1: 500 });
        break;
      case 'scatter':
        this.noise({ dur: 0.09, vol: 0.07, f0: 1800, f1: 400, q: 0.8 });
        break;
      case 'seeker':
        this.tone({ type: 'sawtooth', f0: 300 * v, f1: 900, dur: 0.18, vol: 0.04 });
        break;
      case 'arc':
        this.noise({ dur: 0.12, vol: 0.08, f0: 2400, f1: 800, q: 3 });
        this.tone({ type: 'square', f0: 1900, f1: 600, dur: 0.1, vol: 0.03 });
        break;
      case 'nova':
        this.tone({ type: 'sine', f0: 140, f1: 44, dur: 0.35, vol: 0.16 });
        this.noise({ dur: 0.28, vol: 0.06, f0: 700, f1: 120, type: 'lowpass' });
        break;
      case 'hit':
        this.noise({ dur: 0.045, vol: 0.05, f0: 2600 * v, f1: 1400, q: 1.4 });
        break;
      case 'kill':
        this.tone({ type: 'triangle', f0: 520 * v, f1: 130 * rate, dur: 0.12, vol: 0.07 });
        this.noise({ dur: 0.08, vol: 0.05, f0: 1200 * rate, f1: 300 });
        break;
      case 'killBig':
        this.tone({ type: 'sawtooth', f0: 220, f1: 50, dur: 0.4, vol: 0.16 });
        this.noise({ dur: 0.35, vol: 0.14, f0: 900, f1: 90, type: 'lowpass' });
        break;
      case 'explode':
        this.noise({ dur: 0.6, vol: 0.2, f0: 1400, f1: 60, type: 'lowpass' });
        this.tone({ type: 'sine', f0: 120, f1: 30, dur: 0.55, vol: 0.22 });
        break;
      case 'hurt':
        this.tone({ type: 'sawtooth', f0: 340, f1: 90, dur: 0.22, vol: 0.17 });
        this.noise({ dur: 0.18, vol: 0.1, f0: 600, f1: 200, type: 'lowpass' });
        break;
      case 'dash':
        this.noise({ dur: 0.16, vol: 0.09, f0: 500, f1: 3600, q: 1.2 });
        this.tone({ type: 'sine', f0: 300, f1: 700, dur: 0.12, vol: 0.04 });
        break;
      case 'dashKill':
        this.tone({ type: 'square', f0: 900, f1: 1400, dur: 0.08, vol: 0.06 });
        break;
      case 'pickup':
        this.tone({ type: 'sine', f0: 660 * v, f1: 990 * v, dur: 0.08, vol: 0.045 });
        break;
      case 'pickupHeal':
        this.tone({ type: 'sine', f0: 520, f1: 780, dur: 0.14, vol: 0.09 });
        this.tone({ type: 'sine', f0: 780, f1: 1180, dur: 0.16, vol: 0.07, delay: 0.09 });
        break;
      case 'levelup':
        [523, 659, 784, 1046].forEach((f, i) =>
          this.tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.09, delay: i * 0.07 })
        );
        break;
      case 'select':
        this.tone({ type: 'square', f0: 840, f1: 1200, dur: 0.06, vol: 0.05 });
        break;
      case 'uiMove':
        this.tone({ type: 'square', f0: 420, dur: 0.04, vol: 0.03 });
        break;
      case 'reroll':
        this.tone({ type: 'square', f0: 500, f1: 900, dur: 0.09, vol: 0.05 });
        break;
      case 'heatMax':
        this.tone({ type: 'sawtooth', f0: 200, f1: 1600, dur: 0.5, vol: 0.1 });
        this.noise({ dur: 0.5, vol: 0.07, f0: 800, f1: 5000, q: 2 });
        break;
      case 'odEnd':
        this.tone({ type: 'sawtooth', f0: 1200, f1: 200, dur: 0.4, vol: 0.07 });
        break;
      case 'bossRoar':
        this.tone({ type: 'sawtooth', f0: 90, f1: 40, dur: 1.1, vol: 0.24 });
        this.noise({ dur: 1.0, vol: 0.12, f0: 300, f1: 60, type: 'lowpass' });
        break;
      case 'bossDie':
        this.tone({ type: 'sawtooth', f0: 160, f1: 24, dur: 1.4, vol: 0.26 });
        this.noise({ dur: 1.3, vol: 0.22, f0: 1600, f1: 50, type: 'lowpass' });
        [0, 0.18, 0.36].forEach((d) =>
          this.noise({ dur: 0.5, vol: 0.13, f0: 900 - d * 1000, f1: 70, type: 'lowpass', delay: d })
        );
        break;
      case 'waveClear':
        [392, 523, 659].forEach((f, i) =>
          this.tone({ type: 'triangle', f0: f, dur: 0.2, vol: 0.07, delay: i * 0.09 })
        );
        break;
      case 'charge':
        this.tone({ type: 'sawtooth', f0: 180, f1: 520, dur: 0.6, vol: 0.08 });
        break;
      case 'freeze':
        this.tone({ type: 'sine', f0: 1400, f1: 2400, dur: 0.12, vol: 0.04 });
        break;
      case 'revive':
        [262, 330, 392, 523, 659].forEach((f, i) =>
          this.tone({ type: 'triangle', f0: f, dur: 0.3, vol: 0.1, delay: i * 0.06 })
        );
        break;
      case 'playerDie':
        this.tone({ type: 'sawtooth', f0: 400, f1: 30, dur: 1.6, vol: 0.22 });
        this.noise({ dur: 1.5, vol: 0.18, f0: 1200, f1: 60, type: 'lowpass' });
        break;
      case 'victory':
        [523, 659, 784, 1046, 1318].forEach((f, i) =>
          this.tone({ type: 'triangle', f0: f, dur: 0.45, vol: 0.1, delay: i * 0.13 })
        );
        break;
      case 'buy':
        this.tone({ type: 'triangle', f0: 700, f1: 1100, dur: 0.1, vol: 0.08 });
        this.tone({ type: 'triangle', f0: 1100, f1: 1500, dur: 0.12, vol: 0.06, delay: 0.08 });
        break;
      case 'trade':
        this.tone({ type: 'triangle', f0: 900, f1: 1400, dur: 0.08, vol: 0.07 });
        this.tone({ type: 'triangle', f0: 1400, f1: 2100, dur: 0.1, vol: 0.05, delay: 0.06 });
        this.noise({ dur: 0.06, vol: 0.03, f0: 4000, f1: 2000, delay: 0.1 });
        break;
      case 'claim':
        [660, 880, 1320].forEach((f, i) =>
          this.tone({ type: 'triangle', f0: f, dur: 0.14, vol: 0.07, delay: i * 0.07 })
        );
        break;
      case 'shieldDown':
        this.tone({ type: 'sine', f0: 1200, f1: 300, dur: 0.3, vol: 0.14 });
        this.noise({ dur: 0.2, vol: 0.06, f0: 3000, f1: 600, q: 2 });
        break;
      case 'error':
        this.tone({ type: 'square', f0: 220, f1: 160, dur: 0.16, vol: 0.07 });
        break;
      default:
        break;
    }
  }

  // ---------------- MUSIC SEQUENCER ----------------
  // A-minor synthwave: Am F C G, 4 bars of 16 16th-steps.

  private scheduler(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    if (this.musicFilter) {
      const f = 500 + this.intensity * 4200;
      this.musicFilter.frequency.setTargetAtTime(f, ctx.currentTime, 0.1);
    }
    const stepDur = 60 / this.bpm / 4;
    while (this.nextStepTime < ctx.currentTime + 0.12) {
      this.scheduleStep(this.step, this.nextStepTime, stepDur);
      this.step = (this.step + 1) % 64;
      this.nextStepTime += stepDur;
    }
  }

  private mNote(freq: number, t: number, dur: number, vol: number, type: OscType, dest: AudioNode, detune = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.16);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.1);
  }

  private mNoise(t: number, dur: number, vol: number, f0: number, type: BiquadFilterType): void {
    const ctx = this.ctx;
    if (!ctx || !this.noiseBuf || !this.musicBus) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f0;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  private scheduleStep(step: number, t: number, sd: number): void {
    const bus = this.musicBus;
    const ctx = this.ctx;
    if (!bus || !ctx) return;
    const I = this.intensity;
    const bar = Math.floor(step / 16) % 4;
    const s16 = step % 16;
    // chord roots: A2 F2 C3 G2 -> freq
    const roots = [110, 87.31, 130.81, 98];
    const chordSemis = [
      [0, 3, 7], // Am
      [0, 3, 7], // F major (relative shape from root F: F A C)
      [0, 3, 7], // C major shape (approx voicing)
      [0, 3, 7], // G
    ];
    const root = roots[bar];
    const semi = (n: number) => root * Math.pow(2, n / 12);

    // PAD (always) — sustained chord, very low volume
    if (s16 === 0) {
      const chord = chordSemis[bar];
      for (let i = 0; i < chord.length; i++) {
        const f = semi(chord[i] + 12);
        this.mNote(f, t, sd * 15, 0.045 + I * 0.02, 'sawtooth', bus, -8);
        this.mNote(f, t, sd * 15, 0.04 + I * 0.02, 'sawtooth', bus, 8);
      }
    }
    // BASS (intensity > 0.2) — driving 8ths
    if (I > 0.2 && s16 % 2 === 0) {
      const oct = s16 === 14 ? 12 : 0;
      this.mNote(semi(oct), t, sd * 1.9, 0.13, 'sawtooth', bus);
      this.mNote(semi(oct) / 2, t, sd * 1.9, 0.1, 'sine', bus);
    }
    // KICK (intensity > 0.3) — four on the floor
    if (I > 0.3 && s16 % 4 === 0) {
      this.mKick(t);
    }
    // HAT (intensity > 0.42) — offbeat 8ths
    if (I > 0.42 && s16 % 2 === 1) {
      this.mNoise(t, 0.03, 0.028, 8000, 'highpass');
    }
    // SNARE (intensity > 0.58) — beats 2 & 4
    if (I > 0.58 && (s16 === 4 || s16 === 12)) {
      this.mNoise(t, 0.14, 0.075, 1800, 'bandpass');
    }
    // ARP (intensity > 0.6) — 16th arpeggio
    if (I > 0.6) {
      const seq = [0, 7, 12, 15, 12, 7, 3, 7];
      const n = seq[step % seq.length];
      this.mNote(semi(n + 24), t, sd * 0.9, 0.035, 'square', bus);
    }
  }

  private mKick(t: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.24, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.2);
  }
}
