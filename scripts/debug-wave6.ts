/** Debug: wave 6 stall with orbiters. Run: bun scripts/debug-wave6.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';
import { startWave } from '../src/game/waves';

const STEP = 1 / 60;
const game = new Game(new AudioEngine());
game.godMode = true;
game.startRun();
startWave(game, 6);
// strong weapons
game.player.weapons = [
  { id: 'pulse', level: 5, timer: 0, angle: 0, t: 0 },
  { id: 'arc', level: 3, timer: 0, angle: 0, t: 0 },
  { id: 'nova', level: 3, timer: 0, angle: 0, t: 0 },
];

let t = 0;
let hitsOrbiter = 0;
const origDamage = game.damageEnemy.bind(game);
(game as unknown as { damageEnemy: (e: never, d: number, c: boolean, s: string) => void }).damageEnemy = (
  e: { def: { id: string }; hp: number },
  d: number,
  c: boolean,
  s: string
) => {
  if (e.def.id === 'orbiter') hitsOrbiter++;
  origDamage(e, d, c, s);
};

while (t < 200) {
  if (game.state === 'levelup') game.chooseCard(0);
  if (game.state === 'victory' || game.state === 'gameover') break;
  game.update(STEP);
  t += STEP;
  const s = Math.floor(t);
  if (s % 20 === 0 && t - s < STEP) {
    const alive = game.enemies.filter((e) => !e.dead);
    const types: Record<string, number> = {};
    for (const e of alive) types[e.def.id] = (types[e.def.id] ?? 0) + 1;
    console.log(
      `t=${t.toFixed(0)} wave=${game.wave} budget=${game.spawnBudget} alive=${alive.length} ${JSON.stringify(types)} orbHits=${hitsOrbiter} rage=${alive[0]?.rage.toFixed(2) ?? '-'} state=${game.waveState}`
    );
  }
}
console.log(`final wave=${game.wave} state=${game.state}`);
