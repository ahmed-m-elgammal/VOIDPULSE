// ===== VOIDPULSE :: ship skin registry (SEASON ONE cosmetics) =====
// Every hull is an original vector sprite drawn procedurally on canvas.

import type { SkinDef } from './types';

const HULL_FILL = 'rgba(10,20,30,0.88)';

/** helper: polygon path */
function poly(ctx: CanvasRenderingContext2D, pts: [number, number][], close = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  if (close) ctx.closePath();
}

export const SKINS: Record<string, SkinDef> = {
  pulse: {
    id: 'pulse',
    name: 'Pulse Frame',
    desc: 'The standard-issue interceptor. Honest lines, honest fire.',
    rarity: 'starter',
    currency: 'cores',
    price: 0,
    color: '#4de8ff',
    trail: '#4de8ff',
    glow: '#4de8ff',
    draw: (ctx) => {
      ctx.strokeStyle = '#4de8ff';
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2;
      poly(ctx, [
        [0, -14],
        [10, 10],
        [0, 5],
        [-10, 10],
      ]);
      ctx.fill();
      ctx.stroke();
    },
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Ghost',
    desc: 'Twin-pronged assault hull painted in the color of the swarm.',
    rarity: 'common',
    currency: 'cores',
    price: 3500,
    color: '#ff5c7a',
    trail: '#ff5c7a',
    glow: '#ff5c7a',
    draw: (ctx) => {
      ctx.strokeStyle = '#ff5c7a';
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2;
      poly(ctx, [
        [0, -13],
        [4, -2],
        [13, 8],
        [5, 11],
        [0, 6],
        [-5, 11],
        [-13, 8],
        [-4, -2],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ff5c7a';
      ctx.fillRect(-1.4, -10, 2.8, 10);
    },
  },
  gilded: {
    id: 'gilded',
    name: 'Gilded Reaper',
    desc: 'A scythe-winged frigate plated in salvaged vault-gold.',
    rarity: 'rare',
    currency: 'cores',
    price: 6000,
    color: '#ffd166',
    trail: '#ffd166',
    glow: '#ffd166',
    draw: (ctx, t) => {
      ctx.strokeStyle = '#ffd166';
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2;
      // scythe wings
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.quadraticCurveTo(16, -2 + Math.sin(t * 3) * 1.5, 12, 12);
      ctx.quadraticCurveTo(6, 4, 0, 8);
      ctx.quadraticCurveTo(-6, 4, -12, 12);
      ctx.quadraticCurveTo(-16, -2 + Math.sin(t * 3) * 1.5, 0, -8);
      ctx.fill();
      ctx.stroke();
      // spine
      poly(ctx, [
        [0, -15],
        [3.2, 2],
        [0, 7],
        [-3.2, 2],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff3c9';
      ctx.beginPath();
      ctx.arc(0, -3, 2.2, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  manta: {
    id: 'manta',
    name: 'Abyssal Manta',
    desc: 'Wide-winged glider that rides the pressure of the deep void.',
    rarity: 'rare',
    currency: 'cores',
    price: 9000,
    color: '#5c9dff',
    trail: '#5c9dff',
    glow: '#5c9dff',
    draw: (ctx, t) => {
      const flap = Math.sin(t * 4) * 1.6;
      ctx.strokeStyle = '#5c9dff';
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(14, 2 + flap, 17, 11);
      ctx.quadraticCurveTo(8, 8, 0, 12);
      ctx.quadraticCurveTo(-8, 8, -17, 11);
      ctx.quadraticCurveTo(-14, 2 + flap, 0, -10);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#5c9dff';
      ctx.fillRect(-0.9, -9, 1.8, 8);
    },
  },
  serpent: {
    id: 'serpent',
    name: 'Neon Serpent',
    desc: 'Segmented strike craft that coils through the swarm.',
    rarity: 'epic',
    currency: 'prisms',
    price: 450,
    color: '#6dff8c',
    trail: '#6dff8c',
    glow: '#6dff8c',
    draw: (ctx, t) => {
      ctx.strokeStyle = '#6dff8c';
      ctx.lineWidth = 2;
      // tail segments
      for (let i = 0; i < 3; i++) {
        const off = Math.sin(t * 6 - i * 1.2) * (3 + i * 1.6);
        ctx.globalAlpha = 0.85 - i * 0.22;
        ctx.beginPath();
        ctx.arc(off, 8 + i * 5.5, 3.4 - i * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = HULL_FILL;
      poly(ctx, [
        [0, -14],
        [6, 0],
        [3, 9],
        [-3, 9],
        [-6, 0],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#c9ffda';
      ctx.fillRect(-1.2, -8, 2.4, 12);
    },
  },
  monarch: {
    id: 'monarch',
    name: 'Void Monarch',
    desc: 'Crowned flagship of a hive that no longer exists.',
    rarity: 'epic',
    currency: 'prisms',
    price: 800,
    color: '#c9b8ff',
    trail: '#c9b8ff',
    glow: '#c9b8ff',
    draw: (ctx, t) => {
      ctx.strokeStyle = '#c9b8ff';
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2;
      // cloak
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.quadraticCurveTo(11, 0 + Math.sin(t * 2.5), 9, 12);
      ctx.lineTo(-9, 12);
      ctx.quadraticCurveTo(-11, 0 + Math.sin(t * 2.5), 0, -9);
      ctx.fill();
      ctx.stroke();
      // crown
      poly(ctx, [
        [-6, -8],
        [-3, -14],
        [0, -9],
        [3, -14],
        [6, -8],
      ]);
      ctx.stroke();
      ctx.fillStyle = '#c9b8ff';
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  phantom: {
    id: 'phantom',
    name: 'Phantom Protocol',
    desc: 'VOIDPASS PRIME · Phase 20 reward. A hull that forgets it exists.',
    rarity: 'prime',
    currency: 'pass',
    price: 0,
    color: '#e8fbff',
    trail: '#e8fbff',
    glow: '#e8fbff',
    draw: (ctx, t) => {
      const split = Math.sin(t * 2.2) * 1.4;
      ctx.strokeStyle = '#e8fbff';
      ctx.fillStyle = 'rgba(20,28,44,0.8)';
      ctx.lineWidth = 1.6;
      // split hull halves
      ctx.save();
      ctx.translate(-2.5 - split, 0);
      poly(ctx, [
        [0, -13],
        [6, 8],
        [0, 5],
        [-4, 9],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(2.5 + split, 0);
      poly(ctx, [
        [0, -13],
        [4, 9],
        [0, 5],
        [-6, 8],
      ]);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      // phase core
      ctx.fillStyle = '#e8fbff';
      ctx.globalAlpha = 0.6 + Math.sin(t * 5) * 0.3;
      ctx.beginPath();
      ctx.arc(0, -1, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    },
  },
  sovereign: {
    id: 'sovereign',
    name: 'Sovereign Prime',
    desc: 'VOIDPASS PRIME · Season 1 grand reward. Prismatic regalia of the abyss.',
    rarity: 'prime',
    currency: 'pass',
    price: 0,
    color: '#ffe066',
    trail: '#7dffcf',
    glow: '#ffe066',
    draw: (ctx, t) => {
      const hue = (t * 40) % 360;
      ctx.strokeStyle = `hsl(${hue}, 90%, 72%)`;
      ctx.fillStyle = HULL_FILL;
      ctx.lineWidth = 2.2;
      // grand hull
      poly(ctx, [
        [0, -16],
        [5, -4],
        [14, 6],
        [6, 12],
        [0, 7],
        [-6, 12],
        [-14, 6],
        [-5, -4],
      ]);
      ctx.fill();
      ctx.stroke();
      // regalia fins
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(6, -2);
      ctx.lineTo(15, -8 + Math.sin(t * 5));
      ctx.moveTo(-6, -2);
      ctx.lineTo(-15, -8 + Math.sin(t * 5));
      ctx.stroke();
      // prism core
      const hue2 = (t * 40 + 120) % 360;
      ctx.fillStyle = `hsl(${hue2}, 95%, 80%)`;
      ctx.beginPath();
      ctx.arc(0, -2, 3.2, 0, Math.PI * 2);
      ctx.fill();
    },
  },
};

export const SKIN_IDS = Object.keys(SKINS);

export function skinOf(id: string): SkinDef {
  return SKINS[id] ?? SKINS.pulse;
}

export const RARITY_LABEL: Record<SkinDef['rarity'], string> = {
  starter: 'STANDARD',
  common: 'COMMON',
  rare: 'RARE',
  epic: 'EPIC',
  prime: 'PRIME',
};
