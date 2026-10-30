// ===== VOIDPULSE :: v1.4 ASCENSION (NG+) — the tree that deepens the void =====
// Unlocked by stabilizing the core once (first victory). Every node is a
// stackable, PERMANENT commitment: each rank twists the run harder and pays
// back a bigger CORES multiplier. Total ranks bought = ASCENSION LEVEL.
//
//   HUNGER      — enemies hit harder (HP / damage / bullet speed)
//   HORDE       — the swarm thickens (density / burst size / sim cap)
//   CORRUPTION  — signatures corrupt earlier (elite floor / affixes / boss HP)

import type { MetaSave } from './types';

export type AscBranch = 'hunger' | 'horde' | 'corruption';

export interface AscNodeDef {
  id: string;
  name: string;
  branch: AscBranch;
  tier: 1 | 2 | 3;
  glyph: string;
  color: string;
  maxRank: number;
  baseCost: number;
  req?: { id: string; rank: number };
  desc: string; // what the whole node does
  effect: (rank: number) => string; // effect text at a given rank
}

export const ASC_BRANCHES: { id: AscBranch; name: string; color: string; blurb: string }[] = [
  { id: 'hunger', name: 'HUNGER', color: '#ff5c8a', blurb: 'the swarm bites deeper' },
  { id: 'horde', name: 'HORDE', color: '#d96bff', blurb: 'the swarm never thins' },
  { id: 'corruption', name: 'CORRUPTION', color: '#ff9a3d', blurb: 'signatures corrupt sooner' },
];

export const ASC_NODES: AscNodeDef[] = [
  // ---- tier 1 ----
  {
    id: 'voidfed',
    name: 'VOIDFED FLESH',
    branch: 'hunger',
    tier: 1,
    glyph: '♥',
    color: '#ff5c8a',
    maxRank: 10,
    baseCost: 130,
    desc: 'Every hostile hull thickens.',
    effect: (r) => `+${r * 8}% enemy HP`,
  },
  {
    id: 'swarm',
    name: 'SWARM LOGIC',
    branch: 'horde',
    tier: 1,
    glyph: '⁂',
    color: '#d96bff',
    maxRank: 10,
    baseCost: 130,
    desc: 'Wave budgets grow fatter.',
    effect: (r) => `+${r * 8}% spawn density`,
  },
  {
    id: 'vanguard',
    name: 'ELITE VANGUARD',
    branch: 'corruption',
    tier: 1,
    glyph: '▲',
    color: '#ff9a3d',
    maxRank: 2,
    baseCost: 220,
    desc: 'Elite signatures invade earlier and more often.',
    effect: (r) => `elites from wave ${Math.max(1, 3 - r)}, +${r * 2}% elite chance`,
  },
  // ---- tier 2 ----
  {
    id: 'barbed',
    name: 'BARBED WILL',
    branch: 'hunger',
    tier: 2,
    glyph: '✕',
    color: '#ff5c8a',
    maxRank: 8,
    baseCost: 160,
    req: { id: 'voidfed', rank: 2 },
    desc: 'Hostile contact and fire hit harder.',
    effect: (r) => `+${r * 6}% enemy damage`,
  },
  {
    id: 'brood',
    name: 'BROOD BURSTS',
    branch: 'horde',
    tier: 2,
    glyph: '≋',
    color: '#d96bff',
    maxRank: 4,
    baseCost: 170,
    req: { id: 'swarm', rank: 2 },
    desc: 'Spawn bursts pack extra bodies.',
    effect: (r) => `+${r} per spawn burst`,
  },
  {
    id: 'twinAffix',
    name: 'TWIN AFFIXES',
    branch: 'corruption',
    tier: 2,
    glyph: '⁝',
    color: '#ff9a3d',
    maxRank: 2,
    baseCost: 260,
    req: { id: 'vanguard', rank: 1 },
    desc: 'Deep-wave elites roll richer affix sets.',
    effect: (r) => (r >= 2 ? 'wave 5+ elites: 2 affixes guaranteed, 25% for a 3rd' : 'wave 5+ elites always roll 2 affixes'),
  },
  // ---- tier 3 ----
  {
    id: 'frenzy',
    name: 'FRENZIED SIGNALS',
    branch: 'hunger',
    tier: 3,
    glyph: '⚡',
    color: '#ff5c8a',
    maxRank: 5,
    baseCost: 180,
    req: { id: 'barbed', rank: 2 },
    desc: 'Enemy fire travels faster.',
    effect: (r) => `+${r * 10}% enemy bullet speed`,
  },
  {
    id: 'overflow',
    name: 'CAP OVERFLOW',
    branch: 'horde',
    tier: 3,
    glyph: '∎',
    color: '#d96bff',
    maxRank: 5,
    baseCost: 170,
    req: { id: 'brood', rank: 2 },
    desc: 'The field holds more simultaneous hostiles.',
    effect: (r) => `+${r * 20} max simultaneous enemies`,
  },
  {
    id: 'ascendant',
    name: 'ASCENDANT SIGILS',
    branch: 'corruption',
    tier: 3,
    glyph: '◈',
    color: '#ff9a3d',
    maxRank: 5,
    baseCost: 240,
    req: { id: 'twinAffix', rank: 1 },
    desc: 'The deep-dwellers harden.',
    effect: (r) => `+${r * 18}% boss HP`,
  },
];

export const CORES_PER_RANK = 0.08; // +8% cores earned per ascension rank

export function ascNodeOf(id: string): AscNodeDef | null {
  return ASC_NODES.find((n) => n.id === id) ?? null;
}

/** Total ranks bought across the tree = the player's Ascension Level. */
export function ascLevelOf(save: MetaSave): number {
  let lv = 0;
  for (const n of ASC_NODES) lv += save.ascension[n.id] ?? 0;
  return lv;
}

export function ascCoresMult(level: number): number {
  return 1 + CORES_PER_RANK * level;
}

/** Cost of the NEXT rank (currentRank -> currentRank+1), rounded to 5. */
export function ascCostOf(node: AscNodeDef, currentRank: number): number {
  const raw = node.baseCost * Math.pow(currentRank + 1, 1.25);
  return Math.max(5, Math.round(raw / 5) * 5);
}

export function ascUnlocked(save: MetaSave): boolean {
  return save.endlessUnlocked || save.wins > 0;
}

export function nodeRank(save: MetaSave, id: string): number {
  return save.ascension[id] ?? 0;
}

/** Tree gating: unlocked game + prerequisite node depth. */
export function nodeLocked(save: MetaSave, node: AscNodeDef): { locked: boolean; reason: string } {
  if (!ascUnlocked(save)) return { locked: true, reason: 'STABILIZE THE CORE TO UNLOCK' };
  if (node.req) {
    const have = nodeRank(save, node.req.id);
    if (have < node.req.rank) {
      const reqNode = ascNodeOf(node.req.id);
      return { locked: true, reason: `REQUIRES ${reqNode?.name ?? node.req.id} LV ${node.req.rank}` };
    }
  }
  return { locked: false, reason: '' };
}

export interface AscBuyCheck {
  ok: boolean;
  reason: string;
}

export function canBuyAscNode(save: MetaSave, node: AscNodeDef): AscBuyCheck {
  const lock = nodeLocked(save, node);
  if (lock.locked) return { ok: false, reason: lock.reason };
  const rank = nodeRank(save, node.id);
  if (rank >= node.maxRank) return { ok: false, reason: 'MAX RANK' };
  const cost = ascCostOf(node, rank);
  if (save.cores < cost) return { ok: false, reason: `NEEDS ${cost}◆` };
  return { ok: true, reason: '' };
}

/** Deduct cores, deepen the rank. Caller persists the save. */
export function buyAscNode(save: MetaSave, node: AscNodeDef): AscBuyCheck {
  const check = canBuyAscNode(save, node);
  if (!check.ok) return check;
  save.cores -= ascCostOf(node, nodeRank(save, node.id));
  save.ascension[node.id] = nodeRank(save, node.id) + 1;
  return { ok: true, reason: '' };
}

// ---------------- per-run aggregate ----------------

export interface AscensionState {
  level: number;
  coresMult: number;
  enemyHp: number; // multiplier
  enemyDmg: number; // multiplier
  bulletSpeed: number; // multiplier on every hostile projectile
  density: number; // multiplier on wave spawn budget
  burstAdd: number; // extra bodies per spawn burst
  capAdd: number; // extra max simultaneous enemies
  eliteFloor: number; // first wave elites may appear on
  eliteChanceBonus: number; // flat chance added at/after the floor
  affixTier: number; // 0 none, 1 guaranteed 2nd affix, 2 + 3rd chance
  bossHpMult: number; // multiplier
  active: boolean;
}

export const NO_ASCENSION: AscensionState = {
  level: 0,
  coresMult: 1,
  enemyHp: 1,
  enemyDmg: 1,
  bulletSpeed: 1,
  density: 1,
  burstAdd: 0,
  capAdd: 0,
  eliteFloor: 3,
  eliteChanceBonus: 0,
  affixTier: 0,
  bossHpMult: 1,
  active: false,
};

/** Aggregate the tree into run modifiers. DAILY BREACH stays ascension-free. */
export function computeAscension(save: MetaSave, dailyMode: boolean): AscensionState {
  if (dailyMode) return NO_ASCENSION;
  const r = (id: string): number => nodeRank(save, id);
  const level = ascLevelOf(save);
  if (level === 0) return NO_ASCENSION;
  const vanguard = r('vanguard');
  return {
    level,
    coresMult: ascCoresMult(level),
    enemyHp: 1 + 0.08 * r('voidfed'),
    enemyDmg: 1 + 0.06 * r('barbed'),
    bulletSpeed: 1 + 0.1 * r('frenzy'),
    density: 1 + 0.08 * r('swarm'),
    burstAdd: r('brood'),
    capAdd: 20 * r('overflow'),
    eliteFloor: Math.max(1, 3 - vanguard),
    eliteChanceBonus: 0.02 * vanguard,
    affixTier: r('twinAffix'),
    bossHpMult: 1 + 0.18 * r('ascendant'),
    active: true,
  };
}
