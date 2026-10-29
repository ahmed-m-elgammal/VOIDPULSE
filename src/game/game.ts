// ===== VOIDPULSE :: core game orchestrator =====

import type {
  Afterimage,
  Arc,
  BossState,
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
import { makeRng, sweepDead } from './utils';
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
  bullets: import('./types').Bullet[] = [];
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

  // ui
  menuIndex = 0;
  perkIndex = 0;
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
    this.rng = makeRng((Date.now() ^ 0x5f3759df) >>> 0);
    this.resetPlayer();
    this.attachDebug();
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
    const maxHp = PLAYER_BASE.hp + perkTiers('guardCore') * 15;
    this.player = {
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
    this.coresEarned =
      Math.floor(this.score / 1000) + this.wave * 3 + this.bossKills * 30;
    m.cores += this.coresEarned;
    m.bestScore = Math.max(m.bestScore, Math.floor(this.score));
    m.bestWave = Math.max(m.bestWave, this.wave);
    if (won) {
      m.wins++;
      m.endlessUnlocked = true;
    }
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
    sweepDead(this.enemies); // bullets/shocks may have killed enemies
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
    const e: Enemy = {
      eid: this.nextEid(),
      def: base,
      x,
      y,
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      radius: base.radius * (elite ? 1.55 : 1),
      speed: base.speed * spdScale * (mod === 'swift' ? 1.45 : 1),
      damage: base.damage * dmgScale * (elite ? 1.4 : 1),
      xp: base.xp * (elite ? 6 : 1),
      score: base.score * (elite ? 8 : 1),
      elite,
      mod,
      flash: 0,
      t: 0,
      shootTimer: base.shoot ? base.shoot.cd * (0.5 + Math.random()) : 999,
      phase: 0,
      slow: 0,
      slowT: 0,
      freezeT: 0,
      stunT: 0,
      knockX: 0,
      knockY: 0,
      spawnT: 0.45,
      orbHitCd: 0,
      zigPhase: Math.random() * Math.PI * 2,
      rage: 1,
      shieldHits: mod === 'shield' ? 3 : 0,
      hitCd: new Map<number, number>(),
    };
    this.enemies.push(e);
    if (elite) {
      this.spawnParticleBurst(x, y, '#ff9a3d', 12, 160, 3);
    }
    return e;
  }

  damageEnemy(e: Enemy, dmg: number, crit: boolean, source: string, silent = false): void {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 1;
    if (!silent && this.texts.length < MAX_TEXTS) {
      this.addText(
        e.x + (Math.random() - 0.5) * 14,
        e.y - e.radius - 6,
        String(Math.round(dmg)),
        crit ? '#ffe066' : '#ffffff',
        crit ? 15 : 11,
        crit
      );
    }
    if (e.hp <= 0) {
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
    this.audio.sfx(e.elite ? 'killBig' : 'kill', 0.15);
    this.shake(e.elite ? 4 : 0.6);
    if (e.elite) this.hitStop = Math.max(this.hitStop, 0.05);

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
          this.ebullets.push({
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
    this.hitStop = 0.14;
    this.spawnParticleBurst(e.x, e.y, e.def.color, 60, 380, 5, 0.95);
    this.spawnParticleBurst(e.x, e.y, '#ffffff', 30, 260, 4, 0.92);
    this.shockwaves.push({
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
      hitIds: new Set<number>(),
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
    this.cards = generateCards(this);
    this.rerolls = 1;
    this.cardHover = -1;
    this.state = 'levelup';
    this.audio.sfx('levelup');
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
    } else {
      this.state = 'playing';
    }
  }

  rerollCards(): void {
    if (this.state !== 'levelup' || this.rerolls <= 0) return;
    this.rerolls--;
    this.cards = generateCards(this);
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

  // ---------------- fx helpers ----------------

  addText(x: number, y: number, text: string, color: string, size = 12, bold = false): void {
    if (this.texts.length >= MAX_TEXTS + 20) return;
    this.texts.push({
      x,
      y,
      vy: -46,
      life: bold ? 1.1 : 0.75,
      maxLife: bold ? 1.1 : 0.75,
      text,
      color,
      size,
    });
  }

  spawnParticle(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, drag = 0.9): void {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ x, y, vx, vy, life, maxLife: life, size, color, drag, glow: true });
  }

  spawnParticleBurst(x: number, y: number, color: string, count: number, speed: number, size: number, drag = 0.88): void {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.4,
        maxLife: 0.75,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        drag,
        glow: true,
      });
    }
  }

  shake(amount: number): void {
    this.trauma = Math.min(1.2, this.trauma + amount / 14);
  }

  flashScreen(color: string, alpha: number): void {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
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
    switch (id) {
      case 'title_start':
        this.startRun();
        break;
      case 'title_perks':
        this.state = 'perks';
        this.perkIndex = 0;
        break;
      case 'title_help':
        this.state = 'help';
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
        if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
        else if (code === 'KeyE') {
          this.state = 'perks';
          this.perkIndex = 0;
        } else if (code === 'KeyH') this.state = 'help';
        else if (code === 'ArrowUp' || code === 'KeyW') {
          this.menuIndex = (this.menuIndex + 2) % 3;
          this.audio.sfx('uiMove');
        } else if (code === 'ArrowDown' || code === 'KeyS') {
          this.menuIndex = (this.menuIndex + 1) % 3;
          this.audio.sfx('uiMove');
        } else if (code === 'KeyM') this.toggleMute();
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
        else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'gameover': {
        if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
        else if (code === 'KeyT') {
          this.state = 'title';
          this.menuIndex = 0;
        } else if (code === 'KeyM') this.toggleMute();
        break;
      }
      case 'victory': {
        if (code === 'KeyC') this.continueEndless();
        else if (code === 'Enter' || code === 'NumpadEnter') this.startRun();
        else if (code === 'KeyT') {
          this.state = 'title';
          this.menuIndex = 0;
        } else if (code === 'KeyM') this.toggleMute();
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
