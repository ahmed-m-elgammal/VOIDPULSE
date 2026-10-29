/** Debug: trace bullet targeting + collisions. Run: bun scripts/debug-trace.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;
const game = new Game(new AudioEngine());
game.startRun();

let t = 0;
let hitCount = 0;
const origDamage = game.damageEnemy.bind(game);
(game as unknown as { damageEnemy: (e: unknown, d: number, c: boolean, s: string) => void }).damageEnemy = (
  e: { def: { id: string }; hp: number },
  d: number,
  c: boolean,
  s: string
) => {
  if (s === 'bullet') {
    hitCount++;
    if (hitCount <= 12) console.log(`HIT ${hitCount}: ${e.def.id} hp ${e.hp.toFixed(1)} -> ${(e.hp - d).toFixed(1)} src=${s}`);
  }
  origDamage(e as never, d, c, s);
};

for (let i = 0; i < 60 * 10; i++) {
  if (game.state === 'levelup') game.chooseCard(0);
  game.update(STEP);
  t += STEP;
  if (i % 120 === 0) {
    const nearest = game.enemies.reduce(
      (best, e) => {
        const d = Math.hypot(e.x - game.player.x, e.y - game.player.y);
        return d < best.d ? { d, id: e.def.id } : best;
      },
      { d: 1e9, id: 'none' }
    );
    console.log(
      `t=${t.toFixed(1)} enemies=${game.enemies.length} bulletHits=${hitCount} nearest=${nearest.id}@${nearest.d.toFixed(0)}px wave=${game.wave} budget=${game.spawnBudget} playerHp=${game.player.hp.toFixed(0)} state=${game.state}`
    );
  }
  if (game.state === 'gameover') {
    console.log(`died at t=${t.toFixed(1)} wave=${game.wave}`);
    break;
  }
}
