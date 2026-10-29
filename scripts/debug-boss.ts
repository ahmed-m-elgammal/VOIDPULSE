/** Debug: boss fight probe. Run: bun scripts/debug-boss.ts */
import { Game } from '../src/game/game';
import { AudioEngine } from '../src/game/audio';

const STEP = 1 / 60;
const game = new Game(new AudioEngine());
game.godMode = true;
game.startRun();

// jump straight to boss wave
game.wave = 5;
game.enemies.length = 0;
game.gems.length = 0;
game.ebullets.length = 0;
game.spawnBudget = 0;
game.waveState = 'active';
game.waveIntroT = 0.1;
game.bossActive = true;
game.pendingBoss = { idx: 0, hpMult: 1 };
// buff player weapons
const p = game.player;
p.weapons = [
  { id: 'pulse', level: 4, timer: 0, angle: 0, t: 0 },
  { id: 'nova', level: 3, timer: 0, angle: 0, t: 0 },
  { id: 'orbit', level: 3, timer: 0, angle: 0, t: 0 },
];

let t = 0;
let hitsOnBoss = 0;
let dmgOnBoss = 0;
const origDamage = game.damageEnemy.bind(game);
(game as unknown as { damageEnemy: (e: never, d: number, c: boolean, s: string) => void }).damageEnemy = (
  e: { def: { id: string }; hp: number },
  d: number,
  c: boolean,
  s: string
) => {
  if (e.def.id === 'boss') {
    hitsOnBoss++;
    dmgOnBoss += d;
  }
  origDamage(e, d, c, s);
};

while (t < 120) {
  if (game.state === 'levelup') game.chooseCard(0);
  if (game.state === 'victory' || game.state === 'gameover') break;
  game.update(STEP);
  t += STEP;
  if (i_check(t)) {
    const boss = game.boss;
    console.log(
      `t=${t.toFixed(1)} boss=${boss ? boss.hp.toFixed(0) + '/' + boss.maxHp.toFixed(0) : 'null'} hits=${hitsOnBoss} dmg=${dmgOnBoss.toFixed(0)} bullets=${game.bullets.length} enemies=${game.enemies.length} bossState=${game.bossState ? game.bossState.actPattern + '/' + game.bossState.windupPattern : '-'} playerPos=(${p.x.toFixed(0)},${p.y.toFixed(0)}) bossPos=${boss ? `(${boss.x.toFixed(0)},${boss.y.toFixed(0)})` : '-'}`
    );
  }
}
console.log(`final: state=${game.state} wave=${game.wave} bossKills=${game.bossKills}`);

function i_check(t: number): boolean {
  const s = Math.floor(t);
  return (s % 10 === 0) && t - s < STEP;
}
