// ===== VOIDPULSE :: shared types =====

export type GameState =
  | 'title'
  | 'perks'
  | 'help'
  | 'pass'
  | 'market'
  | 'settings'
  | 'playing'
  | 'levelup'
  | 'paused'
  | 'gameover'
  | 'victory';

export type ColorblindMode = 'off' | 'protan' | 'deutan' | 'tritan';

export interface Settings {
  shake: number; // 0..1 multiplier
  reduceFlash: boolean;
  dmgNumbers: boolean;
  colorblind: ColorblindMode;
  reducedMotion: boolean;
  volMaster: number; // 0..1
  volMusic: number;
  volSfx: number;
}

export type Currency = 'cores' | 'prisms';

export interface PassReward {
  kind: 'cores' | 'prisms' | 'skin' | 'booster' | 'title';
  amount?: number; // cores/prisms
  id?: string; // skin id / booster id
  label: string;
}

export interface PassTier {
  tier: number; // 1..30
  need: number; // bp xp required to reach this tier (cumulative per-tier delta)
  free: PassReward;
  prime: PassReward;
}

export interface ContractDef {
  id: string;
  desc: string;
  target: number;
  metric:
    | 'kills'
    | 'wave'
    | 'elites'
    | 'bosses'
    | 'dashKills'
    | 'overdrive'
    | 'coresEarned'
    | 'score'
    | 'wins'
    | 'heals';
  perRun: boolean; // true = must be achieved within a single run
  bpXp: number;
  cores?: number;
  prisms?: number;
}

export interface BoosterDef {
  id: string;
  name: string;
  desc: string;
  currency: Currency;
  price: number;
  color: string;
}

export interface SkinDef {
  id: string;
  name: string;
  desc: string;
  rarity: 'starter' | 'common' | 'rare' | 'epic' | 'prime';
  currency: Currency | 'pass';
  price: number; // 0 = default / pass-granted
  color: string;
  trail: string;
  glow: string;
  draw: (ctx: CanvasRenderingContext2D, t: number) => void; // draws at origin facing up
}

export interface MarketEntryInfo {
  id: string;
  name: string;
  desc: string;
  price: number;
  currency: Currency;
  color: string;
  owned: boolean;
  equipped: boolean;
  rarityLabel: string;
}

export interface Vec {
  x: number;
  y: number;
}

export interface Stats {
  damageMult: number;
  fireRateMult: number;
  speedMult: number;
  magnetRadius: number;
  critChance: number;
  critMult: number;
  xpMult: number;
  armor: number;
  regen: number;
  dashCdMult: number;
  dashBonusDmg: number;
  extraDash: number;
  areaMult: number;
  luck: number;
}

export interface WeaponInstance {
  id: string;
  level: number;
  timer: number;
  angle: number; // orbital phase
  t: number; // misc accumulator
}

export interface Player {
  shield: number; // 1-hit guard from Shield Cache booster
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  level: number;
  xp: number;
  xpNext: number;
  dashCharges: number;
  dashTimer: number; // active dash remaining
  dashDirX: number;
  dashDirY: number;
  dashRecharge: number; // progress toward next charge (0..1 of cd)
  hitInvuln: number;
  dashInvuln: number;
  heat: number; // 0..100
  heatIdle: number; // seconds since last kill
  overdrive: number; // remaining OD seconds
  weapons: WeaponInstance[];
  passives: Record<string, number>;
  stats: Stats;
  facing: number;
  moveX: number;
  moveY: number;
  trail: { x: number; y: number; a: number }[];
  reviveUsed: boolean;
  lastHitT: number;
  thrustT: number;
}

export type EnemyBehavior =
  | 'chase'
  | 'zigzag'
  | 'keepaway'
  | 'orbit'
  | 'splitter'
  | 'pod'
  | 'volatile'
  | 'sniper'
  | 'mender'
  | 'phase'
  | 'boss';

export type EliteMod = 'burst' | 'swift' | 'shield';

export interface EnemyShoot {
  cd: number;
  count: number;
  spread: number;
  speed: number;
  dmg: number;
  range: number;
  keep?: number; // preferred distance
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  score: number;
  color: string;
  glow: string;
  behavior: EnemyBehavior;
  shoot?: EnemyShoot;
  splitsInto?: { id: string; count: number };
  minor?: boolean; // dash-executable
  knockResist?: number;
  weight: number; // spawn weight
  unlockWave: number;
  shape:
    | 'mote'
    | 'drifter'
    | 'sprinter'
    | 'spitter'
    | 'splitter'
    | 'bulwark'
    | 'orbiter'
    | 'shard'
    | 'volatile'
    | 'lancer'
    | 'mender'
    | 'phantom'
    | 'boss';
}

export interface Enemy {
  eid: number;
  def: EnemyDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  speed: number;
  damage: number;
  xp: number;
  score: number;
  elite: boolean;
  mod: EliteMod | null;
  flash: number;
  t: number;
  shootTimer: number;
  phase: number;
  slow: number; // slow amount 0..1 (0 = no slow)
  slowT: number; // slow duration remaining
  freezeT: number;
  stunT: number;
  knockX: number;
  knockY: number;
  spawnT: number; // spawn-in animation timer
  orbHitCd: number;
  zigPhase: number;
  rage: number; // speed multiplier when wave over
  shieldHits: number;
  hitCd: Map<number, number>; // bullet source cooldowns
  fuseT: number; // volatile: detonation countdown (-1 = idle)
  ghostT: number; // phantom: intangible time remaining
  phaseT: number; // phantom / sniper: cycle accumulator
  healT: number; // mender: pulse timer
  dead?: boolean;
}

export interface BossPattern {
  id: string;
  cd: number;
  minHpPct?: number; // phase gating (1 = always, 0.5 = below 50%)
  firstDelay: number;
}

export interface BossDef {
  name: string;
  title: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  score: number;
  color: string;
  glow: string;
  keep: number;
  patterns: BossPattern[];
}

export interface BossState {
  def: BossDef;
  cds: Record<string, number>;
  windup: number; // telegraph timer
  windupPattern: string;
  actTimer: number; // active action timer (charge/spiral etc)
  actPattern: string;
  spiralAngle: number;
  spiralShots: number;
  chargeX: number;
  chargeY: number;
  blinkT: number;
  volley: number;
  volleyTimer: number;
  phase2: boolean;
  intro: number;
}

export interface Bullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  pierce: number;
  life: number;
  kind: 'pulse' | 'seeker' | 'lance' | 'scatter' | 'shard';
  crit: boolean;
  homing: number;
  aoe: number;
  angle: number;
  trailT: number;
  tgtEid?: number; // cached homing target (validated by eid)
  retargetT?: number; // time until next target search
  dead?: boolean;
}

export interface EBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  life: number;
  mine?: boolean; // leviathan proximity mine
  armT?: number; // mine arming delay
  telegraph?: number; // lancer heavy shot visual
  dead?: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  drag: number;
  glow: boolean;
  kind?: 'dot' | 'gib';
  rot?: number; // gib rotation
  vrot?: number; // gib angular velocity
  dead?: boolean;
}

export interface FloatText {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text: string;
  color: string;
  size: number;
  dead?: boolean;
}

export interface Shock {
  x: number;
  y: number;
  r: number;
  maxR: number;
  speed: number;
  life: number;
  maxLife: number;
  color: string;
  width: number;
  dmg: number;
  knock: number;
  hitIds: Set<number>;
  dead?: boolean;
}

export interface Gem {
  x: number;
  y: number;
  vx: number;
  vy: number;
  value: number;
  kind: 'xp' | 'heal' | 'core';
  t: number;
  magnet: boolean;
  dead?: boolean;
}

export interface Arc {
  x: number;
  y: number;
  x2: number;
  y2: number;
  life: number;
  maxLife: number;
  color: string;
  seed: number;
  dead?: boolean;
}

export interface Afterimage {
  x: number;
  y: number;
  angle: number;
  life: number;
  maxLife: number;
  color: string;
  dead?: boolean;
}

export interface CardOption {
  kind: 'weapon' | 'passive' | 'evolve' | 'heal' | 'scrap';
  refId: string;
  title: string;
  desc: string;
  rarity: 'common' | 'rare' | 'epic';
  levelText: string;
  color: string;
}

export interface WeaponStats {
  cd: number;
  dmg: number;
  count?: number;
  radius?: number;
  chains?: number;
  slow?: number;
  dps?: number;
  rot?: number;
  knock?: number;
  spread?: number;
  bspeed?: number;
  aoe?: number;
  stun?: number;
  freeze?: number;
  pierce?: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  maxLevel: number;
  evoReq?: string; // passive id required to evolve
  evoInto?: string;
  evoFrom?: string; // base weapon id (for evolved weapons)
  isEvolved?: boolean;
  kind: 'pulse' | 'orbit' | 'arc' | 'nova' | 'seeker' | 'frost' | 'scatter' | 'lance';
  stats: (lv: number) => WeaponStats;
  levelDesc: (lv: number) => string;
}

export interface PassiveDef {
  id: string;
  name: string;
  desc: string;
  color: string;
  maxLevel: number;
  levelDesc: (lv: number) => string;
}

export interface MetaPerk {
  id: string;
  name: string;
  desc: string;
  maxTier: number;
  costs: number[];
  color: string;
}

export interface LifeStats {
  kills: number;
  elites: number;
  bosses: number;
  dashKills: number;
  overdrive: number;
  coresEarned: number;
  heals: number;
}

export interface MetaSave {
  saveVersion: 2;
  seasonId: number;
  cores: number;
  prisms: number;
  perks: Record<string, number>;
  bestScore: number;
  bestWave: number;
  runs: number;
  wins: number;
  endlessUnlocked: boolean;
  muted: boolean;
  // battle pass
  passLevel: number; // 1..30
  passXp: number; // xp into current tier
  prime: boolean;
  primeDemo: boolean; // unlocked via simulated purchase
  // cosmetics
  skinsOwned: string[];
  skinEquipped: string;
  equippedTitle: string;
  titlesOwned: string[];
  // market
  boosters: Record<string, number>;
  // contracts
  contractSlots: string[]; // 3 active ids
  contractProgress: Record<string, number>;
  contractsDone: string[];
  contractsCleared: number;
  // lifetime stats for contract metrics
  life: LifeStats;
  // BP lifetime
  bpXpTotal: number;
  // accessibility & audio settings
  settings: Settings;
}

export interface ButtonRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hover: boolean;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  dash: boolean; // edge-triggered, consumed by player
}
