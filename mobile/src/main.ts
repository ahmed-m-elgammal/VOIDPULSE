/**
 * VOIDPULSE MOBILE — boot glue (v1.6.0 "MIRROR").
 * Order: core runtime (real Game + save) → layout → render ctx → input →
 * screens (binds flow hooks + bakes sprites from CORE defs) → loop.
 * Deep links (?state=run|garage, ?debug=1) are development-only helpers.
 */
import { createRuntime, rt } from './bridge';
import { initLayout, recompute } from './layout';
import { initRender, resizeRender } from './ui/render';
import { initInput, consumePause } from './input';
import { initScreens, openPauseAuto, startRun, openGarage } from './ui/screens';
import { startLoop, fps } from './loop';

function boot(): void {
  createRuntime();

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const probe = document.getElementById('safe-probe') as HTMLElement;
  initLayout(probe);
  initRender(canvas);

  initInput(canvas);
  initScreens();
  startLoop();

  // viewport lifecycle
  window.addEventListener('resize', () => { recompute(); resizeRender(); });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { recompute(); resizeRender(); }, 250);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && rt.game.state === 'playing') openPauseAuto();
  });

  // pause hotkey from the keyboard fallback
  setInterval(() => {
    if (consumePause() && rt.game.state === 'playing') openPauseAuto();
  }, 50);

  // dev deep links
  const q = new URLSearchParams(location.search);
  const s = q.get('state');
  if (s === 'run') startRun();
  else if (s === 'garage') openGarage();

  if (q.get('debug')) {
    const dbg = document.getElementById('dbg') as HTMLElement;
    dbg.hidden = false;
    setInterval(() => {
      const g = rt.game;
      dbg.textContent = fps + 'FPS · E' + g.enemies.length + ' B' + g.bullets.length
        + ' EB' + g.ebullets.length + ' G' + g.gems.length
        + ' · W' + g.wave + ' K' + g.kills;
    }, 500);
    // dev inspection hook (debug builds only)
    (window as unknown as Record<string, unknown>).__vp = {
      game: rt.game,
      score: () => rt.game.score,
      kills: () => rt.game.kills,
      wave: () => rt.game.wave,
      rt: () => rt.game.time,
    };
  }
}

boot();
