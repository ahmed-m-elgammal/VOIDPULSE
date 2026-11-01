/**
 * VOIDPULSE MOBILE — boot glue.
 * Order: save → layout → render ctx → bake sprites → ports → input →
 * screens → loop. Deep links (?state=run|garage|perk|over, ?debug=1) are
 * development-only helpers.
 */
import { loadSave, save } from './save';
import { initLayout, recompute } from './layout';
import { initRender, resizeRender } from './ui/render';
import { bakeAll } from './sprites';
import { PALETTES } from './palette';
import { applyVolumes } from './audio';
import { setHaptics } from './haptics';
import { initInput, consumePause } from './input';
import { initScreens, openPauseAuto, startRun, openGarage, openPerkModal, finishRun } from './ui/screens';
import { startLoop, fps } from './loop';
import * as W from './sim/world';
import * as P from './sim/player';

function boot(): void {
  loadSave();

  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const probe = document.getElementById('safe-probe') as HTMLElement;
  initLayout(probe);
  initRender(canvas);

  // palette + sprite bake
  const pal = PALETTES[save.settings.palette] || PALETTES[0];
  document.documentElement.style.setProperty('--acc', pal.css);
  bakeAll(pal);

  // ports
  applyVolumes(save.settings.master, save.settings.sfx, save.settings.music);
  setHaptics(save.settings.haptics);

  initInput(canvas);
  initScreens();
  startLoop();

  // viewport lifecycle
  window.addEventListener('resize', () => { recompute(); resizeRender(); });
  window.addEventListener('orientationchange', () => {
    setTimeout(() => { recompute(); resizeRender(); }, 250);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && W.state === 2) openPauseAuto(); // ST_RUNNING
  });

  // dev deep links
  const q = new URLSearchParams(location.search);
  const s = q.get('state');
  if (s === 'run') startRun();
  else if (s === 'garage') openGarage();
  else if (s === 'perk') { startRun(); P.debugForceLevel(); openPerkModal(); }
  else if (s === 'over') { startRun(); finishRun(false); }

  if (q.get('debug')) {
    const dbg = document.getElementById('dbg') as HTMLElement;
    dbg.hidden = false;
    setInterval(() => {
      dbg.textContent = fps + 'FPS · E' + W.eCount + ' B' + W.bCount + ' G' + W.gCount + ' P' + W.pCount;
    }, 500);
    // dev inspection hook (debug builds only)
    (window as unknown as Record<string, unknown>).__vp = {
      score: () => W.score, kills: () => W.kills, wave: () => W.wave,
      rt: () => W.runTime, ec: () => W.eCount, spawning: () => W.waveSpawning,
      budget: () => W.waveBudget, inter: () => W.waveInter,
    };
  }
}

// pause hotkey from the keyboard fallback
setInterval(() => {
  if (consumePause() && W.state === 2) openPauseAuto();
}, 50);

boot();
