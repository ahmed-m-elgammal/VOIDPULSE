// ===== VOIDPULSE :: level-up card draft =====

import type { Game } from './game';
import type { CardOption } from './types';
import { PASSIVES, WEAPONS, EVO_MAP } from './content';
import { shuffle } from './utils';

const MAX_WEAPONS = 6;
const MAX_PASSIVE_KINDS = 7;

export function generateCards(g: Game): CardOption[] {
  const p = g.player;
  const candidates: CardOption[] = [];
  // v1.3 VOID PACT relic: tighter weapon bay, wider module rack
  const maxWeapons = g.relic === 'voidPact' ? MAX_WEAPONS - 1 : MAX_WEAPONS;
  const maxPassives = g.relic === 'voidPact' ? MAX_PASSIVE_KINDS + 1 : MAX_PASSIVE_KINDS;

  // evolutions (highest priority, epic)
  for (const w of p.weapons) {
    const evo = EVO_MAP[w.id];
    if (evo && w.level >= WEAPONS[w.id].maxLevel) {
      if (evo.reqWeapon) {
        // dual path: needs its partner weapon at the listed level (GLACIER FAN)
        const partner = p.weapons.find((x) => x.id === evo.reqWeapon);
        if (!partner || partner.level < (evo.reqWeaponLevel ?? 1)) continue;
      } else {
        const passiveLv = p.passives[evo.req ?? ''] ?? 0;
        if (passiveLv < 2) continue;
      }
      const into = WEAPONS[evo.into];
      candidates.push({
        kind: 'evolve',
        refId: w.id,
        title: `EVOLVE: ${into.name}`,
        desc: into.desc,
        rarity: 'epic',
        levelText: evo.reqWeapon ? 'DUAL EVOLUTION' : 'WEAPON EVOLUTION',
        color: into.color,
      });
    }
  }

  // weapon upgrades
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (!def.isEvolved && w.level < def.maxLevel) {
      candidates.push({
        kind: 'weapon',
        refId: w.id,
        title: def.name,
        desc: def.levelDesc(w.level + 1),
        rarity: 'rare',
        levelText: `Lv ${w.level} → ${w.level + 1}`,
        color: def.color,
      });
    }
  }

  // new weapons
  if (p.weapons.length < maxWeapons) {
    for (const def of Object.values(WEAPONS)) {
      if (def.isEvolved) continue;
      if (p.weapons.some((w) => w.id === def.id)) continue;
      candidates.push({
        kind: 'weapon',
        refId: def.id,
        title: def.name,
        desc: def.desc,
        rarity: 'rare',
        levelText: 'NEW WEAPON',
        color: def.color,
      });
    }
  }

  // passive upgrades / new passives
  const ownedKinds = Object.keys(p.passives).length;
  for (const def of Object.values(PASSIVES)) {
    const lv = p.passives[def.id] ?? 0;
    if (lv > 0 && lv < def.maxLevel) {
      candidates.push({
        kind: 'passive',
        refId: def.id,
        title: def.name,
        desc: def.levelDesc(lv + 1),
        rarity: 'common',
        levelText: `Lv ${lv} → ${lv + 1}`,
        color: def.color,
      });
    } else if (lv === 0 && ownedKinds < maxPassives) {
      candidates.push({
        kind: 'passive',
        refId: def.id,
        title: def.name,
        desc: def.desc,
        rarity: 'common',
        levelText: 'NEW MODULE',
        color: def.color,
      });
    }
  }

  // heal option when hurt
  if (p.hp < p.maxHp * 0.75) {
    candidates.push({
      kind: 'heal',
      refId: 'heal',
      title: 'Patch Kit',
      desc: 'Restore 35% hull integrity. Sometimes survival is the upgrade.',
      rarity: 'common',
      levelText: 'REPAIR',
      color: '#ff6d8c',
    });
  }

  // dedupe by kind+refId
  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    const key = c.kind + ':' + c.refId;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // pick: prioritize evolutions always, then weighted random
  const evos = unique.filter((c) => c.kind === 'evolve');
  const rest = shuffle(
    unique.filter((c) => c.kind !== 'evolve'),
    Math.random
  );

  const out: CardOption[] = [];
  for (const e of evos) {
    if (out.length < 3) out.push(e);
  }
  // weight newer content: new weapons early, upgrades later — simple shuffle is fine
  for (const c of rest) {
    if (out.length >= 3) break;
    out.push(c);
  }

  // fallback
  while (out.length < 3) {
    out.push({
      kind: 'scrap',
      refId: 'scrap',
      title: 'Salvage Cache',
      desc: '+150 score and restore 8 hull. The void provides.',
      rarity: 'common',
      levelText: 'BONUS',
      color: '#9aa8c0',
    });
  }
  return out;
}

export function applyCard(g: Game, card: CardOption): void {
  const p = g.player;
  switch (card.kind) {
    case 'weapon': {
      const existing = p.weapons.find((w) => w.id === card.refId);
      if (existing) {
        existing.level = Math.min(WEAPONS[card.refId].maxLevel, existing.level + 1);
      } else {
        const inst = { id: card.refId, level: 1, timer: 0.4, angle: Math.random() * Math.PI * 2, t: 0 };
        p.weapons.push(inst);
      }
      g.audio.sfx('select');
      break;
    }
    case 'evolve': {
      const idx = p.weapons.findIndex((w) => w.id === card.refId);
      if (idx >= 0) {
        const evo = EVO_MAP[card.refId];
        if (evo) {
          p.weapons[idx] = { id: evo.into, level: 1, timer: 0.3, angle: p.weapons[idx].angle, t: 0 };
          g.runEvolutions++; // feeds the TRANSCENDENT achievement chain
          g.flashScreen(WEAPONS[evo.into].color, 0.5);
          g.addText(p.x, p.y - 50, `${WEAPONS[evo.into].name}`, WEAPONS[evo.into].color, 20, true);
          g.shake(5);
          // evolution = the biggest moment in a run: hit-stop tier + burst
          g.hitStop = Math.max(g.hitStop, 0.22);
          g.spawnParticleBurst(p.x, p.y, WEAPONS[evo.into].color, 34, 300, 4, 0.93);
          g.spawnShock({
            x: p.x,
            y: p.y,
            r: 10,
            maxR: 180,
            speed: 560,
            life: 0.32,
            maxLife: 0.32,
            color: WEAPONS[evo.into].color,
            width: 4,
            dmg: 0,
            knock: 140,
          });
        }
      }
      g.audio.sfx('levelup');
      break;
    }
    case 'passive': {
      p.passives[card.refId] = (p.passives[card.refId] ?? 0) + 1;
      g.recomputeStats();
      g.audio.sfx('select');
      break;
    }
    case 'heal': {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.35);
      g.audio.sfx('pickupHeal');
      break;
    }
    case 'scrap': {
      g.score += 150;
      p.hp = Math.min(p.maxHp, p.hp + 8);
      g.audio.sfx('select');
      break;
    }
  }
}
