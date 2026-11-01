/**
 * VOIDPULSE MOBILE — dual-thumb touch input.
 *
 * Left thumb: floating joystick spawns on pointerdown anywhere on the LEFT
 * half, 55dp outer / 22dp nub / 10% deadzone, normalized -1..1 output.
 * Right thumb: drag = manual aim + continuous fire; idle = auto-aim assist.
 * Dedicated dash / overdrive buttons (52dp+ hit targets, bottom-right).
 * All listeners are non-passive + preventDefault to kill pull-to-refresh,
 * double-tap zoom and scroll bounce. A minimal keyboard fallback exists for
 * development/testing only.
 */
import { STICK_R, STICK_DEAD, AIM_RANGE } from './config';
import { ST_RUNNING } from './types';
import * as W from './sim/world';
import * as P from './sim/player';
import { dashX, dashY, odX, odY, viewW } from './layout';
import { unlock } from './audio';

// ---- joystick state (read by the renderer) ----
export let stickActive = false;
export let stickBaseX = 0, stickBaseY = 0, stickCurX = 0, stickCurY = 0;
export let stickOutX = 0, stickOutY = 0;      // normalized -1..1 after deadzone
export let stickFade = 0;                      // 1 → 0 after release

// ---- aim state ----
export let aimActive = false;
export let aimFromX = 0, aimFromY = 0;         // drag start (screen space)
export let aimCurX = 0, aimCurY = 0;

export let pauseRequested = false;
export function consumePause(): boolean {
  const r = pauseRequested;
  pauseRequested = false;
  return r;
}

// pointer roles
const ROLE_NONE = 0, ROLE_STICK = 1, ROLE_AIM = 2, ROLE_BTN = 3;
let stickId = -1, aimId = -1;

// keyboard fallback (dev/test)
const keyDown: Int8Array = new Int8Array(128);

function running(): boolean {
  return W.state === ST_RUNNING;
}

// ---------------------------------------------------------------- pointer
function onDown(e: PointerEvent): void {
  e.preventDefault();
  unlock(); // AudioPort: first gesture unlocks WebAudio

  if (!running()) return;
  const x = e.clientX, y = e.clientY;

  // action buttons first (bottom-right anchored)
  const dDX = x - dashX, dDY = y - dashY;
  if (dDX * dDX + dDY * dDY < 44 * 44) { P.requestDash(); return; }
  const oDX = x - odX, oDY = y - odY;
  if (oDX * oDX + oDY * oDY < 44 * 44) { P.requestOverdrive(); return; }

  if (x < viewW * 0.5) {
    if (stickId === -1) {
      stickId = e.pointerId;
      stickActive = true;
      stickFade = 1;
      stickBaseX = x; stickBaseY = y;
      stickCurX = x; stickCurY = y;
      stickOutX = 0; stickOutY = 0;
    }
  } else {
    if (aimId === -1) {
      aimId = e.pointerId;
      aimActive = true;
      aimFromX = x; aimFromY = y;
      aimCurX = x; aimCurY = y;
      P.setFiring(true);
    }
  }
}

function onMove(e: PointerEvent): void {
  e.preventDefault();
  if (e.pointerId === stickId) {
    stickCurX = e.clientX; stickCurY = e.clientY;
    let dx = stickCurX - stickBaseX, dy = stickCurY - stickBaseY;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > STICK_R) { // base follows the thumb ("floating")
      const k = (len - STICK_R) / len;
      stickBaseX += dx * k; stickBaseY += dy * k;
      dx = stickCurX - stickBaseX; dy = stickCurY - stickBaseY;
    }
    const nx = dx / STICK_R, ny = dy / STICK_R;
    const mag = Math.sqrt(nx * nx + ny * ny);
    if (mag < STICK_DEAD) { stickOutX = 0; stickOutY = 0; }
    else { stickOutX = nx; stickOutY = ny; }
  } else if (e.pointerId === aimId) {
    aimCurX = e.clientX; aimCurY = e.clientY;
  }
}

function onUp(e: PointerEvent): void {
  e.preventDefault();
  if (e.pointerId === stickId) {
    stickId = -1; stickActive = false;
    stickOutX = 0; stickOutY = 0;
  } else if (e.pointerId === aimId) {
    aimId = -1; aimActive = false;
    P.setFiring(false);
  }
}

// ---------------------------------------------------------------- keyboard (dev fallback)
function onKeyDown(e: KeyboardEvent): void {
  const k = e.keyCode | 0;
  if (k < 0 || k >= 128) return;
  keyDown[k] = 1;
  if (running()) {
    if (k === 32) P.requestDash();        // Space
    if (k === 69) P.requestOverdrive();   // E
    if (k === 80 || k === 27) pauseRequested = true; // P / Esc
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const k = e.keyCode | 0;
  if (k >= 0 && k < 128) keyDown[k] = 0;
}

// ---------------------------------------------------------------- tick
/** Auto-aim assist + keyboard merge. Called once per sim step while RUNNING. */
export function tickInput(): void {
  // keyboard movement merge (dev fallback)
  let kx = 0, ky = 0;
  if (keyDown[65] || keyDown[37]) kx -= 1; // A / ←
  if (keyDown[68] || keyDown[39]) kx += 1; // D / →
  if (keyDown[87] || keyDown[38]) ky -= 1; // W / ↑
  if (keyDown[83] || keyDown[40]) ky += 1; // S / ↓
  if (kx !== 0 || ky !== 0) P.setMove(kx, ky);
  else P.setMove(stickOutX, stickOutY);

  // stick fade-out for the renderer
  if (!stickActive && stickFade > 0) stickFade -= 0.08;

  if (aimActive) {
    // manual aim: drag vector from the drag origin
    const dx = aimCurX - aimFromX, dy = aimCurY - aimFromY;
    if (dx * dx + dy * dy > 64) P.setAim(Math.atan2(dy, dx));
    P.setFiring(true);
    return;
  }

  // auto-aim: lock nearest enemy in range; fire only when a target exists
  let best = -1, bestD2 = AIM_RANGE * AIM_RANGE;
  for (let i = 0; i < W.eCount; i++) {
    const dx = W.ex[i] - P.pX, dy = W.ey[i] - P.pY;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) { bestD2 = d2; best = i; }
  }
  if (best >= 0) {
    P.setAim(Math.atan2(W.ey[best] - P.pY, W.ex[best] - P.pX));
    P.setFiring(true);
  } else {
    P.setFiring(false);
  }
}

// ---------------------------------------------------------------- install
export function initInput(canvas: HTMLCanvasElement): void {
  const opts: AddEventListenerOptions = { passive: false };
  window.addEventListener('pointerdown', onDown, opts);
  window.addEventListener('pointermove', onMove, opts);
  window.addEventListener('pointerup', onUp, opts);
  window.addEventListener('pointercancel', onUp, opts);
  window.addEventListener('touchstart', (e: TouchEvent) => e.preventDefault(), opts);
  window.addEventListener('touchmove', (e: TouchEvent) => e.preventDefault(), opts);
  window.addEventListener('contextmenu', (e: Event) => e.preventDefault());
  document.addEventListener('gesturestart', (e: Event) => e.preventDefault());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('touchstart', (e: TouchEvent) => e.preventDefault(), opts);
}
