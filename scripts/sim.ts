/**
 * VOIDPULSE headless simulation harness.
 * Runs the real game logic (no renderer) with a simple kiting AI to:
 *  - verify systems run without exceptions across a full run
 *  - check wave/boss/levelup/victory/endless flow
 *  - gather balance data (damage taken, kills, levels)
 *
 * Usage: bun scripts/sim.ts
 */

import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';
import { WEAPONS, EVO_MAP } from '../src/game/content';
import { generateCards } from '../src/game/cards';
import type { CardOption, GameState } from '../src/game/types';
import { COMPANIONS } from '../src/game/companions';
import { RELICS } from '../src/game/relics';
import {
  ASC_NODES,
  ascCostOf,
  ascCoresMult,
  ascLevelOf,
  ascNodeOf,
  computeAscension,
  nodeLocked,
  nodeRank,
} from '../src/game/ascension';

const STEP = 1 / 60;

function cardScore(c: CardOption): number {
  if (c.kind === 'evolve') return 100;
  if (c.kind === 'weapon') {
    const inst = null;
    void inst;
    return c.levelText === 'NEW WEAPON' ? 60 : 70;
  }
  if (c.kind === 'passive') {
    // prefer might/focus/vitality early
    const good = ['might', 'focus', 'vitality', 'capacitor', 'phantom'];
    return c.levelText === 'NEW MODULE' ? (good.includes(c.refId) ? 55 : 30) : good.includes(c.refId) ? 50 : 25;
  }
  if (c.kind === 'heal') return 40;
  return 10;
}

interface RunResult {
  reachedWave: number;
  level: number;
  kills: number;
  score: number;
  hpLeft: number;
  timeSurvived: number;
  deaths: number;
  errors: string[];
}

function runBot(maxSeconds: number, godMode: boolean, playUntilEnd: boolean, verbose: boolean): RunResult {
  const game = new Game(new AudioEngine());
  game.godMode = godMode;
  game.startRun();
  const errors: string[] = [];
  let lastWave = 1;
  let deaths = 0;
  const waveLog: string[] = [];

  const sanity = (label: string) => {
    const p = game.player;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.hp)) {
      errors.push(`NaN at ${label} (wave ${game.wave})`);
    }
    if (game.enemies.length > 320) errors.push(`enemy overflow ${game.enemies.length} at ${label}`);
  };

  let t = 0;
  while (t < maxSeconds) {
    // ------- simple kiting AI -------
    if (game.state === 'playing') {
      const p = game.player;
      // nearest enemy
      let near: { x: number; y: number } | null = null;
      let nd = 1e9;
      for (const e of game.enemies) {
        const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (d < nd) {
          nd = d;
          near = e;
        }
      }
      let mx = 0;
      let my = 0;
      if (near && nd < 260 * 260) {
        // flee
        const d = Math.sqrt(nd) || 1;
        mx = (p.x - near.x) / d;
        my = (p.y - near.y) / d;
      } else if (near) {
        // orbit at distance
        const d = Math.sqrt(nd) || 1;
        const nx = (near.x - p.x) / d;
        const ny = (near.y - p.y) / d;
        mx = -ny * 0.8 + nx * 0.2;
        my = nx * 0.8 + ny * 0.2;
      }
      // steer away from walls
      if (p.x < 220) mx += 0.8;
      if (p.x > game.worldW - 220) mx -= 0.8;
      if (p.y < 220) my += 0.8;
      if (p.y > game.worldH - 220) my -= 0.8;
      game.input.left = mx < -0.25;
      game.input.right = mx > 0.25;
      game.input.up = my < -0.25;
      game.input.down = my > 0.25;
      // dash when crowded
      if (near && nd < 90 * 90 && Math.random() < 0.02) game.input.dash = true;
    } else if (game.state === 'levelup') {
      // pick best card, sometimes reroll
      if (game.rerolls > 0 && Math.random() < 0.25) game.rerollCards();
      let best = 0;
      let bestScore = -1;
      game.cards.forEach((c, i) => {
        const s = cardScore(c);
        if (s > bestScore) {
          bestScore = s;
          best = i;
        }
      });
      game.chooseCard(best);
      if (game.state === 'levelup') errors.push('still in levelup after choosing');
    } else if (game.state === 'relicpick') {
      // wave-3 bargain: grab a random relic and move on
      const n = game.relicChoices.length;
      if (n === 0) errors.push('relicpick with no choices');
      else game.chooseRelic(Math.floor(Math.random() * n));
      if (game.state === 'relicpick') errors.push('still in relicpick after choosing');
    } else if (game.state === 'gameover') {
      break;
    } else if (game.state === 'victory') {
      if (playUntilEnd) {
        game.continueEndless();
      } else break;
    }

    game.update(STEP);
    t += STEP;

    if (game.wave !== lastWave) {
      lastWave = game.wave;
      waveLog.push(
        `  wave ${String(game.wave).padStart(2)} @ ${t.toFixed(0)}s | lvl ${game.player.level} | kills ${game.kills} | score ${Math.floor(game.score)} | hp ${Math.ceil(game.player.hp)}/${game.player.maxHp} | weapons ${game.player.weapons.map((w) => w.id + ':' + w.level).join(',')}`
      );
    }
    if (t % 30 < STEP) sanity(`t=${t.toFixed(0)}`);
    if (game.player.hp <= 0 && game.state === 'playing' && game.deathT <= 0) {
      // dying cinematic ongoing
    }
  }

  const diedInCinematic = game.state === 'gameover';
  if (diedInCinematic) deaths = 1;

  if (verbose) {
    console.log(`--- run (god=${godMode}, max=${maxSeconds}s) ---`);
    for (const line of waveLog) console.log(line);
  }

  return {
    reachedWave: game.wave,
    level: game.player.level,
    kills: game.kills,
    score: Math.floor(game.score),
    hpLeft: Math.max(0, Math.ceil(game.player.hp)),
    timeSurvived: t,
    deaths,
    errors,
  };
}

function testEvolutionAndMaxSystems(): string[] {
  const errors: string[] = [];
  const game = new Game(new AudioEngine());
  game.startRun();
  // force player to have every weapon maxed + evolve all
  const p = game.player;
  p.weapons = Object.values(WEAPONS)
    .filter((w) => !w.isEvolved)
    .map((w) => ({ id: w.id, level: w.maxLevel, timer: 0, angle: 0, t: 0 }));
  for (const [base, evo] of Object.entries(EVO_MAP)) {
    if (evo.req) p.passives[evo.req] = 3;
    // dual paths (glacierFan) rely on the partner weapon being in the maxed set
    const w = p.weapons.find((x) => x.id === base);
    if (!w) {
      errors.push(`missing base weapon ${base}`);
      continue;
    }
    // simulate evolution via card
    game.state = 'levelup';
    game.cards = [
      {
        kind: 'evolve',
        refId: base,
        title: 'x',
        desc: 'x',
        rarity: 'epic',
        levelText: '',
        color: '#fff',
      },
    ];
    game.chooseCard(0);
    if (!p.weapons.some((x) => x.id === evo.into)) {
      errors.push(`evolution ${base} -> ${evo.into} failed`);
    }
  }
  // run 20 seconds of chaos
  game.state = 'playing';
  for (let i = 0; i < 20 * 60; i++) {
    if ((game.state as GameState) === 'levelup') game.chooseCard(0);
    else if ((game.state as GameState) === 'relicpick') game.chooseRelic(0);
    game.update(STEP);
  }
  if (!Number.isFinite(game.score)) errors.push('score NaN in max-systems test');
  return errors;
}

function testRelicsAndDrones(): string[] {
  const errors: string[] = [];
  const game = new Game(new AudioEngine());
  game.meta.data.cores = 100000;
  game.meta.data.prisms = 10000;

  // ---- drone bay: buy + equip through the real market actions ----
  for (const d of COMPANIONS) {
    game.buyCompanion(d.id);
    if (!game.meta.data.companionsOwned.includes(d.id)) errors.push(`failed to buy drone ${d.id}`);
  }
  if (game.meta.data.cores < 0 || game.meta.data.prisms < 0) errors.push('cores/prisms went negative buying drones');
  game.equipCompanion('lumen');
  game.startRun();
  if (!game.companion || game.companion.id !== 'lumen') errors.push('equipped drone did not deploy');

  // ---- relic flow: wave-3 bargain via the real state machine ----
  game.openRelicPick();
  if (game.state !== 'relicpick') errors.push('relicpick state not entered');
  if (game.relicChoices.length !== RELICS.length) errors.push('relic offer count wrong');
  game.chooseRelic(0);
  if (game.state !== 'playing') errors.push('relic choice did not resume play');
  if (!game.relic) errors.push('no relic bound after choice');

  // ---- VAMPIRE SIGIL: kills heal ----
  game.relic = 'vampire';
  game.player.hp = 50;
  const mote = game.spawnEnemy('mote', game.player.x + 60, game.player.y, false);
  if (mote) {
    game.damageEnemy(mote, 9999, false, 'test');
    if (game.player.hp !== 51) errors.push(`vampire heal wrong: ${game.player.hp}`);
  } else errors.push('failed to spawn test mote');

  // ---- OVERCLOCK CORE: fire rate bonus + jam fields exist ----
  game.relic = 'overclock';
  game.recomputeStats();
  if (game.player.stats.fireRateMult < 1.25) errors.push(`overclock fire rate not applied: ${game.player.stats.fireRateMult}`);
  game.relicJamT = 1;
  game.update(1 / 60);
  if (game.relicJamT >= 1) errors.push('jam timer does not tick down');

  // ---- VOID PACT: tighter weapon bay in the card draft ----
  game.relic = 'voidPact';
  game.player.weapons = [
    { id: 'pulse', level: 2, timer: 0, angle: 0, t: 0 },
    { id: 'orbit', level: 2, timer: 0, angle: 0, t: 0 },
    { id: 'arc', level: 2, timer: 0, angle: 0, t: 0 },
    { id: 'nova', level: 2, timer: 0, angle: 0, t: 0 },
    { id: 'seeker', level: 2, timer: 0, angle: 0, t: 0 },
  ];
  game.cards = [];
  const draft = generateCards(game);
  if (draft.some((c) => c.kind === 'weapon' && c.levelText === 'NEW WEAPON')) {
    errors.push('voidPact still offers new weapons past the 5-slot cap');
  }

  // ---- new weapons fire without exploding: force them all + run 10s ----
  game.relic = null;
  game.recomputeStats();
  game.godMode = true;
  game.player.weapons = ['rail', 'tether', 'mirror', 'glacierFan'].map((id) => ({
    id,
    level: WEAPONS[id].maxLevel,
    timer: 0.2,
    angle: 0,
    t: 0,
  }));
  for (let i = 0; i < 10 * 60; i++) {
    if (game.state === 'levelup') game.chooseCard(0);
    else if (game.state === 'relicpick') game.chooseRelic(0);
    game.update(STEP);
  }
  if (!Number.isFinite(game.player.hp) || !Number.isFinite(game.score)) errors.push('NaN in new-weapons soak test');
  return errors;
}

function testMetaAndShop(): string[] {
  const errors: string[] = [];
  const game = new Game(new AudioEngine());
  // fake some cores
  game.meta.data.cores = 10000;
  game.state = 'perks';
  for (const perk of ['powerCore', 'guardCore', 'batteryCore', 'phoenixCore']) {
    game.buyPerk(perk);
    game.buyPerk(perk);
    game.buyPerk(perk);
  }
  if ((game.meta.data.perks.powerCore ?? 0) !== 3) errors.push('powerCore did not reach max tier');
  if (game.meta.data.cores < 0) errors.push('cores went negative');
  // start a run with perks applied
  game.startRun();
  if (game.player.maxHp !== 100 + 45) errors.push(`guardCore hp wrong: ${game.player.maxHp}`);
  if (game.player.dashCharges !== 3) errors.push(`batteryCore dash wrong: ${game.player.dashCharges}`);
  // phoenix revive test
  game.godMode = false;
  game.player.hp = 1;
  game.damagePlayer(50, game.player.x + 10, game.player.y);
  if (game.player.hp <= 0) errors.push('phoenix core failed to revive');
  return errors;
}

function testAscension(): string[] {
  const errors: string[] = [];
  const game = new Game(new AudioEngine());
  const meta = game.meta.data;
  meta.cores = 500000;

  // ---- locked until the first victory ----
  if (computeAscension(meta, false).active) errors.push('ascension active before any win');
  const vanguard = ascNodeOf('vanguard')!;
  const lockedCheck = nodeLocked(meta, vanguard);
  if (!lockedCheck.locked) errors.push('tree nodes not locked before first win');
  game.buyAscension('voidfed');
  if (nodeRank(meta, 'voidfed') !== 0) errors.push('bought a rank while the tree was locked');

  // ---- unlock + buy through the real action path ----
  meta.endlessUnlocked = true;
  game.buyAscension('voidfed');
  if (nodeRank(meta, 'voidfed') !== 1) errors.push(`voidfed rank wrong: ${nodeRank(meta, 'voidfed')}`);
  if (meta.cores <= 0 || meta.cores >= 500000) errors.push('cores not deducted on rank buy');

  // ---- prerequisite gating: barbed needs voidfed lv2, frenzy needs barbed lv2 ----
  const barbed = ascNodeOf('barbed')!;
  if (!nodeLocked(meta, barbed).locked) errors.push('barbed should need voidfed lv2');
  game.buyAscension('voidfed');
  if (nodeRank(meta, 'voidfed') !== 2) errors.push(`voidfed rank 2 wrong: ${nodeRank(meta, 'voidfed')}`);
  if (nodeLocked(meta, barbed).locked) errors.push('barbed still locked with voidfed lv2 met');
  game.buyAscension('barbed');
  if (nodeRank(meta, 'barbed') !== 1) errors.push('barbed rank 1 not bought with prereq met');
  const frenzy = ascNodeOf('frenzy')!;
  if (!nodeLocked(meta, frenzy).locked) errors.push('frenzy should need barbed lv2');
  game.buyAscension('barbed');
  if (nodeLocked(meta, frenzy).locked) errors.push('frenzy still locked with barbed lv2 met');

  // ---- rank caps + empty pockets ----
  for (let i = 0; i < 5; i++) game.buyAscension('vanguard'); // maxRank 2
  if (nodeRank(meta, 'vanguard') !== 2) errors.push(`vanguard cap wrong: ${nodeRank(meta, 'vanguard')}`);
  meta.cores = 0;
  game.buyAscension('frenzy');
  if (nodeRank(meta, 'frenzy') !== 0) errors.push('bought without cores');

  // ---- aggregate math ----
  meta.cores = 1000;
  meta.ascension = { voidfed: 5, barbed: 3, frenzy: 2, swarm: 4, brood: 1, overflow: 2, vanguard: 2, twinAffix: 1, ascendant: 3 };
  const asc = computeAscension(meta, false);
  if (Math.abs(asc.enemyHp - 1.4) > 1e-9) errors.push(`enemyHp mult wrong: ${asc.enemyHp}`);
  if (Math.abs(asc.enemyDmg - 1.18) > 1e-9) errors.push(`enemyDmg mult wrong: ${asc.enemyDmg}`);
  if (Math.abs(asc.bulletSpeed - 1.2) > 1e-9) errors.push(`bulletSpeed mult wrong: ${asc.bulletSpeed}`);
  if (Math.abs(asc.density - 1.32) > 1e-9) errors.push(`density mult wrong: ${asc.density}`);
  if (asc.burstAdd !== 1 || asc.capAdd !== 40) errors.push('burst/cap modifiers wrong');
  if (asc.eliteFloor !== 1 || asc.affixTier !== 1) errors.push('elite floor/affix tier wrong');
  if (Math.abs(asc.bossHpMult - 1.54) > 1e-9) errors.push(`bossHp mult wrong: ${asc.bossHpMult}`);
  if (Math.abs(asc.coresMult - ascCoresMult(23)) > 1e-9 || asc.level !== 23) errors.push('level/cores mult wrong');

  // ---- daily breach stays clean ----
  const dailyAsc = computeAscension(meta, true);
  if (dailyAsc.active || dailyAsc.enemyHp !== 1) errors.push('daily breach should ignore ascension');

  // ---- in-run application: enemies actually tougher, payout multiplied ----
  game.startRun();
  const m1 = game.spawnEnemy('mote', game.player.x + 50, game.player.y, false);
  const hpWith = m1 ? m1.maxHp : -1;
  game.asc = { ...computeAscension(meta, false), active: false };
  game.asc.enemyHp = 1;
  const m2 = game.spawnEnemy('mote', game.player.x + 50, game.player.y + 80, false);
  const hpWithout = m2 ? m2.maxHp : -1;
  if (Math.abs(hpWith / hpWithout - 1.4) > 1e-6) errors.push(`spawnEnemy hp mult wrong: ${hpWith}/${hpWithout}`);
  if (game.maxEnemies !== 300 + 40) errors.push(`cap add wrong: ${game.maxEnemies}`);

  // ---- cores payout: run finalize multiplies by the tree ----
  game.asc.coresMult = 2.38; // lv 23 tree
  game.score = 100000;
  game.wave = 10;
  game.bossKills = 2;
  game.kills = 500;
  game.runMaxCombo = 0;
  (game as unknown as { finalizeRun: (won: boolean) => void }).finalizeRun(true);
  const baseCores = Math.floor(100000 / 1000) + 10 * 3 + 2 * 30;
  const expected = Math.round(baseCores * 2.38);
  if (game.coresEarned !== expected) errors.push(`ascension payout wrong: ${game.coresEarned} vs ${expected}`);
  if (meta.wins < 1) errors.push('finalizeRun did not count the win');

  // ---- costs curve: strictly increasing, round to 5 ----
  for (const node of ASC_NODES) {
    let prev = 0;
    for (let r = 0; r < node.maxRank; r++) {
      const c = ascCostOf(node, r);
      if (c <= prev || c % 5 !== 0) errors.push(`cost curve bad for ${node.id} at rank ${r}: ${c}`);
      prev = c;
    }
  }

  // ---- level counter sanity ----
  if (ascLevelOf(meta) !== 23) errors.push(`ascLevelOf wrong: ${ascLevelOf(meta)}`);
  return errors;
}

// ================= main =================
console.log('VOIDPULSE headless simulation\n');

console.log('TEST 1: systems maxed + evolutions');
const e1 = testEvolutionAndMaxSystems();
console.log(e1.length ? e1.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

console.log('\nTEST 2: meta shop + perks + phoenix revive');
const e2 = testMetaAndShop();
console.log(e2.length ? e2.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

console.log('\nTEST 2.5: relics + drone bay (v1.3)');
const e25 = testRelicsAndDrones();
console.log(e25.length ? e25.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

console.log('\nTEST 2.6: ascension tree (v1.4)');
const e26 = testAscension();
console.log(e26.length ? e26.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

console.log('\nTEST 3: full god run to wave 15 + victory + endless');
const r3 = runBot(60 * 22, true, true, true);
console.log(`  reached wave ${r3.reachedWave}, lvl ${r3.level}, kills ${r3.kills}, errors: ${r3.errors.length}`);
if (r3.errors.length) console.log(r3.errors.map((e) => '  FAIL: ' + e).join('\n'));

console.log('\nTEST 4: bot survival runs (balance sample, n=5)');
const results: RunResult[] = [];
for (let i = 0; i < 5; i++) {
  const r = runBot(60 * 25, false, false, false);
  results.push(r);
  console.log(
    `  run ${i + 1}: wave ${r.reachedWave} | lvl ${r.level} | kills ${r.kills} | score ${r.score} | ${r.timeSurvived.toFixed(0)}s ${r.deaths ? '(died)' : '(alive at cutoff)'} err:${r.errors.length}`
  );
  if (r.errors.length) console.log(r.errors.slice(0, 3).map((e) => '    FAIL: ' + e).join('\n'));
}
const avgWave = results.reduce((a, r) => a + r.reachedWave, 0) / results.length;
const avgLevel = results.reduce((a, r) => a + r.level, 0) / results.length;
console.log(`\n  avg wave reached: ${avgWave.toFixed(1)} | avg level: ${avgLevel.toFixed(1)}`);

console.log('\nDone.');
