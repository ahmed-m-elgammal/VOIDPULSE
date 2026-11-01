/**
 * VOIDPULSE MOBILE — canvas renderer (v1.6.0 "MIRROR").
 * Draws the CORE's live game state (real enemies, weapons, FX, meta) with
 * pre-baked sprites: parallax starfield, grid, pooled blits, floating HUD.
 *
 * Hot-path hygiene: no object/array literals, no closures, no string
 * building per frame (cached number strings), index loops only.
 */
import { HULL_W, HULL_H, XP_H, HUD_PAD, HEAT_W, HEAT_H } from '../config';
import { rt } from '../bridge';
import { camX, camY, shakeX, shakeY } from '../camera';
import * as S from '../sprites';
import * as L from '../layout';
import { stickActive, stickFade, stickBaseX, stickBaseY, stickCurX, stickCurY } from '../input';
import { dashX, dashY } from '../layout';
import { SKIN_IDS } from '../../../src/game/skins';

let ctx: CanvasRenderingContext2D;
let canvas: HTMLCanvasElement;
let gridPat: CanvasPattern | null = null;
let vignette: HTMLCanvasElement | null = null;

// pre-baked font strings (no per-frame string building)
const F12 = '600 12px ui-monospace, monospace';
const F13 = '700 13px ui-monospace, monospace';
const F16 = '700 16px ui-monospace, monospace';
const F11 = '600 11px ui-monospace, monospace';
const F10 = '500 10px ui-monospace, monospace';
const F36 = '800 36px ui-monospace, monospace';

const TXT = '#dff6ff';
const DIM = 'rgba(223,246,255,0.55)';
const OD_COLOR = '#ffd94d';

// ---------------------------------------------------------------- string caches
const numCache = new Map<number, string>();
function ns(n: number): string {
  const c = numCache.get(n);
  if (c !== undefined) return c;
  const s = '' + n;
  numCache.set(n, s);
  return s;
}
const preCache = new Map<number, string>();
function pad2(n: number): string {
  const c = preCache.get(n);
  if (c !== undefined) return c;
  const s = (n < 10 ? '0' : '') + n;
  preCache.set(n, s);
  return s;
}
let timeStrSec = -1;
let timeStr = '0:00';
function timeStrFor(total: number): string {
  const sec = total | 0;
  if (sec === timeStrSec) return timeStr;
  timeStrSec = sec;
  timeStr = ns((sec / 60) | 0) + ':' + pad2(sec % 60);
  return timeStr;
}
let waveStrNum = -1;
let waveStr = 'WAVE 1';
let waveBannerT = 0;

export function resetRenderCaches(): void {
  numCache.clear(); preCache.clear();
  timeStrSec = -1; timeStr = '0:00'; waveStrNum = -1; waveStr = 'WAVE 1';
  waveBannerT = 1.6;
}

/** Light the center banner (called by the flow when a new wave starts). */
export function showWaveBanner(): void {
  waveBannerT = 1.6;
}

// ---------------------------------------------------------------- init/resize
export function initRender(cv: HTMLCanvasElement): void {
  canvas = cv;
  ctx = cv.getContext('2d', { alpha: false }) as CanvasRenderingContext2D;
  resizeRender();
}

export function resizeRender(): void {
  canvas.width = Math.max(1, (L.viewW * L.dpr) | 0);
  canvas.height = Math.max(1, (L.viewH * L.dpr) | 0);
  if (ctx && S.gridTile) gridPat = ctx.createPattern(S.gridTile, 'repeat');
  const v = document.createElement('canvas');
  v.width = Math.max(1, L.viewW | 0); v.height = Math.max(1, L.viewH | 0);
  const vg = v.getContext('2d') as CanvasRenderingContext2D;
  const grad = vg.createRadialGradient(v.width / 2, v.height / 2, Math.min(v.width, v.height) * 0.36,
    v.width / 2, v.height / 2, Math.max(v.width, v.height) * 0.72);
  grad.addColorStop(0, 'rgba(2,4,9,0)');
  grad.addColorStop(1, 'rgba(2,4,9,0.55)');
  vg.fillStyle = grad;
  vg.fillRect(0, 0, v.width, v.height);
  vignette = v;
}

// ---------------------------------------------------------------- helpers
function blit(img: HTMLCanvasElement, x: number, y: number, ang: number, alpha: number, scale: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (ang !== 0) ctx.rotate(ang);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.drawImage(img, -img.width * 0.5, -img.height * 0.5);
  ctx.restore();
  if (alpha !== 1) ctx.globalAlpha = 1;
}

function starLayer(img: HTMLCanvasElement, par: number, cl: number, ct: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  const size = 512;
  const ox = -(((cl * par) % size) + size) % size;
  const oy = -(((ct * par) % size) + size) % size;
  for (let x = ox; x < L.viewW; x += size) {
    for (let y = oy; y < L.viewH; y += size) {
      ctx.drawImage(img, x, y);
    }
  }
  ctx.globalAlpha = 1;
}

/** Ship sprite variant for the equipped skin (stable mapping, P0). */
function shipVariant(): number {
  const idx = SKIN_IDS.indexOf(rt.game.meta.data.skinEquipped);
  if (idx <= 0) return 0;
  return idx % 3;
}

// ---------------------------------------------------------------- main render
export function render(nowSec: number): void {
  const g = rt.game;
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, L.viewW, L.viewH);

  const inRun = g.state !== 'title';

  const cl = inRun ? camX - L.viewW * 0.5 - shakeX : nowSec * 6;
  const ct = inRun ? camY - L.viewH * 0.5 - shakeY : nowSec * 3;
  if (S.imgStars.length === 2) {
    starLayer(S.imgStars[0], 0.22, cl, ct, 0.8);
    starLayer(S.imgStars[1], 0.45, cl, ct, 1);
  }

  if (inRun) renderWorld(cl, ct, nowSec);

  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

  if (inRun && g.state !== 'gameover' && g.state !== 'victory') drawHUD(nowSec);
  if (g.state === 'playing') drawTouchControls(nowSec);

  if (vignette) ctx.drawImage(vignette, 0, 0, L.viewW, L.viewH);
}

function renderWorld(cl: number, ct: number, nowSec: number): void {
  const g = rt.game;

  // grid in world space
  if (gridPat) {
    ctx.save();
    ctx.translate(-cl, -ct);
    ctx.fillStyle = gridPat;
    ctx.fillRect(cl, ct, L.viewW, L.viewH);
    ctx.restore();
  }

  // arena border
  ctx.save();
  ctx.translate(-cl, -ct);
  ctx.strokeStyle = 'rgba(0,229,255,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, g.worldW - 2, g.worldH - 2);
  ctx.restore();

  const hw = L.viewW * 0.5 + 60, hh = L.viewH * 0.5 + 60;

  // ---- pickups (shards / heals / cores) ----
  const gems = g.gems;
  for (let i = 0; i < gems.length; i++) {
    const ge = gems[i];
    if (ge.dead) continue;
    const gx = ge.x, gy = ge.y;
    if (Math.abs(gx - camX) > hw || Math.abs(gy - camY) > hh) continue;
    const bob = Math.sin(ge.t * 4 + i) * 2;
    const img = ge.kind === 'core' ? S.imgCore : (ge.kind === 'heal' ? S.imgHeal : S.imgGem);
    blit(img, gx - cl, gy - ct + bob, 0, 0.95, 1);
  }

  // ---- particles ----
  const parts = g.particles;
  for (let i = 0; i < parts.length; i++) {
    const pa = parts[i];
    if (pa.dead) continue;
    const x = pa.x - cl, y = pa.y - ct;
    if (x < -20 || x > L.viewW + 20 || y < -20 || y > L.viewH + 20) continue;
    const a = pa.life / pa.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = pa.color;
    const s = pa.size * (0.5 + a * 0.5);
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
  }
  ctx.globalAlpha = 1;

  // ---- shocks (expanding rings) ----
  const shocks = g.shockwaves;
  for (let i = 0; i < shocks.length; i++) {
    const sh = shocks[i];
    if (sh.dead) continue;
    const x = sh.x - cl, y = sh.y - ct;
    if (x < -220 || x > L.viewW + 220 || y < -220 || y > L.viewH + 220) continue;
    const a = sh.life / sh.maxLife;
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = sh.color;
    ctx.lineWidth = sh.width;
    ctx.beginPath();
    ctx.arc(x, y, sh.r, 0, 6.2831853);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- rail beams ----
  const beams = g.beams;
  for (let i = 0; i < beams.length; i++) {
    const bm = beams[i];
    if (bm.dead) continue;
    const a = bm.life / bm.maxLife;
    ctx.globalAlpha = a;
    ctx.strokeStyle = bm.color;
    ctx.lineWidth = bm.width;
    ctx.beginPath();
    ctx.moveTo(bm.x - cl, bm.y - ct);
    ctx.lineTo(bm.x - cl + Math.cos(bm.angle) * bm.len, bm.y - ct + Math.sin(bm.angle) * bm.len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // ---- player bullets ----
  const bullets = g.bullets;
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (b.dead) continue;
    const x = b.x - cl, y = b.y - ct;
    if (x < -30 || x > L.viewW + 30 || y < -30 || y > L.viewH + 30) continue;
    const ang = b.angle !== 0 ? b.angle : Math.atan2(b.vy, b.vx);
    blit(S.imgBolt, x, y, ang, 1, 1);
  }

  // ---- enemy bullets ----
  const ebs = g.ebullets;
  for (let i = 0; i < ebs.length; i++) {
    const b = ebs[i];
    if (b.dead) continue;
    const x = b.x - cl, y = b.y - ct;
    if (x < -30 || x > L.viewW + 30 || y < -30 || y > L.viewH + 30) continue;
    const scale = b.mine ? 1.6 : b.r / 4.5;
    const a = b.telegraph ? 0.45 + Math.sin(nowSec * 24) * 0.3 : 1;
    blit(S.imgOrb, x, y, 0, a, scale);
  }

  // ---- enemies ----
  const enemies = g.enemies;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    const x = e.x - cl, y = e.y - ct;
    if (x < -120 || x > L.viewW + 120 || y < -120 || y > L.viewH + 120) continue;
    const isBoss = e.def.behavior === 'boss';
    const img = isBoss
      ? (S.imgEnemy['boss:' + e.def.color] ?? S.imgEnemy['boss'])
      : (S.imgEnemy[e.def.id] ?? S.imgEnemy['mote'] ?? S.imgEnemy['boss']);
    if (!img) continue;
    const ang = isBoss ? 0 : Math.atan2(e.vy, e.vx);
    blit(img, x, y, ang, 1, 1);
    if (e.flash > 0) blit(S.imgGlow[S.PC_HURT], x, y, 0, e.flash * 0.75, (img.width / 64) * 0.9);
    if (e.elite) {
      // elite vanguard ring
      ctx.globalAlpha = 0.55 + Math.sin(nowSec * 6 + i) * 0.15;
      ctx.strokeStyle = S.slotCss[S.PC_BOSS];
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, e.radius + 6 + Math.sin(nowSec * 4 + i) * 1.5, 0, 6.2831853);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---- companion drone ----
  const cp = g.companion;
  if (cp) {
    blit(S.imgCore, cp.x - cl, cp.y - ct, cp.angle, 0.9, 0.55);
  }

  // ---- player ----
  const p = g.player;
  const pxs = p.x - cl, pys = p.y - ct;
  const blink = (p.hitInvuln > 0 || p.dashInvuln > 0) && (((nowSec * 18) | 0) & 1) === 0;
  if (p.overdrive > 0) {
    blit(S.imgGlow[S.PC_CORE], pxs, pys, 0, 0.5 + Math.sin(nowSec * 14) * 0.2, 2.6);
  }
  const ship = S.imgShip[shipVariant()];
  if (!blink) {
    // dash trail ghosts (core-owned trail)
    const trail = p.trail;
    const n = trail.length;
    const start = n > 3 ? n - 3 : 0;
    for (let i = start; i < n; i++) {
      blit(ship, trail[i].x - cl, trail[i].y - ct, p.facing, trail[i].a * 0.35, 1);
    }
    blit(ship, pxs, pys, p.facing, 1, 1);
  } else {
    blit(ship, pxs, pys, p.facing, 0.35, 1);
  }

  // ---- damage / info floaters ----
  const texts = g.texts;
  ctx.textAlign = 'center';
  for (let i = 0; i < texts.length; i++) {
    const ft = texts[i];
    if (ft.dead) continue;
    const a = ft.life / ft.maxLife;
    ctx.globalAlpha = a;
    ctx.font = ft.size >= 20 ? F16 : F11;
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, ft.x - cl, ft.y - ct);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- HUD
function drawHUD(nowSec: number): void {
  const g = rt.game;
  const p = g.player;
  const x0 = L.insetL + HUD_PAD, y0 = L.insetT + HUD_PAD;

  // --- top-left: HULL bar + numeric ---
  const ratio = p.hp / p.maxHp;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x0, y0, HULL_W, HULL_H);
  ctx.fillStyle = ratio < 0.3 ? S.slotCss[S.PC_HURT] : S.slotCss[S.PC_PLAYER];
  ctx.fillRect(x0 + 1, y0 + 1, (HULL_W - 2) * (ratio < 0 ? 0 : ratio), HULL_H - 2);
  ctx.strokeStyle = 'rgba(0,229,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, HULL_W - 1, HULL_H - 1);
  ctx.font = F13;
  ctx.fillStyle = TXT;
  ctx.fillText(ns(Math.ceil(p.hp)), x0 + HULL_W + 8, y0 + HULL_H - 1);

  // dash charge pips
  const pipY = y0 + HULL_H + 7;
  const maxDash = rt.maxDash > 0 ? rt.maxDash : 2;
  for (let k = 0; k < maxDash; k++) {
    const px = x0 + k * 18;
    ctx.fillStyle = k < p.dashCharges ? S.slotCss[S.PC_PLAYER] : 'rgba(255,255,255,0.10)';
    ctx.fillRect(px, pipY, 14, 4);
    if (k === p.dashCharges && p.dashCharges < maxDash) {
      ctx.fillStyle = 'rgba(0,229,255,0.45)';
      ctx.fillRect(px, pipY, 14 * (p.dashRecharge < 0 ? 0 : p.dashRecharge), 4);
    }
  }

  // --- heat / overdrive bar (core: heat builds → auto OVERDRIVE) ---
  const hy = pipY + 9;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x0, hy, HEAT_W, HEAT_H);
  if (p.overdrive > 0) {
    const odF = p.overdrive / 7;
    ctx.fillStyle = OD_COLOR;
    ctx.globalAlpha = 0.75 + Math.sin(nowSec * 12) * 0.25;
    ctx.fillRect(x0, hy, HEAT_W * (odF < 0 ? 0 : odF), HEAT_H);
    ctx.globalAlpha = 1;
  } else {
    const hf = p.heat / 100;
    ctx.fillStyle = hf >= 1 ? OD_COLOR : 'rgba(255,217,77,0.65)';
    ctx.fillRect(x0, hy, HEAT_W * (hf < 0 ? 0 : hf), HEAT_H);
  }

  // --- top-center: wave + timer ---
  ctx.font = F12;
  ctx.fillStyle = DIM;
  ctx.textAlign = 'center';
  if (waveStrNum !== g.wave) { waveStrNum = g.wave; waveStr = 'WAVE ' + ns(g.wave); }
  ctx.fillText(waveStr, L.viewW * 0.5, y0 + 10);
  ctx.font = F16;
  ctx.fillStyle = TXT;
  ctx.fillText(timeStrFor(g.time), L.viewW * 0.5, y0 + 28);

  // --- boss bar (core bossState drives it) ---
  const boss = g.boss;
  const bs = g.bossState;
  if (boss && bs && bs.intro <= 0) {
    const bw = Math.min(300, L.viewW * 0.5);
    const bx0 = (L.viewW - bw) * 0.5, by0 = y0 + 40;
    const r = boss.hp / boss.maxHp;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(bx0, by0, bw, 6);
    ctx.fillStyle = S.slotCss[S.PC_BOSS];
    ctx.fillRect(bx0, by0, bw * (r < 0 ? 0 : r), 6);
    ctx.font = F10;
    ctx.fillStyle = S.slotCss[S.PC_BOSS];
    ctx.fillText(bs.def.name, L.viewW * 0.5, by0 - 4);
  }

  // wave banner
  if (waveBannerT > 0) {
    waveBannerT -= 1 / 60;
    const a = Math.min(1, waveBannerT * 1.4);
    ctx.globalAlpha = a;
    ctx.font = F36;
    ctx.fillStyle = TXT;
    ctx.fillText(waveStr, L.viewW * 0.5, L.viewH * 0.32);
    ctx.globalAlpha = 1;
  }
  ctx.textAlign = 'left';

  // --- top-right: score + kills (below the DOM pause button) ---
  ctx.textAlign = 'right';
  ctx.font = F16;
  ctx.fillStyle = TXT;
  ctx.fillText(ns(g.score | 0), L.viewW - L.insetR - HUD_PAD, y0 + 58);
  ctx.font = F11;
  ctx.fillStyle = DIM;
  ctx.fillText('KILLS ' + ns(g.kills), L.viewW - L.insetR - HUD_PAD, y0 + 73);
  ctx.textAlign = 'left';

  // --- bottom: full-width XP bar ---
  const xr = p.xp / p.xpNext;
  const yb = L.viewH - XP_H;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, yb, L.viewW, XP_H);
  ctx.fillStyle = S.slotCss[S.PC_GEM];
  ctx.fillRect(0, yb, L.viewW * (xr < 0 ? 0 : (xr > 1 ? 1 : xr)), XP_H);
  ctx.font = F10;
  ctx.fillStyle = DIM;
  ctx.fillText('LV ' + ns(p.level), L.viewW - L.insetR - HUD_PAD, yb - 4);
}

// ---------------------------------------------------------------- touch controls
function drawTouchControls(nowSec: number): void {
  const p = rt.game.player;

  // joystick
  const a = stickActive ? 1 : (stickFade > 0 ? stickFade : 0);
  if (a > 0) {
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = S.slotCss[S.PC_PLAYER];
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stickBaseX, stickBaseY, 55, 0, 6.2831853); ctx.stroke();
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = S.slotCss[S.PC_PLAYER];
    ctx.beginPath(); ctx.arc(stickCurX, stickCurY, 22, 0, 6.2831853); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- dash button (pie cooldown) ---
  drawBtn(dashX, dashY, S.imgDashIcon, 1, 1);
  const maxDash = rt.maxDash > 0 ? rt.maxDash : 2;
  const rechargeF = p.dashCharges >= maxDash ? 1 : p.dashRecharge;
  pieOverlay(dashX, dashY, rechargeF);
  if (p.dashCharges === 0) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#05070c';
    ctx.beginPath(); ctx.arc(dashX, dashY, 26, 0, 6.2831853); ctx.fill();
    ctx.globalAlpha = 1;
  }
  void nowSec;
}

function drawBtn(x: number, y: number, icon: HTMLCanvasElement, alpha: number, scale: number): void {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(10,15,22,0.6)';
  ctx.beginPath(); ctx.arc(x, y, 30, 0, 6.2831853); ctx.fill();
  ctx.strokeStyle = 'rgba(0,229,255,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.drawImage(icon, x - icon.width * 0.5 * scale, y - icon.height * 0.5 * scale,
    icon.width * scale, icon.height * scale);
  ctx.globalAlpha = 1;
}

function pieOverlay(x: number, y: number, f: number): void {
  if (f >= 1) return;
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = '#05070c';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, 29, -Math.PI / 2, -Math.PI / 2 + 6.2831853 * (1 - f));
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}
