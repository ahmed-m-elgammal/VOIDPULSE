/**
 * VOIDPULSE MOBILE — world state, Structure-of-Arrays pools, wave director.
 *
 * ZERO-ALLOC CONTRACT: every pool below is pre-allocated typed storage with a
 * live count + swap-remove deletion. spawnX()/killX() never allocate. The sim
 * tick only ever touches these fields with local primitives.
 *
 * NOTE: ES modules can only reassign their own `export let`, so every mutable
 * piece of state is mutated inside its owning module through plain functions.
 * Player state lives in sim/player.ts, camera in camera.ts, etc.
 */
import {
  CAP_ENEMY, CAP_BULLET, CAP_GEM, CAP_PARTICLE, CAP_FLOATER,
  WORLD_W, WORLD_H, WAVE_BUDGET_BASE, WAVE_BUDGET_PER, WAVE_MAX_ALIVE,
  WAVE_HP_SCALE, WAVE_SPD_SCALE, WAVE_SPD_CAP, BOSS_EVERY, VICTORY_WAVE,
} from '../config';
import { ST_TITLE } from '../types';

// ---------------------------------------------------------------- enemy types
export const E_MOTE = 0, E_DRIFTER = 1, E_SPRINTER = 2, E_SPITTER = 3,
  E_SPLITTER = 4, E_BULWARK = 5, E_VOLATILE = 6, E_BOSS = 7;

// static per-type table: hp, speed, radius, contact dmg, xp, score
export const ET_HP = new Float32Array([14, 26, 20, 30, 34, 90, 22, 640]);
export const ET_SPD = new Float32Array([95, 55, 92, 70, 80, 40, 122, 34]);
export const ET_R = new Float32Array([9, 12, 10, 11, 13, 17, 10, 36]);
export const ET_DMG = new Float32Array([8, 10, 12, 10, 10, 16, 8, 22]);
export const ET_XP = new Float32Array([1, 2, 3, 3, 2, 6, 3, 40]);
export const ET_SCORE = new Int32Array([10, 20, 25, 30, 25, 60, 25, 500]);

// ---------------------------------------------------------------- enemy pool
export const ex = new Float32Array(CAP_ENEMY);
export const ey = new Float32Array(CAP_ENEMY);
export const evx = new Float32Array(CAP_ENEMY);
export const evy = new Float32Array(CAP_ENEMY);
export const ehp = new Float32Array(CAP_ENEMY);
export const emaxhp = new Float32Array(CAP_ENEMY);
export const eage = new Float32Array(CAP_ENEMY);
export const etimer = new Float32Array(CAP_ENEMY);   // AI phase timer
export const eflash = new Float32Array(CAP_ENEMY);   // hit flash 0..1
export const espd = new Float32Array(CAP_ENEMY);
export const eType = new Int8Array(CAP_ENEMY);
export const eState = new Int8Array(CAP_ENEMY);      // AI state per type
export const eAlive = new Int8Array(CAP_ENEMY);
export let eCount = 0;

// ---------------------------------------------------------------- bullet pool
export const bx = new Float32Array(CAP_BULLET);
export const by = new Float32Array(CAP_BULLET);
export const bvx = new Float32Array(CAP_BULLET);
export const bvy = new Float32Array(CAP_BULLET);
export const blife = new Float32Array(CAP_BULLET);
export const bdmg = new Float32Array(CAP_BULLET);
export const bR = new Float32Array(CAP_BULLET);
export const bFriendly = new Int8Array(CAP_BULLET);
export const bPierce = new Int8Array(CAP_BULLET);
export const bLastHit = new Int32Array(CAP_BULLET);  // last enemy index hit (pierce guard)
export let bCount = 0;

// ---------------------------------------------------------------- gem pool
export const gx = new Float32Array(CAP_GEM);
export const gy = new Float32Array(CAP_GEM);
export const gvx = new Float32Array(CAP_GEM);
export const gvy = new Float32Array(CAP_GEM);
export const gval = new Float32Array(CAP_GEM);
export const gAge = new Float32Array(CAP_GEM);
export const gKind = new Int8Array(CAP_GEM);          // 0 xp, 1 core (visual)
export let gCount = 0;

// ---------------------------------------------------------------- particles
export const ppx = new Float32Array(CAP_PARTICLE);
export const ppy = new Float32Array(CAP_PARTICLE);
export const pvx = new Float32Array(CAP_PARTICLE);
export const pvy = new Float32Array(CAP_PARTICLE);
export const plife = new Float32Array(CAP_PARTICLE);
export const pmax = new Float32Array(CAP_PARTICLE);
export const psize = new Float32Array(CAP_PARTICLE);
export const pCol = new Int8Array(CAP_PARTICLE);      // palette color slot
export let pCount = 0;

// P_COLOR slots (index into palette-derived bake tables)
export const PC_PLAYER = 0, PC_ENEMY = 1, PC_ENEMY2 = 2, PC_ENEMY3 = 3,
  PC_BOSS = 4, PC_GEM = 5, PC_CORE = 6, PC_HURT = 7, PC_HEAL = 8;

// ---------------------------------------------------------------- floaters
export const flx = new Float32Array(CAP_FLOATER);
export const fly = new Float32Array(CAP_FLOATER);
export const flLife = new Float32Array(CAP_FLOATER);
export const flVal = new Int32Array(CAP_FLOATER);
export let flCount = 0;

// ---------------------------------------------------------------- run stats
export let runTime = 0;
export let score = 0;
export let kills = 0;
export let wave = 1;
export let runOver = false;
export let runWon = false;
export let victoryPending = false;
export let bossAlive = false;

// ---------------------------------------------------------------- wave director
export let waveBudget = 0;
export let waveSpawnT = 0;
export let waveInter = 0;              // intermission countdown
export let waveSpawning = false;

// ---------------------------------------------------------------- game state
export let state = ST_TITLE;

export function setState(s: number): void { state = s; }
export function addScore(n: number): void { score += n; }
export function addKill(): void { kills += 1; }
export function tickRunTime(dt: number): void { runTime += dt; }
export function setRunOver(won: boolean): void { runOver = true; runWon = won; }
export function clearVictory(): void { victoryPending = false; }

// ---------------------------------------------------------------- spawn/kill
export function spawnEnemy(type: number, x: number, y: number, hpScale: number, spdScale: number): boolean {
  if (eCount >= CAP_ENEMY) return false;
  const i = eCount++;
  ex[i] = x; ey[i] = y; evx[i] = 0; evy[i] = 0;
  let hp = ET_HP[type] * hpScale;
  if (type === E_BOSS) { hp = ET_HP[type] * (1 + 0.55 * hpScale); bossAlive = true; }
  ehp[i] = hp; emaxhp[i] = hp;
  eage[i] = 0; etimer[i] = 0; eflash[i] = 0;
  espd[i] = ET_SPD[type] * Math.min(WAVE_SPD_CAP, spdScale);
  eType[i] = type; eState[i] = 0; eAlive[i] = 1;
  return true;
}

export function killEnemy(i: number): void {
  if (eType[i] === E_BOSS) bossAlive = false;
  const last = --eCount;
  if (i !== last) {
    ex[i] = ex[last]; ey[i] = ey[last]; evx[i] = evx[last]; evy[i] = evy[last];
    ehp[i] = ehp[last]; emaxhp[i] = emaxhp[last]; eage[i] = eage[last];
    etimer[i] = etimer[last]; eflash[i] = eflash[last]; espd[i] = espd[last];
    eType[i] = eType[last]; eState[i] = eState[last]; eAlive[i] = eAlive[last];
  }
}

export function spawnBullet(x: number, y: number, vx: number, vy: number,
  life: number, dmg: number, r: number, friendly: number, pierce: number): void {
  if (bCount >= CAP_BULLET) return;
  const i = bCount++;
  bx[i] = x; by[i] = y; bvx[i] = vx; bvy[i] = vy;
  blife[i] = life; bdmg[i] = dmg; bR[i] = r;
  bFriendly[i] = friendly; bPierce[i] = pierce; bLastHit[i] = -1;
}

export function killBullet(i: number): void {
  const last = --bCount;
  if (i !== last) {
    bx[i] = bx[last]; by[i] = by[last]; bvx[i] = bvx[last]; bvy[i] = bvy[last];
    blife[i] = blife[last]; bdmg[i] = bdmg[last]; bR[i] = bR[last];
    bFriendly[i] = bFriendly[last]; bPierce[i] = bPierce[last]; bLastHit[i] = bLastHit[last];
  }
}

export function spawnGem(x: number, y: number, val: number, kind: number): void {
  if (gCount >= CAP_GEM) { // pool full: merge value into a random existing gem
    if (gCount > 0) gval[(Math.random() * gCount) | 0] += val;
    return;
  }
  const i = gCount++;
  gx[i] = x; gy[i] = y;
  const a = Math.random() * 6.2831853;
  const s = 40 + Math.random() * 70;
  gvx[i] = Math.cos(a) * s; gvy[i] = Math.sin(a) * s;
  gval[i] = val; gKind[i] = kind; gAge[i] = 0;
}

export function killGem(i: number): void {
  const last = --gCount;
  if (i !== last) {
    gx[i] = gx[last]; gy[i] = gy[last]; gvx[i] = gvx[last]; gvy[i] = gvy[last];
    gval[i] = gval[last]; gKind[i] = gKind[last]; gAge[i] = gAge[last];
  }
}

export function spawnParticle(x: number, y: number, vx: number, vy: number,
  life: number, size: number, col: number): void {
  if (pCount >= CAP_PARTICLE) return;
  const i = pCount++;
  ppx[i] = x; ppy[i] = y; pvx[i] = vx; pvy[i] = vy;
  plife[i] = life; pmax[i] = life; psize[i] = size; pCol[i] = col;
}

export function killParticle(i: number): void {
  const last = --pCount;
  if (i !== last) {
    ppx[i] = ppx[last]; ppy[i] = ppy[last]; pvx[i] = pvx[last]; pvy[i] = pvy[last];
    plife[i] = plife[last]; pmax[i] = pmax[last]; psize[i] = psize[last]; pCol[i] = pCol[last];
  }
}

export function spawnFloater(x: number, y: number, val: number): void {
  if (flCount >= CAP_FLOATER) return;
  const i = flCount++;
  flx[i] = x; fly[i] = y; flLife[i] = 0.8; flVal[i] = val;
}

export function killFloater(i: number): void {
  const last = --flCount;
  if (i !== last) { flx[i] = flx[last]; fly[i] = fly[last]; flLife[i] = flLife[last]; flVal[i] = flVal[last]; }
}

/** Burst of particles in palette color slot `col`. Index loop, no allocs. */
export function burst(x: number, y: number, n: number, spd: number, col: number, size: number): void {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * 6.2831853 + Math.random() * 0.5;
    const s = spd * (0.4 + Math.random() * 0.8);
    spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.3, size, col);
  }
}

// ---------------------------------------------------------------- reset
export function resetWorld(): void {
  eCount = 0; bCount = 0; gCount = 0; pCount = 0; flCount = 0;
  runTime = 0; score = 0; kills = 0; wave = 1;
  runOver = false; runWon = false; victoryPending = false; bossAlive = false;
  waveBudget = WAVE_BUDGET_BASE + WAVE_BUDGET_PER;
  waveSpawnT = 0.6; waveInter = 0; waveSpawning = true;
}

// ---------------------------------------------------------------- director
const spawnPos = new Int32Array(2); // module scratch — allocated once

/** Ring spawn position around the player, clamped into the arena. */
export function ringSpawnPos(px: number, py: number): void {
  const a = Math.random() * 6.2831853;
  const d = 430 + Math.random() * 130;
  let x = px + Math.cos(a) * d;
  let y = py + Math.sin(a) * d;
  if (x < 30) x = 30; else if (x > WORLD_W - 30) x = WORLD_W - 30;
  if (y < 30) y = 30; else if (y > WORLD_H - 30) y = WORLD_H - 30;
  spawnPos[0] = x | 0; spawnPos[1] = y | 0;
}

/** Wave director tick — called from the sim tick while RUNNING. */
export function tickWaves(dt: number, px: number, py: number): void {
  if (waveInter > 0) {
    waveInter -= dt;
    if (waveInter <= 0) {
      wave++;
      waveBudget = WAVE_BUDGET_BASE + WAVE_BUDGET_PER * wave;
      waveSpawnT = 0.5;
      waveSpawning = true;
    }
    return;
  }

  const hpScale = 1 + (wave - 1) * WAVE_HP_SCALE;
  const spdScale = 1 + (wave - 1) * WAVE_SPD_SCALE;

  if (waveSpawning) {
    if (wave % BOSS_EVERY === 0 && !bossAlive && waveBudget === WAVE_BUDGET_BASE + WAVE_BUDGET_PER * wave) {
      ringSpawnPos(px, py);
      spawnEnemy(E_BOSS, spawnPos[0], spawnPos[1], hpScale, 1);
      waveBudget -= 4; // boss costs 4 budget units
    }
    waveSpawnT -= dt;
    if (waveSpawnT <= 0 && waveBudget > 0 && eCount < WAVE_MAX_ALIVE) {
      waveSpawnT = Math.max(0.34, 1.15 - wave * 0.045);
      const group = 1 + ((Math.random() * 3) | 0);
      for (let g = 0; g < group && waveBudget > 0; g++) {
        ringSpawnPos(px, py);
        let t: number;
        const r = Math.random();
        if (wave <= 1) t = E_MOTE;
        else if (wave === 2) t = r < 0.7 ? E_MOTE : E_DRIFTER;
        else if (r < 0.30) t = E_MOTE;
        else if (r < 0.45) t = E_DRIFTER;
        else if (r < 0.58) t = E_SPRINTER;
        else if (r < 0.70) t = E_SPITTER;
        else if (r < 0.80) t = E_SPLITTER;
        else if (r < 0.90) t = E_VOLATILE;
        else t = E_BULWARK;
        spawnEnemy(t, spawnPos[0], spawnPos[1], hpScale, spdScale);
        waveBudget--;
      }
    }
    if (waveBudget <= 0) waveSpawning = false;
  } else if (eCount === 0) {
    // wave cleared
    score += 50 * wave;
    waveInter = 2.2;
    if (wave >= VICTORY_WAVE) victoryPending = true;
  }
}
