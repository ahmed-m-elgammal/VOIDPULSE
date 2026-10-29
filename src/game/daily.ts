// ===== VOIDPULSE :: DAILY BREACH — date-seeded challenge =====
// One seeded configuration per calendar day: fixed mutations, personal-best
// stamp, one-time completion prism. No leaderboard — you race your own ghost.

import { MUTANT_BONUS_MULT } from './mutations';

const DAILY_EPOCH = 1735689600000; // 2025-01-01T00:00:00Z — stable anchor for hashing

export const DAILY_COMPLETION_PRISMS = 60;

/** Local calendar date key, e.g. "2026-10-30". */
export function todayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Deterministic 32-bit seed from a date key. */
export function dailySeedFor(key: string): number {
  let h = 2166136261 ^ (DAILY_EPOCH & 0xffffffff);
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** FNV-1a continuation — used to derive sub-streams from one seed. */
function hashStep(h: number, salt: number): number {
  let x = (h ^ salt) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 2246822507) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 3266489909) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/** The fixed mutation set for a given day — exactly 2 of the 4 VOID DIAL toggles. */
export function dailyMutationsFor(seed: number): string[] {
  const pool = ['cursedCores', 'glassHull', 'swarmProtocol', 'ironMan'];
  const a = pool[hashStep(seed, 0x9e3779b9) % pool.length];
  let b = pool[hashStep(seed, 0x85ebca6b) % pool.length];
  let guard = 0;
  while (b === a && guard++ < 8) b = pool[hashStep(seed, guard * 0x27d4eb2f) % pool.length];
  return [a, b === a ? pool[(pool.indexOf(a) + 1) % pool.length] : b];
}

/** Multiplier note shown on the title screen (keeps MUTANT math in one place). */
export function mutantHint(): string {
  return `3+ MUTATIONS = ×${MUTANT_BONUS_MULT} BP XP`;
}
