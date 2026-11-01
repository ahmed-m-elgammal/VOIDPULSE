/**
 * VOIDPULSE MOBILE — gems, particles, damage floaters, magnet & collection.
 */
import { P_PICKUP_R, OD_MAGNET_MULT } from '../config';
import * as W from './world';
import * as P from './player';
import { sfxGem } from '../audio';
import { hapLight } from '../haptics';

export function tickPickups(dt: number): void {
  // ---- gems ----
  const magnetR = P.pMagnet * (P.odActive > 0 ? OD_MAGNET_MULT : 1);
  const magnetR2 = magnetR * magnetR;
  for (let i = 0; i < W.gCount; i++) {
    W.gAge[i] += dt;
    const dx = P.pX - W.gx[i], dy = P.pY - W.gy[i];
    const d2 = dx * dx + dy * dy;
    if (d2 < P_PICKUP_R * P_PICKUP_R) {
      if (W.gKind[i] === 0) {
        P.grantXp(W.gval[i]);
      } else {
        W.addScore(50);
      }
      P.addOd(0.012);
      sfxGem();
      hapLight();
      W.burst(W.gx[i], W.gy[i], 3, 90, W.gKind[i] === 0 ? W.PC_GEM : W.PC_CORE, 2);
      W.killGem(i); i--; continue;
    }
    if (d2 < magnetR2) {
      const d = Math.sqrt(d2) || 1;
      const pull = 560 + W.gAge[i] * 1500;
      W.gvx[i] = (dx / d) * pull; W.gvy[i] = (dy / d) * pull;
    } else {
      // damp the initial scatter burst
      const damp = 1 - Math.min(1, 4 * dt);
      W.gvx[i] -= W.gvx[i] * damp * dt * 4;
      W.gvy[i] -= W.gvy[i] * damp * dt * 4;
    }
    W.gx[i] += W.gvx[i] * dt;
    W.gy[i] += W.gvy[i] * dt;
  }

  // ---- particles ----
  for (let i = 0; i < W.pCount; i++) {
    W.plife[i] -= dt;
    if (W.plife[i] <= 0) { W.killParticle(i); i--; continue; }
    const damp = 1 - Math.min(1, 2.4 * dt);
    W.pvx[i] *= damp; W.pvy[i] *= damp;
    W.ppx[i] += W.pvx[i] * dt;
    W.ppy[i] += W.pvy[i] * dt;
  }

  // ---- damage floaters ----
  for (let i = 0; i < W.flCount; i++) {
    W.flLife[i] -= dt;
    if (W.flLife[i] <= 0) { W.killFloater(i); i--; continue; }
    W.fly[i] -= 42 * dt;
  }
}
