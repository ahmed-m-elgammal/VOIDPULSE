// ===== VOIDPULSE :: SEASON ONE economy — VOIDPASS / contracts / market =====
// All currencies and their faucets/sinks live here.
//   CORES (◆) — earned from runs; perks + boosters + skins
//   PRISMS (◇) — premium currency; pass rewards, contracts, exchange
//   BP XP — fills the season pass; earned every run + contracts

import type { ContractDef, MetaSave, PassReward, PassTier } from './types';
import { RARITY_LABEL, SKINS, skinOf } from './skins';

export const PRIME_PRICE = 980; // prisms
export const EXCHANGE_CORES = 1000; // cores ->
export const EXCHANGE_PRISMS = 40; //  -> prisms
export const PASS_MAX_TIER = 30;
export const SEASON_NAME = 'SEASON 1 · CRIMSON ABYSS';

/** XP needed to advance FROM tier t to t+1 */
export function bpXpForTier(t: number): number {
  return 700 + (t - 1) * 45;
}

// ---------------- VOIDPASS track ----------------

function cores(n: number): PassReward {
  return { kind: 'cores', amount: n, label: `${n}◆ CORES` };
}
function prisms(n: number): PassReward {
  return { kind: 'prisms', amount: n, label: `${n}◇ PRISMS` };
}
function booster(id: string): PassReward {
  return { kind: 'booster', id, label: BOOSTER_LABELS[id] ?? id };
}
function skin(id: string): PassReward {
  return { kind: 'skin', id, label: skinOf(id).name };
}
function title(t: string): PassReward {
  return { kind: 'title', label: t };
}

export const BOOSTER_LABELS: Record<string, string> = {
  xpAmp: 'XP AMP',
  coreAmp: 'CORE AMP',
  bpAmp: 'BP AMP',
  shieldCache: 'SHIELD CACHE',
};

type TierSeed = [PassReward, PassReward]; // [free, prime]

const TIER_SEEDS: TierSeed[] = [
  [cores(60), booster('xpAmp')], // 1
  [cores(30), cores(30)], // 2
  [prisms(15), prisms(60)], // 3
  [cores(80), booster('coreAmp')], // 4
  [prisms(25), title('Heat Addict')], // 5
  [cores(90), cores(90)], // 6
  [booster('bpAmp'), prisms(90)], // 7
  [cores(100), cores(120)], // 8
  [prisms(20), prisms(60)], // 9
  [cores(130), cores(150)], // 10
  [booster('xpAmp'), prisms(80)], // 11
  [prisms(30), cores(160)], // 12
  [cores(110), booster('coreAmp')], // 13
  [prisms(50), prisms(100)], // 14
  [title('Abyss Diver'), cores(200)], // 15
  [cores(120), booster('bpAmp')], // 16
  [prisms(25), booster('shieldCache')], // 17
  [cores(140), prisms(100)], // 18
  [prisms(60), cores(180)], // 19
  [cores(150), skin('phantom')], // 20
  [booster('xpAmp'), prisms(100)], // 21
  [cores(160), cores(220)], // 22
  [prisms(30), booster('coreAmp')], // 23
  [cores(180), prisms(110)], // 24
  [booster('shieldCache'), cores(240)], // 25
  [prisms(70), prisms(110)], // 26
  [cores(200), cores(280)], // 27
  [booster('xpAmp'), prisms(120)], // 28
  [prisms(40), prisms(120)], // 29
  [title('Voidwalker'), skin('sovereign')], // 30
];

export const PASS_TIERS: PassTier[] = TIER_SEEDS.map(([free, prime], i) => ({
  tier: i + 1,
  need: bpXpForTier(i + 1),
  free,
  prime,
}));

// season totals (for economy verification)
export const PRIME_PRISM_TOTAL = PASS_TIERS.reduce((a, t) => a + (t.prime.kind === 'prisms' ? t.prime.amount ?? 0 : 0), 0);
export const FREE_PRISM_TOTAL = PASS_TIERS.reduce((a, t) => a + (t.free.kind === 'prisms' ? t.free.amount ?? 0 : 0), 0);

// ---------------- boosters (consumables) ----------------

export interface BoosterCatalogEntry {
  id: string;
  name: string;
  desc: string;
  currency: 'cores' | 'prisms';
  price: number;
  color: string;
}

export const BOOSTERS: BoosterCatalogEntry[] = [
  {
    id: 'xpAmp',
    name: 'XP Amplifier',
    desc: '+30% XP gained during your next run.',
    currency: 'cores',
    price: 240,
    color: '#6dff8c',
  },
  {
    id: 'coreAmp',
    name: 'Core Amplifier',
    desc: '+35% CORES earned from your next run.',
    currency: 'cores',
    price: 300,
    color: '#ffd166',
  },
  {
    id: 'bpAmp',
    name: 'BP Amplifier',
    desc: '+40% VOIDPASS XP from your next run.',
    currency: 'prisms',
    price: 60,
    color: '#c9b8ff',
  },
  {
    id: 'shieldCache',
    name: 'Shield Cache',
    desc: 'Begin your next run behind a 1-hit barrier.',
    currency: 'cores',
    price: 450,
    color: '#9adcff',
  },
];

// ---------------- contracts ----------------

export const CONTRACT_POOL: ContractDef[] = [
  { id: 'kills_600', desc: 'Defeat 600 enemies', target: 600, metric: 'kills', perRun: false, bpXp: 800, cores: 120 },
  { id: 'wave_8', desc: 'Reach wave 8 in a single run', target: 8, metric: 'wave', perRun: true, bpXp: 500, cores: 60 },
  { id: 'elites_15', desc: 'Destroy 15 ELITE signatures', target: 15, metric: 'elites', perRun: false, bpXp: 700, cores: 100 },
  { id: 'dash_40', desc: 'Dash-kill 40 small targets', target: 40, metric: 'dashKills', perRun: false, bpXp: 500, cores: 80 },
  { id: 'overdrive_6', desc: 'Trigger OVERDRIVE 6 times', target: 6, metric: 'overdrive', perRun: false, bpXp: 600, cores: 90 },
  { id: 'bosses_4', desc: 'Destroy 4 bosses', target: 4, metric: 'bosses', perRun: false, bpXp: 900, prisms: 50 },
  { id: 'wave_12', desc: 'Reach wave 12 in a single run', target: 12, metric: 'wave', perRun: true, bpXp: 900, prisms: 40 },
  { id: 'heals_25', desc: 'Collect 25 repair orbs', target: 25, metric: 'heals', perRun: false, bpXp: 400, cores: 70 },
  { id: 'score_60k', desc: 'Score 60,000 in a single run', target: 60000, metric: 'score', perRun: true, bpXp: 800, prisms: 60 },
  { id: 'cores_5k', desc: 'Earn 5,000 CORES from runs', target: 5000, metric: 'coresEarned', perRun: false, bpXp: 700, prisms: 30 },
  { id: 'wins_2', desc: 'Stabilize the core (win) twice', target: 2, metric: 'wins', perRun: false, bpXp: 1200, prisms: 80 },
];

export interface RunStats {
  wave: number;
  kills: number;
  elites: number;
  bosses: number;
  dashKills: number;
  overdrive: number;
  score: number;
  heals: number;
  coresEarned: number;
  won: boolean;
}

export interface GrantResult {
  levelsGained: number;
  rewards: { tier: number; track: 'free' | 'prime'; label: string }[];
}

function grantReward(meta: MetaSave, r: PassReward): void {
  switch (r.kind) {
    case 'cores':
      meta.cores += r.amount ?? 0;
      break;
    case 'prisms':
      meta.prisms += r.amount ?? 0;
      break;
    case 'skin':
      if (r.id && !meta.skinsOwned.includes(r.id)) meta.skinsOwned.push(r.id);
      break;
    case 'booster':
      if (r.id) meta.boosters[r.id] = (meta.boosters[r.id] ?? 0) + 1;
      break;
    case 'title':
      if (!meta.titlesOwned.includes(r.label)) meta.titlesOwned.push(r.label);
      meta.equippedTitle = r.label;
      break;
  }
}

/** Add battle-pass XP, advancing tiers and granting rewards (auto-claim). */
export function applyBpXp(meta: MetaSave, xp: number): GrantResult {
  const res: GrantResult = { levelsGained: 0, rewards: [] };
  if (xp <= 0) return res;
  meta.passXp += xp;
  meta.bpXpTotal += xp;
  while (meta.passLevel < PASS_MAX_TIER) {
    const need = bpXpForTier(meta.passLevel);
    if (meta.passXp < need) break;
    meta.passXp -= need;
    meta.passLevel++;
    res.levelsGained++;
    const tier = PASS_TIERS[meta.passLevel - 1];
    if (tier) {
      res.rewards.push({ tier: tier.tier, track: 'free', label: tier.free.label });
      grantReward(meta, tier.free);
      if (meta.prime) {
        res.rewards.push({ tier: tier.tier, track: 'prime', label: tier.prime.label });
        grantReward(meta, tier.prime);
      }
    }
  }
  if (meta.passLevel >= PASS_MAX_TIER) meta.passXp = 0;
  return res;
}

// ---------------- contracts logic ----------------

export function contractValue(meta: MetaSave, run: RunStats, c: ContractDef): number {
  if (c.perRun) {
    switch (c.metric) {
      case 'wave':
        return run.wave;
      case 'score':
        return run.score;
      default:
        return 0;
    }
  }
  switch (c.metric) {
    case 'kills':
      return meta.life.kills;
    case 'elites':
      return meta.life.elites;
    case 'bosses':
      return meta.life.bosses;
    case 'dashKills':
      return meta.life.dashKills;
    case 'overdrive':
      return meta.life.overdrive;
    case 'coresEarned':
      return meta.life.coresEarned;
    case 'heals':
      return meta.life.heals;
    case 'wins':
      return meta.wins;
    default:
      return 0;
  }
}

export function contractProgressValue(meta: MetaSave, run: RunStats, c: ContractDef): number {
  if (c.perRun) return Math.max(meta.contractProgress[c.id] ?? 0, contractValue(meta, run, c));
  return contractValue(meta, run, c);
}

/** Roll the next contract from the pool that isn't done or already slotted. */
export function nextContractId(meta: MetaSave): string {
  for (const c of CONTRACT_POOL) {
    if (meta.contractsDone.includes(c.id)) continue;
    if (meta.contractSlots.includes(c.id)) continue;
    return c.id;
  }
  return '';
}

export interface ContractComplete {
  id: string;
  desc: string;
  bpXp: number;
  reward: string;
}

/** Evaluate active contracts after a run; completes and replaces them.
 *  Mutates meta; returns completions for the run-end ceremony. */
export function settleContracts(meta: MetaSave, run: RunStats): ContractComplete[] {
  const done: ContractComplete[] = [];
  for (let i = 0; i < meta.contractSlots.length; i++) {
    const id = meta.contractSlots[i];
    if (!id) continue;
    const c = CONTRACT_POOL.find((x) => x.id === id);
    if (!c) continue;
    const value = contractValue(meta, run, c);
    if (c.perRun) {
      meta.contractProgress[c.id] = Math.max(meta.contractProgress[c.id] ?? 0, value);
    }
    if (value < c.target) continue;
    // complete!
    meta.cores += c.cores ?? 0;
    meta.prisms += c.prisms ?? 0;
    const rewardBits: string[] = [];
    if (c.cores) rewardBits.push(`${c.cores}◆`);
    if (c.prisms) rewardBits.push(`${c.prisms}◇`);
    const bp = applyBpXp(meta, c.bpXp);
    done.push({ id: c.id, desc: c.desc, bpXp: c.bpXp, reward: rewardBits.join(' + ') });
    meta.contractsDone.push(c.id);
    meta.contractsCleared++;
    meta.contractSlots[i] = nextContractId(meta);
    // note: bp rewards from the contract itself are folded into run-end display via done[]
  }
  return done;
}

// ---------------- run -> pass xp ----------------

export function computeRunBpXp(run: RunStats): number {
  const base =
    run.wave * 110 + run.kills * 1.6 + run.bosses * 300 + Math.floor(run.score / 350) + (run.won ? 1800 : 0);
  return Math.max(0, Math.round(base));
}

// ---------------- market helpers ----------------

export function marketSkins(meta: MetaSave): {
  id: string;
  name: string;
  desc: string;
  price: number;
  currency: 'cores' | 'prisms';
  color: string;
  owned: boolean;
  equipped: boolean;
  rarityLabel: string;
}[] {
  return Object.values(SKINS)
    .filter((s) => s.currency !== 'pass')
    .map((s) => ({
      id: s.id,
      name: s.name,
      desc: s.desc,
      price: s.price,
      currency: s.currency as 'cores' | 'prisms',
      color: s.color,
      owned: meta.skinsOwned.includes(s.id),
      equipped: meta.skinEquipped === s.id,
      rarityLabel: RARITY_LABEL[s.rarity],
    }));
}
