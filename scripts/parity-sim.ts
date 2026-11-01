/**
 * VOIDPULSE — parity simulation (MOBILE_PARITY_PLAN.md §3, P0 exit test).
 *
 * Drives the REAL core through two mounts with IDENTICAL deterministic
 * input policies and asserts the timelines are identical:
 *   A) raw core  — new Game(new AudioEngine()) + bot input (sim.ts style)
 *   B) mobile    — mobile/src/bridge runtime (the shell's mount)
 *
 * Determinism is injected TEST-SIDE: the core seeds its run RNG from
 * Date.now() and still has stray Math.random() calls (P1 migrates both to
 * the seeded rng), so this harness pins both to a fixed LCG per run.
 * Any divergence = the mobile shell is not running the same game. Exit 1.
 *
 * Usage: bun scripts/parity-sim.ts
 */

import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';
// Mobile mount — the bridge is DOM-free by design (see MOBILE_PARITY_PLAN §1.1)
import { createRuntime, rt, setStick, syncInput, syncFlow, startRun as mobileStartRun } from '../mobile/src/bridge';

// ---- determinism injection (test-side) ----
const FIXED_EPOCH = 1735689600000; // 2025-01-01 — stable anchor
let lcg = 1;
function pinDeterminism(seed: number): void {
  lcg = seed >>> 0;
  (Date as unknown as { now: () => number }).now = () => FIXED_EPOCH;
  Math.random = () => {
    lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0;
    return lcg / 4294967296;
  };
}

const STEP = 1 / 60;
const RUN_SECONDS = 240; // 4 minutes per mount — crosses waves, bosses, relics
const SAMPLE_EVERY = 60; // 1s

interface Sample {
  wave: number;
  level: number;
  kills: number;
  score: number;
  hp: number;
}

function sampleOf(g: Game): Sample {
  return {
    wave: g.wave,
    level: g.player.level,
    kills: g.kills,
    score: Math.floor(g.score),
    hp: Math.ceil(g.player.hp),
  };
}

/** Deterministic input policy: NO Math.random — kiting bot (sim.ts logic). */
function driveInput(g: Game): void {
  if (g.state !== 'playing') return;
  const p = g.player;
  let nearX = 0, nearY = 0, nd = 1e9;
  for (let i = 0; i < g.enemies.length; i++) {
    const e = g.enemies[i];
    const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d < nd) { nd = d; nearX = e.x; nearY = e.y; }
  }
  let mx = 0, my = 0;
  if (nd < 260 * 260) {
    const d = Math.sqrt(nd) || 1;
    mx = (p.x - nearX) / d;
    my = (p.y - nearY) / d;
  } else if (nd < 1e9) {
    const d = Math.sqrt(nd) || 1;
    const nx = (nearX - p.x) / d;
    const ny = (nearY - p.y) / d;
    mx = -ny * 0.8 + nx * 0.2;
    my = nx * 0.8 + ny * 0.2;
  }
  if (p.x < 220) mx += 0.8;
  if (p.x > g.worldW - 220) mx -= 0.8;
  if (p.y < 220) my += 0.8;
  if (p.y > g.worldH - 220) my -= 0.8;
  g.input.left = mx < -0.25;
  g.input.right = mx > 0.25;
  g.input.up = my < -0.25;
  g.input.down = my > 0.25;
  // dash when crowded — deterministic (no random)
  g.input.dash = nd < 90 * 90 && g.player.dashCharges > 0 && (Math.floor(g.time * 60) % 180 === 0);
}

/** Deterministic card policy: evolve > weapon(new) > good passive > heal. */
function cardScore(c: { kind: string; levelText: string; refId: string }): number {
  if (c.kind === 'evolve') return 100;
  if (c.kind === 'weapon') return c.levelText === 'NEW WEAPON' ? 60 : 70;
  if (c.kind === 'passive') {
    const good = ['might', 'focus', 'vitality', 'capacitor', 'phantom'];
    return c.levelText === 'NEW MODULE' ? (good.includes(c.refId) ? 55 : 30) : good.includes(c.refId) ? 50 : 25;
  }
  if (c.kind === 'heal') return 40;
  return 10;
}

function driveStates(g: Game): void {
  if (g.state === 'levelup') {
    let best = 0, bestScore = -1;
    for (let i = 0; i < g.cards.length; i++) {
      const s = cardScore(g.cards[i]);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    g.chooseCard(best);
  } else if (g.state === 'relicpick') {
    g.chooseRelic(0); // deterministic: first relic
  } else if (g.state === 'victory') {
    g.continueEndless();
  }
}

function runRawCore(): Sample[] {
  pinDeterminism(0xc0ffee);
  const game = new Game(new AudioEngine());
  game.startRun();
  const samples: Sample[] = [];
  for (let t = 0; t < RUN_SECONDS * 60; t++) {
    driveStates(game);
    driveInput(game);
    game.update(STEP);
    if (t % SAMPLE_EVERY === 0) samples.push(sampleOf(game));
    if (game.state === 'gameover') break;
  }
  return samples;
}

function runMobileMount(): Sample[] {
  pinDeterminism(0xc0ffee); // identical seed → identical core RNG + Math.random stream
  createRuntime();
  mobileStartRun();
  const g = rt.game;
  const samples: Sample[] = [];
  for (let t = 0; t < RUN_SECONDS * 60; t++) {
    driveStates(g);
    if (g.state === 'playing') {
      driveInput(g);
      // through the shell's own input bridge (same values → same booleans)
      setStick(
        (g.input.left ? -1 : 0) + (g.input.right ? 1 : 0),
        (g.input.up ? -1 : 0) + (g.input.down ? 1 : 0),
      );
      syncInput();
    }
    g.update(STEP);
    syncFlow(); // shell flow hooks are null-safe: rt.flow unset in headless → skipped
    if (t % SAMPLE_EVERY === 0) samples.push(sampleOf(g));
    if (g.state === 'gameover') break;
  }
  return samples;
}

// ---------------------------------------------------------------- main
console.log('VOIDPULSE parity simulation — raw core vs mobile mount');
console.log('  run length: ' + RUN_SECONDS + 's · samples every ' + (SAMPLE_EVERY / 60) + 's');

const a = runRawCore();
console.log('  core  mount: ' + a.length + ' samples · wave ' + a[a.length - 1].wave + ' · kills ' + a[a.length - 1].kills + ' · score ' + a[a.length - 1].score);

const b = runMobileMount();
console.log('  mobile mount: ' + b.length + ' samples · wave ' + b[b.length - 1].wave + ' · kills ' + b[b.length - 1].kills + ' · score ' + b[b.length - 1].score);

let mismatches = 0;
const n = Math.min(a.length, b.length);
for (let i = 0; i < n; i++) {
  const sa = a[i], sb = b[i];
  if (sa.wave !== sb.wave || sa.level !== sb.level || sa.kills !== sb.kills
    || sa.score !== sb.score || sa.hp !== sb.hp) {
    if (mismatches < 8) {
      console.log('  MISMATCH @' + i + 's · core ' + JSON.stringify(sa) + ' vs mobile ' + JSON.stringify(sb));
    }
    mismatches++;
  }
}

if (a.length !== b.length || mismatches > 0) {
  console.log('FAIL — ' + mismatches + ' mismatched samples (' + a.length + ' vs ' + b.length + ')');
  process.exit(1);
}
console.log('OK — timelines identical (' + n + ' samples). Mobile runs the real game.');
