// ===== VOIDPULSE :: v1.3 companions — market drones =====
// Bought once in the BLACK MARKET drone bay, deployed one at a time.
// Drones are not targetable: enemies only ever hunt the player hull.

import type { CompanionDef, Enemy } from './types';
import type { Game } from './game';
import { TAU } from './utils';

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'magnetite',
    name: 'MAGNETITE',
    desc: 'Tractor drone — reels in every shard near its ring.',
    color: '#7dffd4',
    currency: 'cores',
    price: 550,
  },
  {
    id: 'lumen',
    name: 'LUMEN',
    desc: 'Attack drone — zaps the nearest hostile every 3s.',
    color: '#ffe066',
    currency: 'cores',
    price: 850,
  },
  {
    id: 'aegis',
    name: 'AEGIS',
    desc: 'Guard drone — raises a 1-hit barrier at each wave start.',
    color: '#9adcff',
    currency: 'prisms',
    price: 60,
  },
];

export function companionOf(id: string | null | undefined): CompanionDef | null {
  if (!id) return null;
  return COMPANIONS.find((c) => c.id === id) ?? null;
}

function nearestHostile(g: Game, x: number, y: number, maxD: number): Enemy | null {
  let best: Enemy | null = null;
  let bd = maxD * maxD;
  for (const e of g.enemies) {
    if (e.hp <= 0 || e.spawnT > 0 || e.ghostT > 0) continue;
    const d = (e.x - x) * (e.x - x) + (e.y - y) * (e.y - y);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

/** Spring-follow + per-drone behavior. AEGIS re-arms in waves.startWave. */
export function updateCompanion(g: Game, dt: number): void {
  const c = g.companion;
  if (!c) return;
  const def = companionOf(c.id);
  if (!def) return;
  const p = g.player;

  // lazy orbit trail: settle into a slow ring just behind the hull
  c.angle = (c.angle + dt * 1.05) % TAU;
  const tx = p.x + Math.cos(c.angle) * 34;
  const ty = p.y + Math.sin(c.angle) * 34 - 16;
  c.vx += ((tx - c.x) * 10 - c.vx * 4) * dt;
  c.vy += ((ty - c.y) * 10 - c.vy * 4) * dt;
  c.x += c.vx * dt;
  c.y += c.vy * dt;

  if (c.id === 'magnetite') {
    c.timer -= dt;
    if (c.timer <= 0) {
      c.timer = 0.45;
      for (const gem of g.gems) {
        if (gem.dead || gem.magnet) continue;
        if (Math.hypot(gem.x - c.x, gem.y - c.y) < 250) {
          gem.magnet = true;
          g.spawnParticle(gem.x, gem.y, 0, -34, 0.3, 2, def.color);
        }
      }
    }
  } else if (c.id === 'lumen') {
    c.timer -= dt;
    if (c.timer <= 0) {
      const tgt = nearestHostile(g, c.x, c.y, 460);
      if (tgt) {
        c.timer = 3.0;
        const dmg = (14 + g.wave * 1.3) * p.stats.damageMult;
        g.damageEnemy(tgt, dmg, false, 'companion');
        g.spawnArc(c.x, c.y, tgt.x, tgt.y, def.color);
        g.spawnParticleBurst(tgt.x, tgt.y, def.color, 4, 120, 2);
        g.audio.sfx('arc', 0.2, 1.18);
      } else {
        c.timer = 0.4;
      }
    }
  }
}
