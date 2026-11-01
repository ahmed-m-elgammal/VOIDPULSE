/**
 * VOIDPULSE MOBILE — shared layout: viewport size, safe-area insets
 * (read from the CSS env() probe div), and the dash button anchor.
 */

export let viewW = 0, viewH = 0;
export let insetT = 0, insetR = 0, insetB = 0, insetL = 0;
export let dashX = 0, dashY = 0;
export let dpr = 1;

let probe: HTMLElement | null = null;

export function initLayout(probeEl: HTMLElement): void {
  probe = probeEl;
  recompute();
}

export function recompute(): void {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2); // thermal cap — never above 2x

  if (probe) {
    const cs = getComputedStyle(probe);
    insetT = parseFloat(cs.paddingTop) || 0;
    insetR = parseFloat(cs.paddingRight) || 0;
    insetB = parseFloat(cs.paddingBottom) || 0;
    insetL = parseFloat(cs.paddingLeft) || 0;
  }

  const margin = 16;
  const bottom = viewH - insetB - margin;
  const right = viewW - insetR - margin;
  dashX = right - 30;
  dashY = bottom - 30;
}
