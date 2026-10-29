// ===== VOIDPULSE :: persistent meta progression (localStorage) =====
// v2 — SEASON ONE: battle pass, market, contracts, skins, boosters.

import type { LifeStats, MetaSave } from './types';
import { META_PERKS } from './content';
import { CONTRACT_POOL } from './economy';

const KEY = 'voidpulse_save_v2';
const KEY_V1 = 'voidpulse_save_v1';

export function defaultLife(): LifeStats {
  return { kills: 0, elites: 0, bosses: 0, dashKills: 0, overdrive: 0, coresEarned: 0, heals: 0 };
}

export function defaultMeta(): MetaSave {
  return {
    saveVersion: 2,
    seasonId: 1,
    cores: 0,
    prisms: 0,
    perks: {},
    bestScore: 0,
    bestWave: 0,
    runs: 0,
    wins: 0,
    endlessUnlocked: false,
    muted: false,
    passLevel: 1,
    passXp: 0,
    prime: false,
    primeDemo: false,
    skinsOwned: ['pulse'],
    skinEquipped: 'pulse',
    equippedTitle: '',
    titlesOwned: [],
    boosters: {},
    contractSlots: [CONTRACT_POOL[0].id, CONTRACT_POOL[1].id, CONTRACT_POOL[2].id],
    contractProgress: {},
    contractsDone: [],
    contractsCleared: 0,
    life: defaultLife(),
    bpXpTotal: 0,
  };
}

/** v1 -> v2 migration: carry over everything that still exists. */
function migrateV1(raw: Record<string, unknown>): MetaSave {
  const meta = defaultMeta();
  const num = (k: string, d: number): number => (typeof raw[k] === 'number' ? (raw[k] as number) : d);
  meta.cores = num('cores', 0);
  meta.bestScore = num('bestScore', 0);
  meta.bestWave = num('bestWave', 0);
  meta.runs = num('runs', 0);
  meta.wins = num('wins', 0);
  meta.endlessUnlocked = raw['endlessUnlocked'] === true;
  meta.muted = raw['muted'] === true;
  if (raw['perks'] && typeof raw['perks'] === 'object') {
    const perks = raw['perks'] as Record<string, unknown>;
    for (const p of META_PERKS) {
      const v = perks[p.id];
      if (typeof v === 'number') meta.perks[p.id] = v;
    }
  }
  // give veteran players a head start on the season
  meta.prisms = Math.min(150, Math.floor(meta.runs * 8 + meta.wins * 40));
  return meta;
}

export function loadMeta(): MetaSave {
  if (typeof window === 'undefined') return defaultMeta();
  try {
    const rawV2 = window.localStorage.getItem(KEY);
    if (!rawV2) {
      const rawV1 = window.localStorage.getItem(KEY_V1);
      if (rawV1) {
        try {
          const migrated = migrateV1(JSON.parse(rawV1) as Record<string, unknown>);
          saveMeta(migrated);
          return migrated;
        } catch {
          /* fall through to default */
        }
      }
      return defaultMeta();
    }
    const parsed = JSON.parse(rawV2) as Partial<MetaSave>;
    const meta: MetaSave = { ...defaultMeta(), ...parsed };
    meta.perks = { ...(parsed.perks ?? {}) };
    meta.boosters = { ...(parsed.boosters ?? {}) };
    meta.contractProgress = { ...(parsed.contractProgress ?? {}) };
    meta.life = { ...defaultLife(), ...(parsed.life ?? {}) };
    meta.skinsOwned = parsed.skinsOwned?.length ? [...parsed.skinsOwned] : ['pulse'];
    if (!meta.skinsOwned.includes('pulse')) meta.skinsOwned.unshift('pulse');
    meta.titlesOwned = [...(parsed.titlesOwned ?? [])];
    meta.contractsDone = [...(parsed.contractsDone ?? [])];
    meta.skinEquipped = meta.skinsOwned.includes(meta.skinEquipped) ? meta.skinEquipped : 'pulse';
    meta.passLevel = Math.max(1, Math.min(30, meta.passLevel || 1));
    meta.passXp = Math.max(0, meta.passXp || 0);
    if (meta.primeDemo) meta.prime = true;
    meta.seasonId = 1;
    // sanitize perk tiers
    for (const p of META_PERKS) {
      meta.perks[p.id] = Math.max(0, Math.min(p.maxTier, meta.perks[p.id] ?? 0));
    }
    // sanitize contracts: valid ids, exactly 3 unique actives, not already done
    const poolIds = new Set(CONTRACT_POOL.map((c) => c.id));
    const slots = meta.contractSlots.filter((id) => poolIds.has(id) && !meta.contractsDone.includes(id));
    for (const c of CONTRACT_POOL) {
      if (slots.length >= 3) break;
      if (!slots.includes(c.id) && !meta.contractsDone.includes(c.id)) slots.push(c.id);
    }
    meta.contractSlots = slots.slice(0, 3);
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
