/**
 * VOIDPULSE MOBILE — enemy AI, contact damage, death & drops.
 * Index-based iteration over the world SoA pools. Local primitives only.
 */
import { P_RADIUS } from '../config';
import * as W from './world';
import * as P from './player';
import { addTrauma } from '../camera';
import { hapHeavy } from '../haptics';
import { sfxBossDown } from '../audio';

const TAU = 6.2831853;

/** Apply damage to enemy i. Handles flash, floaters, death & drops. */
export function damageEnemy(i: number, dmg: number, hx: number, hy: number): void {
  if (W.eAlive[i] !== 1) return;
  W.ehp[i] -= dmg;
  W.eflash[i] = 1;
  W.spawnFloater(hx, hy, dmg | 0);
  const t = W.eType[i];
  if (W.ehp[i] <= 0) {
    onEnemyDeath(i, t);
  } else {
    W.spawnParticle(hx, hy, (Math.random() - 0.5) * 120, (Math.random() - 0.5) * 120,
      0.25, 2.5, factionCol(t));
  }
}

export function factionCol(t: number): number {
  if (t === W.E_BOSS) return W.PC_BOSS;
  if (t === W.E_SPITTER || t === W.E_SPLITTER) return W.PC_ENEMY2;
  if (t === W.E_BULWARK) return W.PC_ENEMY3;
  return W.PC_ENEMY;
}

function onEnemyDeath(i: number, t: number): void {
  const x = W.ex[i], y = W.ey[i];
  W.addScore(W.ET_SCORE[t]);
  W.addKill();
  P.addOd(0.006);
  W.burst(x, y, t === W.E_BOSS ? 42 : 8, t === W.E_BOSS ? 320 : 160, factionCol(t), t === W.E_BOSS ? 4.5 : 3);
  W.spawnGem(x, y, W.ET_XP[t], 0);

  if (t === W.E_SPLITTER) {
    // splits into two motes with 35% of the parent's relative HP scale
    const rel = (W.emaxhp[i] / W.ET_HP[W.E_SPLITTER]) * 0.35;
    W.spawnEnemy(W.E_MOTE, x - 10, y, rel, 1);
    W.spawnEnemy(W.E_MOTE, x + 10, y, rel, 1);
  } else if (t === W.E_VOLATILE) {
    // death blast: hurts the player if close
    W.burst(x, y, 14, 240, W.PC_ENEMY, 3.5);
    const dx = P.pX - x, dy = P.pY - y;
    if (dx * dx + dy * dy < 95 * 95) P.damagePlayer(18, x, y);
  } else if (t === W.E_BOSS) {
    addTrauma(0.9);
    hapHeavy();
    sfxBossDown();
    for (let k = 0; k < 6; k++) W.spawnGem(x + (k - 2.5) * 22, y + (Math.random() - 0.5) * 30, 0, 1);
  }

  W.killEnemy(i);
}

// ---------------------------------------------------------------- AI tick
export function tickEnemies(dt: number): void {
  for (let i = 0; i < W.eCount; i++) {
    const t = W.eType[i];
    const x = W.ex[i], y = W.ey[i];
    let dx = P.pX - x, dy = P.pY - y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    dx /= dist; dy /= dist;
    const spd = W.espd[i];
    const age = W.eage[i];
    let vx = 0, vy = 0;

    if (t === W.E_MOTE) {
      const wob = Math.sin(age * 5 + i) * 0.35;
      vx = (dx - dy * wob) * spd; vy = (dy + dx * wob) * spd;
    } else if (t === W.E_DRIFTER) {
      const sway = Math.cos(age * 1.7 + i * 1.3) * 0.6;
      vx = (dx - dy * sway) * spd; vy = (dy + dx * sway) * spd;
    } else if (t === W.E_SPRINTER) {
      const st = W.eState[i];
      if (st === 0) {
        vx = dx * spd; vy = dy * spd;
        if (dist < 300) { W.eState[i] = 1; W.etimer[i] = 0.5; }
      } else if (st === 1) {
        W.etimer[i] -= dt;
        vx = dx * spd * 0.15; vy = dy * spd * 0.15;
        if (W.etimer[i] <= 0) { W.eState[i] = 2; W.etimer[i] = 0.5; vx = dx * spd * 3.6; vy = dy * spd * 3.6; }
      } else {
        W.etimer[i] -= dt;
        vx = dx * spd * 3.6; vy = dy * spd * 3.6;
        if (W.etimer[i] <= 0) W.eState[i] = 0;
      }
    } else if (t === W.E_SPITTER) {
      // keep 220..300 range, strafe, fire
      if (dist > 300) { vx = dx * spd; vy = dy * spd; }
      else if (dist < 220) { vx = -dx * spd; vy = -dy * spd; }
      else { vx = -dy * spd * 0.7; vy = dx * spd * 0.7; }
      W.etimer[i] -= dt;
      if (W.etimer[i] <= 0 && dist < 540) {
        W.etimer[i] = 1.9;
        W.spawnBullet(x + dx * 12, y + dy * 12, dx * 190, dy * 190, 4, 10, 5, 0, 0);
      }
    } else if (t === W.E_SPLITTER) {
      const wob = Math.sin(age * 3 + i * 2) * 0.5;
      vx = (dx - dy * wob) * spd; vy = (dy + dx * wob) * spd;
    } else if (t === W.E_BULWARK) {
      const zig = Math.sin(age * 2.2) * 0.25;
      vx = (dx - dy * zig) * spd; vy = (dy + dx * zig) * spd;
    } else if (t === W.E_VOLATILE) {
      vx = dx * spd; vy = dy * spd;
    } else if (t === W.E_BOSS) {
      // drift toward player + radial rings + summons
      vx = dx * spd; vy = dy * spd;
      const enraged = W.ehp[i] < W.emaxhp[i] * 0.5;
      W.etimer[i] -= dt;
      if (W.etimer[i] <= 0) {
        W.etimer[i] = enraged ? 1.7 : 2.2;
        const n = enraged ? 16 : 12;
        const bs = enraged ? 170 : 150;
        const base = age * 0.7;
        for (let k = 0; k < n; k++) {
          const a = base + (k / n) * TAU;
          W.spawnBullet(x + Math.cos(a) * W.ET_R[t], y + Math.sin(a) * W.ET_R[t],
            Math.cos(a) * bs, Math.sin(a) * bs, 4.5, 12, 5, 0, 0);
        }
      }
      const summons = W.eState[i];
      if (age > (summons + 1) * 7 && W.eCount < 150) {
        W.eState[i] = summons + 1;
        for (let k = 0; k < 3; k++) {
          const a = Math.random() * TAU;
          W.spawnEnemy(W.E_MOTE, x + Math.cos(a) * 60, y + Math.sin(a) * 60, 0.8, 1);
        }
      }
    }

    W.evx[i] = vx; W.evy[i] = vy;
    W.ex[i] = x + vx * dt;
    W.ey[i] = y + vy * dt;
    W.eage[i] = age + dt;
    if (W.eflash[i] > 0) W.eflash[i] -= dt * 4;

    // contact damage (after a short spawn-in grace)
    if (age > 0.35 && dist < W.ET_R[t] + P_RADIUS) {
      if (P.damagePlayer(W.ET_DMG[t], x, y) && P.pThorns > 0) {
        damageEnemy(i, P.pThorns, x, y);
        if (W.eAlive[i] !== 1) continue; // enemy died from thorns (index swapped)
      }
    }
  }
}
