/**
 * VOIDPULSE MOBILE — dual-thumb touch input (v1.6.0 "MIRROR").
 *
 * Left thumb: floating joystick (55dp outer / 22dp nub / 10% deadzone),
 * mapped to the CORE's 8-way input (same movement model as desktop keys).
 * Dash button bottom-right (52dp+ hit target, safe-area aware).
 * All weapons auto-fire/auto-target in the core — no aim thumb needed.
 * Listeners are non-passive + preventDefault to kill pull-to-refresh,
 * double-tap zoom and scroll bounce. Keyboard fallback = dev/testing only.
 */
import { STICK_R, STICK_DEAD, BTN_HIT } from './config';
import { dashX, dashY, viewW } from './layout';
import { setStick, requestDash, unlockAudio, rt } from './bridge';

// ---- joystick state (read by the renderer) ----
export let stickActive = false;
export let stickBaseX = 0, stickBaseY = 0, stickCurX = 0, stickCurY = 0;
export let stickOutX = 0, stickOutY = 0; // normalized -1..1 after deadzone
export let stickFade = 0;                // 1 → 0 after release

export let pauseRequested = false;
export function consumePause(): boolean {
  const r = pauseRequested;
  pauseRequested = false;
  return r;
}

let stickId = -1;

// keyboard fallback (dev/test)
const keyDown: Int8Array = new Int8Array(128);

function playing(): boolean { return rt.game.state === 'playing'; }

// ---------------------------------------------------------------- pointer
function onDown(e: PointerEvent): void {
  e.preventDefault();
  unlockAudio(); // AudioPort: first gesture unlocks WebAudio

  if (!playing()) return;
  const x = e.clientX, y = e.clientY;

  // dash button first (bottom-right anchored)
  const dDX = x - dashX, dDY = y - dashY;
  if (dDX * dDX + dDY * dDY < BTN_HIT * BTN_HIT) { requestDash(); return; }

  if (x < viewW * 0.5) {
    if (stickId === -1) {
      stickId = e.pointerId;
      stickActive = true;
      stickFade = 1;
      stickBaseX = x; stickBaseY = y;
      stickCurX = x; stickCurY = y;
      stickOutX = 0; stickOutY = 0;
    }
  }
  // right half: intentionally inert — the core auto-fires every weapon
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
  }
}

function onUp(e: PointerEvent): void {
  e.preventDefault();
  if (e.pointerId === stickId) {
    stickId = -1; stickActive = false;
    stickOutX = 0; stickOutY = 0;
  }
}

// ---------------------------------------------------------------- keyboard (dev fallback)
function onKeyDown(e: KeyboardEvent): void {
  const k = e.keyCode | 0;
  if (k < 0 || k >= 128) return;
  keyDown[k] = 1;
  if (playing()) {
    if (k === 32) requestDash();                          // Space
    if (k === 80 || k === 27) pauseRequested = true;      // P / Esc
  }
}

function onKeyUp(e: KeyboardEvent): void {
  const k = e.keyCode | 0;
  if (k >= 0 && k < 128) keyDown[k] = 0;
}

// ---------------------------------------------------------------- tick
/** Keyboard merge + stick fade. Called once per sim step while playing. */
export function tickInput(): void {
  let kx = 0, ky = 0;
  if (keyDown[65] || keyDown[37]) kx -= 1; // A / ←
  if (keyDown[68] || keyDown[39]) kx += 1; // D / →
  if (keyDown[87] || keyDown[38]) ky -= 1; // W / ↑
  if (keyDown[83] || keyDown[40]) ky += 1; // S / ↓
  if (kx !== 0 || ky !== 0) setStick(kx, ky);
  else setStick(stickOutX, stickOutY);

  if (!stickActive && stickFade > 0) stickFade -= 0.08;
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
