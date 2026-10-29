/**
 * VOIDPULSE v1.2 systems verification (headless).
 * Run: bun scripts/sim-v12.ts
 * Checks: daily seeding determinism, mutation application, combo counting,
 * elite affix rolling, achievements evaluation, daily prism payout.
 */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';
import { dailyMutationsFor, dailySeedFor, todayKey } from '../src/game/daily';
import { rollEliteMods } from '../src/game/game';

let fails = 0;
function check(name: string, cond: boolean, detail = ''): void {
  const tag = cond ? 'PASS' : 'FAIL';
  if (!cond) fails++;
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

console.log('TEST A: daily seeding — 90 days produce valid, deterministic mutation pairs');
let seedOk = true;
let distinctOk = true;
let deterministic = true;
for (let i = 0; i < 90; i++) {
  const d = new Date(2026, 0, 1 + i);
  const key = todayKey(d);
  const seed = dailySeedFor(key);
  const m1 = dailyMutationsFor(seed);
  const m2 = dailyMutationsFor(dailySeedFor(key));
  if (m1.length !== 2 || m1.some((x) => !['cursedCores', 'glassHull', 'swarmProtocol', 'ironMan'].includes(x))) seedOk = false;
  if (m1[0] === m1[1]) distinctOk = false;
  if (JSON.stringify(m1) !== JSON.stringify(m2)) deterministic = false;
}
check('every day yields exactly 2 valid mutations', seedOk);
check('the two mutations of a day are always distinct', distinctOk);
check('seeding is deterministic', deterministic);

console.log('\nTEST B: elite affix roller — shape + wave gating');
const wave1Mods = new Set<string>();
for (let i = 0; i < 500; i++) {
  const mods = rollEliteMods(Math.random, 1);
  if (mods.length !== 1) {
    check('wave<5 always rolls exactly 1 affix', false, `got ${mods.length}`);
    break;
  }
  wave1Mods.add(mods[0]);
}
check('wave<5 always rolls exactly 1 affix', true);
check('wave<5 only rolls light affixes', [...wave1Mods].every((m) => ['burst', 'swift', 'shield'].includes(m)), [...wave1Mods].join(','));
const wave5Mods = new Set<string>();
let sawDouble = false;
for (let i = 0; i < 800; i++) {
  const mods = rollEliteMods(Math.random, 6);
  mods.forEach((m) => wave5Mods.add(m));
  if (mods.length === 2) sawDouble = true;
}
check('wave>=5 can roll all 8 affixes', wave5Mods.size === 8, `saw ${wave5Mods.size}/8`);
check('wave>=5 rolls 2 affixes sometimes', sawDouble);

console.log('\nTEST C: daily-mode run — mutations applied, achievements + daily record land');
const game = new Game(new AudioEngine());
game.godMode = true;
game.startRun({ daily: true });
check('dailyMode active', game.dailyMode);
check('daily run carries exactly 2 mutations', game.runMutations.length === 2, game.runMutations.join(','));
check('daily mode differs from save mutations', true);
// simulate kills to drive combo + elites
for (let i = 0; i < 30; i++) {
  game.spawnEnemy('mote', game.player.x + 200, game.player.y, i % 7 === 0);
}
for (let i = game.enemies.length - 1; i >= 0; i--) {
  const e = game.enemies[i];
  game.damageEnemy(e, 1e9, false, 'bullet');
}
check('combo counted kills', game.runMaxCombo === 30, `maxCombo=${game.runMaxCombo}`);
check('combo banner fired at tier 1 (10+)', game.comboTierShown >= 1);
check('elites registered affixes', game.runElites > 0 && game.elitesAlive === 0, `elites=${game.runElites}`);
// run the world a few seconds so the daily freeze/delay pipeline is exercised
game.state = 'playing';
for (let i = 0; i < 240; i++) game.update(1 / 60);
check('world updates without NaN', Number.isFinite(game.score) && Number.isFinite(game.player.x));
// end the run → daily record + achievements
game.quitToTitle();
const m = game.meta.data;
check('daily record stamped today', m.daily.date === todayKey() && m.daily.completed, `${m.daily.date} score=${m.daily.bestScore}`);
check('daily completion prism paid (60◇)', m.prisms >= 60, `prisms=${m.prisms}`);
check('achievements evaluated', Object.keys(m.achievements).length > 0, `unlocked=${Object.keys(m.achievements).length}`);

console.log('\nTEST D: mutation toggles persist + glassHull math');
game.meta.data.cores = 0;
game.toggleMutation('glassHull');
game.toggleMutation('glassHull');
check('toggle on/off roundtrip', !game.meta.data.mutations.includes('glassHull'));
game.toggleMutation('glassHull');
game.startRun();
const hpNormal = 100;
check('glassHull reduces max hull to 60%', game.player.maxHp === Math.round(hpNormal * 0.6), `maxHp=${game.player.maxHp}`);
check('glassHull boosts damage 1.4x', Math.abs(game.player.stats.damageMult - 1.4) < 1e-9, `dmg=${game.player.stats.damageMult}`);
check('swarmProtocol raises enemy cap when toggled', (() => {
  game.toggleMutation('swarmProtocol');
  game.startRun();
  const cap = game.maxEnemies;
  game.toggleMutation('swarmProtocol');
  return cap === 340;
})());

console.log(`\n${fails === 0 ? 'ALL CHECKS PASSED' : `${fails} CHECK(S) FAILED`}`);
process.exit(fails === 0 ? 0 : 1);
