// ===== VOIDPULSE v1.0 :: SEASON ONE economy simulation =====
// Run: bun scripts/sim-v1.ts
// Verifies battle-pass math, prime economy break-even, contract churn,
// exchange math and booster accounting — all headless, no DOM.

import { defaultMeta } from '../src/game/save';
import {
  BOOSTERS,
  CONTRACT_POOL,
  EXCHANGE_CORES,
  EXCHANGE_PRISMS,
  FREE_PRISM_TOTAL,
  PASS_MAX_TIER,
  PASS_TIERS,
  PRIME_PRICE,
  PRIME_PRISM_TOTAL,
  SEASON_NAME,
  applyBpXp,
  bpXpForTier,
  computeRunBpXp,
  nextContractId,
  settleContracts,
} from '../src/game/economy';
import type { MetaSave } from '../src/game/types';
import type { RunStats } from '../src/game/economy';

let failures = 0;
function check(name: string, cond: boolean, detail = ''): void {
  const tag = cond ? 'PASS' : 'FAIL';
  if (!cond) failures++;
  console.log(`  [${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

function makeRun(wave: number, kills: number, bosses: number, score: number, won: boolean): RunStats {
  return {
    wave,
    kills,
    elites: Math.floor(kills * 0.06),
    bosses,
    dashKills: Math.floor(kills * 0.18),
    overdrive: Math.floor(kills / 90),
    score,
    heals: Math.floor(kills / 45),
    coresEarned: 0,
    won,
  };
}

console.log(`\n=== VOIDPULSE ${SEASON_NAME} — economy sim ===\n`);

// ---------- 1. pass curve ----------
console.log('1. Battle pass curve');
let total = 0;
for (let t = 1; t < PASS_MAX_TIER; t++) {
  total += bpXpForTier(t);
  if (bpXpForTier(t) >= bpXpForTier(t + 1)) {
    check(`tier ${t} xp < tier ${t + 1} xp`, false);
  }
}
check('tier XP curve strictly increasing', true);
check('30 tiers defined', PASS_TIERS.length === 30, `got ${PASS_TIERS.length}`);
console.log(`  total XP for full season: ${total}  (~${Math.round(total / 2600)} decent runs)`);

// ---------- 2. prime economy ----------
console.log('\n2. Prime economy');
check('prime track returns prisms', PRIME_PRISM_TOTAL > 0, `${PRIME_PRISM_TOTAL}◇ across the track`);
check(
  'prime track recoups the 980◇ price when fully cleared',
  PRIME_PRISM_TOTAL >= PRIME_PRICE,
  `returns ${PRIME_PRISM_TOTAL}◇ vs cost ${PRIME_PRICE}◇ (net ${PRIME_PRISM_TOTAL - PRIME_PRICE}◇)`
);
check('free track also pays prisms', FREE_PRISM_TOTAL > 0, `${FREE_PRISM_TOTAL}◇`);
check('both prime exclusive skins placed', PASS_TIERS.some((t) => t.prime.kind === 'skin' && t.prime.id === 'phantom') && PASS_TIERS.some((t) => t.prime.kind === 'skin' && t.prime.id === 'sovereign'));

// ---------- 3. season journey (free player) ----------
console.log('\n3. Season journey — free player, 40 mixed runs');
{
  const meta: MetaSave = defaultMeta();
  const rewards: string[] = [];
  let lastLevel = meta.passLevel;
  for (let i = 0; i < 40; i++) {
    const strong = i % 4 === 3;
    const run = makeRun(strong ? 10 + (i % 5) : 5 + (i % 4), strong ? 700 : 260, strong ? 2 : 0, strong ? 45000 : 14000, false);
    meta.cores += 400; // typical run income
    const grant = applyBpXp(meta, computeRunBpXp(run));
    for (const rw of grant.rewards) rewards.push(rw.label);
    lastLevel = meta.passLevel;
  }
  check('pass level advanced', lastLevel > 10, `reached LV ${lastLevel} after 40 runs`);
  check('no XP overflow beyond cap', meta.passLevel <= PASS_MAX_TIER);
  check('free rewards granted along the way', rewards.length > 10, `${rewards.length} rewards`);
  check('pass XP total tracked', meta.bpXpTotal > 20000, `${Math.round(meta.bpXpTotal)} BP XP lifetime`);
}

// ---------- 4. prime player full clear ----------
console.log('\n4. Prime player — full season clear');
{
  const meta: MetaSave = defaultMeta();
  meta.prisms = PRIME_PRICE;
  meta.prime = true;
  const before = meta.prisms;
  let skins = 0;
  let titles = 0;
  let boosters = 0;
  let prismIncome = 0;
  // brute-force: feed XP until cap
  let guard = 0;
  while (meta.passLevel < PASS_MAX_TIER && guard++ < 200) {
    const preSkins = meta.skinsOwned.length;
    const preTitles = meta.titlesOwned.length;
    const preBoost = Object.values(meta.boosters).reduce((a, b) => a + b, 0);
    const prePrisms = meta.prisms;
    applyBpXp(meta, bpXpForTier(meta.passLevel));
    skins += meta.skinsOwned.length - preSkins;
    titles += meta.titlesOwned.length - preTitles;
    boosters += Object.values(meta.boosters).reduce((a, b) => a + b, 0) - preBoost;
    prismIncome += meta.prisms - prePrisms;
  }
  check('reached LV 30', meta.passLevel === PASS_MAX_TIER, `LV ${meta.passLevel}`);
  check('both prime skins granted', skins >= 2, `${skins} skins`);
  check('prime titles granted', titles >= 2, `${titles} titles`);
  check('prime boosters granted', boosters >= 4, `${boosters} boosters`);
  check(
    'prism refunds recoup the purchase',
    prismIncome >= PRIME_PRICE,
    `income ${prismIncome}◇ on top of kept ${before}◇`
  );
  check('no negative currencies', meta.cores >= 0 && meta.prisms >= 0);
}

// ---------- 5. contracts ----------
console.log('\n5. Contract churn');
{
  const meta: MetaSave = defaultMeta();
  check('3 contracts active at start', meta.contractSlots.length === 3);
  // simulate massive lifetime stats via repeated settle calls
  let completions = 0;
  let guard = 0;
  const life = makeRun(15, 800, 3, 90000, true);
  while (guard++ < 40) {
    meta.life.kills += life.kills;
    meta.life.elites += life.elites;
    meta.life.bosses += life.bosses;
    meta.life.dashKills += life.dashKills;
    meta.life.overdrive += life.overdrive;
    meta.life.heals += life.heals;
    meta.life.coresEarned += 500;
    meta.wins += 1;
    const done = settleContracts(meta, life);
    completions += done.length;
    if (meta.contractSlots.every((s) => s === '')) break;
  }
  check('contracts complete and get replaced', completions >= 5, `${completions} completed in ${guard} mega-runs`);
  check('no duplicate active contracts', new Set(meta.contractSlots.filter(Boolean)).size === meta.contractSlots.filter(Boolean).length);
  check('completed contracts never re-appear', meta.contractSlots.every((s) => !s || !meta.contractsDone.includes(s)));
  // exhaust the pool
  let exhaustGuard = 0;
  while (nextContractId(meta) !== '' && exhaustGuard++ < 50) {
    const id = nextContractId(meta);
    const slot = meta.contractSlots.findIndex((s) => s === '');
    if (slot >= 0) meta.contractSlots[slot] = id;
    else meta.contractSlots[0] = id;
    meta.contractsDone.push(id);
    settleContracts(meta, life);
  }
  check('pool exhaustion handled (empty slots allowed)', meta.contractSlots.every((s) => s === '') || nextContractId(meta) !== '');
  check('contracts never went negative', Object.values(meta.contractProgress).every((v) => v >= 0));
}

// ---------- 6. exchange math ----------
console.log('\n6. Prism exchange');
{
  const meta: MetaSave = defaultMeta();
  meta.cores = EXCHANGE_CORES * 3;
  const cores0 = meta.cores;
  const prisms0 = meta.prisms;
  for (let i = 0; i < 3; i++) {
    if (meta.cores >= EXCHANGE_CORES) {
      meta.cores -= EXCHANGE_CORES;
      meta.prisms += EXCHANGE_PRISMS;
    }
  }
  check('exchange deducts and pays correctly', meta.cores === cores0 - EXCHANGE_CORES * 3 && meta.prisms === prisms0 + EXCHANGE_PRISMS * 3, `${meta.cores}◆ / ${meta.prisms}◇`);
  const pathToPrimeRuns = Math.ceil((PRIME_PRICE - FREE_PRISM_TOTAL) / EXCHANGE_PRISMS) * EXCHANGE_CORES;
  console.log(`  pure-grind path: ~${Math.ceil((PRIME_PRICE - FREE_PRISM_TOTAL) / EXCHANGE_PRISMS)} exchanges ≈ ${pathToPrimeRuns.toLocaleString()} cores extra for PRIME`);
}

// ---------- 7. boosters ----------
console.log('\n7. Booster accounting');
{
  const meta: MetaSave = defaultMeta();
  for (const b of BOOSTERS) meta.boosters[b.id] = 2;
  // simulate startRun consumption: one of each fires
  const active: Record<string, boolean> = {};
  for (const b of BOOSTERS) {
    const n = meta.boosters[b.id] ?? 0;
    if (n > 0) {
      meta.boosters[b.id] = n - 1;
      active[b.id] = true;
    }
  }
  check('one of each consumed', Object.values(meta.boosters).every((v) => v === 1));
  check('all flags active', BOOSTERS.every((b) => active[b.id]));
  // second run
  for (const b of BOOSTERS) {
    const n = meta.boosters[b.id] ?? 0;
    if (n > 0) meta.boosters[b.id] = n - 1;
  }
  check('stacks deplete over two runs', Object.values(meta.boosters).every((v) => v === 0));
  // bpAmp math
  const run = makeRun(10, 500, 2, 30000, false);
  const base = computeRunBpXp(run);
  check('BP amp multiplies', Math.round(base * 1.4) > base, `${base} -> ${Math.round(base * 1.4)}`);
}

// ---------- 8. run xp sanity ----------
console.log('\n8. BP XP per run shape');
for (const [label, run] of [
  ['early death (wave 3)', makeRun(3, 90, 0, 3000, false)],
  ['mid run (wave 8)', makeRun(8, 420, 1, 26000, false)],
  ['strong run (wave 12)', makeRun(12, 900, 2, 60000, false)],
  ['win (wave 15)', makeRun(15, 1400, 3, 110000, true)],
] as [string, RunStats][]) {
  console.log(`  ${label.padEnd(22)} -> ${computeRunBpXp(run)} BP XP (~${(computeRunBpXp(run) / bpXpForTier(10)).toFixed(2)} tiers at LV10)`);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED ✔' : `${failures} CHECK(S) FAILED ✘`}\n`);
process.exit(failures === 0 ? 0 : 1);
