// ===== VOIDPULSE :: wave director =====

import type { Game } from './game';
import { BOSS_WAVES, WAVE_CONFIG, spawnPoolForWave, WORLD_H, WORLD_W } from './content';
import { TAU, weightedPick, clamp } from './utils';
import { createBoss } from './bosses';

export function startWave(g: Game, wave: number): void {
  g.wave = wave;
  g.waveHits = 0;
  g.dmgScale = WAVE_CONFIG.dmgScale(wave);
  g.rageT = 0;
  const isBoss = BOSS_WAVES[wave] !== undefined || (wave > 15 && (wave - 15) % 5 === 0);
  g.waveState = 'intro';
  g.waveTimer = isBoss ? 0 : WAVE_CONFIG.duration(wave);
  // SWARM PROTOCOL: denser waves — bigger budget, shorter gaps, raised cap (see g.maxEnemies)
  const swarm = g.runMutations.includes('swarmProtocol');
  g.spawnBudget = Math.ceil(WAVE_CONFIG.budget(wave) * (swarm ? 1.8 : 1));
  g.spawnTimer = isBoss ? 2.5 : 1.2;
  g.spawnInterval = WAVE_CONFIG.spawnInterval(wave) * (swarm ? 0.65 : 1);
  g.bossActive = isBoss;
  g.audio.setBoss(isBoss); // v1.2 stems: the boss layer rides the mix
  g.waveIntroT = 2.2;
  g.eliteChance = WAVE_CONFIG.eliteChance(wave);
  g.spawnPool = spawnPoolForWave(wave);
  g.minionTimer = 6;

  if (isBoss) {
    let idx: number;
    let hpMult = 1;
    if (wave <= 15) {
      idx = BOSS_WAVES[wave];
    } else {
      const k = Math.floor((wave - 15) / 5); // 20 -> 1, 25 -> 2 ...
      idx = k % 4; // four deep-dwellers rotate through the endless dark
      hpMult = Math.pow(1.45, k);
    }
    g.pendingBoss = { idx, hpMult };
  } else {
    g.pendingBoss = null;
  }
}

export function updateWaves(g: Game, dt: number): void {
  if (g.waveIntroT > 0) {
    g.waveIntroT -= dt;
    if (g.waveIntroT <= 0) {
      g.waveState = 'active';
      if (g.pendingBoss) {
        createBoss(g, g.pendingBoss.idx, g.pendingBoss.hpMult);
        g.pendingBoss = null;
      }
    }
    return;
  }

  if (g.bossActive) {
    updateBossWave(g, dt);
    return;
  }

  // --- normal wave ---
  if (g.waveState === 'active') {
    g.waveTimer -= dt;
    // spawning
    if (g.spawnBudget > 0) {
      g.spawnTimer -= dt;
      if (g.spawnTimer <= 0 && g.enemies.length < g.maxEnemies) {
        g.spawnTimer = g.spawnInterval * (0.75 + Math.random() * 0.5);
        spawnTick(g);
      }
    } else if (g.enemies.length === 0) {
      completeWave(g);
      return;
    } else {
      // rage: remaining enemies get faster over time
      g.rageT += dt;
      if (g.rageT > 10) {
        for (const e of g.enemies) e.rage = Math.min(1.8, e.rage + dt * 0.08);
      }
    }
  } else if (g.waveState === 'breather') {
    g.breatherT -= dt;
    if (g.breatherT <= 0) {
      startWave(g, g.wave + 1);
    }
  }
}

function updateBossWave(g: Game, dt: number): void {
  // minion trickle
  if (g.boss) {
    g.minionTimer -= dt;
    if (g.minionTimer <= 0 && g.enemies.length < 16) {
      g.minionTimer = 7.5;
      const pool = g.spawnPool.length ? g.spawnPool : null;
      for (let i = 0; i < 2; i++) {
        const a = Math.random() * TAU;
        const px = g.player.x + Math.cos(a) * 620;
        const py = g.player.y + Math.sin(a) * 620;
        if (pool) {
          const def = weightedPick(pool, Math.random);
          g.spawnEnemy(def.id, clampWorld(px, WORLD_W), clampWorld(py, WORLD_H), false);
        } else {
          g.spawnEnemy('drifter', clampWorld(px, WORLD_W), clampWorld(py, WORLD_H), false);
        }
      }
    }
    // wave completes on boss death (handled in killEnemy)
  } else {
    // boss dead -> clear minions into gems, complete
    for (const e of g.enemies) {
      e.hp = 0;
      g.spawnGem(e.x, e.y, Math.ceil(e.xp), 'xp');
      g.spawnParticleBurst(e.x, e.y, e.def.color, 8, 160, 3);
    }
    g.enemies.length = 0;
    completeWave(g);
  }
}

function clampWorld(v: number, max: number): number {
  return clamp(v, 30, max - 30);
}

function spawnTick(g: Game): void {
  const burst = Math.random() < 0.16 && g.wave >= 2 ? 4 : 1;
  for (let i = 0; i < burst && g.spawnBudget > 0; i++) {
    if (g.enemies.length >= g.maxEnemies) return;
    const def = weightedPick(g.spawnPool, Math.random);
    const elite = Math.random() < g.eliteChance;
    const a = Math.random() * TAU;
    const R = 560 + Math.random() * 160;
    let x = g.player.x + Math.cos(a) * R;
    let y = g.player.y + Math.sin(a) * R;
    x = clampWorld(x, WORLD_W);
    y = clampWorld(y, WORLD_H);
    g.spawnEnemy(def.id, x, y, elite);
    g.spawnBudget--;
  }
}

export function completeWave(g: Game): void {
  g.audio.sfx('waveClear');
  const waveScore = Math.round(250 * g.wave * g.scoreMult); // SWARM PROTOCOL pays +30% score
  let bonus = 0;
  if (g.waveHits === 0) {
    bonus = 400;
    g.addText(g.player.x, g.player.y - 60, 'FLAWLESS +400', '#ffd94d', 16, true);
  }
  g.score += waveScore + bonus;
  g.addText(g.player.x, g.player.y - 40, `WAVE ${g.wave} CLEAR +${waveScore}`, '#4de8ff', 15, true);

  // wave clear heal orb if hurting (IRON MAN: no repairs)
  if (!g.runMutations.includes('ironMan')) {
    if (g.player.hp < g.player.maxHp * 0.6) {
      g.spawnGem(g.player.x + 60, g.player.y, 20, 'heal');
    } else if (Math.random() < 0.5) {
      g.spawnGem(g.player.x + (Math.random() - 0.5) * 200, g.player.y + (Math.random() - 0.5) * 200, 10, 'heal');
    }
  }

  // magnet all gems
  for (const gem of g.gems) gem.magnet = true;

  // final wave (15) -> victory (handled via boss death in endless too)
  if (g.wave === 15 && !g.endlessMode) {
    g.triggerVictory();
    return;
  }

  g.waveState = 'breather';
  g.breatherT = 4.0;
}
