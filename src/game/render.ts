// ===== VOIDPULSE :: canvas renderer (world + HUD) =====

import type { Game } from './game';
import type { Enemy, Player } from './types';
import { TAU, clamp, fmtScore, fmtTime } from './utils';
import { WEAPONS, WORLD_H, WORLD_W } from './content';
import { drawMenus, drawLevelUpCards } from './renderUI';
import { skinOf } from './skins';

const MONO = `ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace`;

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${MONO}`;
}

interface Star {
  x: number;
  y: number;
  s: number;
  a: number;
  layer: number;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  dpr = 1;
  viewW = 1280;
  viewH = 720;
  private g!: Game;
  private glowCache = new Map<string, HTMLCanvasElement>();
  private stars: Star[] = [];
  private vignette: HTMLCanvasElement | null = null;
  t = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.ctx = ctx;
    this.resize();
    this.genStars();
  }

  resize(): void {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.viewW = w;
    this.viewH = h;
    this.buildVignette();
  }

  private genStars(): void {
    this.stars = [];
    for (let i = 0; i < 240; i++) {
      this.stars.push({
        x: Math.random() * WORLD_W,
        y: Math.random() * WORLD_H,
        s: 0.6 + Math.random() * 1.6,
        a: 0.25 + Math.random() * 0.5,
        layer: Math.random() < 0.5 ? 0.35 : 0.6,
      });
    }
  }

  private buildVignette(): void {
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.floor(this.viewW / 2));
    c.height = Math.max(2, Math.floor(this.viewH / 2));
    const g = c.getContext('2d');
    if (!g) return;
    const grad = g.createRadialGradient(
      c.width / 2,
      c.height / 2,
      Math.min(c.width, c.height) * 0.36,
      c.width / 2,
      c.height / 2,
      Math.max(c.width, c.height) * 0.72
    );
    grad.addColorStop(0, 'rgba(2,4,12,0)');
    grad.addColorStop(1, 'rgba(1,2,8,0.62)');
    g.fillStyle = grad;
    g.fillRect(0, 0, c.width, c.height);
    this.vignette = c;
  }

  private glow(color: string): HTMLCanvasElement {
    let c = this.glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d');
    if (g) {
      const grad = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      grad.addColorStop(0, color);
      grad.addColorStop(0.35, color + '88');
      grad.addColorStop(1, color + '00');
      g.fillStyle = grad;
      g.fillRect(0, 0, 64, 64);
    }
    this.glowCache.set(color, c);
    return c;
  }

  drawGlow(x: number, y: number, radius: number, color: string, alpha = 1): void {
    const ctx = this.ctx;
    const img = this.glow(color);
    ctx.globalAlpha = alpha;
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalAlpha = 1;
  }

  // ================= master draw =================

  draw(g: Game, dt: number): void {
    const ctx = this.ctx;
    this.g = g;
    this.t += dt;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // background
    ctx.fillStyle = '#04060d';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    g.buttons.length = 0;

    const inRun =
      g.state === 'playing' || g.state === 'levelup' || g.state === 'paused' || g.state === 'gameover' || g.state === 'victory';

    if (inRun) {
      this.drawWorld(g);
    }

    // screen-space UI
    switch (g.state) {
      case 'title':
      case 'perks':
      case 'help':
      case 'pass':
      case 'market':
        drawMenus(this, g);
        break;
      case 'playing':
        this.drawHUD(g);
        break;
      case 'levelup':
        this.drawHUD(g);
        drawLevelUpCards(this, g);
        break;
      case 'paused':
        this.drawHUD(g);
        drawMenus(this, g);
        break;
      case 'gameover':
      case 'victory':
        drawMenus(this, g);
        break;
    }

    // flash overlay
    if (g.flashAlpha > 0.01) {
      ctx.fillStyle = g.flashColor;
      ctx.globalAlpha = g.flashAlpha * 0.45;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      ctx.globalAlpha = 1;
    }

    // vignette
    if (this.vignette) {
      ctx.drawImage(this.vignette, 0, 0, this.viewW, this.viewH);
    }
  }

  // ================= world =================

  private drawWorld(g: Game): void {
    const ctx = this.ctx;
    const shakeMag = g.trauma * g.trauma * 16;
    const sx = (Math.random() - 0.5) * 2 * shakeMag;
    const sy = (Math.random() - 0.5) * 2 * shakeMag;
    const camX = g.camera.x + sx;
    const camY = g.camera.y + sy;

    ctx.save();
    ctx.translate(this.viewW / 2 - camX, this.viewH / 2 - camY);

    const vw = this.viewW;
    const vh = this.viewH;
    const left = camX - vw / 2;
    const top = camY - vh / 2;
    const right = camX + vw / 2;
    const bottom = camY + vh / 2;

    // --- background ---
    this.drawBackground(g, left, top, right, bottom);

    // world bounds
    ctx.strokeStyle = 'rgba(80,200,255,0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
    ctx.strokeStyle = 'rgba(80,200,255,0.10)';
    ctx.lineWidth = 14;
    ctx.strokeRect(-7, -7, WORLD_W + 14, WORLD_H + 14);

    // gems
    for (const gem of g.gems) {
      const pulse = 1 + Math.sin(this.t * 6 + gem.t * 3) * 0.15;
      if (gem.kind === 'xp') {
        this.drawGlow(gem.x, gem.y, 12 * pulse, '#6dff8c', 0.5);
        ctx.fillStyle = '#a8ffb8';
        ctx.save();
        ctx.translate(gem.x, gem.y);
        ctx.rotate(Math.PI / 4 + gem.t * 1.2);
        const s = 4.2;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        this.drawGlow(gem.x, gem.y, 18 * pulse, '#ff6d8c', 0.7);
        ctx.fillStyle = '#ffd3de';
        ctx.save();
        ctx.translate(gem.x, gem.y);
        ctx.fillRect(-1.6, -6, 3.2, 12);
        ctx.fillRect(-6, -1.6, 12, 3.2);
        ctx.restore();
      }
    }

    // shockwaves
    for (const s of g.shockwaves) {
      const lifeA = clamp(s.life / s.maxLife, 0, 1);
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = lifeA * 0.9;
      ctx.lineWidth = s.width * lifeA + 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // arcs (lightning)
    for (const a of g.arcs) {
      const alpha = clamp(a.life / a.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      this.drawGlow((a.x + a.x2) / 2, (a.y + a.y2) / 2, Math.hypot(a.x2 - a.x, a.y2 - a.y) / 2 + 20, a.color, alpha * 0.35);
      ctx.strokeStyle = a.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      const segs = 6;
      ctx.moveTo(a.x, a.y);
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        const nx = a.x + (a.x2 - a.x) * t;
        const ny = a.y + (a.y2 - a.y) * t;
        const off = (Math.sin(a.seed + i * 7.7) * 14) * Math.sin(t * Math.PI);
        const px = -((a.y2 - a.y) / (Math.hypot(a.x2 - a.x, a.y2 - a.y) || 1));
        const py = (a.x2 - a.x) / (Math.hypot(a.x2 - a.x, a.y2 - a.y) || 1);
        ctx.lineTo(nx + px * off, ny + py * off);
      }
      ctx.lineTo(a.x2, a.y2);
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // player bullets
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.bullets) {
      if (b.kind === 'lance') {
        this.drawGlow(b.x, b.y, 26, '#e8ffff', 0.8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 5;
        const a = b.angle;
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(a) * 22, b.y - Math.sin(a) * 22);
        ctx.lineTo(b.x + Math.cos(a) * 22, b.y + Math.sin(a) * 22);
        ctx.stroke();
      } else if (b.kind === 'scatter') {
        this.drawGlow(b.x, b.y, 10, '#ff9a8a', 0.7);
        ctx.fillStyle = '#ffd9d0';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 2.6, 0, TAU);
        ctx.fill();
      } else if (b.kind === 'seeker') {
        this.drawGlow(b.x, b.y, 14, '#ffd166', 0.75);
        ctx.fillStyle = '#fff3d1';
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(Math.atan2(b.vy, b.vx));
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, 3.4);
        ctx.lineTo(-4, -3.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      } else {
        this.drawGlow(b.x, b.y, 13, b.crit ? '#ffe066' : '#4de8ff', 0.8);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2.4;
        const a = Math.atan2(b.vy, b.vx);
        ctx.beginPath();
        ctx.moveTo(b.x - Math.cos(a) * 5, b.y - Math.sin(a) * 5);
        ctx.lineTo(b.x + Math.cos(a) * 5, b.y + Math.sin(a) * 5);
        ctx.stroke();
      }
    }

    // enemy bullets
    for (const b of g.ebullets) {
      if (b.mine) {
        // leviathan proximity mine
        const armed = (b.armT ?? 0) <= 0;
        const pulse = 0.65 + Math.sin(this.t * (armed ? 9 : 3)) * 0.3;
        this.drawGlow(b.x, b.y, b.r * 2.6, armed ? '#3dffb8' : '#1a5a48', armed ? pulse : 0.4);
        ctx.strokeStyle = armed ? '#3dffb8' : '#2a7a62';
        ctx.fillStyle = 'rgba(6,20,16,0.9)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + this.t * 0.8;
          const px = b.x + Math.cos(a) * b.r;
          const py = b.y + Math.sin(a) * b.r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = armed ? '#c9ffe9' : '#3dffb8';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 3 + pulse * 2, 0, TAU);
        ctx.fill();
        continue;
      }
      this.drawGlow(b.x, b.y, 14, '#ff4d7e', 0.85);
      ctx.fillStyle = '#ffd9e6';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.55, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#ff8fb0';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.9, 0, TAU);
      ctx.stroke();
    }

    // particles
    for (const p of g.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      this.drawGlow(p.x, p.y, p.size * 3.2 * a + 2, p.color, a * 0.9);
    }
    ctx.globalCompositeOperation = 'source-over';

    // enemies
    for (const e of g.enemies) {
      this.drawEnemy(e);
    }

    // afterimages
    for (const af of g.afterimages) {
      const a = clamp(af.life / af.maxLife, 0, 1);
      ctx.globalAlpha = a * 0.5;
      this.drawShipShape(af.x, af.y, af.angle, af.color, 0.9);
      ctx.globalAlpha = 1;
    }

    // player
    if (g.player.hp > 0 || g.deathT > 0) {
      this.drawPlayer(g);
    }

    // orbit blades (drawn with player weapons)
    this.drawOrbitBlades(g);

    // floating texts
    for (const t of g.texts) {
      const a = clamp(t.life / t.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.font = font(t.size, t.size > 14 ? 700 : 600);
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  private drawBackground(g: Game, left: number, top: number, right: number, bottom: number): void {
    const ctx = this.ctx;

    // nebula blobs (slow parallax)
    const t = this.t * 0.02;
    ctx.globalCompositeOperation = 'lighter';
    const blobs: [number, number, number, string][] = [
      [WORLD_W * 0.3, WORLD_H * 0.3, 340, '#12244a'],
      [WORLD_W * 0.75, WORLD_H * 0.6, 400, '#33103a'],
      [WORLD_W * 0.55, WORLD_H * 0.15, 300, '#0e2f3d'],
      [WORLD_W * 0.2, WORLD_H * 0.8, 380, '#2a0e2e'],
    ];
    for (let i = 0; i < blobs.length; i++) {
      const [bx, by, br, col] = blobs[i];
      const ox = Math.sin(t * 2 + i * 2.1) * 30;
      const oy = Math.cos(t * 1.7 + i * 1.3) * 30;
      this.drawGlow(bx + ox, by + oy, br, col, 0.5);
    }
    ctx.globalCompositeOperation = 'source-over';

    // grid
    const step = 120;
    ctx.strokeStyle = 'rgba(90,140,200,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gx0 = Math.floor(left / step) * step;
    for (let x = gx0; x <= right; x += step) {
      ctx.moveTo(x, top);
      ctx.lineTo(x, bottom);
    }
    const gy0 = Math.floor(top / step) * step;
    for (let y = gy0; y <= bottom; y += step) {
      ctx.moveTo(left, y);
      ctx.lineTo(right, y);
    }
    ctx.stroke();

    // stars with parallax (drawn in world space approximated around camera)
    ctx.fillStyle = '#cfe6ff';
    for (const s of this.stars) {
      const px = s.x + (g.camera.x - s.x) * (1 - s.layer);
      const py = s.y + (g.camera.y - s.y) * (1 - s.layer);
      if (px < left - 20 || px > right + 20 || py < top - 20 || py > bottom + 20) continue;
      ctx.globalAlpha = s.a;
      ctx.fillRect(px, py, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  private drawShipShape(x: number, y: number, angle: number, color: string, scale: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.fillStyle = 'rgba(10,20,30,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(10, 10);
    ctx.lineTo(0, 5);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  private drawShipSkin(x: number, y: number, angle: number, skinId: string, scale: number): void {
    const ctx = this.ctx;
    const skin = skinOf(skinId);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.scale(scale, scale);
    skin.draw(ctx, this.t);
    ctx.restore();
  }

  private drawPlayer(g: Game): void {
    const ctx = this.ctx;
    const p = g.player;
    const od = p.overdrive > 0;
    const skin = skinOf(g.meta.data.skinEquipped);
    const trailCol = od ? '#ffd94d' : skin.trail;

    // trail
    for (const tr of p.trail) {
      if (tr.a <= 0) continue;
      this.drawGlow(tr.x, tr.y, 8 * tr.a, trailCol, tr.a * 0.5);
    }

    // frost aura
    const frost = p.weapons.find((w) => w.id === 'frost' || w.id === 'zeroField');
    if (frost) {
      const def = WEAPONS[frost.id];
      const st = def.stats(frost.level);
      const R = (st.radius ?? 100) * p.stats.areaMult;
      ctx.strokeStyle = '#8fd8ff';
      ctx.globalAlpha = 0.14 + Math.sin(this.t * 3) * 0.05;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, R, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#8fd8ff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // glow under ship
    this.drawGlow(p.x, p.y, 30, od ? '#ffd94d' : skin.glow, od ? 0.9 : 0.55);

    // overdrive ring
    if (od) {
      ctx.strokeStyle = '#ffd94d';
      ctx.globalAlpha = 0.6 + Math.sin(this.t * 10) * 0.2;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 24 + Math.sin(this.t * 8) * 3, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // shield barrier
    if (p.shield > 0) {
      ctx.strokeStyle = '#9adcff';
      ctx.globalAlpha = 0.5 + Math.sin(this.t * 5) * 0.2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 27 + Math.sin(this.t * 4) * 2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // heat shimmer ring
    if (p.heat > 30 && !od) {
      ctx.strokeStyle = '#ffb14d';
      ctx.globalAlpha = (p.heat / 100) * 0.5;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 21 + p.heat / 12, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // blink when hit invuln
    const blink = p.hitInvuln > 0 && Math.floor(this.t * 20) % 2 === 0;
    ctx.globalAlpha = blink ? 0.35 : 1;
    this.drawShipSkin(p.x, p.y, p.facing, skin.id, 1.15);
    // core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawOrbitBlades(g: Game): void {
    const ctx = this.ctx;
    const p = g.player;
    for (const w of p.weapons) {
      const def = WEAPONS[w.id];
      if (!def || def.kind !== 'orbit') continue;
      const st = def.stats(w.level);
      const R = (st.radius ?? 80) * p.stats.areaMult;
      const n = st.count ?? 2;
      for (let i = 0; i < n; i++) {
        const a = w.angle + (i / n) * TAU;
        const bx = p.x + Math.cos(a) * R;
        const by = p.y + Math.sin(a) * R;
        this.drawGlow(bx, by, 16, def.color, 0.65);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + this.t * 6);
        ctx.strokeStyle = '#ffffff';
        ctx.fillStyle = def.color;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(0, -8);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, 8);
        ctx.lineTo(-5, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawEnemy(e: Enemy): void {
    const ctx = this.ctx;
    const x = e.x;
    const y = e.y;
    const col = e.flash > 0.4 ? '#ffffff' : e.def.color;

    // spawn-in effect
    if (e.spawnT > 0) {
      const k = 1 - e.spawnT / 0.45;
      ctx.globalAlpha = k * 0.8;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, e.radius * (2.2 - k * 1.2), 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return;
    }
    if (e.freezeT > 0) {
      this.drawGlow(x, y, e.radius * 2.4, '#bfeaff', 0.7);
    } else {
      this.drawGlow(x, y, e.radius * 2.1, e.elite ? '#ff9a3d' : e.def.glow, e.elite ? 0.8 : 0.42);
    }

    ctx.save();
    ctx.translate(x, y);
    const r = e.radius;
    ctx.strokeStyle = col;
    ctx.fillStyle = 'rgba(20,8,16,0.82)';
    ctx.lineWidth = 2;

    const angle = Math.atan2(this.g.player.y - y, this.g.player.x - x);

    switch (e.def.shape) {
      case 'mote':
      case 'shard': {
        ctx.rotate(e.t * 4);
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'drifter': {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, TAU);
        ctx.stroke();
        break;
      }
      case 'sprinter': {
        ctx.rotate(angle + Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.3);
        ctx.lineTo(r * 0.85, r);
        ctx.lineTo(0, r * 0.4);
        ctx.lineTo(-r * 0.85, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'spitter': {
        ctx.rotate(-e.t * 1.2);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i / 5) * TAU;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'splitter': {
        ctx.rotate(Math.PI / 4 + Math.sin(e.t * 2) * 0.2);
        ctx.fillRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
        ctx.strokeRect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, 0);
        ctx.lineTo(r * 0.85, 0);
        ctx.stroke();
        break;
      }
      case 'bulwark': {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + e.t * 0.3;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.strokeRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
        break;
      }
      case 'orbiter': {
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, TAU);
        ctx.fill();
        // charging indicator
        if (e.shootTimer < 0.5) {
          ctx.strokeStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(0, 0, r + 4, 0, TAU);
          ctx.stroke();
        }
        break;
      }
      case 'volatile': {
        // spiked bomber, blinks faster as the fuse burns
        const fused = e.fuseT >= 0;
        const blink = fused && Math.floor(this.t * (10 + (1 - Math.max(e.fuseT, 0)) * 18)) % 2 === 0;
        ctx.strokeStyle = blink ? '#ffffff' : col;
        ctx.fillStyle = blink ? 'rgba(255,120,40,0.9)' : 'rgba(20,8,16,0.82)';
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * TAU + e.t * 2;
          const rr = i % 2 === 0 ? r * 1.25 : r * 0.62;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // fuse core
        ctx.fillStyle = blink ? '#ffffff' : '#ffd166';
        ctx.beginPath();
        ctx.arc(0, 0, r * (fused ? 0.5 + Math.sin(this.t * 24) * 0.18 : 0.3), 0, TAU);
        ctx.fill();
        break;
      }
      case 'lancer': {
        ctx.rotate(angle);
        // long needle hull
        ctx.fillStyle = 'rgba(20,8,16,0.82)';
        ctx.beginPath();
        ctx.moveTo(r * 1.6, 0);
        ctx.lineTo(-r * 0.7, r * 0.62);
        ctx.lineTo(-r * 1.15, 0);
        ctx.lineTo(-r * 0.7, -r * 0.62);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // charge glow while aiming the heavy bolt
        if (e.shootTimer < 0.8) {
          ctx.fillStyle = '#fff6c9';
          ctx.beginPath();
          ctx.arc(r * 1.3, 0, 3 + (0.8 - e.shootTimer) * 5, 0, TAU);
          ctx.fill();
        }
        break;
      }
      case 'mender': {
        // ringed caretaker with a rotating cross
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.stroke();
        ctx.save();
        ctx.rotate(e.t * 1.4);
        ctx.fillStyle = col;
        ctx.fillRect(-r * 0.16, -r * 0.7, r * 0.32, r * 1.4);
        ctx.fillRect(-r * 0.7, -r * 0.16, r * 1.4, r * 0.32);
        ctx.restore();
        // heal pulse telegraph
        if (e.healT < 0.35) {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = '#6dffb0';
          ctx.beginPath();
          ctx.arc(0, 0, r + 8, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case 'phantom': {
        const ghost = e.ghostT > 0;
        ctx.globalAlpha = ghost ? 0.3 : 1;
        // hourglass silhouette
        ctx.fillStyle = 'rgba(20,8,16,0.82)';
        ctx.beginPath();
        ctx.moveTo(-r, -r);
        ctx.lineTo(r, -r);
        ctx.lineTo(-r, r);
        ctx.lineTo(r, r);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        // phase-glow eye
        ctx.fillStyle = ghost ? '#ffffff' : col;
        ctx.beginPath();
        ctx.arc(0, 0, r * (ghost ? 0.55 : 0.3), 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'boss': {
        this.drawBossBody(e, angle);
        break;
      }
    }
    ctx.restore();

    // lancer aim telegraph (world space)
    if (e.def.shape === 'lancer' && e.shootTimer < 0.8) {
      const a = Math.atan2(this.g.player.y - e.y, this.g.player.x - e.x);
      ctx.strokeStyle = 'rgba(255,224,102,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(e.x + Math.cos(a) * (e.radius + 6), e.y + Math.sin(a) * (e.radius + 6));
      ctx.lineTo(e.x + Math.cos(a) * 820, e.y + Math.sin(a) * 820);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // boss charge telegraph (world space)
    if (e.def.behavior === 'boss' && this.g.bossState && this.g.bossState.windup > 0 && this.g.bossState.windupPattern === 'charge') {
      const bs = this.g.bossState;
      ctx.strokeStyle = '#ff5c5c';
      ctx.globalAlpha = 0.35 + Math.sin(this.t * 20) * 0.2;
      ctx.lineWidth = 4;
      ctx.setLineDash([16, 10]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + (bs.chargeX / 640) * 700, e.y + (bs.chargeY / 640) * 700);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // elite ring
    if (e.elite) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(this.t * 1.4);
      ctx.strokeStyle = '#ff9a3d';
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.85;
      ctx.setLineDash([9, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, e.radius + 9, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // shield mod indicator
    if (e.mod === 'shield' && e.shieldHits > 0) {
      ctx.strokeStyle = '#9adcff';
      ctx.lineWidth = 2;
      for (let i = 0; i < e.shieldHits; i++) {
        ctx.beginPath();
        ctx.arc(x, y, e.radius + 5, (i / 3) * TAU, (i / 3) * TAU + 1.6);
        ctx.stroke();
      }
    }

    // elite / enemy hp bar
    if ((e.elite || e.maxHp > 60) && e.hp < e.maxHp && e.def.behavior !== 'boss') {
      const w = e.radius * 2.4;
      const frac = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2, y - e.radius - 12, w, 4);
      ctx.fillStyle = e.elite ? '#ff9a3d' : '#ff4d7e';
      ctx.fillRect(x - w / 2, y - e.radius - 12, w * frac, 4);
    }
  }

  private drawBossBody(e: Enemy, aimAngle: number): void {
    const ctx = this.ctx;
    const r = e.radius;
    const bs = this.g.bossState;
    const windup = !!bs && bs.windup > 0;
    const col = e.flash > 0.4 ? '#ffffff' : windup ? '#ffffff' : e.def.color;

    // THE DREAMING LEVIATHAN — serpentine deep-dweller
    if (e.phase === 3) {
      const p = this.g.player;
      const back = Math.atan2(e.y - p.y, e.x - p.x);
      // tail segments trailing away from motion
      ctx.save();
      ctx.rotate(back);
      for (let i = 1; i <= 4; i++) {
        const seg = r * (0.62 - i * 0.1);
        const off = r * 1.1 + i * r * 0.62;
        const sway = Math.sin(this.t * 3 - i * 1.1) * (4 + i * 2.4);
        ctx.globalAlpha = 0.75 - i * 0.14;
        ctx.strokeStyle = col;
        ctx.fillStyle = 'rgba(6,20,16,0.9)';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.ellipse(off, sway, seg * 1.5, seg, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // fins
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, side * r * 0.7);
        ctx.quadraticCurveTo(r * 0.9, side * r * 1.5 + Math.sin(this.t * 4 + side) * 4, r * 0.4, side * r * 2.0);
        ctx.stroke();
      }
      ctx.restore();
    }

    // rotating outer ring
    ctx.save();
    ctx.rotate(this.t * 0.7);
    ctx.strokeStyle = col;
    ctx.lineWidth = 3.5;
    ctx.setLineDash([26, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.28, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    if (e.phase === 3) {
      // leviathan core: maw of concentric teeth
      ctx.save();
      ctx.rotate(-this.t * 0.4);
      ctx.strokeStyle = col;
      ctx.fillStyle = 'rgba(6,20,16,0.92)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.stroke();
      for (let ring = 1; ring <= 2; ring++) {
        ctx.beginPath();
        const teeth = 10 + ring * 4;
        for (let i = 0; i < teeth; i++) {
          const a = (i / teeth) * TAU + this.t * (ring % 2 ? 0.9 : -0.9);
          const rr = r * (0.3 + ring * 0.24);
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
      }
      ctx.restore();
      // eye
      ctx.fillStyle = windup ? '#ffffff' : '#c9ffe9';
      ctx.beginPath();
      ctx.arc(Math.cos(aimAngle) * r * 0.3, Math.sin(aimAngle) * r * 0.3, r * 0.18 + (windup ? 3 : 0), 0, TAU);
      ctx.fill();
      return;
    }

    // core polygon
    ctx.save();
    ctx.rotate(-this.t * 0.4);
    ctx.strokeStyle = col;
    ctx.fillStyle = 'rgba(24,6,14,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const rr = i % 2 === 0 ? r : r * 0.72;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // eye
    ctx.fillStyle = windup ? '#ffffff' : '#ffd9e6';
    ctx.beginPath();
    ctx.arc(Math.cos(aimAngle) * r * 0.3, Math.sin(aimAngle) * r * 0.3, r * 0.2 + (windup ? 3 : 0), 0, TAU);
    ctx.fill();
  }

  // ================= HUD =================

  private drawHUD(g: Game): void {
    const ctx = this.ctx;
    const p = g.player;

    // ---- HP bar (top-left) ----
    const hx = 24;
    const hy = 22;
    const hw = 230;
    ctx.font = font(11, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText('HULL', hx, hy + 9);
    const frac = clamp(p.hp / p.maxHp, 0, 1);
    ctx.fillStyle = 'rgba(10,16,28,0.8)';
    ctx.fillRect(hx + 46, hy, hw - 46, 13);
    const hpCol = frac > 0.5 ? '#4de8ff' : frac > 0.25 ? '#ffb14d' : '#ff5c5c';
    ctx.fillStyle = hpCol;
    ctx.fillRect(hx + 47, hy + 1, (hw - 48) * frac, 11);
    ctx.strokeStyle = 'rgba(120,180,255,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hx + 46.5, hy + 0.5, hw - 46, 13);
    ctx.fillStyle = '#dfeeff';
    ctx.font = font(11, 700);
    ctx.fillText(`${Math.ceil(p.hp)}`, hx + 52, hy + 10);

    // dash pips
    const maxCharges = 2 + p.stats.extraDash + this.metaDashBonus(g);
    for (let i = 0; i < maxCharges; i++) {
      const dx = hx + 48 + i * 20;
      const dy = hy + 24;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(Math.PI / 4);
      if (i < p.dashCharges) {
        ctx.fillStyle = '#4de8ff';
        ctx.fillRect(-4.5, -4.5, 9, 9);
      } else {
        ctx.strokeStyle = 'rgba(77,232,255,0.35)';
        ctx.strokeRect(-4.5, -4.5, 9, 9);
      }
      ctx.restore();
    }

    // SEASON ONE chip (below dash pips)
    const m = g.meta.data;
    ctx.font = font(10, 700);
    ctx.fillStyle = '#c9b8ff';
    const chip = `S1 · LV ${m.passLevel}${m.prime ? ' ★PRIME' : ''}`;
    ctx.fillText(chip, hx + 48, hy + 52);
    // bp progress sliver
    const need = 700 + (m.passLevel - 1) * 45;
    const frac2 = m.passLevel >= 30 ? 1 : clamp(m.passXp / need, 0, 1);
    ctx.fillStyle = 'rgba(20,16,40,0.8)';
    ctx.fillRect(hx + 48, hy + 58, 90, 4);
    ctx.fillStyle = '#c9b8ff';
    ctx.fillRect(hx + 48, hy + 58, 90 * frac2, 4);

    // ---- score (top-right) ----
    ctx.textAlign = 'right';
    ctx.font = font(22, 700);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fmtScore(g.score), this.viewW - 24, 38);
    ctx.font = font(11, 600);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText(`KILLS ${g.kills}`, this.viewW - 24, 56);

    // ---- wave / time (top-center) ----
    ctx.textAlign = 'center';
    ctx.font = font(15, 700);
    ctx.fillStyle = '#9adcff';
    ctx.fillText(`WAVE ${g.wave}`, this.viewW / 2, 30);
    ctx.font = font(11, 600);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText(fmtTime(g.time), this.viewW / 2, 47);

    // boss bar
    if (g.boss && g.bossState && g.bossState.intro <= 0) {
      const bw = Math.min(560, this.viewW - 200);
      const bx = (this.viewW - bw) / 2;
      const by = 62;
      const bfrac = clamp(g.boss.hp / g.boss.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(10,10,20,0.75)';
      ctx.fillRect(bx, by, bw, 10);
      ctx.fillStyle = g.boss.def.color;
      ctx.fillRect(bx + 1, by + 1, (bw - 2) * bfrac, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.strokeRect(bx + 0.5, by + 0.5, bw, 10);
      ctx.font = font(11, 700);
      ctx.fillStyle = '#ffd9e6';
      ctx.fillText(g.boss.def.name, this.viewW / 2, by - 5);
    }

    // ---- heat bar (bottom-center) ----
    const hwid = 320;
    const hx2 = (this.viewW - hwid) / 2;
    const hy2 = this.viewH - 40;
    const od = p.overdrive > 0;
    ctx.fillStyle = 'rgba(10,16,28,0.8)';
    ctx.fillRect(hx2, hy2, hwid, 9);
    const heatCol = od ? '#ffd94d' : p.heat > 70 ? '#ff9a3d' : '#ffb14d';
    ctx.fillStyle = heatCol;
    ctx.fillRect(hx2 + 1, hy2 + 1, (hwid - 2) * (p.heat / 100), 7);
    ctx.strokeStyle = od ? 'rgba(255,217,77,0.8)' : 'rgba(255,177,77,0.4)';
    ctx.strokeRect(hx2 + 0.5, hy2 + 0.5, hwid, 9);
    // segment marks
    ctx.fillStyle = 'rgba(4,6,13,0.9)';
    for (let i = 1; i < 4; i++) ctx.fillRect(hx2 + (hwid / 4) * i, hy2, 1.5, 9);
    ctx.font = font(10, 700);
    ctx.textAlign = 'center';
    ctx.fillStyle = od ? '#ffd94d' : '#8fa3c0';
    const odLabel = od ? `OVERDRIVE ${p.overdrive.toFixed(1)}s` : p.heat >= 100 ? 'OVERDRIVE READY' : 'HEAT';
    ctx.fillText(odLabel, this.viewW / 2, hy2 - 5);

    // ---- xp bar (bottom) ----
    const xfrac = clamp(p.xp / p.xpNext, 0, 1);
    ctx.fillStyle = 'rgba(10,20,16,0.85)';
    ctx.fillRect(0, this.viewH - 7, this.viewW, 7);
    ctx.fillStyle = '#6dff8c';
    ctx.fillRect(0, this.viewH - 7, this.viewW * xfrac, 7);
    ctx.font = font(11, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a8ffb8';
    ctx.fillText(`LV ${p.level}`, 12, this.viewH - 13);

    // weapons strip (bottom-left above xp)
    let wx = 12;
    const wy = this.viewH - 34;
    for (const w of p.weapons) {
      const def = WEAPONS[w.id];
      if (!def) continue;
      ctx.fillStyle = 'rgba(10,16,28,0.75)';
      ctx.fillRect(wx, wy - 12, 26, 18);
      ctx.strokeStyle = def.color;
      ctx.globalAlpha = 0.7;
      ctx.strokeRect(wx + 0.5, wy - 11.5, 25, 17);
      ctx.globalAlpha = 1;
      ctx.fillStyle = def.color;
      ctx.font = font(9, 700);
      ctx.fillText(def.isEvolved ? '★' : String(w.level), wx + 9, wy + 1);
      wx += 30;
    }

    // wave intro banner
    if (g.waveIntroT > 0 && g.waveState === 'intro') {
      const a = clamp(g.waveIntroT / 2.2, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.textAlign = 'center';
      ctx.font = font(44, 800);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(g.bossActive ? '!! BOSS SIGNATURE !!' : `WAVE ${g.wave}`, this.viewW / 2, this.viewH * 0.32);
      ctx.font = font(14, 600);
      ctx.fillStyle = '#9adcff';
      ctx.fillText(
        g.bossActive ? 'SOMETHING MASSIVE IS COMING' : g.eliteChance > 0 ? 'ELITE SIGNATURES DETECTED' : 'HOLD THE LINE',
        this.viewW / 2,
        this.viewH * 0.32 + 30
      );
      ctx.globalAlpha = 1;
    }

    // boss banner (letterbox)
    if (g.bossBanner) {
      const bt = g.bossBanner;
      const a = clamp(bt.t / 3.2, 0, 1);
      ctx.globalAlpha = Math.min(1, a * 2);
      ctx.fillStyle = 'rgba(2,3,10,0.85)';
      ctx.fillRect(0, this.viewH * 0.36, this.viewW, 84);
      ctx.fillStyle = bt.color;
      ctx.fillRect(0, this.viewH * 0.36, this.viewW, 3);
      ctx.fillRect(0, this.viewH * 0.36 + 81, this.viewW, 3);
      ctx.textAlign = 'center';
      ctx.font = font(30, 800);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(bt.name, this.viewW / 2, this.viewH * 0.36 + 42);
      ctx.font = font(13, 500);
      ctx.fillStyle = bt.color;
      ctx.fillText(bt.title, this.viewW / 2, this.viewH * 0.36 + 66);
      ctx.globalAlpha = 1;
    }
  }

  private metaDashBonus(g: Game): number {
    return g.meta.perkTiers('batteryCore');
  }
}
