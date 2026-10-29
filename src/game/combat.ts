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
  const nb = g.bulletPool.acquire();
  nb.x = 0;
  nb.y = 0;
  nb.vx = 0;
  nb.vy = 0;
  nb.r = 5;
  nb.dmg = 10;
  nb.pierce = 0;
  nb.life = 2;
  nb.kind = 'pulse';
  nb.crit = false;
  nb.homing = 0;
  nb.aoe = 0;
  nb.angle = 0;
  nb.trailT = 0;
  nb.tgtEid = undefined;
  nb.retargetT = undefined;
  nb.dead = false;
  Object.assign(nb, b);
  g.bullets.push(nb);
}

/** iterate live enemies near (x,y) within r — grid-backed when the swarm is big */
function forEnemiesNear(g: Game, x: number, y: number, r: number, cb: (e: Enemy) => void): void {
  if (g.enemies.length <= 50) {
    for (const e of g.enemies) {
      if (e.hp <= 0) continue;
      cb(e);
    }
    return;
  }
  const cell = 64;
  const c0x = Math.floor((x - r) / cell);
  const c1x = Math.floor((x + r) / cell);
  const c0y = Math.floor((y - r) / cell);
  const c1y = Math.floor((y + r) / cell);
  for (let gx = c0x; gx <= c1x; gx++) {
    for (let gy = c0y; gy <= c1y; gy++) {
      const arr = g.enemyGrid.get(gx + gy * 4096);
      if (!arr) continue;
      for (const e of arr) {
        if (e.hp <= 0) continue;
        cb(e);
      }
    }
  }
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
              g.spawnArc(from.x, from.y, src.x, src.y, def.color);
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
            g.spawnShock({
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
        forEnemiesNear(g, p.x, p.y, R + 40, (e) => {
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
        });
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
          forEnemiesNear(g, bx, by, 44, (e) => {
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
          });
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
    // homing — cached target (eid-validated, rebuilt every frame) cuts
    // nearest-enemy scans by ~10x without changing behavior
    if (b.homing > 0) {
      let t: Enemy | null | undefined;
      b.retargetT = (b.retargetT ?? 0) - dt;
      if (b.tgtEid !== undefined) t = g.enemyById.get(b.tgtEid);
      if (!t || t.hp <= 0 || t.spawnT > 0 || t.ghostT > 0 || b.retargetT <= 0) {
        t = nearestEnemy(g, b.x, b.y, 420);
        b.tgtEid = t?.eid;
        b.retargetT = 0.12;
      }
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
          if (e.hp <= 0 || e.spawnT > 0 || e.ghostT > 0) continue;
          const rr = e.radius + b.r;
          const dx = e.x - b.x;
          const dy = e.y - b.y;
          if (dx * dx + dy * dy <= rr * rr) {
            // shield affix: blocks the first projectile hits
            if (e.mods.includes('shield') && e.shieldHits > 0 && b.kind !== 'lance') {
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
              // aoe splash (grid-backed)
              forEnemiesNear(g, b.x, b.y, b.aoe + 34, (e2) => {
                if (e2 === e) return;
                const d = Math.hypot(e2.x - b.x, e2.y - b.y);
                if (d < b.aoe + e2.radius) {
                  g.damageEnemy(e2, b.dmg * 0.6, false, 'aoe');
                }
              });
              g.spawnShock({
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
  sweepDead(g.bullets, (b) => g.bulletPool.release(b));
}

export function updateEBullets(g: Game, dt: number): void {
  const p = g.player;
  for (const b of g.ebullets) {
    b.life -= dt;
    if (b.life <= 0) {
      b.dead = true;
      continue;
    }
    if (b.telegraph !== undefined) b.telegraph = Math.max(0, b.telegraph - dt);
    // leviathan proximity mine: static, arms, then detonates when approached
    if (b.mine) {
      if ((b.armT ?? 0) > 0) {
        b.armT = (b.armT ?? 0) - dt;
      } else {
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        if (dx * dx + dy * dy < 78 * 78) {
          b.dead = true;
          // detonation: burst of shrapnel + shockwave
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * TAU + Math.random();
            if (g.ebullets.length < MAX_EBULLETS) {
              g.spawnEBullet({
                x: b.x,
                y: b.y,
                vx: Math.cos(a) * 210,
                vy: Math.sin(a) * 210,
                r: 5,
                dmg: b.dmg * 0.6,
                life: 3,
              });
            }
          }
          g.spawnShock({
            x: b.x,
            y: b.y,
            r: 6,
            maxR: 120,
            speed: 640,
            life: 0.22,
            maxLife: 0.22,
            color: '#3dffb8',
            width: 4,
            dmg: 0,
            knock: 260,
          });
          const d2 = Math.hypot(dx, dy);
          if (d2 < 110) g.damagePlayer(b.dmg, b.x, b.y);
          g.audio.sfx('explode', 0.2);
          g.spawnParticleBurst(b.x, b.y, '#3dffb8', 18, 260, 3);
          g.shake(4);
          continue;
        }
      }
      continue; // mines never move or collide while planted
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
  sweepDead(g.ebullets, (b) => g.ebulletPool.release(b));
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

    // phantom intangibility: no damage, no contact, slow drift
    const wasGhost = e.ghostT > 0;
    e.ghostT = Math.max(0, e.ghostT - dt);
    if (wasGhost && e.ghostT <= 0 && e.def.behavior === 'phase') {
      // re-materialize with a snap toward the player
      const tx = p.x - e.x;
      const ty = p.y - e.y;
      const td = Math.hypot(tx, ty) || 1;
      const hop = Math.min(260, Math.max(120, td - 140));
      e.x = Math.max(24, Math.min(g.worldW - 24, e.x + (tx / td) * hop));
      e.y = Math.max(24, Math.min(g.worldH - 24, e.y + (ty / td) * hop));
      g.spawnParticleBurst(e.x, e.y, e.def.color, 14, 200, 3);
      g.audio.sfx('freeze', 0.3);
    }
    if (e.ghostT > 0) {
      e.vx *= Math.pow(0.02, dt);
      e.vy *= Math.pow(0.02, dt);
      applyKnock(g, e, dt);
      continue;
    }

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = dx / d;
    const ny = dy / d;
    const spd = e.speed * (1 - e.slow) * e.rage;

    // ---- v1.2 elite affix behaviors (per-frame) ----
    if (e.elite && e.mods.length > 0) {
      // VAMPIRIC: pulses regeneration into nearby allies
      if (e.mods.includes('vampiric')) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 2.2;
          let healed = 0;
          for (const ally of g.enemies) {
            if (ally === e || ally.dead || ally.hp <= 0 || ally.spawnT > 0) continue;
            if (ally.def.behavior === 'boss') continue;
            if (Math.hypot(ally.x - e.x, ally.y - e.y) < 220 && ally.hp < ally.maxHp) {
              ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.04);
              healed++;
              if (healed <= 3) g.spawnParticle(ally.x, ally.y - ally.radius, 0, -40, 0.5, 2.5, '#ff4d7e');
            }
          }
          if (healed > 0) {
            g.spawnShock({
              x: e.x,
              y: e.y,
              r: 8,
              maxR: 220,
              speed: 480,
              life: 0.3,
              maxLife: 0.3,
              color: '#ff4d7e',
              width: 2,
              dmg: 0,
              knock: 0,
            });
          }
        }
      }
      // FROST AURA: chills the player while inside its radius
      if (e.mods.includes('frostAura') && d < 155) {
        g.playerChillT = 0.15; // refreshed every frame; updatePlayer reads it
      }
    }

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
      case 'volatile': {
        // bomber: chase, arm fuse up close, detonate (explosion handled on death)
        e.vx += (nx * spd - e.vx) * Math.min(1, 7 * dt);
        e.vy += (ny * spd - e.vy) * Math.min(1, 7 * dt);
        if (e.fuseT < 0 && d < 150) {
          e.fuseT = 1.0;
          g.audio.sfx('charge', 0.4);
        }
        if (e.fuseT >= 0) {
          e.fuseT -= dt;
          e.vx *= 1.35;
          e.vy *= 1.35;
          if (e.fuseT <= 0) {
            g.damageEnemy(e, 1e9, false, 'fuse');
            continue;
          }
        }
        break;
      }
      case 'sniper': {
        // lancer: holds far range while its heavy bolt charges
        const keep = e.def.shoot?.keep ?? 520;
        const strafe = ((e.eid % 2) * 2 - 1) * 0.5;
        let tx2: number;
        let ty2: number;
        if (d < keep - 60) {
          tx2 = -nx * spd;
          ty2 = -ny * spd;
        } else if (d > keep + 120) {
          tx2 = nx * spd * 0.8;
          ty2 = ny * spd * 0.8;
        } else {
          tx2 = -ny * spd * strafe;
          ty2 = nx * spd * strafe;
        }
        e.vx += (tx2 - e.vx) * Math.min(1, 4 * dt);
        e.vy += (ty2 - e.vy) * Math.min(1, 4 * dt);
        break;
      }
      case 'mender': {
        // healer: hangs back, pulses regeneration into nearby allies
        const keep2 = 330;
        let tx3: number;
        let ty3: number;
        if (d < keep2 - 60) {
          tx3 = -nx * spd;
          ty3 = -ny * spd;
        } else if (d > keep2 + 100) {
          tx3 = nx * spd;
          ty3 = ny * spd;
        } else {
          tx3 = -ny * spd * 0.6;
          ty3 = nx * spd * 0.6;
        }
        e.vx += (tx3 - e.vx) * Math.min(1, 4 * dt);
        e.vy += (ty3 - e.vy) * Math.min(1, 4 * dt);
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = 1.2;
          let healed = 0;
          for (const ally of g.enemies) {
            if (ally === e || ally.dead || ally.hp <= 0 || ally.spawnT > 0) continue;
            if (ally.def.behavior === 'boss') continue;
            const ad = Math.hypot(ally.x - e.x, ally.y - e.y);
            if (ad < 270 && ally.hp < ally.maxHp) {
              ally.hp = Math.min(ally.maxHp, ally.hp + ally.maxHp * 0.05);
              healed++;
              if (healed <= 3 && Math.random() < 0.5) {
                g.spawnParticle(ally.x, ally.y - ally.radius, 0, -40, 0.5, 2.5, '#6dffb0');
              }
            }
          }
          if (healed > 0) {
            g.spawnShock({
              x: e.x,
              y: e.y,
              r: 8,
              maxR: 270,
              speed: 520,
              life: 0.32,
              maxLife: 0.32,
              color: '#6dffb0',
              width: 2.5,
              dmg: 0,
              knock: 0,
            });
            g.audio.sfx('pickup', 0.5);
          }
        }
        break;
      }
      case 'phase': {
        // phantom: stalks, then slips out of reality
        e.phaseT += dt;
        if (e.phaseT >= 3.2 && e.ghostT <= 0) {
          e.phaseT = 0;
          e.ghostT = 0.7;
          g.spawnParticleBurst(e.x, e.y, e.def.color, 10, 140, 2.5);
        }
        e.vx += (nx * spd - e.vx) * Math.min(1, 6 * dt);
        e.vy += (ny * spd - e.vy) * Math.min(1, 6 * dt);
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
  // NOTE: dead enemies are swept + released at frame end in game.update —
  // releasing mid-frame could recycle an object still referenced by the grid
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
    g.spawnEBullet({
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
        if (e.hp <= 0 || e.spawnT > 0 || e.ghostT > 0 || s.hitIds.has(e.eid)) continue;
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
  sweepDead(g.shockwaves, (s) => g.shockPool.release(s));
}

// ---------------- gems ----------------

export function spawnGem(g: Game, x: number, y: number, value: number, kind: 'xp' | 'heal' | 'core'): void {
  const a = Math.random() * TAU;
  const gem = g.gemPool.acquire();
  gem.x = x;
  gem.y = y;
  gem.vx = Math.cos(a) * 90;
  gem.vy = Math.sin(a) * 90;
  gem.value = value;
  gem.kind = kind;
  gem.t = 0;
  gem.magnet = false;
  gem.dead = false;
  g.gems.push(gem);
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
        g.runHeals++;
        g.audio.sfx('pickupHeal');
        g.addText(p.x, p.y - 30, `+${Math.round(heal)} HULL`, '#ff6d8c', 14, true);
        g.spawnParticleBurst(gem.x, gem.y, '#ff6d8c', 10, 130, 3);
      }
    }
  }
  sweepDead(g.gems, (gem) => g.gemPool.release(gem));
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
    if (pt.kind === 'gib') pt.rot = (pt.rot ?? 0) + (pt.vrot ?? 0) * dt;
  }
  sweepDead(g.particles, (p) => g.particlePool.release(p));

  for (const t of g.texts) {
    t.life -= dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.vy *= Math.pow(0.3, dt);
    t.vx *= Math.pow(0.2, dt);
    if (t.life <= 0) t.dead = true;
  }
  sweepDead(g.texts, (t) => g.textPool.release(t));

  for (const a of g.arcs) {
    a.life -= dt;
    if (a.life <= 0) a.dead = true;
  }
  sweepDead(g.arcs, (a) => g.arcPool.release(a));

  for (const af of g.afterimages) {
    af.life -= dt;
    if (af.life <= 0) af.dead = true;
  }
  sweepDead(g.afterimages, (af) => g.afterimagePool.release(af));
}

// ---------------- enemy spatial grid ----------------

export function rebuildGrid(g: Game): void {
  // recycle cell arrays to kill per-frame allocation churn
  for (const arr of g.enemyGrid.values()) g.gridPool.push(arr);
  g.enemyGrid.clear();
  g.enemyById.clear();
  const cell = 64;
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    g.enemyById.set(e.eid, e);
    const key = Math.floor(e.x / cell) + Math.floor(e.y / cell) * 4096;
    let arr = g.enemyGrid.get(key);
    if (!arr) {
      arr = g.gridPool.pop() ?? [];
      arr.length = 0;
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
