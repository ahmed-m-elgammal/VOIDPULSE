/**
 * VOIDPULSE MOBILE — HapticsPort.
 * navigator.vibrate with graceful no-op fallback and spam gating.
 * Light 10ms (dash / gem), medium 25ms (hull damage), heavy 50ms (wave clear / death).
 */

let enabled = true;
let lastLight = 0;
let lastMedium = 0;

export function setHaptics(on: boolean): void { enabled = on; }

function vib(ms: number): boolean {
  if (!enabled) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) return navigator.vibrate(ms);
  } catch { /* unsupported */ }
  return false;
}

export function hapLight(): boolean {
  const now = performance.now();
  if (now - lastLight < 90) return false;   // gem-pickup spam gate
  lastLight = now;
  return vib(10);
}

export function hapMedium(): boolean {
  const now = performance.now();
  if (now - lastMedium < 120) return false;
  lastMedium = now;
  return vib(25);
}

export function hapHeavy(): boolean {
  return vib(50);
}
