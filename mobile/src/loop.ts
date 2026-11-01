/**
 * VOIDPULSE MOBILE — main loop.
 * Fixed-timestep simulation (60 or 120 Hz per settings) decoupled from
 * rAF rendering; static menus render at 1 FPS per the battery spec.
 */
import { ST_RUNNING } from './types';
import * as W from './sim/world';
import * as P from './sim/player';
import { tickEnemies } from './sim/enemies';
import { tickBullets } from './sim/bullets';
import { tickPickups } from './sim/pickups';
import { tickWaves } from './sim/world';
import { tickCamera } from './camera';
import { tickInput } from './input';
import { render } from './ui/render';
import { tickFlow, openPerkModal, finishRun } from './ui/screens';
import { save } from './save';
import * as L from './layout';

let last = 0;
let acc = 0;
let lastRender = 0;
let menuLast = 0;
let fpsFrames = 0;
let fpsLast = 0;

export let fps = 0;

export function startLoop(): void {
  last = performance.now();
  fpsLast = last;
  requestAnimationFrame(frame);
}

function frame(now: number): void {
  requestAnimationFrame(frame);
  const nowSec = now / 1000;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // spiral-of-death guard (tab return)

  // fps meter (debug)
  fpsFrames++;
  if (now - fpsLast >= 500) {
    fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0; fpsLast = now;
  }

  if (W.state === ST_RUNNING) {
    acc += dt;
    const step = save.settings.fps120 ? (1 / 120) : (1 / 60);
    let steps = 0;
    while (acc >= step && steps < 6) {
      tick(step);
      acc -= step;
      steps++;
      if (W.state !== ST_RUNNING) { acc = 0; break; } // modal/gameover opened mid-tick
    }
    // render gate — 120 mode: every rAF; 60 mode: ~60 renders/s even on 120Hz panels
    if (save.settings.fps120 || now - lastRender >= 15.5) {
      render(nowSec);
      lastRender = now;
    }
  } else {
    acc = 0;
    // static menus / pause / modal → 1 FPS per battery spec
    if (now - menuLast >= 1000) {
      render(nowSec);
      menuLast = now;
    }
  }
}

function tick(step: number): void {
  tickInput();
  P.tickPlayer(step);
  tickEnemies(step);
  tickBullets(step);
  tickPickups(step);
  tickWaves(step, P.pX, P.pY);
  tickCamera(step, P.pX, P.pY, P.pVX, P.pVY, L.viewW, L.viewH);
  W.tickRunTime(step);
  tickFlow();

  if (P.pendingLevels > 0) { openPerkModal(); return; }
  if (W.victoryPending) { W.clearVictory(); W.setRunOver(true); }
  if (W.runOver) finishRun(W.runWon);
}
