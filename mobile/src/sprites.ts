/**
 * VOIDPULSE MOBILE — pre-baked sprite atlas (v1.6.0 "MIRROR").
 *
 * Sprites are rasterized ONCE at startup (and on palette change) from the
 * CORE's enemy definitions (shape/color/glow/radius), then blitted with fast
 * drawImage — zero per-frame gradient recalculation, zero shadowBlur in the
 * hot path.
 *
 * Visual language = gunmetal chassis + faction neon stroke + glowing core.
 */
import type { EnemyDef } from '../../src/game/types';
import type { Palette } from './palette';

function mk(w: number, h: number): { c: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  return { c, g };
}

// ---------------------------------------------------------------- color slots
export const PC_PLAYER = 0;
export const PC_ENEMY = 1;
export const PC_ENEMY2 = 2;
export const PC_ENEMY3 = 3;
export const PC_BOSS = 4;
export const PC_GEM = 5;
export const PC_CORE = 6;
export const PC_HURT = 7;
export const PC_HEAL = 8;

// ---------------------------------------------------------------- exports
export let imgShip: HTMLCanvasElement[] = [];
export let imgEnemy: Record<string, HTMLCanvasElement> = {};
export let imgGlow: HTMLCanvasElement[] = [];   // indexed by PC_* slot
export let imgBolt: HTMLCanvasElement;
export let imgOrb: HTMLCanvasElement;
export let imgGem: HTMLCanvasElement;           // xp shard
export let imgCore: HTMLCanvasElement;          // core pickup
export let imgHeal: HTMLCanvasElement;          // repair pickup
export let imgDashIcon: HTMLCanvasElement;
export let imgStars: HTMLCanvasElement[] = [];
export let gridTile: HTMLCanvasElement | null = null;
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
  if (hex.charCodeAt(0) !== 35) return hex; // not #rgb — pass through
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

function slotOf(col: string): number {
  for (let i = 0; i < slotCss.length; i++) if (slotCss[i] === col) return i;
  return 0;
}

/** Gunmetal chassis + neon stroke + glowing core, centered in canvas. */
function chassis(size: number, r: number, sides: number, rot: number, col: string, coreR: number): HTMLCanvasElement {
  const { c, g } = mk(size, size);
  const cx = size / 2, cy = size / 2;
  g.drawImage(imgGlow[slotOf(col)], cx - r * 1.6, cy - r * 1.6, r * 3.2, r * 3.2);
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
  poly(g, cx, cy, r * 0.62, sides, rot);
  g.lineWidth = 1;
  g.strokeStyle = hexA(col, 0.35);
  g.stroke();
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

/** Core EnemyDef.shape → silhouette geometry (sides, rotation, round-ness). */
const SHAPE_GEO: Record<string, { sides: number; rot: number }> = {
  mote: { sides: 3, rot: -Math.PI / 2 },
  drifter: { sides: 4, rot: Math.PI / 4 },
  sprinter: { sides: 3, rot: Math.PI / 2 },
  spitter: { sides: 5, rot: -Math.PI / 2 },
  splitter: { sides: 6, rot: 0 },
  bulwark: { sides: 7, rot: Math.PI / 7 },
  orbiter: { sides: 4, rot: 0 },
  shard: { sides: 3, rot: Math.PI },
  volatile: { sides: 8, rot: 0 },
  lancer: { sides: 4, rot: -Math.PI / 4 },
  mender: { sides: 5, rot: Math.PI / 2 },
  phantom: { sides: 4, rot: Math.PI / 2 },
  boss: { sides: 8, rot: Math.PI / 8 },
};

// ---------------------------------------------------------------- ships
function bakeShip(col: string, engine: string, variant: number): HTMLCanvasElement {
  const S = 64, cx = S / 2, cy = S / 2;
  const { c, g } = mk(S, S);
  g.drawImage(imgGlow[PC_PLAYER], cx - 26, cy - 26, 52, 52);

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

  g.fillStyle = '#eafcff';
  g.beginPath(); g.arc(cx + 7, cy, 2.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = engine;
  g.shadowColor = engine;
  g.shadowBlur = 7;
  g.fillRect(cx - 15, cy - 2.5, 5, 5);
  g.shadowBlur = 0;
  return c;
}

function bakeBoss(col: string): HTMLCanvasElement {
  const S = 176, cx = S / 2, cy = S / 2;
  const { c, g } = mk(S, S);
  g.drawImage(imgGlow[PC_BOSS], cx - 80, cy - 80, 160, 160);
  poly(g, cx, cy, 72, 8, Math.PI / 8);
  const grad = g.createLinearGradient(cx - 72, cy - 72, cx + 72, cy + 72);
  grad.addColorStop(0, GUNMETAL_A);
  grad.addColorStop(1, GUNMETAL_B);
  g.fillStyle = grad; g.fill();
  g.lineWidth = 3; g.strokeStyle = col;
  g.shadowColor = col; g.shadowBlur = 14; g.stroke();
  g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2);
  g.lineWidth = 2; g.strokeStyle = hexA(col, 0.55); g.shadowBlur = 6; g.stroke();
  g.lineWidth = 3; g.strokeStyle = col;
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46);
    g.lineTo(cx + Math.cos(a) * 74, cy + Math.sin(a) * 74);
    g.stroke();
  }
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

// ---------------------------------------------------------------- bake all
/** Bake everything from the palette + the CORE's enemy/boss definitions. */
export function bakeAll(pal: Palette, enemies: Record<string, EnemyDef>, bossColors: string[]): void {
  slotCss = [pal.player, pal.enemy, pal.enemy2, pal.enemy3, pal.boss, pal.gem, pal.core, pal.hurt, pal.heal];

  const glows: HTMLCanvasElement[] = [];
  for (let s = 0; s < slotCss.length; s++) {
    const { c, g } = mk(64, 64);
    glow(g, slotCss[s], 64);
    glows.push(c);
  }
  imgGlow = glows;

  imgShip = [bakeShip(pal.player, pal.engine, 0), bakeShip(pal.player, pal.engine, 1), bakeShip(pal.player, pal.engine, 2)];

  // enemies — one chassis per CORE def, using the def's own colors/radius
  imgEnemy = {};
  for (const id in enemies) {
    const def = enemies[id];
    const geo = SHAPE_GEO[def.shape] ?? SHAPE_GEO.drifter;
    const col = def.color || pal.enemy;
    const r = Math.max(9, def.radius);
    imgEnemy[id] = chassis(Math.ceil(r * 2 + 16), r, geo.sides, geo.rot, col, Math.max(2, r * 0.22));
  }
  // bosses — one bake per boss color (dedup via slot map)
  for (let i = 0; i < bossColors.length; i++) {
    const col = bossColors[i];
    if (imgEnemy['boss:' + col]) continue;
    imgEnemy['boss:' + col] = bakeBoss(col);
  }
  imgEnemy['boss'] = bakeBoss(pal.boss);

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

  const hl = mk(22, 22);
  hl.g.translate(11, 11);
  hl.g.fillStyle = pal.heal;
  hl.g.shadowColor = pal.heal; hl.g.shadowBlur = 8;
  hl.g.fillRect(-6, -2, 12, 4);
  hl.g.fillRect(-2, -6, 4, 12);
  imgHeal = hl.c;

  const co = mk(26, 26);
  co.g.translate(13, 13);
  co.g.fillStyle = pal.core;
  co.g.shadowColor = pal.core; co.g.shadowBlur = 10;
  poly(co.g, 0, 0, 8, 6, Math.PI / 6);
  co.g.fill();
  co.g.fillStyle = 'rgba(255,255,255,.85)';
  co.g.beginPath(); co.g.arc(0, 0, 2.6, 0, Math.PI * 2); co.g.fill();
  imgCore = co.c;

  // dash icon
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

  imgStars = [bakeStars(512, 110, 0.5, 1.1), bakeStars(512, 60, 0.9, 1.8)];

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
