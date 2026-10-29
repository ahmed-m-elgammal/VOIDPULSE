// ===== VOIDPULSE :: boss creation & attack patterns =====

import type { Game } from './game';
import type { BossDef, BossState, Enemy } from './types';
import { BOSSES, ENEMIES, MAX_EBULLETS } from './content';
import { TAU } from './utils';

export function createBoss(g: Game, defIndex: number, hpMult: number): Enemy {
  const def = BOSSES[defIndex % BOSSES.length];
  const a = Math.random() * TAU;
  const cx = g.worldW / 2;
  const cy = g.worldH / 2;
  const base: Enemy = {
    eid: g.nextEid(),
    def: {
      ...ENEMIES.drifter,
      id: 'boss',
      name: def.name,
      hp: def.hp * hpMult,
      speed: def.speed,
      radius: def.radius,
      damage: def.damage * g.dmgScale,
      xp: def.xp,
      score: def.score,
      color: def.color,
      glow: def.glow,
      behavior: 'boss',
      shape: 'boss',
      weight: 0,
      unlockWave: 99,
    },
    x: cx + Math.cos(a) * 700,
    y: cy + Math.sin(a) * 700,
    vx: 0,
    vy: 0,
    hp: def.hp * hpMult,
    maxHp: def.hp * hpMult,
    radius: def.radius,
    speed: def.speed,
    damage: def.damage * g.dmgScale,
    xp: def.xp,
    score: def.score,
    elite: false,
    mod: null,
    flash: 0,
    t: 0,
    shootTimer: 999,
    phase: 0,
    slow: 0,
    slowT: 0,
    freezeT: 0,
    stunT: 0,
    knockX: 0,
    knockY: 0,
    spawnT: 0,
    orbHitCd: 0,
    zigPhase: 0,
    rage: 1,
    shieldHits: 0,
    hitCd: new Map<number, number>(),
  };
  const bs: BossState = {
    def,
    cds: {},
    windup: 0,
    windupPattern: '',
    actTimer: 0,
    actPattern: '',
    spiralAngle: 0,
    spiralShots: 0,
    chargeX: 0,
    chargeY: 0,
    blinkT: 0,
    volley: 0,
    volleyTimer: 0,
    phase2: false,
    intro: 2.4,
  };
  for (const pat of def.patterns) {
    bs.cds[pat.id] = pat.firstDelay;
  }
  base.phase = defIndex; // store index for reference
  g.boss = base;
  g.bossState = bs;
  g.enemies.push(base);
  g.audio.sfx('bossRoar');
  g.shake(10);
  g.bossBanner = { name: def.name, title: def.title, t: 3.2, color: def.color };
  return base;
}

function ebullet(g: Game, x: number, y: number, vx: number, vy: number, dmg: number, r = 7): void {
  if (g.ebullets.length >= MAX_EBULLETS) return;
  g.ebullets.push({ x, y, vx, vy, r, dmg, life: 6 });
}

function ring(g: Game, x: number, y: number, count: number, speed: number, dmg: number, offset = 0, r = 7): void {
  for (let i = 0; i < count; i++) {
    const a = offset + (i / count) * TAU;
    ebullet(g, x + Math.cos(a) * 20, y + Math.sin(a) * 20, Math.cos(a) * speed, Math.sin(a) * speed, dmg, r);
  }
}

function fan(g: Game, e: Enemy, aim: number, count: number, spread: number, speed: number, dmg: number): void {
  for (let i = 0; i < count; i++) {
    const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const a = aim + off;
    ebullet(g, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, Math.cos(a) * speed, Math.sin(a) * speed, dmg);
  }
}

export function updateBoss(g: Game, e: Enemy, bs: BossState, dt: number): void {
  const p = g.player;
  e.t += dt;
  e.flash = Math.max(0, e.flash - dt * 8);
  e.freezeT = 0; // bosses immune to freeze
  e.stunT = 0;
  e.slowT = Math.max(0, e.slowT - dt);
  if (e.slowT <= 0) e.slow = 0;
  else e.slow = Math.min(e.slow, 0.35); // bosses cap slow

  if (bs.intro > 0) {
    bs.intro -= dt;
    e.vx = 0;
    e.vy = 0;
    return;
  }

  // phase 2 trigger
  if (!bs.phase2 && e.hp < e.maxHp * 0.45) {
    bs.phase2 = true;
    e.speed = bs.def.speed * 1.25;
    g.audio.sfx('bossRoar');
    g.shake(8);
    g.flashScreen(bs.def.color, 0.4);
    g.addText(e.x, e.y - e.radius - 20, 'ENRAGED', '#ff5c5c', 22, true);
    g.hitStop = 0.12;
  }

  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  const spd = e.speed * (1 - e.slow);

  // --- movement ---
  if (bs.actPattern === 'charge') {
    // charging: move hard toward stored dir
    bs.actTimer -= dt;
    e.vx = bs.chargeX;
    e.vy = bs.chargeY;
    if (bs.actTimer <= 0) {
      bs.actPattern = '';
      e.vx *= 0.2;
      e.vy *= 0.2;
    }
  } else if (bs.actPattern === 'spiral') {
    bs.actTimer -= dt;
    // slow drift while spiraling
    e.vx += (nx * spd * 0.3 - e.vx) * Math.min(1, 3 * dt);
    e.vy += (ny * spd * 0.3 - e.vy) * Math.min(1, 3 * dt);
    // emit spiral bullets
    bs.spiralShots -= dt;
    if (bs.spiralShots <= 0) {
      bs.spiralShots = 0.09;
      const arms = bs.phase2 ? 3 : 2;
      for (let i = 0; i < arms; i++) {
        const a = bs.spiralAngle + (i / arms) * TAU;
        ebullet(g, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, Math.cos(a) * 165, Math.sin(a) * 165, 10 * g.dmgScale, 6);
      }
      bs.spiralAngle += 0.27;
    }
    if (bs.actTimer <= 0) bs.actPattern = '';
  } else if (bs.actPattern === 'blink') {
    // fade out, teleport near player, burst
    bs.actTimer -= dt;
    e.vx = 0;
    e.vy = 0;
    if (bs.actTimer <= 0.15 && bs.blinkT === 0) {
      bs.blinkT = 0.15;
      const a = Math.random() * TAU;
      e.x = p.x + Math.cos(a) * 230;
      e.y = p.y + Math.sin(a) * 230;
      e.x = Math.max(60, Math.min(g.worldW - 60, e.x));
      e.y = Math.max(60, Math.min(g.worldH - 60, e.y));
      ring(g, e.x, e.y, bs.phase2 ? 16 : 12, 210, 11 * g.dmgScale, Math.random() * TAU);
      g.spawnParticleBurst(e.x, e.y, bs.def.color, 24, 260, 3.5);
      g.audio.sfx('explode');
      g.shake(6);
    }
    if (bs.actTimer <= 0) {
      bs.actPattern = '';
      bs.blinkT = 0;
    }
  } else if (bs.def.keep > 0) {
    // keep distance (Matriarch)
    const keep = bs.def.keep;
    let tx: number;
    let ty: number;
    if (d < keep - 50) {
      tx = -nx * spd;
      ty = -ny * spd;
    } else if (d > keep + 80) {
      tx = nx * spd;
      ty = ny * spd;
    } else {
      tx = -ny * spd * 0.8;
      ty = nx * spd * 0.8;
    }
    e.vx += (tx - e.vx) * Math.min(1, 4 * dt);
    e.vy += (ty - e.vy) * Math.min(1, 4 * dt);
  } else {
    // slow relentless pursuit
    e.vx += (nx * spd - e.vx) * Math.min(1, 3 * dt);
    e.vy += (ny * spd - e.vy) * Math.min(1, 3 * dt);
  }

  // telegraph windup
  if (bs.windup > 0) {
    bs.windup -= dt;
    e.vx *= 0.9;
    e.vy *= 0.9;
    if (bs.windup <= 0) executePattern(g, e, bs, bs.windupPattern, nx, ny);
  }

  e.x += (e.vx + e.knockX * 0.25) * dt;
  e.y += (e.vy + e.knockY * 0.25) * dt;
  e.knockX *= Math.pow(0.01, dt);
  e.knockY *= Math.pow(0.01, dt);
  const m = e.radius + 4;
  e.x = Math.max(m, Math.min(g.worldW - m, e.x));
  e.y = Math.max(m, Math.min(g.worldH - m, e.y));

  // contact damage
  if (d < e.radius + p.radius) {
    g.damagePlayer(e.damage, e.x, e.y);
  }

  // --- pattern scheduler ---
  if (bs.windup <= 0 && bs.actPattern === '') {
    for (const pat of bs.def.patterns) {
      if (pat.minHpPct !== undefined && e.hp / e.maxHp > pat.minHpPct) continue;
      bs.cds[pat.id] = (bs.cds[pat.id] ?? 0) - dt;
      if (bs.cds[pat.id] <= 0) {
        bs.cds[pat.id] = pat.cd * (bs.phase2 ? 0.82 : 1);
        // charge needs aim storage at windup time
        if (pat.id === 'charge') {
          bs.chargeX = nx * 640;
          bs.chargeY = ny * 640;
          g.audio.sfx('charge');
          bs.windup = 0.7;
          bs.windupPattern = 'charge';
        } else if (pat.id === 'blink') {
          bs.windup = 0.35;
          bs.windupPattern = 'blink';
          bs.actTimer = 0.5; // fade out then teleport
        } else if (pat.id === 'spiral' || pat.id === 'spiral2') {
          bs.windup = 0.45;
          bs.windupPattern = 'spiral';
          bs.actTimer = 2.4;
          bs.spiralShots = 0;
          bs.spiralAngle = Math.random() * TAU;
        } else {
          bs.windup = 0.5;
          bs.windupPattern = pat.id;
        }
        break;
      }
    }
  }

  // volley sequencing (Matriarch triple burst)
  if (bs.actPattern === 'volley') {
    bs.volleyTimer -= dt;
    if (bs.volleyTimer <= 0) {
      fan(g, e, Math.atan2(dy, dx), 3, 0.24, 235, 10 * g.dmgScale);
      g.audio.sfx('shoot');
      bs.volley--;
      bs.volleyTimer = 0.35;
      if (bs.volley <= 0) bs.actPattern = '';
    }
  }
}

function executePattern(g: Game, e: Enemy, bs: BossState, id: string, nx: number, ny: number): void {
  const p = g.player;
  const dmgS = g.dmgScale;
  switch (id) {
    case 'radial': {
      ring(g, e.x, e.y, 18, 155, 10 * dmgS, Math.random() * TAU);
      g.audio.sfx('nova');
      g.shake(3);
      break;
    }
    case 'radial2': {
      ring(g, e.x, e.y, 14, 175, 9 * dmgS, Math.random() * TAU);
      ring(g, e.x, e.y, 14, 120, 9 * dmgS, Math.random() * TAU);
      g.audio.sfx('nova');
      g.shake(3);
      break;
    }
    case 'fan': {
      fan(g, e, Math.atan2(p.y - e.y, p.x - e.x), 5, 0.22, 250, 11 * dmgS);
      g.audio.sfx('shoot');
      break;
    }
    case 'charge': {
      bs.actPattern = 'charge';
      bs.actTimer = 0.55;
      g.shake(5);
      break;
    }
    case 'spiral': {
      bs.actPattern = 'spiral';
      break;
    }
    case 'spiral2': {
      bs.actPattern = 'spiral';
      break;
    }
    case 'brood': {
      const pods = Math.min(3, 12 - g.enemies.length + 1);
      for (let i = 0; i < pods; i++) {
        const a = Math.random() * TAU;
        const sx = e.x + Math.cos(a) * (e.radius + 30);
        const sy = e.y + Math.sin(a) * (e.radius + 30);
        g.spawnEnemy('sprinter', sx, sy, false);
      }
      g.spawnParticleBurst(e.x, e.y, bs.def.color, 20, 200, 3);
      g.audio.sfx('charge');
      break;
    }
    case 'volley': {
      bs.actPattern = 'volley';
      bs.volley = 3;
      bs.volleyTimer = 0;
      break;
    }
    case 'walls': {
      // 5 quick radial bursts with rotating offset -> moving walls
      const off = Math.random() * TAU;
      for (let wv = 0; wv < 5; wv++) {
        setTimeoutlessWall(g, e, off + wv * 0.18, wv * 0.14, dmgS);
      }
      g.audio.sfx('nova');
      g.shake(4);
      break;
    }
    case 'blink': {
      // handled by act state
      break;
    }
    case 'summon': {
      const count = Math.min(2, 14 - g.enemies.length + 1);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU;
        g.spawnEnemy('orbiter', e.x + Math.cos(a) * (e.radius + 40), e.y + Math.sin(a) * (e.radius + 40), false);
      }
      g.spawnParticleBurst(e.x, e.y, '#ff6d6d', 14, 180, 3);
      g.audio.sfx('charge');
      break;
    }
    default:
      break;
  }
}

function setTimeoutlessWall(g: Game, e: Enemy, offset: number, delay: number, dmgS: number): void {
  // schedule via game's timer list (avoid setTimeout for pause correctness)
  g.delayed.push({
    t: delay,
    fn: () => {
      ring(g, e.x, e.y, 14, 160, 10 * dmgS, offset);
    },
  });
}
