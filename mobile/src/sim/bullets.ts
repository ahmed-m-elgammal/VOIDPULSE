/**
 * VOIDPULSE MOBILE — bullet integration & collisions.
 * Swap-remove discipline: after killBullet(i) the slot holds an unprocessed
 * element, so the loop rewinds with i--.
 */
import { WORLD_W, WORLD_H, P_RADIUS } from '../config';
import * as W from './world';
import * as P from './player';
import { damageEnemy } from './enemies';

export function tickBullets(dt: number): void {
  for (let i = 0; i < W.bCount; i++) {
    W.blife[i] -= dt;
    if (W.blife[i] <= 0) { W.killBullet(i); i--; continue; }

    const x = W.bx[i] + W.bvx[i] * dt;
    const y = W.by[i] + W.bvy[i] * dt;
    if (x < -20 || x > WORLD_W + 20 || y < -20 || y > WORLD_H + 20) { W.killBullet(i); i--; continue; }
    W.bx[i] = x; W.by[i] = y;

    if (W.bFriendly[i] === 1) {
      // player bolt vs enemies
      let dead = false;
      for (let j = 0; j < W.eCount; j++) {
        if (W.bLastHit[i] === j) continue;
        const t = W.eType[j];
        const dx = x - W.ex[j], dy = y - W.ey[j];
        const rr = W.bR[i] + W.ET_R[t];
        if (dx * dx + dy * dy <= rr * rr) {
          damageEnemy(j, W.bdmg[i], x, y);
          if (W.bPierce[i] > 0) {
            W.bPierce[i]--;
            W.bLastHit[i] = j;
          } else {
            W.killBullet(i);
            i--; dead = true;
          }
          break;
        }
      }
      if (dead) continue;
    } else {
      // enemy bolt vs player
      const dx = x - P.pX, dy = y - P.pY;
      const rr = W.bR[i] + P_RADIUS - 2;
      if (dx * dx + dy * dy <= rr * rr) {
        if (P.damagePlayer(W.bdmg[i], x, y)) { W.killBullet(i); i--; continue; }
      }
    }
  }
}
