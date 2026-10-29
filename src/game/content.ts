// ===== VOIDPULSE :: content database =====
// All balance-critical data lives here for easy tuning.

import type { BossDef, EnemyDef, MetaPerk, PassiveDef, Stats, WeaponDef } from './types';

export const WORLD_W = 2400;
export const WORLD_H = 2400;
export const MAX_ENEMIES = 300;
export const MAX_EBULLETS = 320;
export const MAX_PARTICLES = 900;
export const MAX_TEXTS = 70;

// ---------------- WEAPONS ----------------

export const WEAPONS: Record<string, WeaponDef> = {
  pulse: {
    id: 'pulse',
    name: 'Pulse Cannon',
    desc: 'Fires energy bolts at the nearest threat. Reliable. Honest. Yours.',
    color: '#4de8ff',
    maxLevel: 5,
    evoReq: 'focus',
    evoInto: 'novaLance',
    kind: 'pulse',
    stats: (lv) => ({
      cd: 0.52 - (lv >= 4 ? 0.07 : 0),
      dmg: [0, 11, 14, 14, 18, 18][lv],
      count: [0, 1, 1, 2, 2, 3][lv],
      pierce: lv >= 5 ? 1 : 0,
      bspeed: 620,
    }),
    levelDesc: (lv) =>
      ['', '+3 damage', '+1 bolt per volley', '+4 damage, faster cycles', '+1 bolt, bolts pierce once', ''][lv] ?? '',
  },
  orbit: {
    id: 'orbit',
    name: 'Orbit Blades',
    desc: 'Crystalline shards circle your hull, shredding anything that touches them.',
    color: '#7dffd4',
    maxLevel: 5,
    evoReq: 'swift',
    evoInto: 'cyclone',
    kind: 'orbit',
    stats: (lv) => ({
      cd: 0.45, // per-enemy hit cooldown
      dmg: [0, 9, 11, 13, 15, 18][lv],
      count: [0, 2, 3, 3, 4, 5][lv],
      radius: 76 + lv * 8,
      rot: 2.6 + lv * 0.16,
    }),
    levelDesc: (lv) =>
      ['', '+1 blade', '+1 blade, wider orbit', '+2 damage', '+1 blade, faster spin', ''][lv] ?? '',
  },
  arc: {
    id: 'arc',
    name: 'Arc Coil',
    desc: 'Discharges chained lightning that leaps between hostile signatures.',
    color: '#b7a4ff',
    maxLevel: 5,
    evoReq: 'capacitor',
    evoInto: 'tempest',
    kind: 'arc',
    stats: (lv) => ({
      cd: 1.7 - (lv - 1) * 0.12,
      dmg: [0, 15, 18, 21, 24, 28][lv],
      chains: [0, 2, 3, 3, 4, 5][lv],
    }),
    levelDesc: (lv) =>
      ['', '+3 damage', 'chains to +1 target', '+3 damage', 'chains to +1 target', ''][lv] ?? '',
  },
  nova: {
    id: 'nova',
    name: 'Shock Nova',
    desc: 'Periodically detonates a pressure ring that hurls the swarm back.',
    color: '#5cc8ff',
    maxLevel: 5,
    evoReq: 'might',
    evoInto: 'seismic',
    kind: 'nova',
    stats: (lv) => ({
      cd: 3.0 - (lv - 1) * 0.2,
      dmg: [0, 17, 20, 24, 27, 31][lv],
      radius: 115 + lv * 15,
      knock: 280 + lv * 30,
    }),
    levelDesc: (lv) =>
      ['', '+3 damage, wider ring', '+3 damage', 'faster cycles, +4 damage', 'wider ring', ''][lv] ?? '',
  },
  seeker: {
    id: 'seeker',
    name: 'Seeker Swarm',
    desc: 'Launches micro-missiles that hunt targets down and detonate.',
    color: '#ffd166',
    maxLevel: 5,
    evoReq: 'magnet',
    evoInto: 'hornet',
    kind: 'seeker',
    stats: (lv) => ({
      cd: 2.0 - (lv - 1) * 0.12,
      dmg: [0, 13, 15, 17, 19, 22][lv],
      count: [0, 2, 2, 3, 3, 4][lv],
      bspeed: 350,
      aoe: 46,
    }),
    levelDesc: (lv) =>
      ['', '+2 damage', 'faster launch cycles', '+1 missile', '+2 damage', ''][lv] ?? '',
  },
  frost: {
    id: 'frost',
    name: 'Cryo Field',
    desc: 'A cold aura slows everything near you and gnaws at their structure.',
    color: '#8fd8ff',
    maxLevel: 5,
    evoReq: 'vitality',
    evoInto: 'zeroField',
    kind: 'frost',
    stats: (lv) => ({
      cd: 0.5, // damage tick
      dmg: [0, 3, 3.5, 4, 4.5, 5.5][lv], // per tick (dps = dmg/cd)
      radius: 95 + lv * 12,
      slow: 0.3 + lv * 0.036,
    }),
    levelDesc: (lv) =>
      ['', '+0.5 damage/tick', 'wider field', '+1 damage/tick', 'wider, colder field', ''][lv] ?? '',
  },
  scatter: {
    id: 'scatter',
    name: 'Scatter Bolt',
    desc: 'Short-range pellet burst in your movement direction. Point blank. Personal.',
    color: '#ff9a8a',
    maxLevel: 5,
    kind: 'scatter',
    stats: (lv) => ({
      cd: 1.5 - (lv - 1) * 0.1,
      dmg: [0, 8, 9, 10, 12, 13][lv],
      count: [0, 3, 4, 4, 5, 6][lv],
      bspeed: 560,
      spread: 0.42,
    }),
    levelDesc: (lv) =>
      ['', '+1 pellet', '+1 damage', '+1 pellet, faster cycles', '+1 damage', ''][lv] ?? '',
  },

  // ---- EVOLUTIONS ----
  novaLance: {
    id: 'novaLance',
    name: 'NOVA LANCE',
    desc: 'EVOLVED. A railgun spine that transfixed the whole wave in one breath.',
    color: '#e8ffff',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'lance',
    stats: () => ({
      cd: 1.05,
      dmg: 46,
      count: 1,
      pierce: 99,
      bspeed: 1500,
    }),
    levelDesc: () => '',
  },
  cyclone: {
    id: 'cyclone',
    name: 'CYCLONE ARRAY',
    desc: 'EVOLVED. Seven monomolecular blades whip around you in a killing storm.',
    color: '#a7ffe0',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'orbit',
    stats: () => ({
      cd: 0.4,
      dmg: 26,
      count: 7,
      radius: 128,
      rot: 4.6,
    }),
    levelDesc: () => '',
  },
  tempest: {
    id: 'tempest',
    name: 'TEMPEST COIL',
    desc: 'EVOLVED. A storm that never stops chaining — and sometimes it stuns.',
    color: '#d0c2ff',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'arc',
    stats: () => ({
      cd: 0.95,
      dmg: 24,
      chains: 6,
      stun: 0.35,
    }),
    levelDesc: () => '',
  },
  seismic: {
    id: 'seismic',
    name: 'SEISMIC ENGINE',
    desc: 'EVOLVED. Pressure rings with the temper of a collapsing star.',
    color: '#9adcff',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'nova',
    stats: () => ({
      cd: 2.3,
      dmg: 55,
      radius: 235,
      knock: 520,
    }),
    levelDesc: () => '',
  },
  hornet: {
    id: 'hornet',
    name: 'HORNET LEGION',
    desc: 'EVOLVED. A screaming cloud of hungry missiles. It never misses twice.',
    color: '#ffe08a',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'seeker',
    stats: () => ({
      cd: 1.25,
      dmg: 18,
      count: 5,
      bspeed: 430,
      aoe: 62,
    }),
    levelDesc: () => '',
  },
  zeroField: {
    id: 'zeroField',
    name: 'ABSOLUTE ZERO',
    desc: 'EVOLVED. The void itself freezes. Sometimes the swarm simply stops.',
    color: '#bfeaff',
    maxLevel: 1,
    isEvolved: true,
    evoFrom: undefined as unknown as string,
    kind: 'frost',
    stats: () => ({
      cd: 0.5,
      dmg: 6.5,
      radius: 168,
      slow: 0.6,
      freeze: 0.1,
    }),
    levelDesc: () => '',
  },
};

// fix evoFrom references (can't self-reference during literal creation)
for (const [key, w] of Object.entries(WEAPONS)) {
  if (w.isEvolved) {
    (w as { evoFrom?: string }).evoFrom = key === 'novaLance' ? 'pulse' : key === 'cyclone' ? 'orbit' : key === 'tempest' ? 'arc' : key === 'seismic' ? 'nova' : key === 'hornet' ? 'seeker' : 'frost';
  }
}

export const EVO_MAP: Record<string, { req: string; into: string }> = {
  pulse: { req: 'focus', into: 'novaLance' },
  orbit: { req: 'swift', into: 'cyclone' },
  arc: { req: 'capacitor', into: 'tempest' },
  nova: { req: 'might', into: 'seismic' },
  seeker: { req: 'magnet', into: 'hornet' },
  frost: { req: 'vitality', into: 'zeroField' },
};

// ---------------- PASSIVES ----------------

export const PASSIVES: Record<string, PassiveDef> = {
  might: {
    id: 'might',
    name: 'Might Core',
    desc: 'Raw destructive output.',
    color: '#ff7d5c',
    maxLevel: 5,
    levelDesc: () => '+12% damage',
  },
  swift: {
    id: 'swift',
    name: 'Swift Thrusters',
    desc: 'Move like you mean it.',
    color: '#9dff6d',
    maxLevel: 5,
    levelDesc: () => '+8% move speed',
  },
  vitality: {
    id: 'vitality',
    name: 'Vital Weave',
    desc: 'Deeper reserves, slow mend.',
    color: '#ff6d8c',
    maxLevel: 5,
    levelDesc: () => '+20 max HP, +0.5 HP/s regen',
  },
  focus: {
    id: 'focus',
    name: 'Focus Lens',
    desc: 'Find the weak point.',
    color: '#ffe066',
    maxLevel: 5,
    levelDesc: () => '+6% critical chance',
  },
  capacitor: {
    id: 'capacitor',
    name: 'Capacitor',
    desc: 'Weapons cycle faster.',
    color: '#b7a4ff',
    maxLevel: 5,
    levelDesc: () => '+10% fire rate',
  },
  magnet: {
    id: 'magnet',
    name: 'Tractor Field',
    desc: 'Shards come to you.',
    color: '#7dffd4',
    maxLevel: 5,
    levelDesc: () => '+45% pickup radius',
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom Drive',
    desc: 'More dashes, crueler strikes.',
    color: '#c9b8ff',
    maxLevel: 2,
    levelDesc: () => '+1 dash charge, +20 dash damage',
  },
  plating: {
    id: 'plating',
    name: 'Ablative Plating',
    desc: 'Ignore a slab of every hit.',
    color: '#c0c8d8',
    maxLevel: 4,
    levelDesc: () => '+2 armor (flat damage reduction)',
  },
  greed: {
    id: 'greed',
    name: 'Resonance Lens',
    desc: 'Learn faster from the void.',
    color: '#6dff8c',
    maxLevel: 5,
    levelDesc: () => '+12% XP gained',
  },
  tempo: {
    id: 'tempo',
    name: 'Tempo Regulator',
    desc: 'The dash comes back sooner.',
    color: '#8fd8ff',
    maxLevel: 5,
    levelDesc: () => '-12% dash cooldown',
  },
};

// ---------------- ENEMIES ----------------

export const ENEMIES: Record<string, EnemyDef> = {
  mote: {
    id: 'mote',
    name: 'Mote',
    hp: 9,
    speed: 130,
    radius: 9,
    damage: 5,
    xp: 1,
    score: 10,
    color: '#ff5c8a',
    glow: '#ff5c8a',
    behavior: 'chase',
    minor: true,
    weight: 30,
    unlockWave: 1,
    shape: 'mote',
  },
  drifter: {
    id: 'drifter',
    name: 'Drifter',
    hp: 22,
    speed: 88,
    radius: 14,
    damage: 8,
    xp: 2,
    score: 20,
    color: '#ff4d7e',
    glow: '#ff4d7e',
    behavior: 'chase',
    weight: 26,
    unlockWave: 1,
    shape: 'drifter',
  },
  sprinter: {
    id: 'sprinter',
    name: 'Sprinter',
    hp: 15,
    speed: 185,
    radius: 11,
    damage: 7,
    xp: 2,
    score: 25,
    color: '#ff8a5c',
    glow: '#ff8a5c',
    behavior: 'zigzag',
    minor: true,
    weight: 18,
    unlockWave: 2,
    shape: 'sprinter',
  },
  spitter: {
    id: 'spitter',
    name: 'Spitter',
    hp: 28,
    speed: 72,
    radius: 13,
    damage: 7,
    xp: 3,
    score: 35,
    color: '#d96bff',
    glow: '#d96bff',
    behavior: 'keepaway',
    shoot: { cd: 2.4, count: 1, spread: 0.14, speed: 215, dmg: 9, range: 520, keep: 290 },
    weight: 12,
    unlockWave: 3,
    shape: 'spitter',
  },
  splitter: {
    id: 'splitter',
    name: 'Splitter',
    hp: 36,
    speed: 78,
    radius: 15,
    damage: 9,
    xp: 3,
    score: 30,
    color: '#ff5cb8',
    glow: '#ff5cb8',
    behavior: 'splitter',
    splitsInto: { id: 'shard', count: 2 },
    weight: 12,
    unlockWave: 4,
    shape: 'splitter',
  },
  bulwark: {
    id: 'bulwark',
    name: 'Bulwark',
    hp: 95,
    speed: 44,
    radius: 21,
    damage: 14,
    xp: 6,
    score: 60,
    color: '#c44dff',
    glow: '#c44dff',
    behavior: 'chase',
    knockResist: 0.75,
    weight: 8,
    unlockWave: 4,
    shape: 'bulwark',
  },
  orbiter: {
    id: 'orbiter',
    name: 'Warden Orb',
    hp: 42,
    speed: 120,
    radius: 12,
    damage: 8,
    xp: 4,
    score: 45,
    color: '#ff6d6d',
    glow: '#ff6d6d',
    behavior: 'orbit',
    shoot: { cd: 3.0, count: 3, spread: 0.5, speed: 205, dmg: 8, range: 600, keep: 210 },
    weight: 10,
    unlockWave: 6,
    shape: 'orbiter',
  },
  shard: {
    id: 'shard',
    name: 'Shard',
    hp: 8,
    speed: 150,
    radius: 8,
    damage: 4,
    xp: 1,
    score: 8,
    color: '#ff5cb8',
    glow: '#ff5cb8',
    behavior: 'chase',
    minor: true,
    weight: 0, // never spawned directly
    unlockWave: 99,
    shape: 'shard',
  },
  volatile: {
    id: 'volatile',
    name: 'Volatile',
    hp: 20,
    speed: 172,
    radius: 11,
    damage: 8,
    xp: 3,
    score: 40,
    color: '#ffa04d',
    glow: '#ff8a3d',
    behavior: 'volatile',
    weight: 10,
    unlockWave: 5,
    shape: 'volatile',
  },
  lancer: {
    id: 'lancer',
    name: 'Lancer',
    hp: 30,
    speed: 78,
    radius: 12,
    damage: 10,
    xp: 4,
    score: 55,
    color: '#ffe066',
    glow: '#ffd94d',
    behavior: 'sniper',
    shoot: { cd: 3.2, count: 1, spread: 0, speed: 520, dmg: 14, range: 900, keep: 520 },
    weight: 8,
    unlockWave: 7,
    shape: 'lancer',
  },
  mender: {
    id: 'mender',
    name: 'Mender',
    hp: 55,
    speed: 62,
    radius: 14,
    damage: 6,
    xp: 6,
    score: 85,
    color: '#6dffb0',
    glow: '#6dffb0',
    behavior: 'mender',
    knockResist: 0.3,
    weight: 6,
    unlockWave: 9,
    shape: 'mender',
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom',
    hp: 34,
    speed: 148,
    radius: 11,
    damage: 9,
    xp: 4,
    score: 55,
    color: '#b7a4ff',
    glow: '#b7a4ff',
    behavior: 'phase',
    weight: 7,
    unlockWave: 11,
    shape: 'phantom',
  },
};

// ---------------- BOSSES ----------------

export const BOSSES: BossDef[] = [
  {
    name: 'THE WARDEN',
    title: 'Gatekeeper of the Outer Dark',
    hp: 2350,
    speed: 58,
    radius: 44,
    damage: 18,
    xp: 60,
    score: 1500,
    color: '#ff4d6d',
    glow: '#ff4d6d',
    keep: 0,
    patterns: [
      { id: 'radial', cd: 3.4, firstDelay: 2.2 },
      { id: 'fan', cd: 2.7, firstDelay: 4.0 },
      { id: 'charge', cd: 6.0, firstDelay: 6.5 },
      { id: 'radial2', cd: 3.0, minHpPct: 0.4, firstDelay: 3.0 },
    ],
  },
  {
    name: 'HIVE MATRIARCH',
    title: 'Mother of the Swarm',
    hp: 5000,
    speed: 50,
    radius: 52,
    damage: 20,
    xp: 90,
    score: 3000,
    color: '#d96bff',
    glow: '#d96bff',
    keep: 320,
    patterns: [
      { id: 'spiral', cd: 6.5, firstDelay: 2.4 },
      { id: 'brood', cd: 7.5, firstDelay: 4.5 },
      { id: 'volley', cd: 4.2, firstDelay: 3.4 },
      { id: 'spiral2', cd: 5.6, minHpPct: 0.5, firstDelay: 3.0 },
    ],
  },
  {
    name: 'NULL SOVEREIGN',
    title: 'The Wound in the Void',
    hp: 9000,
    speed: 64,
    radius: 58,
    damage: 24,
    xp: 150,
    score: 5000,
    color: '#ff3d5e',
    glow: '#ff3d5e',
    keep: 0,
    patterns: [
      { id: 'walls', cd: 5.8, firstDelay: 2.4 },
      { id: 'blink', cd: 7.0, firstDelay: 5.0 },
      { id: 'summon', cd: 8.0, firstDelay: 4.0 },
      { id: 'spiral', cd: 7.0, minHpPct: 0.5, firstDelay: 2.0 },
      { id: 'charge', cd: 6.5, minHpPct: 0.5, firstDelay: 3.0 },
    ],
  },
  {
    name: 'THE DREAMING LEVIATHAN',
    title: 'It Was Here Before the Void',
    hp: 14000,
    speed: 46,
    radius: 66,
    damage: 26,
    xp: 220,
    score: 8000,
    color: '#3dffb8',
    glow: '#3dffb8',
    keep: 0,
    patterns: [
      { id: 'mines', cd: 7.2, firstDelay: 2.6 },
      { id: 'spiral', cd: 6.4, firstDelay: 4.2 },
      { id: 'radial2', cd: 4.6, firstDelay: 3.4 },
      { id: 'charge', cd: 7.5, minHpPct: 0.6, firstDelay: 5.0 },
      { id: 'brood', cd: 9.0, minHpPct: 0.55, firstDelay: 6.0 },
    ],
  },
];

// ---------------- META PERKS ----------------

export const META_PERKS: MetaPerk[] = [
  {
    id: 'powerCore',
    name: 'Power Core',
    desc: '+6% weapon damage per tier.',
    maxTier: 3,
    costs: [40, 90, 150],
    color: '#ff7d5c',
  },
  {
    id: 'guardCore',
    name: 'Guard Core',
    desc: '+15 max hull per tier.',
    maxTier: 3,
    costs: [35, 80, 140],
    color: '#ff6d8c',
  },
  {
    id: 'thrusterCore',
    name: 'Thruster Core',
    desc: '+5% move speed per tier.',
    maxTier: 2,
    costs: [50, 100],
    color: '#9dff6d',
  },
  {
    id: 'batteryCore',
    name: 'Battery Core',
    desc: 'Start each run with +1 dash charge.',
    maxTier: 1,
    costs: [120],
    color: '#c9b8ff',
  },
  {
    id: 'sageCore',
    name: 'Sage Core',
    desc: '+10% XP gained per tier.',
    maxTier: 2,
    costs: [45, 90],
    color: '#6dff8c',
  },
  {
    id: 'magnetCore',
    name: 'Magnet Core',
    desc: '+30% pickup radius per tier.',
    maxTier: 2,
    costs: [35, 70],
    color: '#7dffd4',
  },
  {
    id: 'phoenixCore',
    name: 'Phoenix Core',
    desc: 'Cheat death once per run: revive at 50% hull.',
    maxTier: 1,
    costs: [280],
    color: '#ffd166',
  },
];

// ---------------- STAT RECOMPUTE ----------------

export const PLAYER_BASE = {
  hp: 100,
  speed: 255,
  radius: 13,
  magnet: 110,
  dashCharges: 2,
  dashCd: 2.6,
  dashDmg: 35,
};

export function computeStats(perkTiers: Record<string, number>, passives: Record<string, number>): Stats {
  const lv = (id: string) => passives[id] ?? 0;
  const perk = (id: string) => perkTiers[id] ?? 0;
  const s: Stats = {
    damageMult: 1 + lv('might') * 0.12 + perk('powerCore') * 0.06,
    fireRateMult: 1 + lv('capacitor') * 0.1,
    speedMult: 1 + lv('swift') * 0.08 + perk('thrusterCore') * 0.05,
    magnetRadius: PLAYER_BASE.magnet * (1 + lv('magnet') * 0.45 + perk('magnetCore') * 0.3),
    critChance: 0.05 + lv('focus') * 0.06,
    critMult: 2.2,
    xpMult: 1 + lv('greed') * 0.12 + perk('sageCore') * 0.1,
    armor: lv('plating') * 2,
    regen: lv('vitality') * 0.5,
    dashCdMult: Math.pow(0.88, lv('tempo')),
    dashBonusDmg: lv('phantom') * 20,
    extraDash: lv('phantom'),
    areaMult: 1,
    luck: 1,
  };
  return s;
}

export function xpForLevel(level: number): number {
  const l = level - 1;
  return Math.floor(8 + l * 5 + Math.pow(l, 1.7) * 1.5);
}

// wave composition helper
export function spawnPoolForWave(wave: number): [EnemyDef, number][] {
  const pool: [EnemyDef, number][] = [];
  for (const def of Object.values(ENEMIES)) {
    if (def.weight > 0 && def.unlockWave <= wave) {
      // recent unlocks get a temporary spotlight boost
      let w = def.weight;
      if (wave - def.unlockWave < 2) w *= 1.6;
      pool.push([def, w]);
    }
  }
  return pool;
}

export const WAVE_CONFIG = {
  duration: (wave: number) => Math.min(40 + wave * 2.5, 72),
  spawnInterval: (wave: number) => Math.max(1.15 - wave * 0.05, 0.38),
  budget: (wave: number) => Math.min(16 + wave * 7, 150),
  eliteChance: (wave: number) => (wave < 3 ? 0 : Math.min(0.05 + wave * 0.011, 0.22)),
  hpScale: (wave: number) => (wave <= 15 ? 1 + (wave - 1) * 0.15 : 3.1 * Math.pow(1.07, wave - 15)),
  dmgScale: (wave: number) => Math.min(1 + (wave - 1) * 0.045, 2.0),
  spdScale: (wave: number) => 1 + wave * 0.008,
};

export const BOSS_WAVES: Record<number, number> = { 5: 0, 10: 1, 15: 2 };
