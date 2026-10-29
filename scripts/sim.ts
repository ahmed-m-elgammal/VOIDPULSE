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
import type { CardOption } from '../src/game/types';

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
    p.passives[evo.req] = 3;
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
    if (game.state === 'levelup') game.chooseCard(0);
    game.update(STEP);
  }
  if (!Number.isFinite(game.score)) errors.push('score NaN in max-systems test');
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

// ================= main =================
console.log('VOIDPULSE headless simulation\n');

console.log('TEST 1: systems maxed + evolutions');
const e1 = testEvolutionAndMaxSystems();
console.log(e1.length ? e1.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

console.log('\nTEST 2: meta shop + perks + phoenix revive');
const e2 = testMetaAndShop();
console.log(e2.length ? e2.map((e) => '  FAIL: ' + e).join('\n') : '  OK');

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
