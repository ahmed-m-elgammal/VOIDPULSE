/**
 * VOIDPULSE MOBILE — main loop (v1.6.0 "MIRROR").
 * The CORE runs at a locked 1/60 logic step (desktop parity); the 120 Hz
 * setting only lifts the RENDER gate. Static menus render at 1 FPS per the
 * battery spec.
 */
import { rt, syncInput, syncFlow, prefs } from './bridge';
import { tickInput } from './input';
import { tickCamera } from './camera';
import { render } from './ui/render';
import * as L from './layout';

const STEP = 1 / 60; // core logic step — NEVER scales with display refresh

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
  const dt = (now - last) / 1000;
  last = now;
  const dtc = dt > 0.25 ? 0.25 : dt; // spiral-of-death guard (tab return)

  // fps meter (debug)
  fpsFrames++;
  if (now - fpsLast >= 500) {
    fps = Math.round((fpsFrames * 1000) / (now - fpsLast));
    fpsFrames = 0; fpsLast = now;
  }

  const st = rt.game.state;

  if (st === 'title') {
    // title: DOM menu drives everything; canvas only drifts the starfield
    acc = 0;
    if (now - menuLast >= 1000) { render(nowSec); menuLast = now; }
    return;
  }

  acc += dtc;
  let steps = 0;
  while (acc >= STEP && steps < 6) {
    tickInput();
    syncInput();
    rt.game.update(STEP);
    syncFlow();
    const p = rt.game.player;
    tickCamera(STEP, p.x, p.y, p.vx, p.vy, L.viewW, L.viewH, rt.game.worldW, rt.game.worldH);
    acc -= STEP;
    steps++;
    if (rt.game.state === 'title') { acc = 0; break; } // abandoned mid-tick
  }

  if (st === 'playing') {
    // render gate — 120 mode: every rAF; 60 mode: ~60 renders/s on 120Hz panels
    if (prefs.fps120 || now - lastRender >= 15.5) {
      render(nowSec);
      lastRender = now;
    }
  } else {
    // paused / levelup / relicpick / gameover / victory → 1 FPS battery spec
    if (now - menuLast >= 1000) { render(nowSec); menuLast = now; }
  }
}
