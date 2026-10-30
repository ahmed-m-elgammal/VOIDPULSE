/** Debug: reproduce the wave-10 stall and dump the stuck enemies. */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;

function playOne(attempt: number): 'ok' | 'stalled' {
  const game = new Game(new AudioEngine());
  game.godMode = true;
  game.startRun();

  let t = 0;
  let lastWave = 1;
  let scoreAt = -1;
  let scoreFreezeSince = -1;
  while (t < 1320) {
    if (game.state === 'playing') {
      const p = game.player;
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
        const d = Math.sqrt(nd) || 1;
        mx = (p.x - near.x) / d;
        my = (p.y - near.y) / d;
      } else if (near) {
        const d = Math.sqrt(nd) || 1;
        const nx = (near.x - p.x) / d;
        const ny = (near.y - p.y) / d;
        mx = -ny * 0.8 + nx * 0.2;
        my = nx * 0.8 + ny * 0.2;
      }
      if (p.x < 220) mx += 0.8;
      if (p.x > game.worldW - 220) mx -= 0.8;
      if (p.y < 220) my += 0.8;
      if (p.y > game.worldH - 220) my -= 0.8;
      game.input.left = mx < -0.25;
      game.input.right = mx > 0.25;
      game.input.up = my < -0.25;
      game.input.down = my > 0.25;
      if (near && nd < 90 * 90 && Math.random() < 0.02) game.input.dash = true;
    } else if (game.state === 'levelup') {
      game.chooseCard(0);
    } else if (game.state === 'relicpick') {
      game.chooseRelic(0);
    } else if (game.state === 'gameover') break;
    else if (game.state === 'victory') game.continueEndless();

    game.update(STEP);
    t += STEP;

    if (game.wave !== lastWave) {
      lastWave = game.wave;
      scoreAt = -1;
      scoreFreezeSince = -1;
    }
    // stall detector: wave stuck, boss gone, enemies alive, score frozen 60s
    if (game.wave >= 10 && game.boss === null && game.enemies.length > 0) {
      const s = Math.floor(game.score);
      if (s === scoreAt) {
        if (scoreFreezeSince < 0) scoreFreezeSince = t;
        else if (t - scoreFreezeSince > 150) {
          console.log(`\n### STALL reproduced (attempt ${attempt}) at t=${t.toFixed(0)}s wave=${game.wave} state=${game.state}`);
          console.log(`    waveState=${game.waveState} bossActive=${game.bossActive} spawnBudget=${game.spawnBudget} waveTimer=${game.waveTimer.toFixed(1)} pendingLevels=${game.pendingLevels}`);
          console.log(`    relic=${game.relic} companion=${game.companion?.id ?? 'none'} weapons=${game.player.weapons.map((w) => w.id + ':' + w.level).join(',')}`);
          console.log(`    enemies=${game.enemies.length}:`);
          for (const e of game.enemies) {
            console.log(
              `      ${e.def.id} eid=${e.eid} hp=${e.hp.toFixed(1)} dead=${e.dead} spawnT=${e.spawnT.toFixed(2)} ghost=${e.ghostT.toFixed(2)} slow=${e.slow.toFixed(2)}/${e.slowT.toFixed(1)} pos=(${e.x.toFixed(0)},${e.y.toFixed(0)}) elite=${e.elite} mods=[${e.mods.join(',')}]`
            );
          }
          return 'stalled';
        }
      } else {
        scoreAt = s;
        scoreFreezeSince = -1;
      }
    }
  }
  return 'ok';
}

for (let i = 1; i <= 10; i++) {
  const r = playOne(i);
  console.log(`attempt ${i}: ${r}`);
  if (r === 'stalled') break;
}
