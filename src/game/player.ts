// ===== VOIDPULSE :: player systems (movement / dash / heat / pickups) =====

import type { Game } from './game';
import { clamp, TAU } from './utils';
import { PLAYER_BASE, WORLD_H, WORLD_W } from './content';

export function updatePlayer(g: Game, dt: number): void {
  const p = g.player;

  // --- timers ---
  p.hitInvuln = Math.max(0, p.hitInvuln - dt);
  p.dashInvuln = Math.max(0, p.dashInvuln - dt);
  const maxCharges = PLAYER_BASE.dashCharges + p.stats.extraDash + g.meta.perkTiers('batteryCore');
  const dashCd = PLAYER_BASE.dashCd * p.stats.dashCdMult;
  if (p.dashCharges < maxCharges) {
    p.dashRecharge += dt;
    if (p.dashRecharge >= dashCd) {
      p.dashRecharge = 0;
      p.dashCharges++;
    }
  } else {
    p.dashRecharge = 0;
  }

  // --- input direction ---
  let ix = 0;
  let iy = 0;
  if (g.input.left) ix -= 1;
  if (g.input.right) ix += 1;
  if (g.input.up) iy -= 1;
  if (g.input.down) iy += 1;
  const ilen = Math.hypot(ix, iy);
  if (ilen > 0) {
    ix /= ilen;
    iy /= ilen;
    p.moveX = ix;
    p.moveY = iy;
    p.facing = Math.atan2(iy, ix);
  }

  // --- dash trigger ---
  if (g.input.dash && p.dashCharges > 0 && p.dashTimer <= 0) {
    g.input.dash = false;
    p.dashCharges--;
    p.dashTimer = 0.16;
    p.dashInvuln = 0.24;
    let dx = ix;
    let dy = iy;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(p.facing);
      dy = Math.sin(p.facing);
    }
    p.dashDirX = dx;
    p.dashDirY = dy;
    g.audio.sfx('dash');
    // speed-line streaks — the dash should feel like a burst of motion
    for (let i = 0; i < 8; i++) {
      const a = Math.atan2(dy, dx) + Math.PI + (Math.random() - 0.5) * 1.1;
      const s = 180 + Math.random() * 220;
      g.spawnParticle(p.x, p.y, Math.cos(a) * s, Math.sin(a) * s, 0.28, 2.4, p.overdrive > 0 ? '#ffd94d' : '#4de8ff', 0.8);
    }
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * TAU;
      g.spawnParticle(p.x, p.y, Math.cos(a) * 60, Math.sin(a) * 60, 0.3, 3, p.overdrive > 0 ? '#ffd94d' : '#4de8ff');
    }
  }
  if (!g.input.dash) g.input.dash = false; // consumed or released

  // --- movement ---
  // FROST AURA elites chill the player — thrusters run at 72% while chilled
  const chill = g.playerChillT > 0 ? 0.72 : 1;
  const speed = PLAYER_BASE.speed * p.stats.speedMult * (p.overdrive > 0 ? 1.15 : 1) * chill;
  if (p.dashTimer > 0) {
    p.dashTimer -= dt;
    const ds = 950;
    p.vx = p.dashDirX * ds;
    p.vy = p.dashDirY * ds;
    // dash trail afterimages
    g.spawnAfterimage(p.x, p.y, p.facing, p.overdrive > 0 ? '#ffd94d' : '#4de8ff');
    dashStrike(g);
    if (p.dashTimer <= 0) {
      // dash-exit micro slow-mo: the world takes a breath as you land
      g.slowT = Math.max(g.slowT, 0.09);
    }
  } else {
    const tvx = ix * speed;
    const tvy = iy * speed;
    const accel = 12;
    p.vx += (tvx - p.vx) * Math.min(1, accel * dt);
    p.vy += (tvy - p.vy) * Math.min(1, accel * dt);
  }

  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // --- world bounds (soft clamp) ---
  const m = 24;
  if (p.x < m) {
    p.x = m;
    p.vx = Math.max(0, p.vx);
  }
  if (p.x > WORLD_W - m) {
    p.x = WORLD_W - m;
    p.vx = Math.min(0, p.vx);
  }
  if (p.y < m) {
    p.y = m;
    p.vy = Math.max(0, p.vy);
  }
  if (p.y > WORLD_H - m) {
    p.y = WORLD_H - m;
    p.vy = Math.min(0, p.vy);
  }

  // --- trail ---
  p.thrustT += dt;
  if (ilen > 0 && p.thrustT > 0.03) {
    p.thrustT = 0;
    p.trail.push({ x: p.x, y: p.y, a: 0.5 });
    if (p.trail.length > 14) p.trail.shift();
  }
  for (const tr of p.trail) tr.a -= dt * 1.6;
  while (p.trail.length && p.trail[0].a <= 0) p.trail.shift();

  // --- heat / overdrive ---
  p.heatIdle += dt;
  if (p.overdrive > 0) {
    p.overdrive -= dt;
    p.heat = Math.max(0, (p.overdrive / 7) * 100);
    if (p.overdrive <= 0) {
      p.heat = 0;
      g.audio.sfx('odEnd');
      g.addText(p.x, p.y - 34, 'OVERDRIVE END', '#9aa8c0', 13);
    }
  } else if (p.heatIdle > 1.8 && p.heat > 0) {
    p.heat = Math.max(0, p.heat - 7 * dt);
  }

  // --- regen ---
  if (p.stats.regen > 0 && p.hp < p.maxHp && p.hp > 0) {
    p.hp = Math.min(p.maxHp, p.hp + p.stats.regen * dt);
  }
}

/** dash through enemies: damage + execute minors; clears enemy bullets */
function dashStrike(g: Game): void {
  const p = g.player;
  const dmg = (PLAYER_BASE.dashDmg + p.stats.dashBonusDmg) * p.stats.damageMult * (p.overdrive > 0 ? 1.5 : 1);
  const hitR = p.radius + 16;
  for (const e of g.enemies) {
    if (e.spawnT > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < hitR + e.radius) {
      if (e.def.minor && !e.elite) {
        g.damageEnemy(e, 9999, false, 'dash');
        g.audio.sfx('dashKill');
      } else {
        g.damageEnemy(e, dmg, false, 'dash');
      }
      // THORNS affix: dashing into the elite reflects a slice of the damage
      if (e.mods.includes('thorns')) {
        g.damagePlayer(Math.max(1, dmg * 0.15), e.x, e.y);
        g.spawnParticleBurst(p.x, p.y, '#ff5c5c', 6, 150, 2.5);
      }
      g.spawnParticleBurst(e.x, e.y, e.def.color, 6, 160, 3);
    }
  }
  // destroy enemy bullets along the dash
  for (const b of g.ebullets) {
    if (Math.hypot(b.x - p.x, b.y - p.y) < 34) {
      b.dead = true;
      g.spawnParticle(b.x, b.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, 0.25, 2.5, '#ff5c8a');
    }
  }
}

export function addHeat(g: Game, amount: number): void {
  const p = g.player;
  if (p.overdrive > 0) return;
  p.heat = clamp(p.heat + amount, 0, 100);
  p.heatIdle = 0;
  if (p.heat >= 100 && p.overdrive <= 0) {
    p.overdrive = 7;
    g.runOverdrive++;
    g.audio.sfx('heatMax');
    g.addText(p.x, p.y - 40, 'OVERDRIVE!', '#ffd94d', 22, true);
    g.shake(6);
    g.flashScreen('#ffd94d', 0.35);
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU;
      g.spawnParticle(p.x, p.y, Math.cos(a) * 240, Math.sin(a) * 240, 0.6, 4, '#ffd94d', 0.94);
    }
    g.spawnShock({
      x: p.x,
      y: p.y,
      r: 10,
      maxR: 220,
      speed: 700,
      life: 0.4,
      maxLife: 0.4,
      color: '#ffd94d',
      width: 4,
      dmg: 0,
      knock: 120,
    });
  }
}

export function breakHeat(g: Game): void {
  const p = g.player;
  if (p.overdrive > 0) {
    p.overdrive = 0;
    g.audio.sfx('odEnd');
  }
  if (p.heat > 25) {
    g.addText(p.x, p.y - 30, 'HEAT BROKEN', '#ff5c5c', 14, true);
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU;
      g.spawnParticle(p.x, p.y, Math.cos(a) * 140, Math.sin(a) * 140, 0.4, 3, '#ff5c5c');
    }
  }
  p.heat = 0;
  p.heatIdle = 0;
}

export function damagePlayer(g: Game, dmg: number, sx: number, sy: number): void {
  const p = g.player;
  if (p.hitInvuln > 0 || p.dashInvuln > 0 || p.hp <= 0) return;
  if (g.godMode) return;
  // Shield Cache barrier: eats the hit whole, keeps heat alive
  if (p.shield > 0) {
    p.shield--;
    p.hitInvuln = 1.1;
    g.audio.sfx('shieldDown');
    g.addText(p.x, p.y - 30, 'BARRIER DOWN', '#9adcff', 15, true);
    g.flashScreen('#9adcff', 0.25);
    g.spawnShock({
      x: p.x,
      y: p.y,
      r: 10,
      maxR: 150,
      speed: 620,
      life: 0.25,
      maxLife: 0.25,
      color: '#9adcff',
      width: 3,
      dmg: 0,
      knock: 180,
    });
    return;
  }
  const real = Math.max(1, Math.round(dmg - p.stats.armor));
  p.hp -= real;
  p.hitInvuln = 0.85;
  p.lastHitT = 0;
  g.waveHits++;
  breakHeat(g);
  g.audio.sfx('hurt');
  g.shake(9);
  g.hitStop = Math.max(g.hitStop, 0.12); // hit-stop tier: getting hurt must be FELT
  g.flashScreen('#ff3d5e', 0.3);
  g.addText(p.x, p.y - 24, `-${real}`, '#ff5c5c', 16, true);
  // knockback away from source
  const dx = p.x - sx;
  const dy = p.y - sy;
  const d = Math.hypot(dx, dy) || 1;
  p.vx += (dx / d) * 320;
  p.vy += (dy / d) * 320;

  if (p.hp <= 0) {
    // phoenix core?
    if (!p.reviveUsed && g.meta.perkTiers('phoenixCore') > 0) {
      p.reviveUsed = true;
      p.hp = Math.ceil(p.maxHp * 0.5);
      p.hitInvuln = 2.2;
      g.audio.sfx('revive');
      g.addText(p.x, p.y - 40, 'PHOENIX PROTOCOL', '#ffd166', 20, true);
      g.flashScreen('#ffd166', 0.6);
      g.spawnShock({
        x: p.x,
        y: p.y,
        r: 10,
        maxR: 420,
        speed: 900,
        life: 0.6,
        maxLife: 0.6,
        color: '#ffd166',
        width: 6,
        dmg: 60,
        knock: 500,
      });
      for (const b of g.ebullets) b.dead = true;
      return;
    }
    g.onPlayerDeath();
  }
}
