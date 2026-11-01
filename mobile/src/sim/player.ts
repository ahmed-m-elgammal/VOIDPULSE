/**
 * VOIDPULSE MOBILE — player state & tick.
 * Owns every mutable player field (module `export let`), the hull roster,
 * dash + overdrive, firing, XP/levels and damage intake.
 */
import {
  P_RADIUS, P_BULLET_SPD, P_DASH_CHARGES, P_DASH_TIME, P_DASH_MULT,
  P_DASH_IFRAME, P_IFRAME_HIT, P_FIRE_BASE, P_MAGNET_BASE, P_PICKUP_R,
  OD_DURATION, OD_FIRE_MULT, OD_DMG_MULT, OD_MAGNET_MULT,
  WORLD_W, WORLD_H,
} from '../config';
import { clamp } from '../types';
import { HullDef } from '../types';
import * as W from './world';
import { addTrauma } from '../camera';
import { sfxShoot, sfxDash, sfxHurt, sfxOverdrive } from '../audio';
import { hapLight, hapMedium } from '../haptics';

// ---------------------------------------------------------------- hulls
export const HULLS: HullDef[] = [
  { id: 0, name: 'PULSE',  tag: 'BALANCED PROTOTYPE', hp: 100, speed: 240, dmg: 10, fireRate: 3.0, dashCd: 2.4, regen: 0.0, cost: 0 },
  { id: 1, name: 'WRAITH', tag: 'GLASS-CANNON INTERCEPTOR', hp: 70, speed: 285, dmg: 8, fireRate: 3.4, dashCd: 1.7, regen: 0.0, cost: 350 },
  { id: 2, name: 'LEECH',  tag: 'REGENERATIVE JUGGERNAUT', hp: 135, speed: 215, dmg: 12, fireRate: 2.6, dashCd: 2.7, regen: 1.2, cost: 800 },
];

// ---------------------------------------------------------------- state
export let pX = 0, pY = 0, pVX = 0, pVY = 0;
export let pHp = 100, pMaxHp = 100;
export let pFireCd = 0;
export let pDashCharges = P_DASH_CHARGES;
export let pDashCd = 0;
export let pDashT = 0;
export let pDashVX = 0, pDashVY = 0;
export let pIframe = 0;
export let aimAngle = -1.5707963;
export let firing = false;
export let moveX = 0, moveY = 0;
export let dashRequested = false;
export let odRequested = false;
export let odMeter = 0, odActive = 0;

// mods (perk-raised)
export let pSpeed = 240, pDmg = 10, pFireRate = P_FIRE_BASE, pBulletSpd = P_BULLET_SPD;
export let pMagnet = P_MAGNET_BASE, pMultishot = 1, pPierce = 0, pCrit = 0;
export let pXpGain = 1, pOdGain = 1, pRegen = 0, pDashCdMax = 2.4, pThorns = 0;
export let pXp = 0, pLevel = 1, pXpNext = 10, pendingLevels = 0;

const TAU = 6.2831853;

// ---------------------------------------------------------------- reset
export function resetPlayer(hull: number): void {
  const h = HULLS[hull];
  pX = 1120; pY = 800; pVX = 0; pVY = 0;
  pHp = h.hp; pMaxHp = h.hp;
  pFireCd = 0;
  pDashCharges = P_DASH_CHARGES; pDashCd = 0; pDashT = 0; pDashVX = 0; pDashVY = 0;
  pIframe = 0; aimAngle = -1.5707963;
  firing = false; moveX = 0; moveY = 0; dashRequested = false; odRequested = false;
  odMeter = 0; odActive = 0;
  pSpeed = h.speed; pDmg = h.dmg; pFireRate = h.fireRate; pBulletSpd = P_BULLET_SPD;
  pMagnet = P_MAGNET_BASE; pMultishot = 1; pPierce = 0; pCrit = 0;
  pXpGain = 1; pOdGain = 1; pRegen = h.regen; pDashCdMax = h.dashCd; pThorns = 0;
  pXp = 0; pLevel = 1; pXpNext = 10; pendingLevels = 0;
}

// ---------------------------------------------------------------- setters (input / UI)
export function setMove(mx: number, my: number): void { moveX = mx; moveY = my; }
export function setAim(a: number): void { aimAngle = a; }
export function setFiring(f: boolean): void { firing = f; }
export function requestDash(): void { dashRequested = true; }
export function requestOverdrive(): void { odRequested = true; }

// ---------------------------------------------------------------- helpers
export function heal(n: number): void {
  pHp = Math.min(pMaxHp, pHp + n);
}

export function grantXp(raw: number): void {
  pXp += raw * pXpGain;
  while (pXp >= pXpNext) {
    pXp -= pXpNext;
    pLevel++;
    pXpNext = 6 + 4 * pLevel;
    pendingLevels++;
  }
}

/** Perk ids are owned here (same module as the state they mutate). */
export function applyPerk(id: number): void {
  if (id === 0) { pDmg *= 1.25; }
  else if (id === 1) { pFireRate *= 1.18; }
  else if (id === 2) { pSpeed *= 1.12; }
  else if (id === 3) { pMaxHp += 25; heal(25); }
  else if (id === 4) { pDashCdMax *= 0.8; }
  else if (id === 5) { if (pMultishot < 3) pMultishot++; }
  else if (id === 6) { pPierce += 1; }
  else if (id === 7) { pCrit = Math.min(0.6, pCrit + 0.10); }
  else if (id === 8) { pMagnet *= 1.45; }
  else if (id === 9) { pXpGain += 0.20; }
  else if (id === 10) { pBulletSpd *= 1.25; }
  else if (id === 11) { pOdGain += 0.30; }
  else if (id === 12) { pRegen += 0.8; }
  else if (id === 13) { pThorns += 12; }
}

export function addOd(n: number): void {
  if (odActive <= 0) odMeter = Math.min(1, odMeter + n * pOdGain);
}

/** Consume one queued level-up (after a perk card is picked). */
export function consumeLevel(): void { pendingLevels--; }

/** Dev/deep-link helper: force a perk choice. */
export function debugForceLevel(): void { pendingLevels++; }

/** Damage intake with i-frames. Returns true if the hit landed. */
export function damagePlayer(dmg: number, fromX: number, fromY: number): boolean {
  if (pIframe > 0 || pDashT > 0) return false;
  pHp -= dmg;
  pIframe = P_IFRAME_HIT;
  addTrauma(0.55);
  hapMedium();
  sfxHurt();
  let dx = pX - fromX, dy = pY - fromY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  W.burst(pX + (dx / d) * 10, pY + (dy / d) * 10, 7, 150, W.PC_HURT, 3);
  if (pHp <= 0) { pHp = 0; W.setRunOver(false); }
  return true;
}

// ---------------------------------------------------------------- tick
export function tickPlayer(dt: number): void {
  // --- overdrive activation
  if (odRequested) {
    odRequested = false;
    if (odMeter >= 1 && odActive <= 0) {
      odActive = OD_DURATION;
      odMeter = 0;
      sfxOverdrive();
      hapMedium();
      addTrauma(0.35);
      W.burst(pX, pY, 22, 260, W.PC_PLAYER, 4);
    }
  }
  const odOn = odActive > 0;
  if (odOn) odActive -= dt;

  // --- dash
  if (dashRequested) {
    dashRequested = false;
    if (pDashCharges > 0 && pDashT <= 0) {
      pDashCharges--;
      if (pDashCd <= 0) pDashCd = pDashCdMax;
      pDashT = P_DASH_TIME;
      pIframe = Math.max(pIframe, P_DASH_IFRAME);
      let dx = moveX, dy = moveY;
      if (dx === 0 && dy === 0) { dx = Math.cos(aimAngle); dy = Math.sin(aimAngle); }
      const dl = Math.sqrt(dx * dx + dy * dy) || 1;
      pDashVX = (dx / dl) * pSpeed * P_DASH_MULT;
      pDashVY = (dy / dl) * pSpeed * P_DASH_MULT;
      W.burst(pX, pY, 10, 200, W.PC_PLAYER, 3);
      sfxDash();
      hapLight();
    }
  }
  if (pDashCharges < P_DASH_CHARGES) {
    pDashCd -= dt;
    if (pDashCd <= 0) { pDashCharges++; if (pDashCharges < P_DASH_CHARGES) pDashCd = pDashCdMax; }
  }

  // --- movement
  if (pDashT > 0) {
    pDashT -= dt;
    pVX = pDashVX; pVY = pDashVY;
  } else {
    pVX = moveX * pSpeed;
    pVY = moveY * pSpeed;
  }
  pX += pVX * dt; pY += pVY * dt;
  if (pX < P_RADIUS) { pX = P_RADIUS; pVX = 0; } else if (pX > WORLD_W - P_RADIUS) { pX = WORLD_W - P_RADIUS; pVX = 0; }
  if (pY < P_RADIUS) { pY = P_RADIUS; pVY = 0; } else if (pY > WORLD_H - P_RADIUS) { pY = WORLD_H - P_RADIUS; pVY = 0; }

  // --- regen & timers
  if (pRegen > 0) heal(pRegen * dt);
  if (pIframe > 0) pIframe -= dt;
  if (pFireCd > 0) pFireCd -= dt;

  // --- firing
  if (firing && pFireCd <= 0) {
    pFireCd = 1 / (pFireRate * (odOn ? OD_FIRE_MULT : 1));
    const shots = pMultishot;
    const base = pDmg * (odOn ? OD_DMG_MULT : 1);
    for (let s = 0; s < shots; s++) {
      const off = (s - (shots - 1) * 0.5) * 0.14;
      const a = aimAngle + off;
      const ca = Math.cos(a), sa = Math.sin(a);
      let dmg = base;
      if (pCrit > 0 && Math.random() < pCrit) dmg *= 2;
      W.spawnBullet(pX + ca * 16, pY + sa * 16, ca * pBulletSpd, sa * pBulletSpd,
        1.6, dmg, 4, 1, pPierce);
    }
    sfxShoot();
  }

  odMeter = clamp(odMeter, 0, 1);
}
