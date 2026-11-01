/** VOIDPULSE MOBILE — shared types. No imports (leaf module). */

// Game states (numeric consts — `const enum` is banned under isolatedModules)
export const ST_TITLE = 0;
export const ST_GARAGE = 1;
export const ST_RUNNING = 2;
export const ST_LEVELUP = 3;
export const ST_PAUSED = 4;
export const ST_GAMEOVER = 5;

export interface Settings {
  master: number;   // 0..1
  sfx: number;      // 0..1
  music: number;    // 0..1
  haptics: boolean;
  fps120: boolean;  // false = 60 low-power mode
  palette: number;  // 0 default, 1 deutan, 2 protan, 3 tritan
}

export interface Bests {
  score: number;
  wave: number;
  kills: number;
  time: number;
}

export interface SaveData {
  bests: Bests;
  cores: number;
  hull: number;          // selected hull index
  unlocked: number;      // bitmask of unlocked hulls
  settings: Settings;
}

export interface HullDef {
  id: number;
  name: string;
  tag: string;
  hp: number;
  speed: number;
  dmg: number;
  fireRate: number;
  dashCd: number;
  regen: number;         // hp/s
  cost: number;          // cores to unlock (0 = free)
}

/**
 * Scratch discipline: hot-path functions use ONLY local primitives (`let`)
 * and module-level pre-allocated state. No object/array literals, no
 * closures, no .map/.filter inside tick/draw.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : (v > hi ? hi : v);
}
