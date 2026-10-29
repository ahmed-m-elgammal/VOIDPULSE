/** Debug: single-target combat probe. Run: bun scripts/debug-combat.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;
const game = new Game(new AudioEngine());
game.startRun();
game.wave = 3;
// place a spitter at fixed position
const e = game.spawnEnemy('spitter', game.player.x + 200, game.player.y, false);
if (e) e.spawnT = 0;

let t = 0;
let lastBullets = 0;
let shots = 0;
for (let i = 0; i < 60 * 6; i++) {
  if (game.state === 'levelup') game.chooseCard(0);
  const before = game.bullets.length;
  game.update(STEP);
  t += STEP;
  if (game.bullets.length > before) shots += game.bullets.length - before;
  if (i % 60 === 0) {
    console.log(
      `t=${t.toFixed(1)} bullets=${game.bullets.length} shotsFired=${shots} enemyHp=${e ? e.hp.toFixed(1) : 'DEAD'} enemies=${game.enemies.length} weapons=${game.player.weapons.map((w) => w.id + ':' + w.level).join(',')}`
    );
  }
  if (!e || e.hp <= 0) {
    console.log(`enemy died at t=${t.toFixed(2)}`);
    break;
  }
  void lastBullets;
}
