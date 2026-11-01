/**
 * VOIDPULSE MOBILE — tunables & layout constants.
 * All values are CSS pixels (canvas is DPR-scaled at render time only).
 */

// --- canvas / thermal ---
export const DPR_CAP = 2;                 // never render above 2x — thermal protection

// --- world ---
export const WORLD_W = 2240;
export const WORLD_H = 1600;

// --- camera ---
export const CAM_LEAD = 0.12;             // velocity lead multiplier (see spec)
export const CAM_SMOOTH = 6.5;            // exponential smoothing rate
export const SHAKE_DECAY = 1.7;           // trauma decay per second
export const SHAKE_AMP = 13;              // max shake offset at trauma = 1
export const SHAKE_FREQ = 31;

// --- left-thumb floating joystick ---
export const STICK_R = 55;                // outer radius (dp)
export const STICK_NUB = 22;              // inner nub radius (dp)
export const STICK_DEAD = 0.10;           // 10% deadzone

// --- right-thumb action buttons ---
export const BTN_R = 30;                  // visual radius of dash/overdrive buttons
export const BTN_HIT = 34;                // hit radius (>= 52dp target when centered)
export const BTN_MARGIN = 16;             // from safe edge

// --- HUD layout ---
export const HULL_W = 160;
export const HULL_H = 10;
export const XP_H = 7;
export const HUD_PAD = 12;

// --- player ---
export const P_RADIUS = 13;
export const P_FIRE_BASE = 3.0;           // shots / second
export const P_BULLET_SPD = 560;
export const P_DASH_CD = 2.4;
export const P_DASH_CHARGES = 2;
export const P_DASH_TIME = 0.18;
export const P_DASH_MULT = 3.5;
export const P_DASH_IFRAME = 0.28;
export const P_IFRAME_HIT = 0.55;         // post-contact invulnerability
export const P_MAGNET_BASE = 95;
export const P_PICKUP_R = 24;
export const OD_DURATION = 6.0;
export const OD_FIRE_MULT = 1.7;
export const OD_DMG_MULT = 1.5;
export const OD_MAGNET_MULT = 1.8;

// --- auto-aim ---
export const AIM_RANGE = 470;

// --- progression ---
export const XP_BASE = 6;
export const XP_PER_LEVEL = 4;
export const WAVE_BUDGET_BASE = 5;
export const WAVE_BUDGET_PER = 3;
export const WAVE_MAX_ALIVE = 80;
export const WAVE_HP_SCALE = 0.13;        // +13% hp per wave
export const WAVE_SPD_SCALE = 0.02;
export const WAVE_SPD_CAP = 1.45;
export const BOSS_EVERY = 5;
export const VICTORY_WAVE = 10;

// --- pools (fixed capacity — never allocate during a run) ---
export const CAP_ENEMY = 160;
export const CAP_BULLET = 900;
export const CAP_GEM = 512;
export const CAP_PARTICLE = 640;
export const CAP_FLOATER = 56;
