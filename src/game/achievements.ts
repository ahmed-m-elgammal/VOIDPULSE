// ===== VOIDPULSE :: achievements — lifelong milestones paying cores/prisms =====
// Evaluated after every run against the meta save (lifetime stats + bests).
// Unlocks land in MetaSave.achievements (id -> epoch ms) and toast at run end.

import type { MetaSave } from './types';
import { ascLevelOf } from './ascension';

export type AchMetric =
  | 'kills'
  | 'elites'
  | 'bosses'
  | 'wins'
  | 'bestWave'
  | 'bestScore'
  | 'dashKills'
  | 'overdrive'
  | 'evolutions'
  | 'coresEarned'
  | 'contracts'
  | 'passLevel'
  | 'daily'
  | 'ascension';

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  metric: AchMetric;
  target: number;
  tier: 1 | 2 | 3 | 4;
  cores?: number;
  prisms?: number;
}

const A = (
  id: string,
  name: string,
  desc: string,
  metric: AchMetric,
  target: number,
  tier: 1 | 2 | 3 | 4,
  cores?: number,
  prisms?: number
): AchievementDef => ({ id, name, desc, metric, target, tier, cores, prisms });

export const ACHIEVEMENTS: AchievementDef[] = [
  // ---- tier 1: first steps ----
  A('kills_100', 'FIRST HUNDRED', 'Defeat 100 enemies (lifetime)', 'kills', 100, 1, 60),
  A('wave_5', 'WAVE WALKER', 'Reach wave 5', 'bestWave', 5, 1, 50),
  A('dash_25', 'DASH DANCER', 'Dash-kill 25 small targets (lifetime)', 'dashKills', 25, 1, 60),
  A('od_5', 'OVERCHARGED', 'Trigger OVERDRIVE 5 times (lifetime)', 'overdrive', 5, 1, 60),
  A('cores_1k', 'SHARD PINCHER', 'Earn 1,000 CORES from runs (lifetime)', 'coresEarned', 1000, 1, 80),

  // ---- tier 2: committed ----
  A('kills_1k', 'EXTERMINATOR', 'Defeat 1,000 enemies (lifetime)', 'kills', 1000, 2, 120),
  A('wave_10', 'DEEP DIVER', 'Reach wave 10', 'bestWave', 10, 2, 120),
  A('elites_50', 'ELITE HUNTER', 'Destroy 50 ELITE signatures (lifetime)', 'elites', 50, 2, 120),
  A('bosses_10', 'BIG GAME HUNTER', 'Destroy 10 bosses (lifetime)', 'bosses', 10, 2, 140),
  A('evo_1', 'TRANSCENDENT', 'Evolve a weapon for the first time', 'evolutions', 1, 2, 150),
  A('score_30k', 'UP AND COMING', 'Score 30,000 in a single run', 'bestScore', 30000, 2, 120),
  A('od_25', 'HEAT JUNKIE', 'Trigger OVERDRIVE 25 times (lifetime)', 'overdrive', 25, 2, 120),

  // ---- tier 3: veteran ----
  A('kills_5k', 'SWARM BREAKER', 'Defeat 5,000 enemies (lifetime)', 'kills', 5000, 3, undefined, 30),
  A('wave_15', 'ABYSS RUNNER', 'Reach wave 15', 'bestWave', 15, 3, undefined, 40),
  A('bosses_25', 'LEGEND SLAYER', 'Destroy 25 bosses (lifetime)', 'bosses', 25, 3, undefined, 40),
  A('evo_10', 'MASTER OF ARMS', 'Evolve weapons 10 times (lifetime)', 'evolutions', 10, 3, undefined, 40),
  A('contracts_5', 'CONTRACTOR', 'Clear 5 season contracts', 'contracts', 5, 3, undefined, 35),
  A('score_80k', 'HIGH SCORER', 'Score 80,000 in a single run', 'bestScore', 80000, 3, undefined, 45),
  A('pass_10', 'SEASONED PILOT', 'Reach VOIDPASS tier 10', 'passLevel', 10, 3, undefined, 35),
  A('asc_5', 'ASCENDANT', 'Reach Ascension Lv 5 (NG+)', 'ascension', 5, 3, undefined, 40),

  // ---- tier 4: legend ----
  A('kills_20k', 'VOIDSOUL', 'Defeat 20,000 enemies (lifetime)', 'kills', 20000, 4, undefined, 90),
  A('win_1', 'CORE STABILIZER', 'Stabilize the core (win a run)', 'wins', 1, 4, undefined, 80),
  A('wave_25', 'INTO THE ENDLESS', 'Reach wave 25 in ENDLESS mode', 'bestWave', 25, 4, undefined, 100),
  A('pass_30', 'SEASON MASTER', 'Finish VOIDPASS tier 30', 'passLevel', 30, 4, undefined, 120),
  A('cores_50k', 'PRISM BARON', 'Earn 50,000 CORES from runs (lifetime)', 'coresEarned', 50000, 4, undefined, 90),
  A('daily_1', 'DAILY BREACHER', 'Complete a DAILY BREACH run', 'daily', 1, 3, undefined, 60),
  A('asc_10', 'DEEP CORE', 'Reach Ascension Lv 10 (NG+)', 'ascension', 10, 4, undefined, 90),
];

export const TIER_COLORS: Record<number, string> = {
  1: '#9adcff',
  2: '#6dff8c',
  3: '#c9b8ff',
  4: '#ffd94d',
};

export function achievementValue(m: MetaSave, metric: AchMetric): number {
  switch (metric) {
    case 'kills':
      return m.life.kills;
    case 'elites':
      return m.life.elites;
    case 'bosses':
      return m.life.bosses;
    case 'dashKills':
      return m.life.dashKills;
    case 'overdrive':
      return m.life.overdrive;
    case 'evolutions':
      return m.life.evolutions;
    case 'coresEarned':
      return m.life.coresEarned;
    case 'contracts':
      return m.contractsCleared;
    case 'passLevel':
      return m.passLevel;
    case 'bestWave':
      return m.bestWave;
    case 'bestScore':
      return m.bestScore;
    case 'wins':
      return m.wins;
    case 'daily':
      return m.daily.completed ? 1 : 0;
    case 'ascension':
      return ascLevelOf(m);
    default:
      return 0;
  }
}

export interface AchievementUnlock {
  id: string;
  name: string;
  desc: string;
  reward: string;
  tier: number;
}

export function achievementRewardLabel(a: AchievementDef): string {
  const bits: string[] = [];
  if (a.cores) bits.push(`${a.cores}◆`);
  if (a.prisms) bits.push(`${a.prisms}◇`);
  return bits.join(' + ') || 'GLORY';
}

/** Evaluate all achievements against the (already-updated) meta save.
 *  Grants rewards for newly completed ones and returns them for the toast. */
export function evaluateAchievements(m: MetaSave): AchievementUnlock[] {
  const unlocked: AchievementUnlock[] = [];
  for (const a of ACHIEVEMENTS) {
    if (m.achievements[a.id]) continue;
    if (achievementValue(m, a.metric) >= a.target) {
      m.achievements[a.id] = Date.now();
      m.cores += a.cores ?? 0;
      m.prisms += a.prisms ?? 0;
      unlocked.push({
        id: a.id,
        name: a.name,
        desc: a.desc,
        reward: achievementRewardLabel(a),
        tier: a.tier,
      });
    }
  }
  return unlocked;
}

export function unlockedCount(m: MetaSave): number {
  return Object.keys(m.achievements).length;
}
