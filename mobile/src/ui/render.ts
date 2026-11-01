/**
 * VOIDPULSE MOBILE — canvas renderer: parallax starfield, grid, pooled
 * entities via pre-baked drawImage blits, and the floating HUD.
 *
 * Hot-path hygiene: no object/array literals, no closures, no string
 * building per frame (cached number strings), index loops only.
 */
import {
  HULL_W, HULL_H, XP_H, HUD_PAD, P_DASH_CHARGES, P_RADIUS,
  WORLD_W, WORLD_H,
} from '../config';
import { ST_TITLE, ST_GARAGE, ST_RUNNING, ST_LEVELUP, ST_PAUSED, ST_GAMEOVER } from '../types';
import * as W from '../sim/world';
import * as P from '../sim/player';
import { camX, camY, shakeX, shakeY } from '../camera';
import * as S from '../sprites';
import { slotCss } from '../sprites';
import * as L from '../layout';
import { stickActive, stickFade, stickBaseX, stickBaseY, stickCurX, stickCurY, aimActive } from '../input';
import { dashX, dashY, odX, odY } from '../layout';
import { save } from '../save';

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

// ---------------------------------------------------------------- string caches
// Allocate once per NEW displayed value (warm-up), zero steady-state garbage.
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
  // bake vignette for this viewport
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
  if (scale !== 1) { ctx.scale(scale, scale); }
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

// ---------------------------------------------------------------- main render
export function render(nowSec: number): void {
  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, L.viewW, L.viewH);

  const st = W.state;
  const inRun = st === ST_RUNNING || st === ST_LEVELUP || st === ST_PAUSED || st === ST_GAMEOVER;

  // parallax starfield everywhere
  const cl = inRun ? camX - L.viewW * 0.5 - shakeX : nowSec * 6;
  const ct = inRun ? camY - L.viewH * 0.5 - shakeY : nowSec * 3;
  if (S.imgStars.length === 2) {
    starLayer(S.imgStars[0], 0.22, cl, ct, 0.8);
    starLayer(S.imgStars[1], 0.45, cl, ct, 1);
  }

  if (inRun) renderWorld(cl, ct, nowSec);

  ctx.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);

  if (inRun && st !== ST_GAMEOVER) drawHUD(nowSec);
  if (st === ST_RUNNING) drawTouchControls(nowSec);

  if (vignette) ctx.drawImage(vignette, 0, 0, L.viewW, L.viewH);
}

function renderWorld(cl: number, ct: number, nowSec: number): void {
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
  ctx.strokeRect(1, 1, WORLD_W - 2, WORLD_H - 2);
  ctx.restore();

  // ---- gems (culled) ----
  const hw = L.viewW * 0.5 + 60, hh = L.viewH * 0.5 + 60;
  for (let i = 0; i < W.gCount; i++) {
    const gx = W.gx[i], gy = W.gy[i];
    if (Math.abs(gx - camX) > hw || Math.abs(gy - camY) > hh) continue;
    const bob = Math.sin(W.gAge[i] * 4 + i) * 2;
    blit(W.gKind[i] === 0 ? S.imgGem : S.imgCore, gx - cl, gy - ct + bob, 0, 0.95, 1);
  }

  // ---- particles (screen-space rects) ----
  for (let i = 0; i < W.pCount; i++) {
    const x = W.ppx[i] - cl, y = W.ppy[i] - ct;
    if (x < -20 || x > L.viewW + 20 || y < -20 || y > L.viewH + 20) continue;
    const a = W.plife[i] / W.pmax[i];
    ctx.globalAlpha = a;
    ctx.fillStyle = slotCss[W.pCol[i]];
    const s = W.psize[i] * (0.5 + a * 0.5);
    ctx.fillRect(x - s * 0.5, y - s * 0.5, s, s);
  }
  ctx.globalAlpha = 1;

  // ---- bullets ----
  for (let i = 0; i < W.bCount; i++) {
    const x = W.bx[i] - cl, y = W.by[i] - ct;
    if (x < -30 || x > L.viewW + 30 || y < -30 || y > L.viewH + 30) continue;
    if (W.bFriendly[i] === 1) blit(S.imgBolt, x, y, Math.atan2(W.bvy[i], W.bvx[i]), 1, 1);
    else blit(S.imgOrb, x, y, 0, 1, 1);
  }

  // ---- enemies ----
  for (let i = 0; i < W.eCount; i++) {
    const t = W.eType[i];
    const x = W.ex[i] - cl, y = W.ey[i] - ct;
    if (x < -120 || x > L.viewW + 120 || y < -120 || y > L.viewH + 120) continue;
    const img = S.imgEnemy[t];
    const ang = (t === W.E_BOSS) ? 0 : Math.atan2(W.evy[i], W.evx[i]);
    const flash = W.eflash[i] > 0 ? W.eflash[i] : 0;
    blit(img, x, y, ang, 1, 1);
    if (flash > 0) blit(S.imgGlow[W.PC_PLAYER], x, y, 0, flash * 0.75, (img.width / 64) * 0.9);
    if (t === W.E_SPRINTER && W.eState[i] === 1) {
      // windup telegraph
      const p = 0.5 + Math.sin(nowSec * 26) * 0.5;
      blit(S.imgGlow[W.PC_ENEMY], x, y, 0, p * 0.7, 1.6);
    }
    if (t === W.E_BOSS) {
      // boss HP bar
      const bw = 240, bx0 = x - bw * 0.5, by0 = y - img.height * 0.5 - 26;
      const ratio = W.ehp[i] / W.emaxhp[i];
      ctx.fillStyle = 'rgba(10,14,22,0.8)';
      ctx.fillRect(bx0, by0, bw, 8);
      ctx.fillStyle = slotCss[W.PC_BOSS];
      ctx.fillRect(bx0 + 1, by0 + 1, (bw - 2) * ratio, 6);
      ctx.strokeStyle = slotCss[W.PC_BOSS];
      ctx.lineWidth = 1;
      ctx.strokeRect(bx0 + 0.5, by0 + 0.5, bw - 1, 7);
    }
  }

  // ---- player ----
  const pxs = P.pX - cl, pys = P.pY - ct;
  const blink = P.pIframe > 0 && (((nowSec * 18) | 0) & 1) === 0;
  if (P.odActive > 0) {
    blit(S.imgGlow[W.PC_PLAYER], pxs, pys, 0, 0.5 + Math.sin(nowSec * 14) * 0.2, 2.6);
  }
  if (!blink) {
    if (P.pDashT > 0) {
      // dash afterimages
      blit(S.imgShip[save.hull], pxs - P.pVX * 0.02, pys - P.pVY * 0.02, P.aimAngle, 0.35, 1);
      blit(S.imgShip[save.hull], pxs - P.pVX * 0.04, pys - P.pVY * 0.04, P.aimAngle, 0.18, 1);
    }
    blit(S.imgShip[save.hull], pxs, pys, P.aimAngle, 1, 1);
  } else {
    blit(S.imgShip[save.hull], pxs, pys, P.aimAngle, 0.35, 1);
  }

  // ---- damage floaters ----
  ctx.font = F11;
  ctx.textAlign = 'center';
  for (let i = 0; i < W.flCount; i++) {
    const a = W.flLife[i] / 0.8;
    ctx.globalAlpha = a;
    ctx.fillStyle = slotCss[W.PC_HURT];
    ctx.fillText(ns(W.flVal[i]), W.flx[i] - cl, W.fly[i] - ct);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------- HUD
function drawHUD(nowSec: number): void {
  const x0 = L.insetL + HUD_PAD, y0 = L.insetT + HUD_PAD;

  // --- top-left: HULL bar + numeric + dash pips ---
  const ratio = P.pHp / P.pMaxHp;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x0, y0, HULL_W, HULL_H);
  ctx.fillStyle = ratio < 0.3 ? slotCss[W.PC_HURT] : slotCss[W.PC_PLAYER];
  ctx.fillRect(x0 + 1, y0 + 1, (HULL_W - 2) * (ratio < 0 ? 0 : ratio), HULL_H - 2);
  ctx.strokeStyle = 'rgba(0,229,255,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, HULL_W - 1, HULL_H - 1);
  ctx.font = F13;
  ctx.fillStyle = TXT;
  ctx.fillText(ns(P.pHp | 0), x0 + HULL_W + 8, y0 + HULL_H - 1);

  // dash charge pips
  const pipY = y0 + HULL_H + 7;
  for (let k = 0; k < P_DASH_CHARGES; k++) {
    const px = x0 + k * 18;
    ctx.fillStyle = k < P.pDashCharges ? slotCss[W.PC_PLAYER] : 'rgba(255,255,255,0.10)';
    ctx.fillRect(px, pipY, 14, 4);
    if (k === P.pDashCharges && P.pDashCharges < P_DASH_CHARGES) {
      // recharging pip — partial fill
      const f = 1 - P.pDashCd / P.pDashCdMax;
      ctx.fillStyle = 'rgba(0,229,255,0.45)';
      ctx.fillRect(px, pipY, 14 * (f < 0 ? 0 : f), 4);
    }
  }

  // --- top-center: wave + timer (+ boss bar) ---
  ctx.font = F12;
  ctx.fillStyle = DIM;
  ctx.textAlign = 'center';
  if (waveStrNum !== W.wave) { waveStrNum = W.wave; waveStr = 'WAVE ' + ns(W.wave); }
  ctx.fillText(waveStr, L.viewW * 0.5, y0 + 10);
  ctx.font = F16;
  ctx.fillStyle = TXT;
  ctx.fillText(timeStrFor(W.runTime), L.viewW * 0.5, y0 + 28);

  if (W.bossAlive) {
    // find boss index (single boss at a time)
    for (let i = 0; i < W.eCount; i++) {
      if (W.eType[i] === W.E_BOSS) {
        const bw = Math.min(300, L.viewW * 0.5);
        const bx0 = (L.viewW - bw) * 0.5, by0 = y0 + 40;
        const r = W.ehp[i] / W.emaxhp[i];
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(bx0, by0, bw, 6);
        ctx.fillStyle = slotCss[W.PC_BOSS];
        ctx.fillRect(bx0, by0, bw * (r < 0 ? 0 : r), 6);
        ctx.fillStyle = slotCss[W.PC_BOSS];
        ctx.font = F10;
        ctx.fillText('⟡ WARDEN', L.viewW * 0.5, by0 - 4);
        break;
      }
    }
  }

  // wave banner
  if (waveBannerT > 0) {
    waveBannerT -= 1 / 60; // HUD runs at frame rate; coarse decay is fine
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
  ctx.fillText(ns(W.score | 0), L.viewW - L.insetR - HUD_PAD, y0 + 58);
  ctx.font = F11;
  ctx.fillStyle = DIM;
  ctx.fillText('KILLS ' + ns(W.kills), L.viewW - L.insetR - HUD_PAD, y0 + 73);
  ctx.textAlign = 'left';

  // --- bottom: full-width XP bar ---
  const xr = P.pXp / P.pXpNext;
  const yb = L.viewH - XP_H;
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(0, yb, L.viewW, XP_H);
  ctx.fillStyle = slotCss[W.PC_GEM];
  ctx.fillRect(0, yb, L.viewW * (xr < 0 ? 0 : (xr > 1 ? 1 : xr)), XP_H);
  // level notch
  ctx.font = F10;
  ctx.fillStyle = DIM;
  ctx.fillText('LV ' + ns(P.pLevel), L.viewW - L.insetR - HUD_PAD, yb - 4);
}

// ---------------------------------------------------------------- touch controls
function drawTouchControls(nowSec: number): void {
  // joystick
  const a = stickActive ? 1 : (stickFade > 0 ? stickFade : 0);
  if (a > 0) {
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = slotCss[W.PC_PLAYER];
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stickBaseX, stickBaseY, 55, 0, 6.2831853); ctx.stroke();
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = slotCss[W.PC_PLAYER];
    ctx.beginPath(); ctx.arc(stickCurX, stickCurY, 22, 0, 6.2831853); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // manual aim guide
  if (aimActive) {
    const sxp = P.pX - (camX - L.viewW * 0.5 - shakeX);
    const syp = P.pY - (camY - L.viewH * 0.5 - shakeY);
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = slotCss[W.PC_PLAYER];
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sxp, syp);
    ctx.lineTo(sxp + Math.cos(P.aimAngle) * 90, syp + Math.sin(P.aimAngle) * 90);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- dash button (pie cooldown) ---
  drawBtn(dashX, dashY, S.imgDashIcon, 1, 1);
  const rechargeF = P.pDashCharges >= P_DASH_CHARGES ? 1
    : (1 - P.pDashCd / P.pDashCdMax);
  pieOverlay(dashX, dashY, rechargeF);
  if (P.pDashCharges === 0) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#05070c';
    ctx.beginPath(); ctx.arc(dashX, dashY, 26, 0, 6.2831853); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // --- overdrive button ---
  const ready = P.odMeter >= 1;
  const active = P.odActive > 0;
  const pulse = ready ? 0.65 + Math.sin(nowSec * 8) * 0.35 : 0.35;
  ctx.globalAlpha = pulse;
  ctx.strokeStyle = slotCss[W.PC_CORE];
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(odX, odY, 30, 0, 6.2831853); ctx.stroke();
  ctx.globalAlpha = 1;
  drawBtn(odX, odY, S.imgOdIcon, active ? 1 : (ready ? 1 : 0.5), active || ready ? 1 : 0.75);
  if (active) {
    // countdown ring
    ctx.strokeStyle = slotCss[W.PC_CORE];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(odX, odY, 34, -Math.PI / 2, -Math.PI / 2 + 6.2831853 * (P.odActive / 6));
    ctx.stroke();
  } else if (!ready) {
    // charge progress arc
    ctx.strokeStyle = 'rgba(255,224,102,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(odX, odY, 34, -Math.PI / 2, -Math.PI / 2 + 6.2831853 * P.odMeter);
    ctx.stroke();
  }
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
