/**
 * VOIDPULSE MOBILE — save (localStorage). Leaf module.
 * Key is namespaced separately from the desktop game — mobile and desktop
 * saves never collide.
 */
import { SaveData } from './types';

const KEY = 'voidpulse_mobile_v1';

function defaults(): SaveData {
  return {
    bests: { score: 0, wave: 0, kills: 0, time: 0 },
    cores: 0,
    hull: 0,
    unlocked: 1, // bit 0 = PULSE
    settings: { master: 0.8, sfx: 0.8, music: 0.45, haptics: true, fps120: false, palette: 0 },
  };
}

export const save: SaveData = defaults();

export function loadSave(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const d = JSON.parse(raw) as Partial<SaveData>;
    if (d.bests) {
      save.bests.score = d.bests.score | 0;
      save.bests.wave = d.bests.wave | 0;
      save.bests.kills = d.bests.kills | 0;
      save.bests.time = d.bests.time || 0;
    }
    if (typeof d.cores === 'number') save.cores = d.cores | 0;
    if (typeof d.hull === 'number') save.hull = d.hull | 0;
    if (typeof d.unlocked === 'number') save.unlocked = d.unlocked;
    if (d.settings) {
      const s = d.settings;
      if (typeof s.master === 'number') save.settings.master = s.master;
      if (typeof s.sfx === 'number') save.settings.sfx = s.sfx;
      if (typeof s.music === 'number') save.settings.music = s.music;
      if (typeof s.haptics === 'boolean') save.settings.haptics = s.haptics;
      if (typeof s.fps120 === 'boolean') save.settings.fps120 = s.fps120;
      if (typeof s.palette === 'number') save.settings.palette = s.palette | 0;
    }
  } catch { /* corrupt save — keep defaults */ }
}

export function persist(): void {
  try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* storage full/blocked */ }
}

/** Bank cores from a finished run. */
export function bankCores(n: number): void {
  save.cores += n;
  persist();
}

/** Compare against bests, update, persist. Returns true on any new best. */
export function recordRun(score: number, wave: number, kills: number, time: number): boolean {
  let best = false;
  if (score > save.bests.score) { save.bests.score = score; best = true; }
  if (wave > save.bests.wave) { save.bests.wave = wave; best = true; }
  if (kills > save.bests.kills) { save.bests.kills = kills; best = true; }
  if (time > save.bests.time) { save.bests.time = time; best = true; }
  if (best) persist();
  return best;
}

/** Try to unlock a hull by bitmask index. Returns false if unaffordable/owned. */
export function unlockHull(bit: number, cost: number): boolean {
  if (save.unlocked & bit) return true;
  if (save.cores < cost) return false;
  save.cores -= cost;
  save.unlocked |= bit;
  persist();
  return true;
}

export function selectHull(idx: number): void {
  save.hull = idx;
  persist();
}
