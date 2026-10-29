// ===== VOIDPULSE :: screen-space UI (menus, cards) =====

import type { Renderer } from './render';
import type { Game } from './game';
import { META_PERKS, PASSIVES, WEAPONS } from './content';
import { fmtScore, fmtTime } from './utils';
import type { ButtonRect, CardOption } from './types';

const MONO = `ui-monospace, 'Cascadia Mono', 'JetBrains Mono', Menlo, Consolas, monospace`;

function font(size: number, weight = 400): string {
  return `${weight} ${size}px ${MONO}`;
}

function reg(r: Renderer, g: Game, id: string, x: number, y: number, w: number, h: number): ButtonRect {
  const b: ButtonRect = { id, x, y, w, h, hover: false };
  if (g.mouse.x >= x && g.mouse.x <= x + w && g.mouse.y >= y && g.mouse.y <= y + h) {
    b.hover = true;
  }
  g.buttons.push(b);
  return b;
}

function dim(r: Renderer, alpha: number): void {
  const ctx = r.ctx;
  ctx.fillStyle = `rgba(2,4,10,${alpha})`;
  ctx.fillRect(0, 0, r.viewW, r.viewH);
}

function panel(r: Renderer, x: number, y: number, w: number, h: number, border = 'rgba(90,160,255,0.35)'): void {
  const ctx = r.ctx;
  ctx.fillStyle = 'rgba(6,10,22,0.92)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function button(
  r: Renderer,
  g: Game,
  id: string,
  label: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accent = '#4de8ff',
  size = 15
): void {
  const ctx = r.ctx;
  const b = reg(r, g, id, x, y, w, h);
  ctx.fillStyle = b.hover ? 'rgba(30,48,80,0.9)' : 'rgba(12,20,38,0.9)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = b.hover ? accent : 'rgba(90,140,200,0.4)';
  ctx.lineWidth = b.hover ? 2 : 1.2;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
  ctx.font = font(size, 700);
  ctx.textAlign = 'center';
  ctx.fillStyle = b.hover ? '#ffffff' : accent;
  ctx.fillText(label, x + w / 2, y + h / 2 + size * 0.36);
  if (b.hover) {
    ctx.fillStyle = accent;
    ctx.fillRect(x, y, 3, h);
    ctx.fillRect(x + w - 3, y, 3, h);
  }
}

// ================= TITLE / PERKS / HELP / PAUSE / END SCREENS =================

export function drawMenus(r: Renderer, g: Game): void {
  switch (g.state) {
    case 'title':
      drawTitle(r, g);
      break;
    case 'perks':
      drawPerks(r, g);
      break;
    case 'help':
      drawHelp(r, g);
      break;
    case 'paused':
      drawPause(r, g);
      break;
    case 'gameover':
      drawGameOver(r, g);
      break;
    case 'victory':
      drawVictory(r, g);
      break;
    default:
      break;
  }
}

function drawTitle(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.25);

  // animated background pulses
  const t = r.t;
  ctx.globalCompositeOperation = 'lighter';
  r.drawGlow(W / 2, H * 0.3, 200 + Math.sin(t * 1.2) * 14, '#1a3a6a', 0.55);
  r.drawGlow(W / 2, H * 0.3, 90, '#4de8ff', 0.12);
  ctx.globalCompositeOperation = 'source-over';

  // logo
  ctx.textAlign = 'center';
  const title = 'VOIDPULSE';
  ctx.font = font(Math.min(84, W / 9), 800);
  const grad = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.32);
  grad.addColorStop(0, '#e8fbff');
  grad.addColorStop(0.5, '#4de8ff');
  grad.addColorStop(1, '#7d5cff');
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, H * 0.28);
  ctx.font = font(13, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText('S U R V I V E   T H E   S W A R M   ·   R I D E   T H E   H E A T', W / 2, H * 0.28 + 30);

  // menu
  const items: [string, string, string][] = [
    ['title_start', 'START RUN', 'Enter'],
    ['title_perks', 'PERMANENT UPGRADES', 'E'],
    ['title_help', 'HOW TO PLAY', 'H'],
  ];
  const mw = 340;
  const mx = (W - mw) / 2;
  let my = H * 0.44;
  for (const [id, label, key] of items) {
    const selected = g.menuIndex === items.findIndex((i) => i[0] === id);
    const accent = id === 'title_start' ? '#4de8ff' : '#9adcff';
    button(r, g, id, label, mx, my, mw, 46, accent, 15);
    ctx.font = font(10, 600);
    ctx.textAlign = 'right';
    ctx.fillStyle = selected ? '#ffd94d' : '#5a6a85';
    ctx.fillText(`[${key}]`, mx + mw + 34, my + 28);
    my += 58;
  }

  // stats footer
  const m = g.meta.data;
  ctx.textAlign = 'center';
  ctx.font = font(12, 600);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`CORES ${m.cores}   ·   BEST ${fmtScore(m.bestScore)}   ·   BEST WAVE ${m.bestWave}   ·   RUNS ${m.runs}${m.endlessUnlocked ? '   ·   ★ ENDLESS UNLOCKED' : ''}`, W / 2, H - 64);
  ctx.font = font(11, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('WASD move · SPACE dash · weapons auto-fire · [M] mute', W / 2, H - 40);
}

function drawPerks(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.72);

  ctx.textAlign = 'center';
  ctx.font = font(30, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText('PERMANENT UPGRADES', W / 2, 64);
  ctx.font = font(14, 700);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`CORES: ${g.meta.data.cores}`, W / 2, 92);

  const listW = Math.min(680, W - 80);
  const x = (W - listW) / 2;
  let y = 120;
  const rowH = 58;
  for (let i = 0; i < META_PERKS.length; i++) {
    const perk = META_PERKS[i];
    const tier = g.meta.data.perks[perk.id] ?? 0;
    const maxed = tier >= perk.maxTier;
    const cost = maxed ? 0 : perk.costs[tier];
    const affordable = !maxed && g.meta.data.cores >= cost;
    const selected = i === g.perkIndex;

    panel(r, x, y, listW, rowH - 8, selected ? perk.color : 'rgba(90,160,255,0.25)');

    ctx.textAlign = 'left';
    ctx.font = font(14, 700);
    ctx.fillStyle = perk.color;
    ctx.fillText(perk.name, x + 16, y + 24);
    ctx.font = font(11, 500);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText(perk.desc, x + 16, y + 42);

    // tier pips
    for (let t = 0; t < perk.maxTier; t++) {
      ctx.fillStyle = t < tier ? perk.color : 'rgba(120,140,180,0.25)';
      ctx.fillRect(x + 230 + t * 18, y + 16, 12, 12);
    }

    ctx.textAlign = 'right';
    ctx.font = font(13, 700);
    if (maxed) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillText('MAXED', x + listW - 16, y + 30);
    } else {
      ctx.fillStyle = affordable ? '#6dff8c' : '#ff5c5c';
      ctx.fillText(`◆ ${cost}`, x + listW - 16, y + 30);
    }

    // click target = whole row
    reg(r, g, 'perk_select_' + i, x, y, listW, rowH - 8);

    y += rowH;
  }

  button(r, g, 'perk_buy', selectedPerkLabel(g), x, y + 4, listW * 0.48, 40, '#6dff8c');
  button(r, g, 'perk_back', 'BACK [ESC]', x + listW * 0.52, y + 4, listW * 0.48, 40, '#9adcff');

  ctx.textAlign = 'center';
  ctx.font = font(10, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('↑↓ select · ENTER buy · ESC back', W / 2, y + 64);
}

function selectedPerkLabel(g: Game): string {
  const perk = META_PERKS[g.perkIndex];
  if (!perk) return 'BUY';
  const tier = g.meta.data.perks[perk.id] ?? 0;
  if (tier >= perk.maxTier) return 'MAXED';
  const cost = perk.costs[tier];
  return g.meta.data.cores >= cost ? `BUY — ${cost} CORES` : `NEED ${cost - g.meta.data.cores} MORE`;
}

function drawHelp(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.8);
  const pw = Math.min(760, W - 60);
  const px = (W - pw) / 2;
  const py = 40;
  const ph = H - 110;
  panel(r, px, py, pw, ph);

  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#4de8ff';
  ctx.fillText('HOW TO PLAY', W / 2, py + 44);

  ctx.textAlign = 'left';
  ctx.font = font(13, 600);
  const lines: [string, string][] = [
    ['#4de8ff', 'CONTROLS'],
    ['#ffffff', '  WASD / ARROWS — move your ship'],
    ['#ffffff', '  SPACE / SHIFT — dash: brief invulnerability, damages enemies, erases enemy bullets'],
    ['#ffffff', '  Weapons fire automatically at the nearest threat'],
    ['#ffffff', '  1 / 2 / 3 — pick upgrade cards · R — reroll · P — pause · M — mute'],
    ['#4de8ff', ''],
    ['#ffb14d', 'HEAT & OVERDRIVE'],
    ['#ffffff', '  Every kill builds HEAT. Higher heat = higher score multiplier.'],
    ['#ffffff', '  Fill the heat bar to trigger OVERDRIVE: +50% damage, +30% fire rate, +15% speed.'],
    ['#ff5c5c', '  Getting hit WIPES your heat and ends Overdrive. Aggression is armor.'],
    ['#4de8ff', ''],
    ['#6dff8c', 'PROGRESSION'],
    ['#ffffff', '  Green shards = XP → level up → draft 1 of 3 upgrade cards.'],
    ['#ffffff', '  A weapon at max level + its paired module at Lv2+ offers an EVOLUTION.'],
    ['#ffffff', '  Survive 15 waves and kill the final boss to win — then the void opens: ENDLESS mode.'],
    ['#ffffff', '  Earn CORES every run → buy permanent upgrades between runs.'],
    ['#4de8ff', ''],
    ['#ff4d7e', 'THREATS'],
    ['#ffffff', '  Motes swarm. Sprinters zigzag. Spitters keep range and shoot. Splitters divide.'],
    ['#ffffff', '  Bulwarks shrug off knockback. Warden Orbs encircle you and fire fans.'],
    ['#ffffff', '  ELITES (orange ring) are 6× tougher with modifiers: Burst / Swift / Shield.'],
    ['#ffffff', '  Small targets (Motes, Shards, Sprinters) die instantly to a dash.'],
  ];
  let y = py + 76;
  for (const [color, line] of lines) {
    if (line === '') {
      y += 8;
      continue;
    }
    ctx.fillStyle = color;
    ctx.fillText(line, px + 26, y);
    y += line.startsWith('  ') ? 19 : 24;
  }

  button(r, g, 'help_back', 'BACK [ESC]', px + pw / 2 - 110, py + ph - 54, 220, 40, '#9adcff');
}

function drawPause(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.66);

  ctx.textAlign = 'center';
  ctx.font = font(34, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillText('PAUSED', W / 2, 110);

  // current build
  const p = g.player;
  const bw = Math.min(560, W - 80);
  const bx = (W - bw) / 2;
  panel(r, bx, 140, bw, 210, 'rgba(90,160,255,0.3)');
  ctx.textAlign = 'left';
  ctx.font = font(13, 700);
  ctx.fillStyle = '#9adcff';
  ctx.fillText('ACTIVE SYSTEMS', bx + 18, 166);
  let y = 190;
  ctx.font = font(12, 600);
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    ctx.fillStyle = def.color;
    const pips = def.isEvolved ? '★MAX' : '·'.repeat(w.level);
    ctx.fillText(`${def.name.padEnd(18, ' ')} ${pips}`, bx + 18, y);
    y += 19;
  }
  y += 8;
  ctx.fillStyle = '#8fa3c0';
  const passiveIds = Object.keys(p.passives);
  if (passiveIds.length === 0) {
    ctx.fillText('No modules installed yet', bx + 18, y);
    y += 19;
  }
  for (const pid of passiveIds) {
    const def = PASSIVES[pid];
    if (!def) continue;
    ctx.fillStyle = def.color;
    ctx.fillText(`${def.name} Lv${p.passives[pid]}`, bx + 18, y);
    y += 19;
    if (y > 330) break;
  }

  const by = 380;
  button(r, g, 'pause_resume', 'RESUME [P]', bx, by, bw * 0.48, 44, '#4de8ff');
  button(r, g, 'pause_restart', 'RESTART [R]', bx + bw * 0.52, by, bw * 0.48, 44, '#ffb14d');
  button(r, g, 'pause_quit', 'ABANDON RUN [Q]', bx, by + 56, bw, 44, '#ff5c5c');
}

function statRow(r: Renderer, x: number, y: number, w: number, label: string, value: string, color = '#ffffff'): void {
  const ctx = r.ctx;
  ctx.textAlign = 'left';
  ctx.font = font(13, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(label, x, y);
  ctx.textAlign = 'right';
  ctx.font = font(16, 800);
  ctx.fillStyle = color;
  ctx.fillText(value, x + w, y);
}

function drawGameOver(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.78);
  const pw = Math.min(520, W - 60);
  const px = (W - pw) / 2;
  const py = H * 0.14;
  const ph = H * 0.62;
  panel(r, px, py, pw, ph, 'rgba(255,80,110,0.5)');

  ctx.textAlign = 'center';
  ctx.font = font(36, 800);
  ctx.fillStyle = '#ff5c5c';
  ctx.fillText('SIGNAL LOST', W / 2, py + 60);

  const m = g.meta.data;
  let y = py + 100;
  const rows: [string, string, string][] = [
    ['SCORE', fmtScore(g.score), '#ffffff'],
    ['WAVES SURVIVED', String(g.wave), '#9adcff'],
    ['TIME', fmtTime(g.time), '#9adcff'],
    ['KILLS', String(g.kills), '#dfeeff'],
    ['BOSSES DOWN', String(g.bossKills), '#ff9a3d'],
    ['BEST SCORE', fmtScore(m.bestScore), '#ffd94d'],
  ];
  for (const [label, value, color] of rows) {
    statRow(r, px + 30, y, pw - 60, label, value, color);
    y += 30;
  }

  // cores earned
  y += 12;
  ctx.textAlign = 'center';
  ctx.font = font(18, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`+${g.coresEarned} CORES EARNED`, W / 2, y);
  ctx.font = font(12, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(`BANK: ${m.cores} CORES — spend them under PERMANENT UPGRADES`, W / 2, y + 24);

  button(r, g, 'over_retry', 'RE-DEPLOY [ENTER]', px + 30, py + ph - 92, pw - 60, 44, '#4de8ff', 16);
  button(r, g, 'over_title', 'TITLE [T]', px + 30, py + ph - 40, pw - 60, 34, '#9adcff', 13);
}

function drawVictory(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.7);
  const t = r.t;
  ctx.globalCompositeOperation = 'lighter';
  r.drawGlow(W / 2, H * 0.2, 240 + Math.sin(t * 2) * 20, '#ffd94d', 0.25);
  ctx.globalCompositeOperation = 'source-over';

  const pw = Math.min(560, W - 60);
  const px = (W - pw) / 2;
  const py = H * 0.12;
  const ph = H * 0.66;
  panel(r, px, py, pw, ph, 'rgba(255,217,77,0.55)');

  ctx.textAlign = 'center';
  ctx.font = font(34, 800);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('CORE STABILIZED', W / 2, py + 58);
  ctx.font = font(13, 600);
  ctx.fillStyle = '#dfeeff';
  ctx.fillText('The Null Sovereign is destroyed. The void recedes… for now.', W / 2, py + 84);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText('★ ENDLESS MODE UNLOCKED ★', W / 2, py + 108);

  let y = py + 146;
  const rows: [string, string, string][] = [
    ['FINAL SCORE', fmtScore(g.score), '#ffffff'],
    ['TIME', fmtTime(g.time), '#9adcff'],
    ['KILLS', String(g.kills), '#dfeeff'],
    ['LEVEL REACHED', String(g.player.level), '#6dff8c'],
    ['BOSSES DESTROYED', String(g.bossKills), '#ff9a3d'],
  ];
  for (const [label, value, color] of rows) {
    statRow(r, px + 30, y, pw - 60, label, value, color);
    y += 30;
  }
  y += 10;
  ctx.textAlign = 'center';
  ctx.font = font(16, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`+${g.coresEarned} CORES EARNED`, W / 2, y);

  button(r, g, 'victory_endless', 'DIVE INTO ENDLESS [C]', px + 30, py + ph - 96, pw - 60, 44, '#ffd94d', 15);
  button(r, g, 'victory_title', 'TITLE [T]', px + 30, py + ph - 44, pw - 60, 36, '#9adcff', 13);
}

// ================= LEVEL-UP CARDS =================

const RARITY_STYLE: Record<CardOption['rarity'], { border: string; label: string; glow: string }> = {
  common: { border: 'rgba(140,160,200,0.6)', label: 'MODULE', glow: '#8ca3c8' },
  rare: { border: 'rgba(77,232,255,0.75)', label: 'WEAPON', glow: '#4de8ff' },
  epic: { border: 'rgba(255,217,77,0.9)', label: 'EVOLUTION', glow: '#ffd94d' },
};

export function drawLevelUpCards(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.72);

  ctx.textAlign = 'center';
  ctx.font = font(28, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText('SYSTEM UPGRADE AVAILABLE', W / 2, H * 0.16);
  ctx.font = font(12, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(`LEVEL ${g.player.level} — choose one integration`, W / 2, H * 0.16 + 26);

  const cardW = Math.min(300, (W - 100) / 3 - 14);
  const cardH = Math.min(340, H * 0.52);
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2;
  const y0 = H * 0.22;

  for (let i = 0; i < g.cards.length; i++) {
    const card = g.cards[i];
    const x = x0 + i * (cardW + gap);
    drawCard(r, g, card, i, x, y0, cardW, cardH);
  }

  // reroll
  if (g.rerolls > 0) {
    button(r, g, 'reroll_btn', `REROLL [R] — ${g.rerolls} left`, W / 2 - 120, y0 + cardH + 26, 240, 40, '#ffb14d');
  } else {
    ctx.font = font(12, 600);
    ctx.fillStyle = '#5a6a85';
    ctx.fillText('no rerolls left', W / 2, y0 + cardH + 52);
  }
}

function drawCard(r: Renderer, g: Game, card: CardOption, index: number, x: number, y: number, w: number, h: number): void {
  const ctx = r.ctx;
  const style = RARITY_STYLE[card.rarity];
  const b = reg(r, g, 'card' + index, x, y, w, h);
  const hover = b.hover;
  const lift = hover ? -6 : 0;

  ctx.save();
  ctx.translate(0, lift);

  // glow for epic
  if (card.rarity === 'epic') {
    ctx.globalCompositeOperation = 'lighter';
    r.drawGlow(x + w / 2, y + h / 2, w * 0.75, '#ffd94d', 0.14 + Math.sin(r.t * 4) * 0.05);
    ctx.globalCompositeOperation = 'source-over';
  }

  panel(r, x, y, w, h, hover ? style.glow : style.border);
  ctx.lineWidth = hover ? 2.5 : 1.5;

  // header strip
  ctx.fillStyle = 'rgba(20,32,56,0.8)';
  ctx.fillRect(x + 1, y + 1, w - 2, 30);
  ctx.font = font(10, 700);
  ctx.textAlign = 'left';
  ctx.fillStyle = style.glow;
  ctx.fillText(style.label, x + 14, y + 20);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#5a6a85';
  ctx.fillText(`[${index + 1}]`, x + w - 14, y + 20);

  // icon glyph
  ctx.globalCompositeOperation = 'lighter';
  r.drawGlow(x + w / 2, y + 92, 44, card.color, 0.5);
  ctx.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.translate(x + w / 2, y + 92);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = card.color;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(-13, -13, 26, 26);
  ctx.restore();
  ctx.fillStyle = card.color;
  ctx.fillRect(x + w / 2 - 3, y + 89, 6, 6);

  // title
  ctx.textAlign = 'center';
  ctx.font = font(16, 800);
  ctx.fillStyle = '#ffffff';
  const titleLines = wrapText(ctx, card.title, w - 28, 16, 800);
  let ty = y + 158;
  for (const line of titleLines.slice(0, 2)) {
    ctx.fillText(line, x + w / 2, ty);
    ty += 19;
  }

  // level text
  ctx.font = font(11, 700);
  ctx.fillStyle = card.color;
  ctx.fillText(card.levelText, x + w / 2, ty + 4);

  // desc
  ctx.font = font(11.5, 500);
  ctx.fillStyle = '#aebdd4';
  const descLines = wrapText(ctx, card.desc, w - 30, 11.5, 500);
  let dy = ty + 28;
  for (const line of descLines.slice(0, 6)) {
    ctx.fillText(line, x + w / 2, dy);
    dy += 15;
  }

  ctx.restore();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, size: number, weight: number): string[] {
  ctx.font = font(size, weight);
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? cur + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
