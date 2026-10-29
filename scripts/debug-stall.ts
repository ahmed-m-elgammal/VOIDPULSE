/** Debug: find why waves stall. Run: bun scripts/debug-stall.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;

const game = new Game(new AudioEngine());
game.godMode = true;
game.startRun();

let t = 0;
let lastWave = 1;
while (t < 300) {
  if (game.state === 'levelup') game.chooseCard(0);
  if (game.state === 'gameover' || game.state === 'victory') break;
  game.update(STEP);
  t += STEP;

  if (game.wave > lastWave) {
    lastWave = game.wave;
    console.log(`wave ${game.wave} at ${t.toFixed(1)}s`);
  }

  // stall detector
  if (Math.floor(t) === 100 || Math.floor(t) === 150 || Math.floor(t) === 200) {
    if (Math.abs(t - Math.floor(t)) < STEP) {
      const alive = game.enemies.filter((e) => !e.dead);
      console.log(
        `t=${t.toFixed(0)} wave=${game.wave} state=${game.waveState} budget=${game.spawnBudget} alive=${alive.length} boss=${game.boss ? game.boss.hp.toFixed(0) : 'null'}`
      );
      for (const e of alive.slice(0, 8)) {
        console.log(
          `  -> ${e.def.id} hp=${e.hp.toFixed(1)} spawnT=${e.spawnT.toFixed(2)} freeze=${e.freezeT.toFixed(2)} stun=${e.stunT.toFixed(2)} slow=${e.slow.toFixed(2)} pos=(${e.x.toFixed(0)},${e.y.toFixed(0)}) vx=${e.vx.toFixed(1)} vy=${e.vy.toFixed(1)} rage=${e.rage.toFixed(2)}`
        );
      }
    }
  }
}
