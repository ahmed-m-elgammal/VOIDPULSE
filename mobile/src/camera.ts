/**
 * VOIDPULSE MOBILE — camera with mobile velocity lead + trauma shake.
 * (camX, camY) is the CENTER of the view in world coordinates.
 */
import { CAM_LEAD, CAM_SMOOTH, SHAKE_AMP, SHAKE_DECAY, SHAKE_FREQ, WORLD_W, WORLD_H } from './config';

export let camX = WORLD_W * 0.5;
export let camY = WORLD_H * 0.5;
export let trauma = 0;
export let shakeX = 0, shakeY = 0;

let time = 0;

export function addTrauma(v: number): void {
  if (trauma < 1) trauma += v;
  if (trauma > 1) trauma = 1;
}

export function resetCamera(x: number, y: number): void {
  camX = x; camY = y; trauma = 0; shakeX = 0; shakeY = 0; time = 0;
}

/** dt-second camera tick. viewW/viewH are CSS-pixel viewport sizes. */
export function tickCamera(dt: number, px: number, py: number, pvx: number, pvy: number,
  viewW: number, viewH: number): void {
  const tx = px + pvx * CAM_LEAD;
  const ty = py + pvy * CAM_LEAD;
  const k = 1 - Math.exp(-CAM_SMOOTH * dt);
  camX += (tx - camX) * k;
  camY += (ty - camY) * k;

  // clamp to arena (center the world if it is smaller than the view)
  if (WORLD_W > viewW) {
    const half = viewW * 0.5;
    if (camX < half) camX = half; else if (camX > WORLD_W - half) camX = WORLD_W - half;
  } else camX = WORLD_W * 0.5;
  if (WORLD_H > viewH) {
    const half = viewH * 0.5;
    if (camY < half) camY = half; else if (camY > WORLD_H - half) camY = WORLD_H - half;
  } else camY = WORLD_H * 0.5;

  time += dt;
  trauma -= dt * SHAKE_DECAY;
  if (trauma < 0) trauma = 0;
  const t2 = trauma * trauma;
  shakeX = Math.sin(time * SHAKE_FREQ * 1.13) * t2 * SHAKE_AMP;
  shakeY = Math.cos(time * SHAKE_FREQ * 0.97) * t2 * SHAKE_AMP;
}
