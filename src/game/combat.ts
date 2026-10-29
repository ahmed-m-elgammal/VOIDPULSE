// ===== VOIDPULSE :: combat systems (weapons / bullets / collisions / gems) =====

import type { Game } from './game';
import type { Bullet, Enemy, WeaponInstance } from './types';
import { TAU, sweepDead, clamp } from './utils';
import { MAX_EBULLETS, WEAPONS } from './content';

// ---------------- weapon firing ----------------

function nearestEnemy(g: Game, x: number, y: number, maxD: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxD * maxD;
  for (const e of g.enemies) {
    if (e.spawnT > 0 || e.hp <= 0) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

function newBullet(g: Game, b: Partial<Bullet>): void {
  g.bullets.push({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    r: 5,
    dmg: 10,
    pierce: 0,
    life: 2,
    kind: 'pulse',
    crit: false,
    homing: 0,
    aoe: 0,
    angle: 0,
    trailT: 0,
    ...b,
  });
}

/** aim at predicted intercept position (iterative lead) */
function leadAim(g: Game, target: Enemy, fromX: number, fromY: number, bulletSpeed: number): number {
  let t = 0;
  for (let i = 0; i < 3; i++) {
    const px = target.x + target.vx * t;
    const py = target.y + target.vy * t;
    t = Math.hypot(px - fromX, py - fromY) / bulletSpeed;
  }
  const fx = target.x + target.vx * t;
  const fy = target.y + target.vy * t;
  return Math.atan2(fy - fromY, fx - fromX);
}

function rollCrit(g: Game): boolean {
  return Math.random() < g.player.stats.critChance;
}

export function fireWeapons(g: Game, dt: number): void {
  const p = g.player;
  if (p.hp <= 0) return;
  const od = p.overdrive > 0;
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def) continue;
    const st = def.stats(w.level);
    const target = nearestEnemy(g, p.x, p.y, 760);

    switch (def.kind) {
      case 'pulse': {
        w.timer -= dt;
        if (w.timer <= 0 && target) {
          const baseCd = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
          w.timer = baseCd;
          const aim = leadAim(g, target, p.x, p.y, st.bspeed ?? 600);
          const n = st.count ?? 1;
          for (let i = 0; i < n; i++) {
            const off = n === 1 ? 0 : (i - (n - 1) / 2) * 0.12;
            const a = aim + off;
            const crit = rollCrit(g);
            newBullet(g, {
              x: p.x + Math.cos(a) * 16,
              y: p.y + Math.sin(a) * 16,
              vx: Math.cos(a) * st.bspeed!,
              vy: Math.sin(a) * st.bspeed!,
              r: 4.5,
              dmg: st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
              crit,
              pierce: st.pierce ?? 0,
              life: 1.5,
              kind: 'pulse',
              homing: 3.4,
              angle: a,
            });
          }
          g.audio.sfx('shoot', 0.08);
        } else if (w.timer <= 0) {
          w.timer = 0.12; // no target: retry soon
        }
        break;
      }
      case 'lance': {
        w.timer -= dt;
        if (w.timer <= 0 && target) {
          w.timer = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
          const aim = leadAim(g, target, p.x, p.y, st.bspeed ?? 1500);
          const crit = rollCrit(g);
          newBullet(g, {
            x: p.x,
            y: p.y,
            vx: Math.cos(aim) * st.bspeed!,
            vy: Math.sin(aim) * st.bspeed!,
            r: 8,
            dmg: st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
            crit,
            pierce: st.pierce ?? 99,
            life: 1.2,
            kind: 'lance',
            angle: aim,
          });
          g.shake(2.5);
          g.audio.sfx('lance');
        } else if (w.timer <= 0) {
          w.timer = 0.1;
        }
        break;
      }
      case 'seeker': {
        w.timer -= dt;
        if (w.timer <= 0 && target) {
          w.timer = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
          const n = st.count ?? 1;
          for (let i = 0; i < n; i++) {
            const a = Math.random() * TAU;
            const crit = rollCrit(g);
            newBullet(g, {
              x: p.x + Math.cos(a) * 12,
              y: p.y + Math.sin(a) * 12,
              vx: Math.cos(a) * 120,
              vy: Math.sin(a) * 120,
              r: 4,
              dmg: st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
              crit,
              life: 3.2,
              kind: 'seeker',
              homing: 4.6,
              aoe: st.aoe ?? 0,
              angle: a,
            });
          }
          g.audio.sfx('seeker');
        } else if (w.timer <= 0) {
          w.timer = 0.15;
        }
        break;
      }
      case 'scatter': {
        w.timer -= dt;
        if (w.timer <= 0 && target) {
          w.timer = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
          const aim = leadAim(g, target, p.x, p.y, st.bspeed ?? 550);
          const n = st.count ?? 1;
          for (let i = 0; i < n; i++) {
            const a = aim + (Math.random() - 0.5) * (st.spread ?? 0.4) * 2;
            const crit = rollCrit(g);
            newBullet(g, {
              x: p.x + Math.cos(a) * 14,
              y: p.y + Math.sin(a) * 14,
              vx: Math.cos(a) * st.bspeed!,
              vy: Math.sin(a) * st.bspeed!,
              r: 3.5,
              dmg: st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
              crit,
              life: 0.55,
              kind: 'scatter',
              angle: a,
            });
          }
          g.audio.sfx('scatter');
          g.shake(1);
        } else if (w.timer <= 0) {
          w.timer = 0.12;
        }
        break;
      }
      case 'arc': {
        w.timer -= dt;
        if (w.timer <= 0) {
          const first = nearestEnemy(g, p.x, p.y, 340);
          if (first) {
            w.timer = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
            const chains = st.chains ?? 2;
            let src = first;
            const hit = new Set<number>();
            for (let c = 0; c <= chains; c++) {
              if (!src) break;
              hit.add(src.eid);
              const crit = rollCrit(g);
              const dmg = st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1);
              // arc visual from previous point (player for first)
              const from =
                c === 0
                  ? { x: p.x, y: p.y - 10 }
                  : (() => {
                      const prev = g.arcs[g.arcs.length - 1];
                      return prev ? { x: prev.x2, y: prev.y2 } : { x: p.x, y: p.y };
                    })();
              g.arcs.push({
                x: from.x,
                y: from.y,
                x2: src.x,
                y2: src.y,
                life: 0.14,
                maxLife: 0.14,
                color: def.color,
                seed: Math.random() * 1000,
              });
              g.damageEnemy(src, dmg, crit, 'arc');
              if ((st.stun ?? 0) > 0 && Math.random() < (st.stun ?? 0)) {
                src.stunT = Math.max(src.stunT, 0.8);
              }
              // find next chain target
              let next: Enemy | null = null;
              let nd = 180 * 180;
              for (const e of g.enemies) {
                if (e.hp <= 0 || e.spawnT > 0 || hit.has(e.eid)) continue;
                const d = (e.x - src.x) * (e.x - src.x) + (e.y - src.y) * (e.y - src.y);
                if (d < nd) {
                  nd = d;
                  next = e;
                }
              }
              src = next as Enemy;
            }
            g.audio.sfx('arc');
          } else {
            w.timer = 0.15;
          }
        }
        break;
      }
      case 'nova': {
        w.timer -= dt;
        if (w.timer <= 0) {
          const anyNear = g.enemies.length > 0;
          if (anyNear) {
            w.timer = st.cd / p.stats.fireRateMult / (od ? 1.3 : 1);
            const R = (st.radius ?? 120) * p.stats.areaMult;
            g.shockwaves.push({
              x: p.x,
              y: p.y,
              r: 14,
              maxR: R,
              speed: R / 0.28,
              life: 0.34,
              maxLife: 0.34,
              color: def.color,
              width: 7,
              dmg: st.dmg * p.stats.damageMult * (od ? 1.5 : 1),
              knock: st.knock ?? 280,
              hitIds: new Set<number>(),
            });
            g.audio.sfx('nova');
            g.shake(3);
          } else {
            w.timer = 0.2;
          }
        }
        break;
      }
      case 'frost': {
        // aura — damage ticks + slow; handled here per-frame
        const R = (st.radius ?? 100) * p.stats.areaMult;
        w.timer -= dt;
        const doTick = w.timer <= 0;
        if (doTick) w.timer = st.cd;
        for (const e of g.enemies) {
          if (e.hp <= 0 || e.spawnT > 0) continue;
          const d = Math.hypot(e.x - p.x, e.y - p.y);
          if (d < R + e.radius) {
            if (e.slowT <= 0 || e.slow < (st.slow ?? 0.3)) e.slow = st.slow ?? 0.3;
            e.slowT = 0.4;
            if ((st.freeze ?? 0) > 0 && Math.random() < (st.freeze ?? 0) * dt * 8 && e.freezeT <= 0 && !e.elite && !e.def.behavior.includes('boss')) {
              e.freezeT = 1.1;
              g.audio.sfx('freeze');
            }
            if (doTick) {
              const crit = rollCrit(g);
              g.damageEnemy(
                e,
                st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
                crit,
                'frost',
                true
              );
            }
          }
        }
        break;
      }
      case 'orbit': {
        // blades orbit; contact damage with per-enemy cooldown
        const R = (st.radius ?? 80) * p.stats.areaMult;
        const rot = st.rot ?? 3;
        w.angle = (w.angle + rot * dt) % TAU;
        const n = st.count ?? 1;
        for (let i = 0; i < n; i++) {
          const a = w.angle + (i / n) * TAU;
          const bx = p.x + Math.cos(a) * R;
          const by = p.y + Math.sin(a) * R;
          for (const e of g.enemies) {
            if (e.hp <= 0 || e.spawnT > 0) continue;
            const d = Math.hypot(e.x - bx, e.y - by);
            if (d < e.radius + 9 && e.orbHitCd <= 0) {
              e.orbHitCd = st.cd ?? 0.45;
              const crit = rollCrit(g);
              g.damageEnemy(
                e,
                st.dmg * p.stats.damageMult * (od ? 1.5 : 1) * (crit ? p.stats.critMult : 1),
                crit,
                'orbit'
              );
            }
          }
        }
        break;
      }
    }
  }
}

// ---------------- bullets update + collisions ----------------

export function updateBullets(g: Game, dt: number): void {
  const grid = g.enemyGrid;

  for (const b of g.bullets) {
    b.life -= dt;
    if (b.life <= 0) {
      b.dead = true;
      continue;
    }
    // homing
    if (b.homing > 0) {
      const t = nearestEnemy(g, b.x, b.y, 420);
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        const cur = Math.atan2(b.vy, b.vx);
        let diff = want - cur;
        while (diff > Math.PI) diff -= TAU;
        while (diff < -Math.PI) diff += TAU;
        const turn = clamp(diff, -b.homing * dt, b.homing * dt);
        const sp = Math.hypot(b.vx, b.vy);
        const na = cur + turn;
        b.vx = Math.cos(na) * sp;
        b.vy = Math.sin(na) * sp;
        b.angle = na;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // out of world
    if (b.x < -40 || b.y < -40 || b.x > g.worldW + 40 || b.y > g.worldH + 40) {
      b.dead = true;
      continue;
    }

    // trail sparks for seekers/lance
    b.trailT -= dt;
    if (b.trailT <= 0 && (b.kind === 'seeker' || b.kind === 'lance')) {
      b.trailT = 0.03;
      g.spawnParticle(b.x, b.y, 0, 0, 0.22, b.kind === 'lance' ? 4 : 2.5, b.crit ? '#ffe066' : '#4de8ff');
    }

    // collide with enemies via grid
    const cell = 64;
    const cx = Math.floor(b.x / cell);
    const cy = Math.floor(b.y / cell);
    for (let gx = cx - 1; gx <= cx + 1 && !b.dead; gx++) {
      for (let gy = cy - 1; gy <= cy + 1 && !b.dead; gy++) {
        const arr = grid.get(gx + gy * 4096);
        if (!arr) continue;
        for (const e of arr) {
          if (e.hp <= 0 || e.spawnT > 0) continue;
          const rr = e.radius + b.r;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy <= rr * rr) {
            // shield mod: blocks first hits
            if (e.mod === 'shield' && e.shieldHits > 0 && b.kind !== 'lance') {
              e.shieldHits--;
              g.spawnParticleBurst(b.x, b.y, '#9adcff', 4, 120, 2.5);
              b.dead = true;
              g.audio.sfx('hit');
              break;
            }
            g.damageEnemy(e, b.dmg, b.crit, 'bullet');
            g.spawnParticleBurst(b.x, b.y, b.crit ? '#ffe066' : '#bfefff', 4, 130, 2.5);
            g.audio.sfx('hit');
            if (b.aoe > 0) {
              // aoe splash
              for (const e2 of g.enemies) {
                if (e2 === e || e2.hp <= 0) continue;
                const d = Math.hypot(e2.x - b.x, e2.y - b.y);
                if (d < b.aoe + e2.radius) {
                  g.damageEnemy(e2, b.dmg * 0.6, false, 'aoe');
                }
              }
              g.shockwaves.push({
                x: b.x,
                y: b.y,
                r: 6,
                maxR: b.aoe + 14,
                speed: b.aoe / 0.12,
                life: 0.18,
                maxLife: 0.18,
                color: '#ffd166',
                width: 3,
                dmg: 0,
                knock: 0,
                hitIds: new Set<number>(),
              });
              b.dead = true;
              break;
            }
            if (b.pierce > 0) {
              b.pierce--;
            } else {
              b.dead = true;
              break;
            }
          }
        }
      }
    }
  }
  sweepDead(g.bullets);
}

export function updateEBullets(g: Game, dt: number): void {
  const p = g.player;
  for (const b of g.ebullets) {
    b.life -= dt;
    if (b.life <= 0) {
      b.dead = true;
      continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -60 || b.y < -60 || b.x > g.worldW + 60 || b.y > g.worldH + 60) {
      b.dead = true;
      continue;
    }
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const rr = p.radius + b.r;
    if (dx * dx + dy * dy <= rr * rr) {
      b.dead = true;
      g.damagePlayer(b.dmg, b.x, b.y);
    }
  }
  sweepDead(g.ebullets);
}

// ---------------- enemy behavior + separation ----------------

export function updateEnemies(g: Game, dt: number): void {
  const p = g.player;
  for (const e of g.enemies) {
    if (e.dead || e.hp <= 0) continue;
    e.t += dt;
    e.flash = Math.max(0, e.flash - dt * 8);
    e.orbHitCd = Math.max(0, e.orbHitCd - dt);
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      continue;
    }
    if (e.slowT > 0) {
      e.slowT -= dt;
      if (e.slowT <= 0) e.slow = 0;
    }
    e.freezeT = Math.max(0, e.freezeT - dt);
    e.stunT = Math.max(0, e.stunT - dt);

    if (e.freezeT > 0 || e.stunT > 0) {
      e.vx = 0;
      e.vy = 0;
      // frozen/stunned: skip movement but keep separation
      applyKnock(g, e, dt);
      continue;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const spd = e.speed * (1 - e.slow) * e.rage;

    switch (e.def.behavior) {
      case 'chase':
      case 'splitter':
      case 'pod': {
        e.vx += (nx * spd - e.vx) * Math.min(1, 6 * dt);
        e.vy += (ny * spd - e.vy) * Math.min(1, 6 * dt);
        break;
      }
      case 'zigzag': {
        e.zigPhase += dt * 7;
        const perp = Math.sin(e.zigPhase) * 0.65;
        const tx = (nx * Math.cos(perp) - ny * Math.sin(perp)) * spd;
        const ty = (nx * Math.sin(perp) + ny * Math.cos(perp)) * spd;
        e.vx += (tx - e.vx) * Math.min(1, 8 * dt);
        e.vy += (ty - e.vy) * Math.min(1, 8 * dt);
        break;
      }
      case 'keepaway': {
        // enraged keepers abandon distance and charge
        if (e.rage > 1.05) {
          e.vx += (nx * spd - e.vx) * Math.min(1, 6 * dt);
          e.vy += (ny * spd - e.vy) * Math.min(1, 6 * dt);
          break;
        }
        const keep = e.def.shoot?.keep ?? 280;
        const strafe = ((e.eid % 2) * 2 - 1) * (0.55 + Math.sin(e.t * 0.9 + e.zigPhase) * 0.45);
        let tx: number;
        let ty: number;
        if (d < keep - 40) {
          tx = -nx * spd;
          ty = -ny * spd;
        } else if (d > keep + 90) {
          tx = nx * spd;
          ty = ny * spd;
        } else {
          tx = -ny * spd * strafe;
          ty = nx * spd * strafe;
        }
        e.vx += (tx - e.vx) * Math.min(1, 5 * dt);
        e.vy += (ty - e.vy) * Math.min(1, 5 * dt);
        break;
      }
      case 'orbit': {
        // enraged orbs abandon orbit and dive
        if (e.rage > 1.05) {
          e.vx += (nx * spd - e.vx) * Math.min(1, 6 * dt);
          e.vy += (ny * spd - e.vy) * Math.min(1, 6 * dt);
          break;
        }
        const keep = e.def.shoot?.keep ?? 210;
        const tang = ((e.eid % 2) * 2 - 1) * spd;
        const rad = (keep - d) * 1.6;
        const tx = -ny * tang + nx * clamp(rad, -spd, spd);
        const ty = nx * tang + ny * clamp(rad, -spd, spd);
        e.vx += (tx - e.vx) * Math.min(1, 5 * dt);
        e.vy += (ty - e.vy) * Math.min(1, 5 * dt);
        break;
      }
      default:
        break;
    }

    applyKnock(g, e, dt);

    // shooting
    if (e.def.shoot && e.shootTimer > 0) {
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < e.def.shoot.range) {
        e.shootTimer = e.def.shoot.cd * (0.85 + Math.random() * 0.3);
        enemyShoot(g, e, Math.atan2(dy, dx));
      }
    }

    // contact damage
    const rr = e.radius + p.radius;
    if (d < rr && e.spawnT <= 0) {
      g.damagePlayer(e.damage, e.x, e.y);
      // small push apart
      e.knockX -= nx * 120 * (1 - (e.def.knockResist ?? 0));
      e.knockY -= ny * 120 * (1 - (e.def.knockResist ?? 0));
    }
  }
  sweepDead(g.enemies);
}

function applyKnock(g: Game, e: Enemy, dt: number): void {
  e.x += (e.vx + e.knockX) * dt;
  e.y += (e.vy + e.knockY) * dt;
  e.knockX *= Math.pow(0.0025, dt);
  e.knockY *= Math.pow(0.0025, dt);
  const m = e.radius + 4;
  if (e.x < m) {
    e.x = m;
    e.knockX = Math.abs(e.knockX) * 0.5;
  }
  if (e.x > g.worldW - m) {
    e.x = g.worldW - m;
    e.knockX = -Math.abs(e.knockX) * 0.5;
  }
  if (e.y < m) {
    e.y = m;
    e.knockY = Math.abs(e.knockY) * 0.5;
  }
  if (e.y > g.worldH - m) {
    e.y = g.worldH - m;
    e.knockY = -Math.abs(e.knockY) * 0.5;
  }
}

function enemyShoot(g: Game, e: Enemy, aim: number): void {
  if (g.ebullets.length >= MAX_EBULLETS) return;
  const s = e.def.shoot!;
  for (let i = 0; i < s.count; i++) {
    const off = s.count === 1 ? 0 : (i - (s.count - 1) / 2) * s.spread;
    const a = aim + off;
    g.ebullets.push({
      x: e.x + Math.cos(a) * (e.radius + 4),
      y: e.y + Math.sin(a) * (e.radius + 4),
      vx: Math.cos(a) * s.speed,
      vy: Math.sin(a) * s.speed,
      r: 6,
      dmg: s.dmg * g.dmgScale,
      life: 5,
    });
  }
  g.spawnParticleBurst(e.x, e.y, e.def.color, 3, 80, 2);
}

// ---------------- shockwaves ----------------

export function updateShocks(g: Game, dt: number): void {
  for (const s of g.shockwaves) {
    s.life -= dt;
    s.r += s.speed * dt;
    if (s.life <= 0 || s.r >= s.maxR) {
      s.dead = true;
      continue;
    }
    if (s.dmg > 0) {
      for (const e of g.enemies) {
        if (e.hp <= 0 || e.spawnT > 0 || s.hitIds.has(e.eid)) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < s.r + e.radius && d > s.r - 40 - e.radius) {
          s.hitIds.add(e.eid);
          g.damageEnemy(e, s.dmg, false, 'shock');
          if (s.knock > 0) {
            const nx = (e.x - s.x) / (d || 1);
            const ny = (e.y - s.y) / (d || 1);
            const resist = e.def.knockResist ?? 0;
            e.knockX += nx * s.knock * (1 - resist);
            e.knockY += ny * s.knock * (1 - resist);
          }
        }
      }
    } else if (s.knock > 0) {
      for (const e of g.enemies) {
        if (s.hitIds.has(e.eid)) continue;
        const d = Math.hypot(e.x - s.x, e.y - s.y);
        if (d < s.r + e.radius) {
          s.hitIds.add(e.eid);
          const nx = (e.x - s.x) / (d || 1);
          const ny = (e.y - s.y) / (d || 1);
          e.knockX += nx * s.knock;
          e.knockY += ny * s.knock;
        }
      }
    }
  }
  sweepDead(g.shockwaves);
}

// ---------------- gems ----------------

export function spawnGem(g: Game, x: number, y: number, value: number, kind: 'xp' | 'heal' | 'core'): void {
  const a = Math.random() * TAU;
  g.gems.push({
    x,
    y,
    vx: Math.cos(a) * 90,
    vy: Math.sin(a) * 90,
    value,
    kind,
    t: 0,
    magnet: false,
  });
}

export function updateGems(g: Game, dt: number): void {
  const p = g.player;
  const mag = p.stats.magnetRadius;
  for (const gem of g.gems) {
    gem.t += dt;
    const dx = p.x - gem.x;
    const dy = p.y - gem.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < mag || gem.magnet) {
      gem.magnet = true;
      const pull = 340 + (mag - Math.min(d, mag)) * 2;
      gem.vx += (dx / d) * pull * dt * 8;
      gem.vy += (dy / d) * pull * dt * 8;
    }
    gem.vx *= Math.pow(0.14, dt);
    gem.vy *= Math.pow(0.14, dt);
    gem.x += gem.vx * dt;
    gem.y += gem.vy * dt;
    if (d < p.radius + 14) {
      gem.dead = true;
      if (gem.kind === 'xp') {
        g.gainXp(gem.value);
        g.audio.sfx('pickup', 0.14);
        g.spawnParticleBurst(gem.x, gem.y, '#6dff8c', 3, 90, 2);
      } else if (gem.kind === 'heal') {
        const heal = Math.min(gem.value, p.maxHp - p.hp);
        p.hp += heal;
        g.audio.sfx('pickupHeal');
        g.addText(p.x, p.y - 30, `+${Math.round(heal)} HULL`, '#ff6d8c', 14, true);
        g.spawnParticleBurst(gem.x, gem.y, '#ff6d8c', 10, 130, 3);
      }
    }
  }
  sweepDead(g.gems);
}

// ---------------- particles / texts / arcs ----------------

export function updateParticles(g: Game, dt: number): void {
  for (const pt of g.particles) {
    pt.life -= dt;
    if (pt.life <= 0) {
      pt.dead = true;
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    const dr = Math.pow(pt.drag, dt);
    pt.vx *= dr;
    pt.vy *= dr;
  }
  sweepDead(g.particles);

  for (const t of g.texts) {
    t.life -= dt;
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.3, dt);
    if (t.life <= 0) t.dead = true;
  }
  sweepDead(g.texts);

  for (const a of g.arcs) {
    a.life -= dt;
    if (a.life <= 0) a.dead = true;
  }
  sweepDead(g.arcs);

  for (const af of g.afterimages) {
    af.life -= dt;
    if (af.life <= 0) af.dead = true;
  }
  sweepDead(g.afterimages);
}

// ---------------- enemy spatial grid ----------------

export function rebuildGrid(g: Game): void {
  g.enemyGrid.clear();
  const cell = 64;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const key = Math.floor(e.x / cell) + Math.floor(e.y / cell) * 4096;
    let arr = g.enemyGrid.get(key);
    if (!arr) {
      arr = [];
      g.enemyGrid.set(key, arr);
    }
    arr.push(e);
  }
}

/** soft separation so enemies don't stack */
export function separateEnemies(g: Game, dt: number): void {
  const cell = 64;
  const map = g.enemyGrid;
  for (const e of g.enemies) {
    if (e.spawnT > 0) continue;
    const cx = Math.floor(e.x / cell);
    const cy = Math.floor(e.y / cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const arr = map.get(gx + gy * 4096);
        if (!arr) continue;
        for (const o of arr) {
          if (o.eid <= e.eid || o.spawnT > 0) continue;
          const dx = o.x - e.x;
          const dy = o.y - e.y;
          const rr = e.radius + o.radius;
          const d2 = dx * dx + dy * dy;
          if (d2 < rr * rr && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = ((rr - d) / rr) * 260 * dt;
            const nx = dx / d;
            const ny = dy / d;
            const eRes = e.def.knockResist ?? 0;
            const oRes = o.def.knockResist ?? 0;
            e.x -= nx * push * (1 - eRes * 0.8);
            e.y -= ny * push * (1 - eRes * 0.8);
            o.x += nx * push * (1 - oRes * 0.8);
            o.y += ny * push * (1 - oRes * 0.8);
          }
        }
      }
    }
  }
}

// ---------------- weapon instance helper ----------------

export function makeWeaponInstance(id: string): WeaponInstance {
  return { id, level: 1, timer: 0.4, angle: Math.random() * TAU, t: 0 };
}
