/**
 * VOIDPULSE MOBILE — pre-baked sprite atlas.
 *
 * Per the spec: radial glows and complex silhouettes are rasterized ONCE at
 * startup (and on palette change) into offscreen canvases, then blitted with
 * fast drawImage — zero per-frame gradient recalculation, zero shadowBlur in
 * the hot path.
 *
 * Visual language = approved board direction: gunmetal chassis + faction-color
 * neon stroke + glowing core ("void-machines").
 */
import { Palette } from './palette';
import * as W from './sim/world';

function mk(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  return { c, g };
}

// ---------------------------------------------------------------- exports
export let imgShip: HTMLCanvasElement[] = [];
export let imgEnemy: HTMLCanvasElement[] = [];
export let imgGlow: HTMLCanvasElement[] = [];      // indexed by P_COLOR slot
export let imgBolt: HTMLCanvasElement;
export let imgOrb: HTMLCanvasElement;
export let imgGem: HTMLCanvasElement;
export let imgCore: HTMLCanvasElement;
export let imgDashIcon: HTMLCanvasElement;
export let imgOdIcon: HTMLCanvasElement;
export let imgStars: HTMLCanvasElement[] = [];
export let gridTile: HTMLCanvasElement | null = null;  // renderer builds the pattern from its own ctx
export let slotCss: string[] = [];

// ---------------------------------------------------------------- helpers
function glow(g: CanvasRenderingContext2D, color: string, size: number): void {
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, color);
  gr.addColorStop(0.35, hexA(color, 0.5));
  gr.addColorStop(1, hexA(color, 0));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
}

/** #rrggbb → rgba() with alpha. Boot-time only. */
function hexA(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const gg = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ',' + gg + ',' + b + ',' + a + ')';
}

function poly(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, n: number, rot: number): void {
  g.beginPath();
  for (let k = 0; k < n; k++) {
    const a = rot + (k / n) * Math.PI * 2;
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
    if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

const GUNMETAL_A = '#39414f';
const GUNMETAL_B = '#161c26';

/** Gunmetal chassis + neon stroke + glowing core, centered in canvas. */
function chassis(size: number, r: number, sides: number, rot: number, col: string, coreR: number): HTMLCanvasElement {
  const { c, g } = mk(size, size);
  const cx = size / 2, cy = size / 2;
  // under-glow
  g.drawImage(imgGlow[slotOf(col)], cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
  // body
  poly(g, cx, cy, r, sides, rot);
  const grad = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  grad.addColorStop(0, GUNMETAL_A);
  grad.addColorStop(1, GUNMETAL_B);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = col;
  g.shadowColor = col;
  g.shadowBlur = 8;
  g.stroke();
  g.shadowBlur = 0;
  // inner panel line
  poly(g, cx, cy, r * 0.62, sides, rot);
  g.lineWidth = 1;
  g.strokeStyle = hexA(col, 0.35);
  g.stroke();
  // core
  if (coreR > 0) {
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 10;
    g.beginPath();
    g.arc(cx, cy, coreR, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
  }
  return c;
}

function slotOf(col: string): number {
  for (let i = 0; i < slotCss.length; i++) if (slotCss[i] === col) return i;
  return 0;
}

// ---------------------------------------------------------------- ships
function bakeShip(col: string, engine: string, variant: number): HTMLCanvasElement {
  const S = 64, cx = S / 2, cy = S / 2;
  const { c, g } = mk(S, S);
  // engine under-glow
  g.drawImage(imgGlow[W.PC_PLAYER], cx - 26, cy - 26, 52, 52);

  // hull: steel arrowhead pointing +x (angle 0)
  g.beginPath();
  if (variant === 0) {          // PULSE — classic arrow
    g.moveTo(cx + 22, cy);
    g.lineTo(cx - 14, cy - 13);
    g.lineTo(cx - 7, cy);
    g.lineTo(cx - 14, cy + 13);
  } else if (variant === 1) {   // WRAITH — narrow dart
    g.moveTo(cx + 26, cy);
    g.lineTo(cx - 6, cy - 9);
    g.lineTo(cx - 16, cy);
    g.lineTo(cx - 6, cy + 9);
  } else {                      // LEECH — broad blade
    g.moveTo(cx + 20, cy);
    g.lineTo(cx + 2, cy - 8);
    g.lineTo(cx - 16, cy - 15);
    g.lineTo(cx - 10, cy);
    g.lineTo(cx - 16, cy + 15);
    g.lineTo(cx + 2, cy + 8);
  }
  g.closePath();
  const grad = g.createLinearGradient(cx - 16, cy - 14, cx + 22, cy + 14);
  grad.addColorStop(0, GUNMETAL_A);
  grad.addColorStop(1, GUNMETAL_B);
  g.fillStyle = grad;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = col;
  g.shadowColor = col;
  g.shadowBlur = 9;
  g.stroke();
  g.shadowBlur = 0;

  // cockpit dot + engine flame base
  g.fillStyle = '#eafcff';
  g.beginPath(); g.arc(cx + 7, cy, 2.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = engine;
  g.shadowColor = engine;
  g.shadowBlur = 7;
  g.fillRect(cx - 15, cy - 2.5, 5, 5);
  g.shadowBlur = 0;
  return c;
}

// ---------------------------------------------------------------- bake all
export function bakeAll(pal: Palette): void {
  slotCss = [pal.player, pal.enemy, pal.enemy2, pal.enemy3, pal.boss, pal.gem, pal.core, pal.hurt, pal.heal];

  // glows per slot (64px soft disc)
  const glows: HTMLCanvasElement[] = [];
  for (let s = 0; s < slotCss.length; s++) {
    const { c, g } = mk(64, 64);
    glow(g, slotCss[s], 64);
    glows.push(c);
  }
  imgGlow = glows;

  // ships
  imgShip = [bakeShip(pal.player, pal.engine, 0), bakeShip(pal.player, pal.engine, 1), bakeShip(pal.player, pal.engine, 2)];

  // enemies (chassis: sides chosen per type silhouette)
  imgEnemy = [];
  imgEnemy[W.E_MOTE] = chassis(36, 10, 3, -Math.PI / 2, pal.enemy, 2.2);       // triangle
  imgEnemy[W.E_DRIFTER] = chassis(44, 13, 4, Math.PI / 4, pal.enemy, 2.6);     // kite
  imgEnemy[W.E_SPRINTER] = chassis(40, 12, 3, Math.PI / 2, pal.enemy, 2.2);    // dart
  imgEnemy[W.E_SPITTER] = chassis(44, 13, 5, -Math.PI / 2, pal.enemy2, 3);     // pentagon
  imgEnemy[W.E_SPLITTER] = chassis(48, 15, 6, 0, pal.enemy2, 3.2);             // hexagon
  imgEnemy[W.E_BULWARK] = chassis(60, 19, 7, Math.PI / 7, pal.enemy3, 3.8);    // heavy
  imgEnemy[W.E_VOLATILE] = chassis(40, 11, 8, 0, pal.enemy, 4);                // round bomb
  imgEnemy[W.E_BOSS] = bakeBoss(pal.boss);

  // projectiles
  const b = mk(20, 10);
  b.g.fillStyle = pal.player;
  b.g.shadowColor = pal.player; b.g.shadowBlur = 6;
  roundBar(b.g, 3, 2, 14, 6, 3);
  b.g.fill();
  imgBolt = b.c;

  const o = mk(18, 18);
  o.g.fillStyle = pal.enemy;
  o.g.shadowColor = pal.enemy; o.g.shadowBlur = 7;
  o.g.beginPath(); o.g.arc(9, 9, 4.5, 0, Math.PI * 2); o.g.fill();
  imgOrb = o.c;

  // pickups
  const gm = mk(22, 22);
  gm.g.translate(11, 11);
  gm.g.fillStyle = pal.gem;
  gm.g.shadowColor = pal.gem; gm.g.shadowBlur = 8;
  gm.g.beginPath();
  gm.g.moveTo(0, -7); gm.g.lineTo(5, 0); gm.g.lineTo(0, 7); gm.g.lineTo(-5, 0);
  gm.g.closePath(); gm.g.fill();
  imgGem = gm.c;

  const co = mk(26, 26);
  co.g.translate(13, 13);
  co.g.fillStyle = pal.core;
  co.g.shadowColor = pal.core; co.g.shadowBlur = 10;
  poly(co.g, 0, 0, 8, 6, Math.PI / 6);
  co.g.fill();
  co.g.fillStyle = 'rgba(255,255,255,.85)';
  co.g.beginPath(); co.g.arc(0, 0, 2.6, 0, Math.PI * 2); co.g.fill();
  imgCore = co.c;

  // button icons
  const d = mk(40, 40);
  d.g.strokeStyle = '#eafcff';
  d.g.lineWidth = 3.5;
  d.g.lineJoin = 'round';
  d.g.shadowColor = pal.player; d.g.shadowBlur = 6;
  d.g.beginPath();
  d.g.moveTo(10, 9); d.g.lineTo(24, 20); d.g.lineTo(10, 31);
  d.g.moveTo(20, 9); d.g.lineTo(34, 20); d.g.lineTo(20, 31);
  d.g.stroke();
  imgDashIcon = d.c;

  const od = mk(40, 40);
  od.g.fillStyle = '#eafcff';
  od.g.shadowColor = pal.core; od.g.shadowBlur = 8;
  od.g.beginPath();
  od.g.moveTo(24, 5); od.g.lineTo(12, 23); od.g.lineTo(20, 23);
  od.g.lineTo(16, 35); od.g.lineTo(29, 17); od.g.lineTo(21, 17);
  od.g.closePath(); od.g.fill();
  imgOdIcon = od.c;

  // starfield tiles (2 parallax layers)
  imgStars = [bakeStars(512, 110, 0.5, 1.1), bakeStars(512, 60, 0.9, 1.8)];

  // grid tile (renderer turns this into a pattern on its own context)
  const t = mk(256, 256);
  t.g.strokeStyle = hexA(pal.player, 0.05);
  t.g.lineWidth = 1;
  t.g.beginPath();
  for (let k = 0; k <= 256; k += 64) {
    t.g.moveTo(k + 0.5, 0); t.g.lineTo(k + 0.5, 256);
    t.g.moveTo(0, k + 0.5); t.g.lineTo(256, k + 0.5);
  }
  t.g.stroke();
  gridTile = t.c;
}

function bakeBoss(col: string): HTMLCanvasElement {
  const S = 176, cx = S / 2, cy = S / 2;
  const { c, g } = mk(S, S);
  g.drawImage(imgGlow[W.PC_BOSS], cx - 80, cy - 80, 160, 160);
  // outer octagon
  poly(g, cx, cy, 72, 8, Math.PI / 8);
  const grad = g.createLinearGradient(cx - 72, cy - 72, cx + 72, cy + 72);
  grad.addColorStop(0, GUNMETAL_A);
  grad.addColorStop(1, GUNMETAL_B);
  g.fillStyle = grad; g.fill();
  g.lineWidth = 3; g.strokeStyle = col;
  g.shadowColor = col; g.shadowBlur = 14; g.stroke();
  // inner ring
  g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2);
  g.lineWidth = 2; g.strokeStyle = hexA(col, 0.55); g.shadowBlur = 6; g.stroke();
  // prongs
  g.lineWidth = 3; g.strokeStyle = col;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46);
    g.lineTo(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
    g.stroke();
  }
  // core
  g.fillStyle = col;
  g.shadowColor = col; g.shadowBlur = 18;
  g.beginPath(); g.arc(cx, cy, 12, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(cx, cy, 4.5, 0, Math.PI * 2); g.fill();
  g.shadowBlur = 0;
  return c;
}

function bakeStars(size: number, n: number, alpha: number, maxR: number): HTMLCanvasElement {
  const { c, g } = mk(size, size);
  for (let k = 0; k < n; k++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 0.4 + Math.random() * maxR;
    g.fillStyle = 'rgba(200,235,255,' + (alpha * (0.25 + Math.random() * 0.6)).toFixed(2) + ')';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  return c;
}

function roundBar(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
