// ===== VOIDPULSE :: persistent meta progression (localStorage) =====

import type { MetaSave } from './types';
import { META_PERKS } from './content';

const KEY = 'voidpulse_save_v1';

export function defaultMeta(): MetaSave {
  return {
    cores: 0,
    perks: {},
    bestScore: 0,
    bestWave: 0,
    runs: 0,
    wins: 0,
    endlessUnlocked: false,
    muted: false,
  };
}

export function loadMeta(): MetaSave {
  if (typeof window === 'undefined') return defaultMeta();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultMeta();
    const parsed = JSON.parse(raw) as Partial<MetaSave>;
    const meta = { ...defaultMeta(), ...parsed };
    meta.perks = { ...(parsed.perks ?? {}) };
    // sanitize: clamp perk tiers to max
    for (const p of META_PERKS) {
      meta.perks[p.id] = Math.max(0, Math.min(p.maxTier, meta.perks[p.id] ?? 0));
    }
    return meta;
  } catch {
    return defaultMeta();
  }
}

export function saveMeta(meta: MetaSave): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    // storage unavailable (private mode etc) — meta simply won't persist
  }
}
