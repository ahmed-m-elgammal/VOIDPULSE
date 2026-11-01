/**
 * VOIDPULSE MOBILE — core bridge (v1.6.0 "MIRROR" P0).
 *
 * Mounts the REAL desktop core (src/game/*) behind the mobile shell.
 * The core is the single source of truth: same combat, waves, bosses,
 * perks, relics, drones, mutations, meta save. See MOBILE_PARITY_PLAN.md.
 *
 * This module is DOM-free: parity-sim.ts constructs the runtime headlessly
 * and drives it at a fixed 1/60 step.
 */
import { Game } from '../../src/game/game';
import { AudioEngine } from '../../src/game/audio';
import { loadMeta, saveMeta } from '../../src/game/save';
import type { MetaSave } from '../../src/game/types';

// ---------------------------------------------------------------- prefs
/** Mobile-only prefs the core save does not model (shell concerns). */
const PREFS_KEY = 'voidpulse_mobile_prefs_v1';

export interface MobilePrefs {
  haptics: boolean;
  fps120: boolean; // false = 60 render cap (low-power); logic is ALWAYS 60 Hz
}

export const prefs: MobilePrefs = { haptics: true, fps120: false };

export function loadPrefs(): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Partial<MobilePrefs>;
    if (typeof d.haptics === 'boolean') prefs.haptics = d.haptics;
    if (typeof d.fps120 === 'boolean') prefs.fps120 = d.fps120;
  } catch { /* corrupt prefs — keep defaults */ }
}

export function savePrefs(): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
}

// ---------------------------------------------------------------- migration
/** Lite-era save (v1.5.0) → core save. One-time, then the lite key is retired. */
const LITE_KEY = 'voidpulse_mobile_v1';
const CORE_KEY = 'voidpulse_save_v2';

function migrateLiteSave(): void {
  try {
    if (localStorage.getItem(CORE_KEY)) { localStorage.removeItem(LITE_KEY); return; }
    const raw = localStorage.getItem(LITE_KEY);
    if (!raw) return;
    const lite = JSON.parse(raw) as {
      cores?: number;
      bests?: { score?: number; wave?: number };
      settings?: { master?: number; sfx?: number; music?: number };
    };
    const meta: MetaSave = loadMeta();
    if (typeof lite.cores === 'number' && lite.cores > 0) meta.cores += lite.cores | 0;
    if (lite.bests) {
      meta.bestScore = Math.max(meta.bestScore, lite.bests.score ?? 0);
      meta.bestWave = Math.max(meta.bestWave, lite.bests.wave ?? 0);
    }
    if (lite.settings) {
      if (typeof lite.settings.master === 'number') meta.settings.volMaster = lite.settings.master;
      if (typeof lite.settings.sfx === 'number') meta.settings.volSfx = lite.settings.sfx;
      if (typeof lite.settings.music === 'number') meta.settings.volMusic = lite.settings.music;
    }
    saveMeta(meta);
    localStorage.removeItem(LITE_KEY);
  } catch { /* fall through — loadMeta already returns a sane default */ }
}

// ---------------------------------------------------------------- runtime
/** Screen hooks — assigned by ui/screens.ts (keeps bridge DOM-free). */
export interface FlowHooks {
  onLevelUp(): void;
  onRelicPick(): void;
  onRunEnd(won: boolean): void;
  onTitle(): void;
  onWave(w: number): void;
}

export const rt = {
  game: null as unknown as Game,
  audio: null as unknown as AudioEngine,
  flow: null as unknown as FlowHooks,
  /** bests captured at run start (for "new best" detection the shell shows) */
  bestAtStart: { score: 0, wave: 0 },
  /** max dash charges at run start (full) — pip count for the HUD */
  maxDash: 2,
};

export function createRuntime(): void {
  loadPrefs();
  migrateLiteSave();
  const audio = new AudioEngine();
  const game = new Game(audio);
  const s = game.meta.data.settings;
  audio.setVolumes(s.volMaster, s.volMusic, s.volSfx);
  audio.setMuted(game.meta.data.muted);
  rt.game = game;
  rt.audio = audio;
}

/** AudioPort: must be called from a user gesture (iOS unlock). */
export function unlockAudio(): void { rt.audio.init(); }

// ---------------------------------------------------------------- input bridge
/** Normalized stick vector (-1..1, deadzone already applied by input.ts). */
let stickX = 0, stickY = 0;

export function setStick(nx: number, ny: number): void { stickX = nx; stickY = ny; }

/** One-shot dash request (core consumes + clears it). */
export function requestDash(): void { rt.game.input.dash = true; }

const MOVE_THRESHOLD = 0.35; // analog → 8-way, identical to desktop key movement

/** Called once per logic step before game.update(). */
export function syncInput(): void {
  const inp = rt.game.input;
  inp.left = stickX < -MOVE_THRESHOLD;
  inp.right = stickX > MOVE_THRESHOLD;
  inp.up = stickY < -MOVE_THRESHOLD;
  inp.down = stickY > MOVE_THRESHOLD;
}

// ---------------------------------------------------------------- run control
export function startRun(daily = false): void {
  rt.bestAtStart.score = rt.game.meta.data.bestScore;
  rt.bestAtStart.wave = rt.game.meta.data.bestWave;
  rt.game.startRun(daily ? { daily: true } : undefined);
  rt.maxDash = rt.game.player.dashCharges;
  resetFlow();
}

// ---------------------------------------------------------------- flow sync
let lastWave = 0;
let lastState = 'title';

function resetFlow(): void {
  lastWave = rt.game.wave;
  lastState = rt.game.state;
}

/** Called once per logic step AFTER game.update(). Fires shell screen hooks. */
export function syncFlow(): void {
  const g = rt.game;
  const f = rt.flow; // null in headless parity runs — state tracking still works
  if (g.state !== lastState) {
    const prev = lastState;
    lastState = g.state;
    if (!f) { /* headless */ }
    else if (g.state === 'levelup') f.onLevelUp();
    else if (g.state === 'relicpick') f.onRelicPick();
    else if (g.state === 'gameover') f.onRunEnd(false);
    else if (g.state === 'victory') f.onRunEnd(true);
    else if (g.state === 'title' && prev !== 'title') f.onTitle();
  }
  if (g.wave !== lastWave) {
    if (lastWave !== 0 && f) f.onWave(g.wave); // skip the run-start wave set
    lastWave = g.wave;
  }
}
