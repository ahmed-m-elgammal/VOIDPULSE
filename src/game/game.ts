// ===== VOIDPULSE :: core game orchestrator =====

import type {
  Afterimage,
  Arc,
  BossState,
  Bullet,
  ButtonRect,
  CardOption,
  Enemy,
  EnemyDef,
  EBullet,
  FloatText,
  GameState,
  Gem,
  InputState,
  Particle,
  Player,
  Settings,
  Shock,
} from './types';
import {
  ENEMIES as ENEMY_DEFS,
  MAX_ENEMIES,
  MAX_PARTICLES,
  MAX_TEXTS,
  META_PERKS,
  PLAYER_BASE,
  WAVE_CONFIG,
  WORLD_H,
  WORLD_W,
  computeStats,
  xpForLevel,
} from './content';
import { AudioEngine } from './audio';
import { loadMeta, saveMeta } from './save';
import { Pool, makeRng, sweepDead } from './utils';
import { applyCard, generateCards } from './cards';
import { addHeat, damagePlayer as dmgPlayer, updatePlayer } from './player';
import {
  makeWeaponInstance,
  rebuildGrid,
  separateEnemies,
  spawnGem as spawnGemFn,
  updateBullets,
  updateEBullets,
  updateEnemies,
  updateGems,
  updateParticles,
  updateShocks,
  fireWeapons,
} from './combat';
import { updateBoss } from './bosses';
import { startWave, updateWaves } from './waves';
import {
  BOOSTERS,
  EXCHANGE_CORES,
  EXCHANGE_PRISMS,
  PRIME_PRICE,
  applyBpXp,
  computeRunBpXp,
  settleContracts,
  type ContractComplete,
  type RunStats,
} from './economy';
import { skinOf } from './skins';

interface DelayedCall {
  t: number;
  fn: () => void;
}

export class Game {
  state: GameState = 'title';
  prevState: GameState = 'title';
  time = 0; // run time
  score = 0;
  kills = 0;
  bossKills = 0;
  waveHits = 0;
  coresEarned = 0;
  godMode = false;
  debugInfo = '';

  // world
  worldW = WORLD_W;
  worldH = WORLD_H;

  // view (set by renderer host)
  viewW = 1280;
  viewH = 720;

  player!: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  ebullets: EBullet[] = [];
  gems: Gem[] = [];
  particles: Particle[] = [];
  texts: FloatText[] = [];
  arcs: Arc[] = [];
  afterimages: Afterimage[] = [];
  shockwaves: Shock[] = [];
  delayed: DelayedCall[] = [];

  boss: Enemy | null = null;
  bossState: BossState | null = null;
  bossBanner: { name: string; title: string; t: number; color: string } | null = null;
  enemyGrid = new Map<number, Enemy[]>();
  enemyById = new Map<number, Enemy>();

  // object pools — zero per-frame allocation churn
  bulletPool = new Pool<Bullet>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 10, pierce: 0, life: 2,
    kind: 'pulse', crit: false, homing: 0, aoe: 0, angle: 0, trailT: 0, tgtEid: undefined, retargetT: undefined, dead: false,
  }));
  ebulletPool = new Pool<EBullet>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, r: 6, dmg: 10, life: 5, mine: undefined, armT: undefined, telegraph: undefined, dead: false,
  }));
  particlePool = new Pool<Particle>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 2, color: '#ffffff', drag: 0.9, glow: true,
    kind: 'dot', rot: 0, vrot: 0, dead: false,
  }));
  textPool = new Pool<FloatText>(() => ({
    x: 0, y: 0, vx: 0, vy: -46, life: 0.75, maxLife: 0.75, text: '', color: '#ffffff', size: 12, dead: false,
  }));
  gemPool = new Pool<Gem>(() => ({ x: 0, y: 0, vx: 0, vy: 0, value: 1, kind: 'xp', t: 0, magnet: false, dead: false }));
  afterimagePool = new Pool<Afterimage>(() => ({ x: 0, y: 0, angle: 0, life: 0.25, maxLife: 0.25, color: '#4de8ff', dead: false }));
  arcPool = new Pool<Arc>(() => ({ x: 0, y: 0, x2: 0, y2: 0, life: 0.14, maxLife: 0.14, color: '#4de8ff', seed: 0, dead: false }));
  shockPool = new Pool<Shock>(() => ({
    x: 0, y: 0, r: 8, maxR: 100, speed: 600, life: 0.25, maxLife: 0.25, color: '#4de8ff', width: 4, dmg: 0, knock: 0,
    hitIds: new Set<number>(), dead: false,
  }));
  enemyPool = new Pool<Enemy>(() => ({
    eid: 0, def: null as unknown as EnemyDef, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 10, speed: 60,
    damage: 5, xp: 1, score: 1, elite: false, mod: null, flash: 0, t: 0, shootTimer: 999, phase: 0, slow: 0, slowT: 0,
    freezeT: 0, stunT: 0, knockX: 0, knockY: 0, spawnT: 0, orbHitCd: 0, zigPhase: 0, rage: 1, shieldHits: 0,
    hitCd: new Map<number, number>(), fuseT: -1, ghostT: 0, phaseT: 0, healT: 1.2, dead: false,
  }));
  gridPool: Enemy[][] = [];

  // JUICE state — v1.1
  killChainT = 0; // seconds left in the current kill chain
  killChainN = 0; // kills in the chain (drives pitch escalation)
  slowT = 0; // dash-exit micro slow-mo
  levelupFreeze = 0; // freeze frame before card draft opens
  pendingCards = false; // cards ready, waiting on freeze frame
  zoomKick = 0; // boss-kill camera punch-in
  cardAnimT = 0; // card slide-in animation clock

  camera = { x: WORLD_W / 2, y: WORLD_H / 2 };
  trauma = 0;
  flashColor = '#ffffff';
  flashAlpha = 0;

  hitStop = 0;
  deathT = 0;
  wonRun = false;
  endlessMode = false;

  // waves
  wave = 0;
  waveState: 'intro' | 'active' | 'breather' = 'intro';
  waveTimer = 0;
  waveIntroT = 0;
  breatherT = 0;
  spawnBudget = 0;
  spawnTimer = 0;
  spawnInterval = 1;
  eliteChance = 0;
  spawnPool: [EnemyDef, number][] = [];
  minionTimer = 6;
  bossActive = false;
  pendingBoss: { idx: number; hpMult: number } | null = null;
  rageT = 0;
  dmgScale = 1;

  // meta
  meta: {
    data: ReturnType<typeof loadMeta>;
    perkTiers: (id: string) => number;
    save: () => void;
  };
  audio: AudioEngine;

  // cards
  cards: CardOption[] = [];
  pendingLevels = 0;
  rerolls = 0;
  cardHover = -1;

  // SEASON ONE — run counters + economy ceremony
  runDashKills = 0;
  runElites = 0;
  runHeals = 0;
  runOverdrive = 0;
  activeBoosters: Record<string, boolean> = {};
  bpXpGained = 0;
  bpLevelsGained = 0;
  bpRewards: { tier: number; track: 'free' | 'prime'; label: string }[] = [];
  contractResults: ContractComplete[] = [];
  marketTab = 0;
  passSelectedTier = 1;

  // ui
  menuIndex = 0;
  perkIndex = 0;
  settingsIndex = 0;
  settingsReturn: GameState = 'title';
  buttons: ButtonRect[] = [];
  mouse = { x: -100, y: -100, clicked: false };
  hintT = 0;
  hintIndex = 0;

  input: InputState = { up: false, down: false, left: false, right: false, dash: false };

  private rng: () => number;
  private nextEidCounter = 1;
  private hintsShown = new Set<string>();

  constructor(audio: AudioEngine) {
    this.audio = audio;
    const data = loadMeta();
    this.meta = {
      data,
      perkTiers: (id: string) => data.perks[id] ?? 0,
      save: () => saveMeta(data),
    };
    audio.setMuted(data.muted);
    this.applyAudioSettings();
    this.rng = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
    this.resetPlayer();
    this.attachDebug();
  }

  // ---------------- settings ----------------

  get settings(): Settings {
    return this.meta.data.settings;
  }

  private applyAudioSettings(): void {
    const s = this.meta.data.settings;
    this.audio.setVolumes(s.volMaster, s.volMusic, s.volSfx);
  }

  cycleSetting(key: string, dir: 1 | -1): void {
    const s = this.meta.data.settings;
    const stepF = (v: number, step: number): number => Math.round((v + dir * step) * 100) / 100;
    switch (key) {
      case 'shake':
        s.shake = Math.max(0, Math.min(1, stepF(s.shake, 0.25)));
        break;
      case 'volMaster':
        s.volMaster = Math.max(0, Math.min(1, stepF(s.volMaster, 0.1)));
        break;
      case 'volMusic':
        s.volMusic = Math.max(0, Math.min(1, stepF(s.volMusic, 0.1)));
        break;
      case 'volSfx':
        s.volSfx = Math.max(0, Math.min(1, stepF(s.volSfx, 0.1)));
        break;
      case 'reduceFlash':
        s.reduceFlash = !s.reduceFlash;
        break;
      case 'dmgNumbers':
        s.dmgNumbers = !s.dmgNumbers;
        break;
      case 'reducedMotion':
        s.reducedMotion = !s.reducedMotion;
        break;
      case 'colorblind': {
        const modes: Settings['colorblind'][] = ['off', 'protan', 'deutan', 'tritan'];
        const i = modes.indexOf(s.colorblind);
        s.colorblind = modes[(i + (dir === 1 ? 1 : modes.length - 1)) % modes.length];
        break;
      }
      default:
        return;
    }
    this.applyAudioSettings();
    this.meta.save();
    this.audio.sfx('uiMove');
  }

  private resetPlayer(): void {
    const perkTiers = this.meta.perkTiers;
    const passives: Record<string, number> = {};
    const stats = computeStats(
      {
        powerCore: perkTiers('powerCore'),
        guardCore: perkTiers('guardCore'),
        thrusterCore: perkTiers('thrusterCore'),
        sageCore: perkTiers('sageCore'),
        magnetCore: perkTiers('magnetCore'),
      },
      passives
    );
    if (this.activeBoosters['xpAmp']) stats.xpMult *= 1.3;
    const maxHp = PLAYER_BASE.hp + perkTiers('guardCore') * 15;
    this.player = {
      shield: this.activeBoosters['shieldCache'] ? 1 : 0,
      x: this.worldW / 2,
      y: this.worldH / 2,
      vx: 0,
      vy: 0,
      hp: maxHp,
      maxHp,
      radius: PLAYER_BASE.radius,
      level: 1,
      xp: 0,
      xpNext: xpForLevel(1),
      dashCharges: PLAYER_BASE.dashCharges + perkTiers('batteryCore'),
      dashTimer: 0,
      dashDirX: 1,
      dashDirY: 0,
      dashRecharge: 0,
      hitInvuln: 0,
      dashInvuln: 0,
      heat: 0,
      heatIdle: 0,
      overdrive: 0,
      weapons: [makeWeaponInstance('pulse')],
      passives,
      stats,
      facing: -Math.PI / 2,
      moveX: 0,
      moveY: -1,
      trail: [],
      reviveUsed: false,
      lastHitT: 0,
      thrustT: 0,
    };
  }

  // ---------------- run lifecycle ----------------

  startRun(): void {
    // consume boosters (one of each owned type fires this run)
    this.activeBoosters = {};
    let consumed = 0;
    for (const b of BOOSTERS) {
      const n = this.meta.data.boosters[b.id] ?? 0;
      if (n > 0) {
        this.meta.data.boosters[b.id] = n - 1;
        this.activeBoosters[b.id] = true;
        consumed++;
      }
    }
    if (consumed > 0) this.meta.save();
    this.resetPlayer();
    this.enemies.length = 0;
    this.bullets.length = 0;
    this.ebullets.length = 0;
    this.gems.length = 0;
    this.particles.length = 0;
    this.texts.length = 0;
    this.arcs.length = 0;
    this.afterimages.length = 0;
    this.shockwaves.length = 0;
    this.delayed.length = 0;
    this.boss = null;
    this.bossState = null;
    this.bossBanner = null;
    this.time = 0;
    this.score = 0;
    this.kills = 0;
    this.bossKills = 0;
    this.coresEarned = 0;
    this.trauma = 0;
    this.flashAlpha = 0;
    this.hitStop = 0;
    this.deathT = 0;
    this.wonRun = false;
    this.endlessMode = false;
    this.pendingLevels = 0;
    this.cards = [];
    this.killChainT = 0;
    this.killChainN = 0;
    this.slowT = 0;
    this.levelupFreeze = 0;
    this.pendingCards = false;
    this.zoomKick = 0;
    this.cardAnimT = 0;
    this.runDashKills = 0;
    this.runElites = 0;
    this.runHeals = 0;
    this.runOverdrive = 0;
    this.bpXpGained = 0;
    this.bpLevelsGained = 0;
    this.bpRewards = [];
    this.contractResults = [];
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
    this.hintsShown.clear();
    this.hintIndex = 0;
    this.hintT = 0;
    this.state = 'playing';
    this.audio.setIntensity(0.45);
    startWave(this, 1);
  }

  quitToTitle(): void {
    this.finalizeRun(false);
    this.state = 'title';
    this.menuIndex = 0;
    this.audio.setIntensity(0.3);
  }

  onPlayerDeath(): void {
    if (this.deathT > 0) return;
    this.player.hp = 0;
    this.deathT = 1.5;
    this.audio.sfx('playerDie');
    this.shake(14);
    this.flashScreen('#ff3d5e', 0.5);
    this.spawnParticleBurst(this.player.x, this.player.y, '#4de8ff', 40, 320, 4, 0.96);
    this.spawnParticleBurst(this.player.x, this.player.y, '#ffffff', 20, 220, 3, 0.94);
    this.audio.setIntensity(0.2);
  }

  triggerVictory(): void {
    this.wonRun = true;
    this.score += 5000;
    this.state = 'victory';
    this.audio.sfx('victory');
    this.audio.setIntensity(0.5);
    this.finalizeRun(true);
  }

  continueEndless(): void {
    this.endlessMode = true;
    this.state = 'playing';
    this.audio.setIntensity(0.6);
    this.waveState = 'breather';
    this.breatherT = 2.5;
  }

  private finalizeRun(won: boolean): void {
    const m = this.meta.data;
    m.runs++;
    // ---- cores ----
    const baseCores = Math.floor(this.score / 1000) + this.wave * 3 + this.bossKills * 30;
    this.coresEarned = Math.round(baseCores * (this.activeBoosters['coreAmp'] ? 1.35 : 1));
    const run: RunStats = {
      wave: this.wave,
      kills: this.kills,
      elites: this.runElites,
      bosses: this.bossKills,
      dashKills: this.runDashKills,
      overdrive: this.runOverdrive,
      score: Math.floor(this.score),
      heals: this.runHeals,
      coresEarned: this.coresEarned,
      won,
    };
    m.cores += this.coresEarned;
    // ---- lifetime stats (feeds contracts) ----
    m.life.kills += this.kills;
    m.life.elites += this.runElites;
    m.life.bosses += this.bossKills;
    m.life.dashKills += this.runDashKills;
    m.life.overdrive += this.runOverdrive;
    m.life.coresEarned += this.coresEarned;
    m.life.heals += this.runHeals;
    m.bestScore = Math.max(m.bestScore, Math.floor(this.score));
    m.bestWave = Math.max(m.bestWave, this.wave);
    if (won) {
      m.wins++;
      m.endlessUnlocked = true;
    }
    // ---- contracts (may add bp xp) ----
    this.contractResults = settleContracts(m, run);
    // ---- battle pass ----
    const rawBp = computeRunBpXp(run) * (this.activeBoosters['bpAmp'] ? 1.4 : 1);
    this.bpXpGained = Math.round(rawBp) + this.contractResults.reduce((a, c) => a + c.bpXp, 0);
    const grant = applyBpXp(m, this.bpXpGained);
    this.bpLevelsGained = grant.levelsGained;
    this.bpRewards = grant.rewards;
    this.meta.save();
  }

  // ---------------- main update ----------------

  update(realDt: number): void {
    // decay screen fx always
    this.trauma = Math.max(0, this.trauma - realDt * 3.2);
    this.flashAlpha = Math.max(0, this.flashAlpha - realDt * 2.4);
    if (this.bossBanner) {
      this.bossBanner.t -= realDt;
      if (this.bossBanner.t <= 0) this.bossBanner = null;
    }
    this.mouse.clicked = false;

    if (this.state !== 'playing') {
      // menus still breathe slightly
      if (this.state === 'title' || this.state === 'perks' || this.state === 'help') {
        this.audio.setIntensity(0.25);
      } else if (this.state === 'paused') {
        this.audio.setIntensity(0.15);
      }
      return;
    }

    // death cinematic
    let dt = realDt;
    if (this.deathT > 0) {
      this.deathT -= realDt;
      dt = realDt * 0.28;
      if (this.deathT <= 0) {
        this.finalizeRun(false);
        this.state = 'gameover';
        return;
      }
    }

    // level-up freeze frame: world holds, then the draft slams in
    if (this.levelupFreeze > 0) {
      this.levelupFreeze -= realDt;
      if (this.levelupFreeze <= 0 && this.pendingCards) {
        this.pendingCards = false;
        this.state = 'levelup';
        this.cardAnimT = 0;
      }
      return;
    }

    // dash-exit micro slow-mo
    if (this.slowT > 0) {
      this.slowT -= realDt;
      dt = realDt * 0.5;
    }

    // kill-chain window runs on real time
    if (this.killChainT > 0) {
      this.killChainT -= realDt;
      if (this.killChainT <= 0) this.killChainN = 0;
    }

    this.zoomKick = Math.max(0, this.zoomKick - realDt * 2.2);

    // hit-stop freezes world but not fx
    if (this.hitStop > 0) {
      this.hitStop -= realDt;
      return;
    }

    this.time += dt;

    // delayed calls
    for (const d of this.delayed) d.t -= dt;
    const ready = this.delayed.filter((d) => d.t <= 0);
    if (ready.length) {
      this.delayed = this.delayed.filter((d) => d.t > 0);
      for (const d of ready) d.fn();
    }

    updatePlayer(this, dt);
    updateWaves(this, dt);

    rebuildGrid(this);
    updateEnemies(this, dt);
    separateEnemies(this, dt);
    if (this.boss && this.bossState) {
      updateBoss(this, this.boss, this.bossState, dt);
    }
    fireWeapons(this, dt);
    updateBullets(this, dt);
    updateEBullets(this, dt);
    updateShocks(this, dt);
    sweepDead(this.enemies, (e) => this.enemyPool.release(e)); // bullets/shocks may have killed enemies
    updateGems(this, dt);
    updateParticles(this, dt);

    // music intensity follows the fight
    const target =
      this.player.overdrive > 0
        ? 1
        : this.bossActive
          ? 0.85
          : 0.4 + Math.min(0.25, this.wave * 0.016) + Math.min(0.1, this.player.heat / 1000);
    this.audio.setIntensity(target);

    // contextual hints (first run onboarding)
    this.updateHints(dt);

    // camera
    const camLead = 0.12;
    const tx = this.player.x + this.player.vx * camLead;
    const ty = this.player.y + this.player.vy * camLead;
    this.camera.x += (tx - this.camera.x) * Math.min(1, 6 * realDt);
    this.camera.y += (ty - this.camera.y) * Math.min(1, 6 * realDt);

    this.debugInfo = `wave=${this.wave} enemies=${this.enemies.length} lvl=${this.player.level} hp=${Math.ceil(this.player.hp)}`;
  }

  private updateHints(dt: number): void {
    this.hintT += dt;
    const show = (id: string) => !this.hintsShown.has(id);
    if (this.time > 0.5 && show('move')) {
      this.hintsShown.add('move');
      this.addText(this.player.x, this.player.y - 60, 'WASD / ARROWS — MOVE', '#9adcff', 15, true);
    }
    if (this.time > 5 && show('fire')) {
      this.hintsShown.add('fire');
      this.addText(this.player.x, this.player.y - 60, 'WEAPONS AUTO-FIRE — STAY ALIVE', '#9adcff', 14, true);
    }
    if (this.time > 10 && show('dash')) {
      this.hintsShown.add('dash');
      this.addText(this.player.x, this.player.y - 60, 'SPACE — DASH THROUGH ENEMIES', '#ffd94d', 15, true);
    }
    if (this.player.heat > 55 && show('heat')) {
      this.hintsShown.add('heat');
      this.addText(this.player.x, this.player.y - 60, 'HEAT RISING — DO NOT GET HIT', '#ffb14d', 14, true);
    }
  }

  // ---------------- entity ops ----------------

  nextEid(): number {
    return this.nextEidCounter++;
  }

  /** public wrapper used by combat/waves modules */
  damagePlayer(dmg: number, sx: number, sy: number): void {
    dmgPlayer(this, dmg, sx, sy);
  }

  spawnGem(x: number, y: number, value: number, kind: 'xp' | 'heal' | 'core'): void {
    spawnGemFn(this, x, y, value, kind);
  }

  spawnEnemy(typeId: string, x: number, y: number, elite: boolean): Enemy | null {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const base = ENEMY_DEFS[typeId];
    if (!base) return null;
    const wave = this.wave;
    const hpScale = WAVE_CONFIG.hpScale(wave);
    const dmgScale = WAVE_CONFIG.dmgScale(wave);
    const spdScale = WAVE_CONFIG.spdScale(wave);
    const eliteMult = elite ? 6 : 1;
    const mod = elite ? pickMod(this.rng) : null;
    const hp = base.hp * hpScale * eliteMult;
    const e = this.enemyPool.acquire();
    e.eid = this.nextEid();
    e.def = base;
    e.x = x;
    e.y = y;
    e.vx = 0;
    e.vy = 0;
    e.hp = hp;
    e.maxHp = hp;
    e.radius = base.radius * (elite ? 1.55 : 1);
    e.speed = base.speed * spdScale * (mod === 'swift' ? 1.45 : 1);
    e.damage = base.damage * dmgScale * (elite ? 1.4 : 1);
    e.xp = base.xp * (elite ? 6 : 1);
    e.score = base.score * (elite ? 8 : 1);
    e.elite = elite;
    e.mod = mod;
    e.flash = 0;
    e.t = 0;
    e.shootTimer = base.shoot ? base.shoot.cd * (0.5 + Math.random()) : 999;
    e.phase = 0;
    e.slow = 0;
    e.slowT = 0;
    e.freezeT = 0;
    e.stunT = 0;
    e.knockX = 0;
    e.knockY = 0;
    e.spawnT = 0.45;
    e.orbHitCd = 0;
    e.zigPhase = Math.random() * Math.PI * 2;
    e.rage = 1;
    e.shieldHits = mod === 'shield' ? 3 : 0;
    e.hitCd.clear();
    e.fuseT = -1;
    e.ghostT = 0;
    e.phaseT = 0;
    e.healT = 1.2;
    e.dead = false;
    this.enemies.push(e);
    if (elite) {
      this.spawnParticleBurst(x, y, '#ff9a3d', 12, 160, 3);
    }
    return e;
  }

  damageEnemy(e: Enemy, dmg: number, crit: boolean, source: string, silent = false): void {
    if (e.hp <= 0) return;
    const hpBefore = e.hp;
    e.hp -= dmg;
    e.flash = 1;
    if (!silent && this.texts.length < MAX_TEXTS) {
      if (this.settings.dmgNumbers) {
        // damage number tiers: crit = gold arc, overkill = red slam
        if (crit) {
          this.addText(
            e.x + (Math.random() - 0.5) * 14,
            e.y - e.radius - 6,
            String(Math.round(dmg)),
            '#ffe066',
            17,
            true,
            (Math.random() - 0.5) * 46
          );
        } else {
          this.addText(
            e.x + (Math.random() - 0.5) * 14,
            e.y - e.radius - 6,
            String(Math.round(dmg)),
            '#ffffff',
            11
          );
        }
      }
      if (crit) this.hitStop = Math.max(this.hitStop, 0.04); // micro-freeze on crits
    }
    if (e.hp <= 0) {
      const overkill = dmg - hpBefore;
      if (overkill > e.maxHp * 0.4 && this.texts.length < MAX_TEXTS && this.settings.dmgNumbers) {
        this.addText(e.x, e.y - e.radius - 20, `${Math.round(dmg)}!`, '#ff5c5c', 20, true, (Math.random() - 0.5) * 40);
      }
      this.killEnemy(e, source);
    }
  }

  killEnemy(e: Enemy, source: string): void {
    if (e.def.behavior === 'boss') {
      this.killBoss(e);
      return;
    }
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    // kill chain: consecutive kills within the window raise the kill SFX pitch
    if (this.killChainT > 0) this.killChainN++;
    else this.killChainN = 0;
    this.killChainT = 1.5;
    const chainRate = Math.pow(2, Math.min(this.killChainN, 7) / 12);
    if (source === 'dash' && e.def.minor && !e.elite) this.runDashKills++;
    if (e.elite) this.runElites++;
    // volatile detonation — always explodes, even when shot down
    if (e.def.behavior === 'volatile') {
      const R = 96;
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < R + this.player.radius) {
        this.damagePlayer(16 * this.dmgScale, e.x, e.y);
      }
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.random() * 0.4;
        if (this.ebullets.length < 320) {
          this.spawnEBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 235,
            vy: Math.sin(a) * 235,
            r: 5,
            dmg: 9 * this.dmgScale,
            life: 2.5,
          });
        }
      }
      this.spawnShock({
        x: e.x,
        y: e.y,
        r: 8,
        maxR: 150,
        speed: 700,
        life: 0.24,
        maxLife: 0.24,
        color: '#ff8a3d',
        width: 5,
        dmg: 0,
        knock: 220,
      });
      this.audio.sfx('explode', 0.25);
      this.shake(7);
      this.spawnParticleBurst(e.x, e.y, '#ff8a3d', 26, 320, 4);
    }
    // score with heat multiplier
    const p = this.player;
    const mult = (1 + p.heat / 100) * (p.overdrive > 0 ? 2 : 1);
    const pts = Math.round(e.score * mult);
    this.score += pts;
    if (e.elite || Math.random() < 0.2) {
      this.addText(e.x, e.y - e.radius - 14, `+${pts}`, e.elite ? '#ffb14d' : '#9aa8c0', e.elite ? 14 : 10);
    }
    // drops
    const gemCount = e.xp >= 4 ? Math.ceil(e.xp / 4) : 1;
    const per = Math.max(1, Math.round(e.xp / gemCount));
    for (let i = 0; i < gemCount; i++) {
      spawnGemFn(this, e.x + (Math.random() - 0.5) * 18, e.y + (Math.random() - 0.5) * 18, per, 'xp');
    }
    const healChance = 0.028 + (e.elite ? 0.2 : 0);
    if (Math.random() < healChance) {
      spawnGemFn(this, e.x, e.y, 12, 'heal');
    }
    // fx
    this.spawnParticleBurst(e.x, e.y, e.def.color, e.elite ? 26 : 10, e.elite ? 260 : 170, e.elite ? 3.5 : 2.5);
    this.spawnGibs(e.x, e.y, e.def.color, e.elite ? 5 : 3, e.elite ? 260 : 170);
    if (e.elite) {
      // decorative shockwave ring sells the kill
      this.spawnShock({
        x: e.x,
        y: e.y,
        r: 8,
        maxR: 90,
        speed: 420,
        life: 0.22,
        maxLife: 0.22,
        color: '#ffb14d',
        width: 3,
        dmg: 0,
        knock: 0,
      });
    }
    this.audio.sfx(e.elite ? 'killBig' : 'kill', 0.15, chainRate);
    this.shake(e.elite ? 4 : 0.6);
    if (e.elite) this.hitStop = Math.max(this.hitStop, 0.09);

    // splitter spawns
    if (e.def.splitsInto) {
      for (let i = 0; i < e.def.splitsInto.count; i++) {
        const a = Math.random() * Math.PI * 2;
        const child = this.spawnEnemy(e.def.splitsInto.id, e.x + Math.cos(a) * 16, e.y + Math.sin(a) * 16, false);
        if (child) {
          child.knockX = Math.cos(a) * 200;
          child.knockY = Math.sin(a) * 200;
        }
      }
    }
    // elite burst mod
    if (e.mod === 'burst') {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        if (this.ebullets.length < 320) {
          this.spawnEBullet({
            x: e.x,
            y: e.y,
            vx: Math.cos(a) * 190,
            vy: Math.sin(a) * 190,
            r: 6,
            dmg: 9 * this.dmgScale,
            life: 4,
          });
        }
      }
      this.addText(e.x, e.y - 20, 'BURST!', '#ff9a3d', 12, true);
    }
    addHeat(this, e.elite ? 10 : 5);
    // heat pop on kill
    this.spawnParticleBurst(e.x, e.y, '#ffd94d', 2, 60, 1.5);
    void source;
  }

  private killBoss(e: Enemy): void {
    if (e.dead) return;
    e.dead = true;
    this.bossKills++;
    this.score += e.score;
    this.audio.sfx('bossDie');
    this.shake(16);
    this.flashScreen('#ffffff', 0.55);
    this.hitStop = 0.18;
    this.zoomKick = 1; // camera punch-in on the kill
    this.spawnParticleBurst(e.x, e.y, e.def.color, 60, 380, 5, 0.95);
    this.spawnParticleBurst(e.x, e.y, '#ffffff', 30, 260, 4, 0.92);
    this.spawnGibs(e.x, e.y, e.def.color, 9, 340);
    this.spawnShock({
      x: e.x,
      y: e.y,
      r: 20,
      maxR: 520,
      speed: 800,
      life: 0.7,
      maxLife: 0.7,
      color: e.def.color,
      width: 10,
      dmg: 40,
      knock: 420,
    });
    // xp shower
    const chunks = 10;
    for (let i = 0; i < chunks; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnGemFn(this, e.x + Math.cos(a) * 30, e.y + Math.sin(a) * 30, Math.ceil(e.xp / chunks), 'xp');
    }
    spawnGemFn(this, e.x - 20, e.y, 30, 'heal');
    spawnGemFn(this, e.x + 20, e.y, 30, 'heal');
    this.addText(e.x, e.y - 60, `${e.def.name} DESTROYED`, '#ffd94d', 20, true);
    this.boss = null;
    this.bossState = null;
    this.bossActive = false;
    addHeat(this, 25);
  }

  gainXp(v: number): void {
    const p = this.player;
    p.xp += v * p.stats.xpMult;
    let leveled = false;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = xpForLevel(p.level);
      this.pendingLevels++;
      leveled = true;
    }
    if (leveled && this.state === 'playing' && this.deathT <= 0) {
      this.openLevelUp();
    }
  }

  private openLevelUp(): void {
    // don't stack drafts while one is already pending/open
    if (this.pendingCards || this.state === 'levelup') return;
    this.cards = generateCards(this);
    this.rerolls = 1;
    this.cardHover = -1;
    this.pendingCards = true;
    this.levelupFreeze = 0.15; // freeze frame, then the draft slams in
    this.audio.sfx('levelup');
    this.spawnParticleBurst(this.player.x, this.player.y, '#6dff8c', 26, 240, 3.5);
    // restore a dash charge as a small mercy
    this.player.dashCharges = Math.min(
      PLAYER_BASE.dashCharges + this.player.stats.extraDash + this.meta.perkTiers('batteryCore'),
      this.player.dashCharges + 1
    );
  }

  chooseCard(i: number): void {
    if (this.state !== 'levelup') return;
    const card = this.cards[i];
    if (!card) return;
    applyCard(this, card);
    this.pendingLevels--;
    if (this.pendingLevels > 0) {
      this.cards = generateCards(this);
      this.rerolls = 1;
      this.cardAnimT = 0;
    } else {
      this.state = 'playing';
    }
  }

  rerollCards(): void {
    if (this.state !== 'levelup' || this.rerolls <= 0) return;
    this.rerolls--;
    this.cards = generateCards(this);
    this.cardAnimT = 0;
    this.audio.sfx('reroll');
  }

  recomputeStats(): void {
    const p = this.player;
    const oldMax = p.maxHp;
    p.stats = computeStats(
      {
        powerCore: this.meta.perkTiers('powerCore'),
        guardCore: this.meta.perkTiers('guardCore'),
        thrusterCore: this.meta.perkTiers('thrusterCore'),
        sageCore: this.meta.perkTiers('sageCore'),
        magnetCore: this.meta.perkTiers('magnetCore'),
      },
      p.passives
    );
    if (this.activeBoosters['xpAmp']) p.stats.xpMult *= 1.3;
    const newMax = PLAYER_BASE.hp + this.meta.perkTiers('guardCore') * 15 + (p.passives['vitality'] ?? 0) * 20;
    if (newMax !== oldMax) {
      const diff = newMax - oldMax;
      p.maxHp = newMax;
      if (diff > 0) p.hp += diff;
      p.hp = Math.min(p.hp, p.maxHp);
    }
  }

  buyPerk(id: string): void {
    const perk = META_PERKS.find((p) => p.id === id);
    if (!perk) return;
    const tier = this.meta.data.perks[id] ?? 0;
    if (tier >= perk.maxTier) return;
    const cost = perk.costs[tier];
    if (this.meta.data.cores < cost) {
      this.audio.sfx('error');
      return;
    }
    this.meta.data.cores -= cost;
    this.meta.data.perks[id] = tier + 1;
    this.meta.save();
    this.audio.sfx('buy');
    if (this.state === 'playing') this.recomputeStats();
  }

  // ---------------- SEASON ONE economy actions ----------------

  buySkin(id: string): void {
    const skin = skinOf(id);
    if (skin.id === 'pulse' || skin.currency === 'pass') return;
    if (this.meta.data.skinsOwned.includes(id)) return;
    const bal = skin.currency === 'cores' ? this.meta.data.cores : this.meta.data.prisms;
    if (bal < skin.price) {
      this.audio.sfx('error');
      return;
    }
    if (skin.currency === 'cores') this.meta.data.cores -= skin.price;
    else this.meta.data.prisms -= skin.price;
    this.meta.data.skinsOwned.push(id);
    this.meta.data.skinEquipped = id;
    this.meta.save();
    this.audio.sfx('buy');
  }

  equipSkin(id: string): void {
    if (!this.meta.data.skinsOwned.includes(id)) return;
    this.meta.data.skinEquipped = id;
    this.meta.save();
    this.audio.sfx('select');
  }

  buyBooster(id: string): void {
    const b = BOOSTERS.find((x) => x.id === id);
    if (!b) return;
    const bal = b.currency === 'cores' ? this.meta.data.cores : this.meta.data.prisms;
    if (bal < b.price) {
      this.audio.sfx('error');
      return;
    }
    if (b.currency === 'cores') this.meta.data.cores -= b.price;
    else this.meta.data.prisms -= b.price;
    this.meta.data.boosters[id] = (this.meta.data.boosters[id] ?? 0) + 1;
    this.meta.save();
    this.audio.sfx('buy');
  }

  unlockPrime(): void {
    const m = this.meta.data;
    if (m.prime) return;
    if (m.prisms < PRIME_PRICE) {
      this.audio.sfx('error');
      return;
    }
    m.prisms -= PRIME_PRICE;
    m.prime = true;
    this.meta.save();
    this.audio.sfx('victory');
    this.flashScreen('#c9b8ff', 0.4);
  }

  unlockPrimeDemo(): void {
    const m = this.meta.data;
    if (m.prime) return;
    m.prime = true;
    m.primeDemo = true;
    this.meta.save();
    this.audio.sfx('victory');
    this.flashScreen('#c9b8ff', 0.4);
  }

  exchangePrisms(): void {
    const m = this.meta.data;
    if (m.cores < EXCHANGE_CORES) {
      this.audio.sfx('error');
      return;
    }
    m.cores -= EXCHANGE_CORES;
    m.prisms += EXCHANGE_PRISMS;
    this.meta.save();
    this.audio.sfx('trade');
  }

  // ---------------- fx helpers ----------------

  addText(x: number, y: number, text: string, color: string, size = 12, bold = false, vx = 0): void {
    if (this.texts.length >= MAX_TEXTS + 20) return;
    const t = this.textPool.acquire();
    t.x = x;
    t.y = y;
    t.vx = vx;
    t.vy = -46;
    t.life = bold ? 1.1 : 0.75;
    t.maxLife = t.life;
    t.text = text;
    t.color = color;
    t.size = size;
    t.dead = false;
    this.texts.push(t);
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag = 0.9): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    const p = this.particlePool.acquire();
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.color = color;
    p.drag = drag;
    p.glow = true;
    p.kind = 'dot';
    p.rot = 0;
    p.vrot = 0;
    p.dead = false;
    this.particles.push(p);
  }

  spawnParticleBurst(x: number, y: number, color: string, count: number, speed: number, size: number, drag = 0.88): void {
    // reduced motion: half the particles, same energy
    const n = this.settings.reducedMotion ? Math.ceil(count * 0.5) : count;
    for (let i = 0; i < n; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      const p = this.particlePool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = 0.35 + Math.random() * 0.4;
      p.maxLife = 0.75;
      p.size = size * (0.6 + Math.random() * 0.8);
      p.color = color;
      p.drag = drag;
      p.glow = true;
      p.kind = 'dot';
      p.rot = 0;
      p.vrot = 0;
      p.dead = false;
      this.particles.push(p);
    }
  }

  /** spinning hull fragments — enemies shatter instead of just popping */
  spawnGibs(x: number, y: number, color: string, count: number, speed: number): void {
    if (this.settings.reducedMotion) return;
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.75);
      const p = this.particlePool.acquire();
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.life = 0.5 + Math.random() * 0.4;
      p.maxLife = p.life;
      p.size = 2.2 + Math.random() * 2.6;
      p.color = color;
      p.drag = 0.82;
      p.glow = false;
      p.kind = 'gib';
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 22;
      p.dead = false;
      this.particles.push(p);
    }
  }

  spawnEBullet(o: Partial<EBullet>): EBullet | null {
    if (this.ebullets.length >= 340) return null;
    const b = this.ebulletPool.acquire();
    b.x = 0;
    b.y = 0;
    b.vx = 0;
    b.vy = 0;
    b.r = 6;
    b.dmg = 10;
    b.life = 5;
    b.mine = undefined;
    b.armT = undefined;
    b.telegraph = undefined;
    b.dead = false;
    Object.assign(b, o);
    this.ebullets.push(b);
    return b;
  }

  spawnShock(o: Partial<Shock>): Shock {
    const s = this.shockPool.acquire();
    s.x = 0;
    s.y = 0;
    s.r = 8;
    s.maxR = 100;
    s.speed = 600;
    s.life = 0.25;
    s.maxLife = 0.25;
    s.color = '#4de8ff';
    s.width = 4;
    s.dmg = 0;
    s.knock = 0;
    s.hitIds.clear();
    s.dead = false;
    Object.assign(s, o);
    this.shockwaves.push(s);
    return s;
  }

  spawnAfterimage(x: number, y: number, angle: number, color: string): void {
    const af = this.afterimagePool.acquire();
    af.x = x;
    af.y = y;
    af.angle = angle;
    af.life = 0.25;
    af.maxLife = 0.25;
    af.color = color;
    af.dead = false;
    this.afterimages.push(af);
  }

  spawnArc(x: number, y: number, x2: number, y2: number, color: string): void {
    const a = this.arcPool.acquire();
    a.x = x;
    a.y = y;
    a.x2 = x2;
    a.y2 = y2;
    a.life = 0.14;
    a.maxLife = 0.14;
    a.color = color;
    a.seed = Math.random() * 1000;
    a.dead = false;
    this.arcs.push(a);
  }

  shake(amount: number): void {
    const s = this.settings;
    if (s.reducedMotion) return;
    this.trauma = Math.min(1.2, this.trauma + (amount / 14) * s.shake);
  }

  flashScreen(color: string, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha * (this.settings.reduceFlash ? 0.4 : 1));
  }

  // ---------------- ui interaction ----------------

  click(x: number, y: number): void {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.clicked = true;
    for (const b of this.buttons) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        this.onButton(b.id);
        return;
      }
    }
  }

  onButton(id: string): void {
    this.audio.init();
    if (id.startsWith('card')) {
      const i = parseInt(id.slice(4), 10);
      this.chooseCard(i);
      return;
    }
    if (id.startsWith('perk_select_')) {
      const i = parseInt(id.slice(12), 10);
      if (!Number.isNaN(i) && i >= 0 && i < META_PERKS.length) {
        this.perkIndex = i;
        this.audio.sfx('uiMove');
      }
      return;
    }
    if (id === 'reroll_btn') {
      this.rerollCards();
      return;
    }
    if (id.startsWith('set_left_')) {
      this.cycleSetting(id.slice(9), -1);
      return;
    }
    if (id.startsWith('set_right_')) {
      this.cycleSetting(id.slice(10), 1);
      return;
    }
    if (id.startsWith('skin_buy_')) {
      this.buySkin(id.slice(9));
      return;
    }
    if (id.startsWith('skin_equip_')) {
      this.equipSkin(id.slice(11));
      return;
    }
    if (id.startsWith('booster_buy_')) {
      this.buyBooster(id.slice(12));
      return;
    }
    if (id.startsWith('market_tab_')) {
      this.marketTab = parseInt(id.slice(11), 10) || 0;
      this.audio.sfx('uiMove');
      return;
    }
    if (id.startsWith('tier_select_')) {
      const n = parseInt(id.slice(12), 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 30) {
        this.passSelectedTier = n;
        this.audio.sfx('uiMove');
      }
      return;
    }
    switch (id) {
      case 'title_start':
        this.startRun();
        break;
      case 'title_pass':
        this.state = 'pass';
        this.passSelectedTier = Math.max(1, this.meta.data.passLevel);
        break;
      case 'title_market':
        this.state = 'market';
        break;
      case 'title_perks':
        this.state = 'perks';
        this.perkIndex = 0;
        break;
      case 'title_settings':
        this.state = 'settings';
        this.settingsIndex = 0;
        break;
      case 'title_help':
        this.state = 'help';
        break;
      case 'pass_back':
        this.state = 'title';
        this.menuIndex = 0;
        break;
      case 'pass_unlock_prime':
        this.unlockPrime();
        break;
      case 'pass_demo':
        this.unlockPrimeDemo();
        break;
      case 'market_back':
        this.state = 'title';
        this.menuIndex = 0;
        break;
      case 'exchange_btn':
        this.exchangePrisms();
        break;
      case 'perk_buy':
        this.buyPerk(META_PERKS[this.perkIndex]?.id ?? '');
        break;
      case 'perk_back':
        this.state = 'title';
        break;
      case 'help_back':
        this.state = 'title';
        break;
      case 'settings_back':
        this.state = 'title';
        this.menuIndex = 0;
        break;
      case 'pause_settings':
        this.state = 'settings';
        this.settingsIndex = 0;
        this.settingsReturn = 'paused';
        break;
      case 'pause_resume':
        this.togglePause();
        break;
      case 'pause_restart':
        this.startRun();
        break;
      case 'pause_quit':
        this.quitToTitle();
        break;
      case 'over_retry':
        this.startRun();
        break;
      case 'over_title':
        this.state = 'title';
        this.menuIndex = 0;
        break;
      case 'victory_endless':
        this.continueEndless();
        break;
      case 'victory_title':
        this.state = 'title';
        this.menuIndex = 0;
        break;
      default:
        break;
    }
  }

  togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.audio.setIntensity(0.15);
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  toggleMute(): void {
    this.meta.data.muted = !this.meta.data.muted;
    this.audio.setMuted(this.meta.data.muted);
    this.meta.save();
  }

  handleKeyPress(code: string, repeat: boolean): void {
    if (repeat) return;
    this.audio.init();
    switch (this.state) {
      case 'title': {
        if (code === 'Enter' || code === 'NumpadEnter') {
          const actions = ['title_start', 'title_pass', 'title_market', 'title_perks', 'title_settings', 'title_help'];
          this.onButton(actions[this.menuIndex] ?? 'title_start');
        } else if (code === 'KeyB') {
          this.state = 'pass';
          this.passSelectedTier = Math.max(1, this.meta.data.passLevel);
        } else if (code === 'KeyN') {
          this.state = 'market';
        } else if (code === 'KeyE') {
          this.state = 'perks';
          this.perkIndex = 0;
        } else if (code === 'KeyG') {
          this.state = 'settings';
          this.settingsIndex = 0;
        } else if (code === 'KeyH') this.state = 'help';
        else if (code === 'ArrowUp' || code === 'KeyW') {
          this.menuIndex = (this.menuIndex + 5) % 6;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          this.menuIndex = (this.menuIndex + 1) % 6;
          this.audio.sfx('uiMove');
        } else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'settings': {
        const keys = ['volMaster', 'volMusic', 'volSfx', 'shake', 'reduceFlash', 'dmgNumbers', 'colorblind', 'reducedMotion'];
        if (code === 'Escape' || code === 'KeyG') {
          this.state = this.settingsReturn === 'paused' ? 'paused' : 'title';
          if (this.settingsReturn !== 'paused') this.menuIndex = 0;
        } else if (code === 'ArrowUp' || code === 'KeyW') {
          this.settingsIndex = (this.settingsIndex + keys.length - 1) % keys.length;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          this.settingsIndex = (this.settingsIndex + 1) % keys.length;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowLeft' || code === 'KeyA') {
          this.cycleSetting(keys[this.settingsIndex], -1);
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          this.cycleSetting(keys[this.settingsIndex], 1);
        }
        break;
      }
      case 'perks': {
        if (code === 'Escape') this.state = 'title';
        else if (code === 'ArrowUp' || code === 'KeyW') {
          this.perkIndex = (this.perkIndex + META_PERKS.length - 1) % META_PERKS.length;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          this.perkIndex = (this.perkIndex + 1) % META_PERKS.length;
          this.audio.sfx('uiMove');
        } else if (code === 'Enter' || code === 'NumpadEnter') {
          this.buyPerk(META_PERKS[this.perkIndex]?.id ?? '');
        } else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'help': {
        if (code === 'Escape' || code === 'Enter') this.state = 'title';
        break;
      }
      case 'playing': {
        if (code === 'Escape' || code === 'KeyP') this.togglePause();
        else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'levelup': {
        if (code === 'Digit1' || code === 'Numpad1') this.chooseCard(0);
        else if (code === 'Digit2' || code === 'Numpad2') this.chooseCard(1);
        else if (code === 'Digit3' || code === 'Numpad3') this.chooseCard(2);
        else if (code === 'KeyR') this.rerollCards();
        break;
      }
      case 'paused': {
        if (code === 'Escape' || code === 'KeyP') this.togglePause();
        else if (code === 'KeyQ') this.quitToTitle();
        else if (code === 'KeyR') this.startRun();
        else if (code === 'KeyG') this.onButton('pause_settings');
        else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'gameover': {
        if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
        else if (code === 'KeyT') {
          this.state = 'title';
          this.menuIndex = 0;
        } else if (code === 'KeyB') {
          this.state = 'pass';
          this.passSelectedTier = Math.max(1, this.meta.data.passLevel);
        } else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'victory': {
        if (code === 'KeyC') this.continueEndless();
        else if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
        else if (code === 'KeyT') {
          this.state = 'title';
          this.menuIndex = 0;
        } else if (code === 'KeyB') {
          this.state = 'pass';
          this.passSelectedTier = Math.max(1, this.meta.data.passLevel);
        } else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'pass': {
        if (code === 'Escape' || code === 'KeyB') {
          this.state = 'title';
          this.menuIndex = 0;
        }
        break;
      }
      case 'market': {
        if (code === 'Escape' || code === 'KeyN') {
          this.state = 'title';
          this.menuIndex = 0;
        } else if (code === 'ArrowLeft' || code === 'KeyA') {
          this.marketTab = (this.marketTab + 2) % 3;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowRight' || code === 'KeyD') {
          this.marketTab = (this.marketTab + 1) % 3;
          this.audio.sfx('uiMove');
        }
        break;
      }
    }
  }

  handleKeyRelease(code: string): void {
    void code; // movement keys handled by host
  }

  // movement keys — called by host on keydown/keyup
  setMove(code: string, down: boolean): void {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        this.input.up = down;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.input.down = down;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.input.left = down;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.input.right = down;
        break;
      case 'Space':
      case 'ShiftLeft':
      case 'ShiftRight':
        if (down) this.input.dash = true;
        break;
      default:
        break;
    }
  }

  // ---------------- debug hooks ----------------

  private attachDebug(): void {
    if (typeof window === 'undefined') return;
    const w = window as unknown as { __VOIDPULSE?: unknown };
    w.__VOIDPULSE = {
      game: this,
      addXp: (n: number) => this.gainXp(n),
      forceLevel: () => {
        this.pendingLevels++;
        this.openLevelUp();
      },
      setWave: (n: number) => {
        startWave(this, n);
      },
      god: (on: boolean) => {
        this.godMode = on;
      },
      killAll: () => {
        for (const e of this.enemies) this.damageEnemy(e, 1e9, false, 'debug');
      },
      stats: () => ({
        wave: this.wave,
        level: this.player.level,
        hp: this.player.hp,
        score: this.score,
        kills: this.kills,
        enemies: this.enemies.length,
        state: this.state,
        weapons: this.player.weapons.map((w) => `${w.id}:${w.level}`),
        passives: { ...this.player.passives },
      }),
    };
  }
}

function pickMod(rng: () => number): 'burst' | 'swift' | 'shield' {
  const r = rng();
  if (r < 0.4) return 'burst';
  if (r < 0.7) return 'swift';
  return 'shield';
}
