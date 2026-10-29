/** Debug: instrument the exact stall state. Run: bun scripts/debug-stall2.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;
const game = new Game(new AudioEngine());
game.godMode = true;
game.startRun();

let t = 0;
let hits = 0;
let shotsSeen = 0;
const origDamage = game.damageEnemy.bind(game);
(game as unknown as { damageEnemy: (e: never, d: number, c: boolean, s: string) => void }).damageEnemy = (
  e: { def: { id: string }; hp: number },
  d: number,
  c: boolean,
  s: string
) => {
  hits++;
  if (t > 95 && hits < 500) {
    console.log(`  t=${t.toFixed(1)} HIT ${e.def.id} ${e.hp.toFixed(1)}->${(e.hp - d).toFixed(1)} src=${s}`);
  }
  origDamage(e, d, c, s);
};

// track bullet creation
let bulletPushes = 0;
const origPush = Array.prototype.push;
void origPush;

while (t < 170) {
  if (game.state === 'levelup') game.chooseCard(0);
  if (game.state === 'gameover' || game.state === 'victory') break;
  const before = game.bullets.length;
  game.update(STEP);
  t += STEP;
  if (game.bullets.length > before) bulletPushes += game.bullets.length - before;

  if (Math.abs(t - 100) < STEP / 2 || Math.abs(t - 130) < STEP / 2 || Math.abs(t - 160) < STEP / 2) {
    const alive = game.enemies.filter((e) => !e.dead);
    console.log(
      `t=${t.toFixed(1)} wave=${game.wave} budget=${game.spawnBudget} alive=${alive.length} types=${alive.map((e) => e.def.id).join(',')} | bullets=${game.bullets.length} totalShots=${bulletPushes} totalHits=${hits}`
    );
    const spitters = alive.filter((e) => e.def.id === 'spitter');
    for (const s of spitters.slice(0, 3)) {
      const d = Math.hypot(s.x - game.player.x, s.y - game.player.y);
      console.log(`   spitter hp=${s.hp.toFixed(1)} dist=${d.toFixed(0)} spawnT=${s.spawnT.toFixed(2)} pos=(${s.x.toFixed(0)},${s.y.toFixed(0)}) player=(${game.player.x.toFixed(0)},${game.player.y.toFixed(0)})`);
    }
  }
}
