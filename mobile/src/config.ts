/**
 * VOIDPULSE MOBILE — shell tunables (CSS pixels).
 * GAME balance lives exclusively in src/game (core). This file only holds
 * presentation/layout constants owned by the mobile shell.
 */

// --- thermal ---
export const DPR_CAP = 2; // never render above 2x

// --- camera ---
export const CAM_LEAD = 0.12;   // velocity lead multiplier
export const CAM_SMOOTH = 6.5;  // exponential smoothing rate
export const SHAKE_DECAY = 1.7; // trauma decay per second
export const SHAKE_AMP = 13;    // max shake offset at trauma = 1
export const SHAKE_FREQ = 31;

// --- left-thumb floating joystick ---
export const STICK_R = 55;      // outer radius (dp)
export const STICK_NUB = 22;    // inner nub radius (dp)
export const STICK_DEAD = 0.10; // 10% deadzone

// --- dash button (bottom-right) ---
export const BTN_R = 30;        // visual radius
export const BTN_HIT = 34;      // hit radius (>= 52dp target)

// --- HUD layout ---
export const HULL_W = 160;
export const HULL_H = 10;
export const XP_H = 7;
export const HUD_PAD = 12;
export const HEAT_W = 90;
export const HEAT_H = 4;
