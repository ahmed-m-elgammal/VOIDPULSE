// ===== VOIDPULSE :: screen-space UI (menus, cards, VOIDPASS, market) =====

import type { Renderer } from './render';
import type { Game } from './game';
import type { RelicDef } from './types';
import { COMPANIONS } from './companions';
import { META_PERKS, PASSIVES, WEAPONS } from './content';
import { fmtScore, fmtTime } from './utils';
import type { ButtonRect, CardOption } from './types';
import { relicOf } from './relics';
import {
  BOOSTERS,
  CONTRACT_POOL,
  EXCHANGE_CORES,
  EXCHANGE_PRISMS,
  PASS_MAX_TIER,
  PASS_TIERS,
  PRIME_PRICE,
  SEASON_NAME,
  bpXpForTier,
  contractProgressValue,
  marketSkins,
} from './economy';
import { SKINS, skinOf } from './skins';
import { MUTATIONS, MUTANT_BONUS_MULT } from './mutations';
import {
  ASC_BRANCHES,
  ASC_NODES,
  ascCostOf,
  ascCoresMult,
  ascLevelOf,
  ascUnlocked,
  computeAscension,
  nodeLocked,
  nodeRank,
} from './ascension';
import {
  ACHIEVEMENTS,
  TIER_COLORS,
  achievementRewardLabel,
  achievementValue,
  unlockedCount,
} from './achievements';
import { DAILY_COMPLETION_PRISMS, dailyMutationsFor, dailySeedFor, mutantHint, todayKey } from './daily';

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
    case 'pass':
      drawPass(r, g);
      break;
    case 'market':
      drawMarket(r, g);
      break;
    case 'settings':
      drawSettings(r, g);
      break;
    case 'dial':
      drawDial(r, g);
      break;
    case 'ascension':
      drawAscension(r, g);
      break;
    case 'achievements':
      drawAchievements(r, g);
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
  r.drawGlow(W / 2, H * 0.3, 150 + Math.sin(t * 0.8) * 20, '#3a1a5a', 0.4);
  ctx.globalCompositeOperation = 'source-over';

  // logo
  ctx.textAlign = 'center';
  const title = 'VOIDPULSE';
  ctx.font = font(Math.min(84, W / 9), 800);
  const grad = ctx.createLinearGradient(0, H * 0.16, 0, H * 0.3);
  grad.addColorStop(0, '#e8fbff');
  grad.addColorStop(0.5, '#4de8ff');
  grad.addColorStop(1, '#7d5cff');
  ctx.fillStyle = grad;
  ctx.fillText(title, W / 2, H * 0.26);
  ctx.font = font(13, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText('S U R V I V E   T H E   S W A R M   ·   R I D E   T H E   H E A T', W / 2, H * 0.26 + 28);

  // season badge
  const m = g.meta.data;
  ctx.font = font(12, 700);
  ctx.fillStyle = m.prime ? '#ffe066' : '#c9b8ff';
  ctx.fillText(
    `◆ ${SEASON_NAME} ◆   SEASON LV ${m.passLevel}${m.prime ? ' · ★ PRIME ACTIVE' : ''}`,
    W / 2,
    H * 0.26 + 50
  );
  if (m.equippedTitle) {
    ctx.font = font(11, 600);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(`« ${m.equippedTitle} »`, W / 2, H * 0.26 + 68);
  }

  // menu
  const items: [string, string, string][] = [
    ['title_start', 'START RUN', 'Enter'],
    ['title_daily', g.meta.data.daily.date === todayKey() ? 'DAILY BREACH — DONE TODAY' : 'DAILY BREACH', 'Y'],
    ['title_dial', 'VOID DIAL — MUTATIONS', 'D'],
    ['title_pass', 'VOIDPASS — SEASON 1', 'B'],
    ['title_market', 'BLACK MARKET', 'N'],
    [
      'title_ascension',
      ascUnlocked(m)
        ? `ASCENSION — LV ${ascLevelOf(m)} · ×${ascCoresMult(ascLevelOf(m)).toFixed(2)} CORES`
        : 'ASCENSION — LOCKED',
      'X',
    ],
    ['title_perks', 'PERMANENT UPGRADES', 'E'],
    ['title_achievements', `ACHIEVEMENTS — ${unlockedCount(g.meta.data)}/${ACHIEVEMENTS.length}`, 'A'],
    ['title_settings', 'SETTINGS', 'G'],
    ['title_help', 'HOW TO PLAY', 'H'],
  ];
  const mw = 400;
  const mx = (W - mw) / 2;
  // adaptive spacing: fit all items between the logo block and the stats footer
  const topY = H * 0.36;
  const bottomY = H - 96;
  const btnH = H < 800 ? 30 : 36;
  const step = Math.max(26, Math.min(H < 800 ? 36 : 42, (bottomY - topY - btnH) / (items.length - 1)));
  let my = Math.max(topY, Math.min(H * 0.46, bottomY - btnH - (items.length - 1) * step));
  for (const [id, label, key] of items) {
    const idx = items.findIndex((i) => i[0] === id);
    const selected = g.menuIndex === idx;
    const accent =
      id === 'title_start'
        ? '#4de8ff'
        : id === 'title_daily'
          ? '#ffd166'
          : id === 'title_dial'
            ? '#d96bff'
            : id === 'title_ascension'
              ? '#ff5c8a'
              : id === 'title_achievements'
                ? '#ffe066'
                : id === 'title_pass'
                  ? '#c9b8ff'
                  : id === 'title_market'
                    ? '#ffd166'
                    : id === 'title_settings'
                      ? '#aebdd4'
                      : '#9adcff';
    button(r, g, id, label, mx, my, mw, btnH, accent, 13);
    ctx.font = font(10, 600);
    ctx.textAlign = 'right';
    ctx.fillStyle = selected ? '#ffd94d' : '#5a6a85';
    ctx.fillText(`[${key}]`, mx + mw + 34, my + btnH / 2 + 4);
    my += step;
  }

  // stats footer
  const dailyDone = m.daily.date === todayKey() && m.daily.completed;
  ctx.textAlign = 'center';
  ctx.font = font(12, 600);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(
    `CORES ${m.cores}   ·   PRISMS ${m.prisms}   ·   BEST ${fmtScore(m.bestScore)}   ·   BEST WAVE ${m.bestWave}   ·   RUNS ${m.runs}${m.endlessUnlocked ? '   ·   ★ ENDLESS' : ''}`,
    W / 2,
    H - 66
  );
  ctx.font = font(10.5, 600);
  ctx.fillStyle = dailyDone ? '#6dff8c' : '#5a6a85';
  ctx.fillText(
    `DAILY BREACH: ${dailyDone ? `DONE — BEST ${fmtScore(m.daily.bestScore)} (WAVE ${m.daily.bestWave})` : '2 FIXED MUTATIONS AWAIT · 60◇ FIRST CLEAR'}   ·   ${mutantHint().toUpperCase()}`,
    W / 2,
    H - 46
  );
  ctx.font = font(11, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('WASD move · SPACE dash · weapons auto-fire · [M] mute', W / 2, H - 28);
  ctx.font = font(10, 500);
  ctx.fillStyle = '#3d4a63';
  ctx.fillText('VOIDPULSE v1.4.0 — SEASON ONE', W / 2, H - 14);
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
    ['#ffd166', 'COMBO & ACHIEVEMENTS'],
    ['#ffffff', '  Chain kills within 2s to build a COMBO — 10/25/50 slams RAMPAGE/VOIDSTORM/ASCENDANT.'],
    ['#ffffff', '  Long chains pay bonus CORES at run end (+1% per 10 combo, cap +25%).'],
    ['#ffffff', '  ACHIEVEMENTS [A] pay cores/prisms for lifetime milestones. DAILY BREACH [Y] is a'],
    ['#ffffff', '  date-seeded run with 2 fixed mutations — beat your own ghost, 60◇ first clear.'],
    ['#4de8ff', ''],
    ['#d96bff', 'VOID DIAL — MUTATIONS [D]'],
    ['#ffffff', '  Pre-run toggles that stack: CURSED CORES +50% XP · GLASS HULL +40% dmg −40% HP'],
    ['#ffffff', '  SWARM PROTOCOL +80% density +30% score · IRON MAN no heals +100% cores.'],
    ['#ffffff', '  3+ mutations = MUTANT: ×1.5 VOIDPASS XP for that run. Own the pain.'],
    ['#4de8ff', ''],
    ['#c9b8ff', 'VOIDPASS — SEASON 1'],
    ['#ffffff', '  Every run earns BP XP toward 30 season tiers with FREE rewards.'],
    ['#ffffff', '  PRIME adds a second reward per tier — unlock with prisms or the demo purchase.'],
    ['#ffffff', '  Season CONTRACTS pay bonus BP XP, cores and prisms. Claim them all. [B]'],
    ['#ffd166', ''],
    ['#ffd166', 'BLACK MARKET'],
    ['#ffffff', '  Shipwright: 6 purchasable hulls + 2 PRIME-exclusive skins. [N]'],
    ['#ffffff', '  Supply Depot: boosters consumed at the start of your next run.'],
    ['#ffffff', '  Prism Exchange: trade 1,000 cores into 40 prisms. PRIME is 980 prisms.'],
    ['#4de8ff', ''],
    ['#ff4d7e', 'THREATS'],
    ['#ffffff', '  Motes swarm. Sprinters zigzag. Spitters keep range. Splitters divide.'],
    ['#ffffff', '  VOLATILES blink, then detonate — kill them at range or dash past the blast.'],
    ['#ffffff', '  LANCERS aim a heavy bolt — break the line or dodge the telegraph.'],
    ['#ffffff', '  MENDERS heal the swarm — focus them first. PHANTOMS slip out of reality.'],
    ['#ffffff', '  ELITES (orange ring) are 6× tougher and roll AFFIXES — watch the pips:'],
    ['#ffffff', '    BURST · SWIFT · SHIELD · THORNS (punishes dashes) · VAMPIRIC (heals allies)'],
    ['#ffffff', '    FROST AURA (chills you) · EXPLOSIVE (telegraphed death blast) · MIRROR (reflects bullets)'],
    ['#ffffff', '  More affixes = more payout. In ENDLESS, a fourth titan hunts you: THE LEVIATHAN.'],
    ['#4de8ff', ''],
    ['#ff5c8a', 'RELICS — THE WAVE-3 BARGAIN'],
    ['#ffffff', '  At wave 3 the void offers a relic. Pick your poison:'],
    ['#ffffff', '  VAMPIRE SIGIL kills heal 1 hull · OVERCLOCK CORE +25% fire rate, jams sometimes ·'],
    ['#ffffff', '  VOID PACT +1 module slot, one fewer weapon slot. No refunds, no walking away.'],
    ['#7dffd4', ''],
    ['#7dffd4', 'DRONE BAY — BLACK MARKET [N]'],
    ['#ffffff', '  Buy once, deploy every run: MAGNETITE reels shards in · LUMEN zaps hostiles ·'],
    ['#ffffff', '  AEGIS raises a 1-hit barrier at every wave start.'],
    ['#4de8ff', ''],
    ['#ff5c8a', 'ASCENSION (NG+) — [X] AFTER YOUR FIRST WIN'],
    ['#ffffff', '  Every rank bought is permanent: tougher swarm, richer CORES payout (+8% per rank).'],
    ['#ffffff', '  HUNGER (HP/dmg/bullet speed) · HORDE (density/bursts/cap) · CORRUPTION (elite floor,'],
    ['#ffffff', '  affixes, boss HP). DAILY BREACH stays ascension-free. The void remembers.'],
  ];
  let y = py + 66;
  ctx.font = font(11, 600);
  for (const [color, line] of lines) {
    if (line === '') {
      y += 6;
      continue;
    }
    ctx.font = font(line.startsWith('  ') ? 11 : 11.5, line.startsWith('  ') ? 500 : 700);
    ctx.fillStyle = color;
    ctx.fillText(line, px + 26, y);
    y += line.startsWith('  ') ? 15 : 19;
  }

  button(r, g, 'help_back', 'BACK [ESC]', px + pw / 2 - 110, py + ph - 50, 220, 36, '#9adcff');
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
  button(r, g, 'pause_settings', 'SETTINGS [G]', bx, by + 56, bw * 0.48, 44, '#aebdd4');
  button(r, g, 'pause_quit', 'ABANDON RUN [Q]', bx + bw * 0.52, by + 56, bw * 0.48, 44, '#ff5c5c');
}

// ================= SETTINGS =================

interface SettingRow {
  key: string;
  label: string;
  value: (g: Game) => string;
  hint: string;
}

const SETTING_ROWS: SettingRow[] = [
  { key: 'volMaster', label: 'MASTER VOLUME', value: (g) => `${Math.round(g.settings.volMaster * 100)}%`, hint: 'overall loudness' },
  { key: 'volMusic', label: 'MUSIC', value: (g) => `${Math.round(g.settings.volMusic * 100)}%`, hint: 'synthwave engine' },
  { key: 'volSfx', label: 'SFX', value: (g) => `${Math.round(g.settings.volSfx * 100)}%`, hint: 'weapons / impacts' },
  { key: 'shake', label: 'SCREEN SHAKE', value: (g) => `${Math.round(g.settings.shake * 100)}%`, hint: 'impact camera kick' },
  { key: 'reduceFlash', label: 'REDUCE FLASHES', value: (g) => (g.settings.reduceFlash ? 'ON' : 'OFF'), hint: 'tones down screen flashes' },
  { key: 'dmgNumbers', label: 'DAMAGE NUMBERS', value: (g) => (g.settings.dmgNumbers ? 'ON' : 'OFF'), hint: 'floating combat text' },
  { key: 'colorblind', label: 'COLORBLIND MODE', value: (g) => g.settings.colorblind.toUpperCase(), hint: 'remaps critical colors' },
  { key: 'reducedMotion', label: 'REDUCED MOTION', value: (g) => (g.settings.reducedMotion ? 'ON' : 'OFF'), hint: 'less shake, gibs, particles' },
];

function drawSettings(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.82);

  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#aebdd4';
  ctx.fillText('SETTINGS', W / 2, 54);
  ctx.font = font(10, 600);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('saved automatically · ←/→ adjust · ↑/↓ select', W / 2, 74);

  const pw = Math.min(640, W - 60);
  const px = (W - pw) / 2;
  const rowH = 52;
  let y = 100;
  for (let i = 0; i < SETTING_ROWS.length; i++) {
    const row = SETTING_ROWS[i];
    const selected = g.settingsIndex === i;
    panel(r, px, y, pw, rowH - 6, selected ? 'rgba(174,189,212,0.7)' : 'rgba(90,160,255,0.25)');

    ctx.textAlign = 'left';
    ctx.font = font(13, 700);
    ctx.fillStyle = selected ? '#ffffff' : '#aebdd4';
    ctx.fillText(row.label, px + 16, y + 22);
    ctx.font = font(9.5, 500);
    ctx.fillStyle = '#5a6a85';
    ctx.fillText(row.hint, px + 16, y + 38);

    // value + arrows
    ctx.textAlign = 'right';
    ctx.font = font(14, 800);
    ctx.fillStyle = selected ? '#ffd94d' : '#dfeeff';
    ctx.fillText(row.value(g), px + pw - 56, y + 27);
    reg(r, g, `set_left_${row.key}`, px + pw - 108, y + 8, 26, rowH - 22);
    reg(r, g, `set_right_${row.key}`, px + pw - 26, y + 8, 26, rowH - 22);
    ctx.font = font(14, 800);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText('◀', px + pw - 95, y + 29);
    ctx.fillText('▶', px + pw - 13, y + 29);

    // whole row = click cycles up
    reg(r, g, `set_right_${row.key}`, px, y, pw, rowH - 6);
    y += rowH;
  }

  button(r, g, 'settings_back', 'BACK [ESC]', px, y + 8, pw, 40, '#9adcff');
}

// ================= VOID DIAL (v1.2 mutations) =================

function drawDial(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.82);
  const m = g.meta.data;

  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#d96bff';
  ctx.fillText('VOID DIAL', W / 2, 54);
  ctx.font = font(11, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText('twist the rules against yourself — the void pays you back', W / 2, 74);

  const pw = Math.min(680, W - 60);
  const px = (W - pw) / 2;
  const rowH = 74;
  let y = 100;
  for (let i = 0; i < MUTATIONS.length; i++) {
    const mut = MUTATIONS[i];
    const on = m.mutations.includes(mut.id);
    const selected = g.dialIndex === i;
    panel(r, px, y, pw, rowH - 8, selected ? mut.color : 'rgba(90,160,255,0.25)');

    ctx.textAlign = 'left';
    ctx.font = font(14, 800);
    ctx.fillStyle = mut.color;
    ctx.fillText(mut.name, px + 16, y + 24);
    ctx.font = font(10.5, 500);
    ctx.fillStyle = '#aebdd4';
    ctx.fillText(mut.desc, px + 16, y + 42);
    ctx.font = font(10.5, 700);
    ctx.fillStyle = '#6dff8c';
    ctx.fillText(`REWARD: ${mut.reward}`, px + 16, y + 58);

    // toggle
    ctx.textAlign = 'right';
    ctx.font = font(14, 800);
    ctx.fillStyle = on ? '#6dff8c' : '#5a6a85';
    ctx.fillText(on ? '● ON' : '○ OFF', px + pw - 20, y + 30);
    reg(r, g, `dial_toggle_${mut.id}`, px, y, pw, rowH - 8);
    y += rowH;
  }

  // mutant status
  const active = m.mutations.length;
  ctx.textAlign = 'center';
  ctx.font = font(12, 800);
  ctx.fillStyle = active >= 3 ? '#ffd94d' : '#8fa3c0';
  ctx.fillText(
    `${active}/${MUTATIONS.length} ACTIVE${active >= 3 ? `  —  ★ MUTANT ×${MUTANT_BONUS_MULT} BP XP THIS RUN` : `  —  stack 3+ for ×${MUTANT_BONUS_MULT} BP XP`}`,
    W / 2,
    y + 22
  );
  ctx.font = font(10, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('↑/↓ select · ENTER toggle · mutations apply to every normal run until switched off', W / 2, y + 42);

  button(r, g, 'dial_back', 'BACK [ESC]', px, y + 56, pw, 40, '#9adcff');
}

// ================= ASCENSION (v1.4 — NG+ tree) =================

function drawAscension(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.86);
  const m = g.meta.data;
  const t = r.t;

  // ambient corruption glow
  ctx.globalCompositeOperation = 'lighter';
  r.drawGlow(W / 2, H * 0.42, 300 + Math.sin(t * 1.1) * 18, '#3a1030', 0.5);
  ctx.globalCompositeOperation = 'source-over';

  const unlocked = ascUnlocked(m);
  const lv = ascLevelOf(m);
  const mult = ascCoresMult(lv);

  // ---- header ----
  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#ff5c8a';
  ctx.fillText('ASCENSION', W / 2, 44);
  ctx.font = font(11, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText('new game+ — every rank is permanent: the run twists harder, the void pays deeper', W / 2, 64);
  ctx.font = font(13, 800);
  ctx.fillStyle = '#ff5c8a';
  ctx.fillText(`LV ${lv}   ·   ×${mult.toFixed(2)} CORES`, W / 2, 86);
  ctx.textAlign = 'right';
  ctx.font = font(12, 700);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`◆ ${m.cores}`, W - 26, 44);

  // ---- geometry ----
  const sideM = 30;
  const gap = 16;
  const colW = Math.min(368, (W - sideM * 2 - gap * 2) / 3);
  const treeW = colW * 3 + gap * 2;
  const treeX = (W - treeW) / 2;
  const nodeH = H < 780 ? 106 : 116;
  const nodeGap = 12;
  const tierTop = 128; // tier-3 node y (branches grow upward from the root)

  // column headers
  for (let b = 0; b < 3; b++) {
    const br = ASC_BRANCHES[b];
    const cx = treeX + b * (colW + gap);
    ctx.textAlign = 'center';
    ctx.font = font(13, 800);
    ctx.fillStyle = br.color;
    ctx.fillText(br.name, cx + colW / 2, 112);
  }

  const nodeBox = (idx: number): { x: number; y: number } => {
    const node = ASC_NODES[idx];
    const b = ASC_BRANCHES.findIndex((br) => br.id === node.branch);
    const tier = node.tier;
    return { x: treeX + b * (colW + gap), y: tierTop + (3 - tier) * (nodeH + nodeGap) };
  };

  // ---- connectors (drawn under the panels) ----
  ctx.strokeStyle = 'rgba(255,92,138,0.22)';
  ctx.lineWidth = 2;
  const rootY = tierTop + 3 * nodeH + 2 * nodeGap + 26;
  ctx.beginPath();
  // root bus -> each tier-1 node
  for (let b = 0; b < 3; b++) {
    const cx = treeX + b * (colW + gap) + colW / 2;
    const by = tierTop + 3 * nodeH + 2 * nodeGap;
    ctx.moveTo(W / 2, rootY - 14);
    ctx.lineTo(cx, by + 6);
  }
  // within-column tier chains
  for (let i = 0; i < ASC_NODES.length; i++) {
    const node = ASC_NODES[i];
    if (node.tier >= 3) continue;
    const { x, y } = nodeBox(i);
    const cx = x + colW / 2;
    ctx.moveTo(cx, y - nodeGap + 2);
    ctx.lineTo(cx, y + 4);
  }
  ctx.stroke();

  // ---- node panels ----
  for (let i = 0; i < ASC_NODES.length; i++) {
    const node = ASC_NODES[i];
    const { x, y } = nodeBox(i);
    const rank = nodeRank(m, node.id);
    const lock = nodeLocked(m, node);
    const selected = g.ascIndex === i;
    const check = unlocked && !lock.locked && rank < node.maxRank;
    const cost = ascCostOf(node, rank);
    const afford = m.cores >= cost;

    ctx.globalAlpha = lock.locked ? 0.5 : 1;
    panel(r, x, y, colW, nodeH, selected ? node.color : 'rgba(90,160,255,0.25)');
    if (selected) {
      ctx.strokeStyle = node.color;
      ctx.lineWidth = 2.2;
      ctx.strokeRect(x + 1.5, y + 1.5, colW - 3, nodeH - 3);
    }

    // name row: glyph + name + rank pips
    ctx.textAlign = 'left';
    ctx.font = font(13, 800);
    ctx.fillStyle = node.color;
    ctx.fillText(`${node.glyph} ${node.name}`, x + 14, y + 22);
    const pipW = 5;
    const pipGap = 3.5;
    for (let p = 0; p < node.maxRank; p++) {
      const px2 = x + colW - 14 - (node.maxRank - p) * (pipW + pipGap);
      ctx.fillStyle = p < rank ? node.color : 'rgba(120,140,170,0.35)';
      ctx.fillRect(px2, y + 14, pipW, 9);
    }

    ctx.font = font(9.5, 500);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText(node.desc, x + 14, y + 40);

    ctx.font = font(10.5, 700);
    if (rank > 0) {
      ctx.fillStyle = '#6dff8c';
      ctx.fillText(`NOW: ${node.effect(rank)}`, x + 14, y + 60);
    } else {
      ctx.fillStyle = '#5a6a85';
      ctx.fillText('NOT BOUGHT', x + 14, y + 60);
    }

    // next-rank row
    ctx.textAlign = 'left';
    ctx.font = font(10.5, 700);
    if (lock.locked) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8fa3c0';
      ctx.fillText(`LOCKED — ${lock.reason}`, x + colW / 2, y + 86);
    } else if (rank >= node.maxRank) {
      ctx.fillStyle = '#ffd94d';
      ctx.fillText('MAX RANK — the void is satisfied', x + 14, y + 86);
    } else {
      ctx.fillStyle = '#aebdd4';
      ctx.fillText(`NEXT: ${node.effect(rank + 1)}`, x + 14, y + 86);
      ctx.font = font(11, 800);
      ctx.textAlign = 'right';
      if (check) {
        ctx.fillStyle = afford ? '#6dff8c' : '#ff5c5c';
        ctx.fillText(`BUY ${cost}◆`, x + colW - 14, y + 106);
      } else {
        ctx.fillStyle = '#5a6a85';
        ctx.fillText(`COST ${cost}◆`, x + colW - 14, y + 106);
      }
    }
    ctx.globalAlpha = 1;

    reg(r, g, `asc_buy_${node.id}`, x, y, colW, nodeH);
  }

  // ---- root panel: THE DEEP CORE ----
  const rootH = 74;
  panel(r, treeX, rootY - 26, treeW, rootH, 'rgba(255,92,138,0.4)');
  ctx.textAlign = 'left';
  ctx.font = font(12, 800);
  ctx.fillStyle = '#ff5c8a';
  ctx.fillText(`◈ THE DEEP CORE — STABILIZED ×${m.wins}`, treeX + 16, rootY - 4);
  if (unlocked) {
    const a = computeAscension(m, false);
    ctx.font = font(10, 700);
    ctx.fillStyle = '#aebdd4';
    ctx.fillText(
      `NEXT RUN — HP ×${a.enemyHp.toFixed(2)} · DMG ×${a.enemyDmg.toFixed(2)} · DENSITY ×${a.density.toFixed(2)} · ELITES ≥ WAVE ${a.eliteFloor} · BOSS HP ×${a.bossHpMult.toFixed(2)}`,
      treeX + 16,
      rootY + 16
    );
    ctx.font = font(10, 700);
    ctx.fillStyle = mult > 1 ? '#6dff8c' : '#5a6a85';
    ctx.fillText(`DAILY BREACH STAYS CLEAN (NO ASCENSION) · PAYOUT ×${a.coresMult.toFixed(2)} CORES`, treeX + 16, rootY + 34);
  } else {
    ctx.font = font(10.5, 600);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText('The core still sleeps. Stabilize it once — survive wave 15 — and the tree opens.', treeX + 16, rootY + 20);
  }

  // footer
  ctx.textAlign = 'center';
  ctx.font = font(10, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('↑/↓ climb tiers · ←/→ switch branches · ENTER/click a node to buy a rank · ranks are permanent', W / 2, rootY + 66);
  button(r, g, 'asc_back', 'BACK [ESC]', treeX, rootY + 78, treeW, 40, '#9adcff');
}

// ================= ACHIEVEMENTS (v1.2) =================

const ACH_VISIBLE = 8;

function drawAchievements(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.82);
  const m = g.meta.data;
  const done = unlockedCount(m);

  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#ffe066';
  ctx.fillText(`ACHIEVEMENTS — ${done}/${ACHIEVEMENTS.length}`, W / 2, 54);
  ctx.font = font(10.5, 600);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('lifelong milestones · rewards pay out instantly · ↑/↓ browse', W / 2, 74);

  const pw = Math.min(720, W - 60);
  const px = (W - pw) / 2;
  const rowH = 52;
  // keep the selected row in view
  const maxStart = Math.max(0, ACHIEVEMENTS.length - ACH_VISIBLE);
  const start = Math.max(0, Math.min(maxStart, g.achIndex - Math.floor(ACH_VISIBLE / 2)));
  let y = 96;
  for (let i = start; i < Math.min(ACHIEVEMENTS.length, start + ACH_VISIBLE); i++) {
    const a = ACHIEVEMENTS[i];
    const unlockedAt = m.achievements[a.id];
    const selected = i === g.achIndex;
    const color = TIER_COLORS[a.tier];
    panel(r, px, y, pw, rowH - 8, unlockedAt ? color : selected ? 'rgba(174,189,212,0.55)' : 'rgba(90,160,255,0.2)');

    ctx.textAlign = 'left';
    ctx.font = font(13, 800);
    ctx.fillStyle = unlockedAt ? color : selected ? '#ffffff' : '#8fa3c0';
    ctx.fillText(a.name, px + 16, y + 21);
    ctx.font = font(10, 500);
    ctx.fillStyle = '#aebdd4';
    ctx.fillText(a.desc, px + 16, y + 37);

    ctx.textAlign = 'right';
    ctx.font = font(11, 700);
    if (unlockedAt) {
      ctx.fillStyle = '#6dff8c';
      ctx.fillText('★ UNLOCKED', px + pw - 16, y + 24);
      ctx.font = font(9.5, 600);
      ctx.fillStyle = achievementRewardLabel(a).includes('◇') ? '#c9b8ff' : '#6dff8c';
      ctx.fillText(achievementRewardLabel(a), px + pw - 16, y + 39);
    } else {
      const cur = achievementValue(m, a.metric);
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(achievementRewardLabel(a), px + pw - 16, y + 21);
      ctx.font = font(9.5, 600);
      ctx.fillStyle = '#8fa3c0';
      const curTxt = a.metric === 'bestScore' || a.metric === 'coresEarned' ? fmtScore(Math.min(cur, a.target)) : String(Math.min(cur, a.target));
      ctx.fillText(`${curTxt} / ${a.metric === 'bestScore' || a.metric === 'coresEarned' ? fmtScore(a.target) : a.target}`, px + pw - 16, y + 37);
    }

    // tier chip
    ctx.textAlign = 'left';
    ctx.font = font(9, 800);
    ctx.fillStyle = color;
    ctx.fillText(`T${a.tier}`, px + pw - 30, y + 21);
    y += rowH;
  }

  ctx.textAlign = 'center';
  ctx.font = font(9.5, 500);
  ctx.fillStyle = '#3d4a63';
  ctx.fillText(`${done ? `${done} of ${ACHIEVEMENTS.length} claimed` : 'none claimed yet — the void is waiting'}`, W / 2, y + 18);
  button(r, g, 'ach_back', 'BACK [ESC]', px, y + 30, pw, 40, '#9adcff');
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

/** v1.2 run-end ceremony: daily record, combo payout, mutant bonus, new achievements. */
function drawRunEndExtras(r: Renderer, g: Game, x: number, y: number, w: number): void {
  const ctx = r.ctx;
  let cy = y;
  if (g.dailyMode) {
    const first = g.dailyPrismReward > 0;
    ctx.textAlign = 'left';
    ctx.font = font(11, 800);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(
      `DAILY BREACH — BEST TODAY ${fmtScore(g.meta.data.daily.bestScore)} (WAVE ${g.meta.data.daily.bestWave})${first ? `  ·  +${g.dailyPrismReward}◇ FIRST CLEAR` : ''}`,
      x,
      cy
    );
    cy += 17;
  }
  if (g.runMutations.length >= 3) {
    ctx.textAlign = 'left';
    ctx.font = font(11, 800);
    ctx.fillStyle = '#d96bff';
    ctx.fillText(`★ MUTANT — ${g.runMutations.length} MUTATIONS · ×${MUTANT_BONUS_MULT} BP XP`, x, cy);
    cy += 17;
  }
  if (g.runMaxCombo >= 10) {
    const pct = Math.min(25, Math.floor(g.runMaxCombo / 10));
    ctx.textAlign = 'left';
    ctx.font = font(11, 800);
    ctx.fillStyle = '#ff9a3d';
    ctx.fillText(`BEST CHAIN ×${g.runMaxCombo}  ·  +${pct}% CORES`, x, cy);
    cy += 17;
  }
  if (g.relic) {
    const rd = relicOf(g.relic);
    if (rd) {
      ctx.textAlign = 'left';
      ctx.font = font(11, 800);
      ctx.fillStyle = rd.color;
      ctx.fillText(`RELIC — ${rd.name} · ${rd.desc}`, x, cy);
      cy += 17;
    }
  }
  if (g.asc.active) {
    ctx.textAlign = 'left';
    ctx.font = font(11, 800);
    ctx.fillStyle = '#ff5c8a';
    ctx.fillText(`ASCENSION LV ${g.asc.level}  ·  ×${g.asc.coresMult.toFixed(2)} CORES PAID OUT`, x, cy);
    cy += 17;
  }
  if (g.newAchievements.length > 0) {
    ctx.textAlign = 'left';
    ctx.font = font(11, 800);
    ctx.fillStyle = '#ffe066';
    const names = g.newAchievements.slice(0, 2).map((a) => a.name);
    const extra = g.newAchievements.length - 2;
    ctx.fillText(
      `★ ${g.newAchievements.length} ACHIEVEMENT${g.newAchievements.length > 1 ? 'S' : ''}: ${names.join(', ')}${extra > 0 ? ` +${extra} more` : ''}`,
      x,
      cy
    );
    cy += 17;
    for (const a of g.newAchievements.slice(0, 2)) {
      ctx.font = font(10, 600);
      ctx.fillStyle = '#aebdd4';
      ctx.fillText(`   ${a.name} — ${a.desc} (${a.reward})`, x, cy);
      cy += 14;
    }
  }
  void w;
}

function drawRunEndSeason(r: Renderer, g: Game, x: number, y: number, w: number): void {
  const ctx = r.ctx;
  const m = g.meta.data;
  const cy = y;
  panel(r, x, cy, w, 148, 'rgba(201,184,255,0.5)');

  // header
  ctx.textAlign = 'left';
  ctx.font = font(13, 800);
  ctx.fillStyle = '#c9b8ff';
  ctx.fillText('VOIDPASS', x + 16, cy + 22);
  ctx.textAlign = 'right';
  ctx.font = font(13, 800);
  ctx.fillStyle = '#ffe066';
  ctx.fillText(`+${g.bpXpGained} BP XP`, x + w - 16, cy + 22);

  // season bar
  const bx = x + 16;
  const bw = w - 32;
  const need = bpXpForTier(m.passLevel);
  const frac = m.passLevel >= PASS_MAX_TIER ? 1 : Math.min(1, m.passXp / need);
  ctx.fillStyle = 'rgba(30,24,60,0.9)';
  ctx.fillRect(bx, cy + 32, bw, 10);
  ctx.fillStyle = m.prime ? '#ffe066' : '#c9b8ff';
  ctx.fillRect(bx + 1, cy + 33, (bw - 2) * frac, 8);
  ctx.textAlign = 'left';
  ctx.font = font(10, 700);
  ctx.fillStyle = '#ffffff';
  if (g.bpLevelsGained > 0) {
    ctx.fillText(`SEASON LV ${m.passLevel - g.bpLevelsGained} → ${m.passLevel}`, bx, cy + 58);
  } else {
    ctx.fillText(`SEASON LV ${m.passLevel}`, bx, cy + 58);
  }
  ctx.textAlign = 'right';
  ctx.font = font(9.5, 500);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(m.passLevel >= PASS_MAX_TIER ? 'SEASON COMPLETE' : `${Math.floor(m.passXp)}/${need} to next tier`, bx + bw, cy + 58);

  // rewards gained
  ctx.textAlign = 'left';
  ctx.font = font(10, 600);
  const rewards = g.bpRewards.slice(0, 5).map((rw) => `T${rw.tier}${rw.track === 'prime' ? '★' : ''} ${rw.label}`);
  if (rewards.length) {
    ctx.fillStyle = '#6dff8c';
    ctx.fillText(`UNLOCKED: ${rewards.join(' · ')}`, x + 16, cy + 76);
  } else {
    ctx.fillStyle = '#5a6a85';
    ctx.fillText('no tier rewards yet — keep climbing', x + 16, cy + 76);
  }

  // contracts
  let cyy = cy + 94;
  for (const c of g.contractResults.slice(0, 3)) {
    ctx.font = font(10.5, 700);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText('CONTRACT COMPLETE', x + 16, cyy);
    ctx.font = font(10.5, 500);
    ctx.fillStyle = '#dfeeff';
    ctx.fillText(`${c.desc}  (+${c.bpXp} BP XP${c.reward ? `, ${c.reward}` : ''})`, x + 152, cyy);
    cyy += 16;
  }
  if (g.contractResults.length === 0) {
    ctx.font = font(9.5, 500);
    ctx.fillStyle = '#5a6a85';
    ctx.fillText('contracts in progress — check the VOIDPASS screen [B]', x + 16, cyy);
  }
}

function drawGameOver(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.78);
  const pw = Math.min(560, W - 60);
  const px = (W - pw) / 2;
  const ph = Math.min(H * 0.86, 700);
  const py = (H - ph) / 2;
  panel(r, px, py, pw, ph, 'rgba(255,80,110,0.5)');

  ctx.textAlign = 'center';
  ctx.font = font(34, 800);
  ctx.fillStyle = '#ff5c5c';
  ctx.fillText('SIGNAL LOST', W / 2, py + 52);

  const m = g.meta.data;
  let y = py + 86;
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
    y += 26;
  }

  // cores earned
  y += 8;
  ctx.textAlign = 'center';
  ctx.font = font(16, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`+${g.coresEarned} CORES EARNED`, W / 2, y);
  y += 20;
  ctx.font = font(11, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(`BANK: ${m.cores} CORES · ${m.prisms} PRISMS`, W / 2, y);

  // season ceremony
  drawRunEndSeason(r, g, px + 20, y + 12, pw - 40);
  drawRunEndExtras(r, g, px + 20, y + 12 + 148 + 14, pw - 40);

  button(r, g, 'over_retry', 'RE-DEPLOY [ENTER]', px + 30, py + ph - 92, pw - 60, 44, '#4de8ff', 16);
  button(r, g, 'over_title', 'TITLE [T]   ·   VOIDPASS [B]', px + 30, py + ph - 40, pw - 60, 34, '#9adcff', 13);
}

function drawVictory(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.7);
  const t = r.t;
  ctx.globalCompositeOperation = 'lighter';
  r.drawGlow(W / 2, H * 0.16, 240 + Math.sin(t * 2) * 20, '#ffd94d', 0.25);
  ctx.globalCompositeOperation = 'source-over';

  const pw = Math.min(580, W - 60);
  const px = (W - pw) / 2;
  const ph = Math.min(H * 0.88, 720);
  const py = (H - ph) / 2;
  panel(r, px, py, pw, ph, 'rgba(255,217,77,0.55)');

  ctx.textAlign = 'center';
  ctx.font = font(32, 800);
  ctx.fillStyle = '#ffd94d';
  ctx.fillText('CORE STABILIZED', W / 2, py + 52);
  ctx.font = font(12, 600);
  ctx.fillStyle = '#dfeeff';
  ctx.fillText('The Null Sovereign is destroyed. The void recedes… for now.', W / 2, py + 74);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText('★ ENDLESS MODE UNLOCKED ★', W / 2, py + 94);
  // v1.4 — first victory opens the ascension tree
  if (g.meta.data.wins === 1) {
    ctx.fillStyle = '#ff5c8a';
    ctx.fillText('★ ASCENSION CONSOLE UNLOCKED — PRESS [X] AT TITLE ★', W / 2, py + 112);
  }

  let y = py + 122;
  const rows: [string, string, string][] = [
    ['FINAL SCORE', fmtScore(g.score), '#ffffff'],
    ['TIME', fmtTime(g.time), '#9adcff'],
    ['KILLS', String(g.kills), '#dfeeff'],
    ['LEVEL REACHED', String(g.player.level), '#6dff8c'],
    ['BOSSES DESTROYED', String(g.bossKills), '#ff9a3d'],
  ];
  for (const [label, value, color] of rows) {
    statRow(r, px + 30, y, pw - 60, label, value, color);
    y += 26;
  }
  y += 6;
  ctx.textAlign = 'center';
  ctx.font = font(16, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`+${g.coresEarned} CORES EARNED`, W / 2, y);

  // season ceremony
  drawRunEndSeason(r, g, px + 20, y + 12, pw - 40);
  drawRunEndExtras(r, g, px + 20, y + 12 + 148 + 14, pw - 40);

  button(r, g, 'victory_endless', 'DIVE INTO ENDLESS [C]', px + 30, py + ph - 92, pw - 60, 44, '#ffd94d', 15);
  button(r, g, 'victory_title', 'TITLE [T]   ·   VOIDPASS [B]', px + 30, py + ph - 40, pw - 60, 36, '#9adcff', 13);
}

// ================= VOIDPASS (SEASON ONE battle pass) =================

function rewardGlyph(rw: { kind: string; amount?: number; label: string }): { text: string; color: string } {
  switch (rw.kind) {
    case 'cores':
      return { text: `${rw.amount ?? 0}\u25C6`, color: '#6dff8c' };
    case 'prisms':
      return { text: `${rw.amount ?? 0}\u25C7`, color: '#c9b8ff' };
    case 'booster':
      return { text: 'AMP', color: '#9adcff' };
    case 'skin':
      return { text: 'SHIP', color: '#ffd166' };
    case 'title':
      return { text: 'TITLE', color: '#ffe066' };
    default:
      return { text: '?', color: '#8fa3c0' };
  }
}

function drawPass(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.82);
  const m = g.meta.data;

  // track origin — fixed left rail; right panel takes the remainder
  function trackX0(): number {
    return 24;
  }

  // header
  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#c9b8ff';
  ctx.fillText('VOIDPASS', W / 2, 44);
  ctx.font = font(11, 700);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(SEASON_NAME, W / 2, 62);

  // balances (top right)
  ctx.textAlign = 'right';
  ctx.font = font(13, 700);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`${m.cores} \u25C6`, W - 24, 34);
  ctx.fillStyle = '#c9b8ff';
  ctx.fillText(`${m.prisms} \u25C7`, W - 24, 54);

  // season progress bar
  const barW = Math.min(640, W - 480);
  const barX = (W - barW) / 2;
  const barY = 76;
  const need = bpXpForTier(m.passLevel);
  const frac = m.passLevel >= PASS_MAX_TIER ? 1 : Math.min(1, m.passXp / need);
  ctx.textAlign = 'left';
  ctx.font = font(14, 800);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`LV ${m.passLevel}`, barX - 64, barY + 12);
  ctx.fillStyle = 'rgba(30,24,60,0.9)';
  ctx.fillRect(barX, barY, barW, 14);
  ctx.fillStyle = m.prime ? '#ffe066' : '#c9b8ff';
  ctx.fillRect(barX + 1, barY + 1, (barW - 2) * frac, 12);
  ctx.strokeStyle = 'rgba(200,180,255,0.4)';
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW, 14);
  ctx.textAlign = 'right';
  ctx.font = font(11, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText(m.passLevel >= PASS_MAX_TIER ? 'SEASON COMPLETE' : `${Math.floor(m.passXp)} / ${need} BP XP`, barX + barW, barY + 11);

  // ---- left: tier track (2 rows of 15) ----
  const trackW = Math.min(812, W - 470);
  const cellW = (trackW - 14 * 5) / 15;
  const cellH = 74;
  const rows = [0, 1];
  const trackY0 = 108;
  for (const row of rows) {
    for (let i = 0; i < 15; i++) {
      const tierNum = row * 15 + i + 1;
      const tier = PASS_TIERS[tierNum - 1];
      const cx = trackX0() + i * (cellW + 5);
      const cy = trackY0 + row * (cellH + 8);
      const unlocked = m.passLevel > tierNum || (m.passLevel === tierNum && m.passXp >= 0 && tierNum < m.passLevel);
      const claimed = tierNum < m.passLevel;
      const current = tierNum === m.passLevel;
      const selected = g.passSelectedTier === tierNum;
      const primeGot = m.prime;

      // cell bg
      ctx.fillStyle = selected ? 'rgba(46,36,90,0.95)' : claimed ? 'rgba(16,26,22,0.9)' : 'rgba(12,16,30,0.9)';
      ctx.fillRect(cx, cy, cellW, cellH);
      ctx.strokeStyle = selected ? '#ffe066' : current ? '#c9b8ff' : claimed ? 'rgba(109,255,140,0.4)' : 'rgba(90,120,180,0.3)';
      ctx.lineWidth = selected || current ? 2 : 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, cellW, cellH);

      // tier number
      ctx.textAlign = 'center';
      ctx.font = font(9, 700);
      ctx.fillStyle = claimed ? '#6dff8c' : current ? '#ffffff' : '#5a6a85';
      ctx.fillText(String(tierNum), cx + cellW / 2, cy + 12);

      // free reward glyph
      const fg = rewardGlyph(tier.free);
      ctx.font = font(10.5, 700);
      ctx.fillStyle = claimed ? fg.color : 'rgba(140,160,200,0.45)';
      ctx.fillText(fg.text, cx + cellW / 2, cy + 30);
      ctx.font = font(7.5, 500);
      ctx.fillStyle = claimed ? '#6dff8c' : '#3d4a63';
      ctx.fillText('FREE', cx + cellW / 2, cy + 40);

      // prime reward glyph
      const pg = rewardGlyph(tier.prime);
      ctx.font = font(10.5, 700);
      ctx.fillStyle = claimed && primeGot ? pg.color : primeGot ? 'rgba(201,184,255,0.5)' : 'rgba(201,184,255,0.28)';
      ctx.fillText(pg.text, cx + cellW / 2, cy + 57);
      ctx.font = font(7.5, 500);
      ctx.fillStyle = claimed && primeGot ? '#ffe066' : '#3d4a63';
      ctx.fillText(primeGot ? 'PRIME' : 'PRIME', cx + cellW / 2, cy + 67);

      reg(r, g, `tier_select_${tierNum}`, cx, cy, cellW, cellH);
    }
  }

  // selected tier detail
  const selTier = PASS_TIERS[Math.max(0, Math.min(29, g.passSelectedTier - 1))];
  const detailY = trackY0 + 2 * (cellH + 8) + 6;
  ctx.textAlign = 'left';
  ctx.font = font(11, 700);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`TIER ${selTier.tier}`, trackX0(), detailY + 12);
  ctx.font = font(10.5, 500);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`FREE: ${selTier.free.label}`, trackX0() + 70, detailY + 12);
  ctx.fillStyle = '#ffe066';
  ctx.fillText(`PRIME: ${selTier.prime.label}`, trackX0() + 330, detailY + 12);
  ctx.font = font(9.5, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('Rewards auto-claim as you earn BP XP from runs and contracts.', trackX0(), detailY + 30);

  // ---- right: prime panel + contracts ----
  const rx = trackX0() + trackW + 18;
  const rw = W - rx - 24;

  // prime panel
  const primeH = m.prime ? 84 : 150;
  panel(r, rx, 108, rw, primeH, m.prime ? 'rgba(255,224,102,0.65)' : 'rgba(201,184,255,0.45)');
  ctx.textAlign = 'center';
  ctx.font = font(15, 800);
  ctx.fillStyle = m.prime ? '#ffe066' : '#c9b8ff';
  ctx.fillText(m.prime ? '\u2605 PRIME ACTIVE \u2605' : 'VOIDPASS PRIME', rx + rw / 2, 134);
  ctx.font = font(9.5, 500);
  ctx.fillStyle = '#8fa3c0';
  if (m.prime) {
    ctx.fillText('All 30 prime rewards granted on tier-up.', rx + rw / 2, 154);
    ctx.fillText(m.primeDemo ? 'Unlocked via demo purchase.' : 'Purchased with prisms. Thank you, pilot.', rx + rw / 2, 170);
  } else {
    ctx.fillText('Doubles every tier: exclusive skins,', rx + rw / 2, 154);
    ctx.fillText('titles, boosters and ~1150\u25C7 returned.', rx + rw / 2, 168);
    button(r, g, 'pass_unlock_prime', `UNLOCK \u2014 ${PRIME_PRICE}\u25C7`, rx + 12, 182, rw - 24, 32, '#c9b8ff', 12);
    button(r, g, 'pass_demo', 'SIMULATE PURCHASE (DEMO)', rx + 12, 220, rw - 24, 26, '#8fa3c0', 10);
  }

  // contracts panel
  const cy0 = 108 + primeH + 14;
  const chH = H - cy0 - 66;
  panel(r, rx, cy0, rw, chH, 'rgba(109,255,140,0.35)');
  ctx.textAlign = 'center';
  ctx.font = font(13, 800);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText('SEASON CONTRACTS', rx + rw / 2, cy0 + 24);
  ctx.font = font(9, 500);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText(`${m.contractsCleared} cleared`, rx + rw / 2, cy0 + 40);

  let ky = cy0 + 56;
  for (let i = 0; i < 3; i++) {
    const id = m.contractSlots[i];
    const c = CONTRACT_POOL.find((x) => x.id === id);
    if (!c) {
      ctx.font = font(10, 500);
      ctx.fillStyle = '#3d4a63';
      ctx.fillText('— all contracts cleared —', rx + rw / 2, ky + 24);
      ky += 52;
      continue;
    }
    const prog = contractProgressValue(m, { wave: m.bestWave, kills: 0, elites: 0, bosses: 0, dashKills: 0, overdrive: 0, score: 0, heals: 0, coresEarned: 0, won: false }, c);
    const pfrac = Math.min(1, prog / c.target);
    ctx.textAlign = 'left';
    ctx.font = font(10.5, 700);
    ctx.fillStyle = '#dfeeff';
    const descLines = wrapText(ctx, c.desc, rw - 24, 10.5, 700);
    let dy = ky + 12;
    for (const line of descLines.slice(0, 2)) {
      ctx.fillText(line, rx + 12, dy);
      dy += 13;
    }
    // progress bar
    ctx.fillStyle = 'rgba(20,30,24,0.9)';
    ctx.fillRect(rx + 12, dy + 2, rw - 24, 8);
    ctx.fillStyle = '#6dff8c';
    ctx.fillRect(rx + 12, dy + 2, (rw - 24) * pfrac, 8);
    ctx.font = font(9, 600);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText(`${c.metric === 'score' ? fmtScore(Math.floor(prog)) : Math.floor(prog)}/${c.metric === 'score' ? fmtScore(c.target) : c.target}`, rx + 12, dy + 22);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#c9b8ff';
    ctx.fillText(`+${c.bpXp} BP XP${c.cores ? ` ${c.cores}\u25C6` : ''}${c.prisms ? ` ${c.prisms}\u25C7` : ''}`, rx + rw - 12, dy + 22);
    ky = dy + 34;
  }

  button(r, g, 'pass_back', 'BACK [ESC]', rx + rw * 0.1, H - 52, rw * 0.8, 36, '#9adcff', 12);
}

// ================= BLACK MARKET =================

function drawMarket(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.82);
  const m = g.meta.data;

  ctx.textAlign = 'center';
  ctx.font = font(26, 800);
  ctx.fillStyle = '#ffd166';
  ctx.fillText('BLACK MARKET', W / 2, 44);
  ctx.font = font(10, 600);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('EVERYTHING HERE IS EARNABLE IN-GAME — NO REAL MONEY, EVER', W / 2, 62);

  // balances
  ctx.textAlign = 'right';
  ctx.font = font(13, 700);
  ctx.fillStyle = '#6dff8c';
  ctx.fillText(`${m.cores} \u25C6`, W - 24, 34);
  ctx.fillStyle = '#c9b8ff';
  ctx.fillText(`${m.prisms} \u25C7`, W - 24, 54);

  // tabs
  const tabs = ['SHIPWRIGHT', 'DRONE BAY', 'SUPPLY DEPOT', 'PRISM EXCHANGE'];
  const tabW = Math.min(180, (W - 48 - 3 * 8) / 4);
  let tx = (W - tabW * 4 - 24) / 2;
  for (let i = 0; i < 4; i++) {
    const active = g.marketTab === i;
    button(r, g, `market_tab_${i}`, tabs[i], tx, 84, tabW, 34, active ? '#ffd166' : '#8fa3c0', 12);
    tx += tabW + 8;
  }

  const contentY = 136;
  const contentH = H - contentY - 70;

  if (g.marketTab === 0) {
    // ---- skins grid 4 x 2 ----
    const entries = marketSkins(m);
    const gridW = Math.min(1100, W - 60);
    const cW = (gridW - 3 * 14) / 4;
    const cH = (contentH - 14) / 2;
    const x0 = (W - gridW) / 2;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const cx = x0 + (i % 4) * (cW + 14);
      const cy = contentY + Math.floor(i / 4) * (cH + 14);
      const afford = e.currency === 'cores' ? m.cores >= e.price : m.prisms >= e.price;
      panel(r, cx, cy, cW, cH, e.equipped ? 'rgba(255,217,77,0.8)' : e.owned ? 'rgba(109,255,140,0.5)' : afford ? 'rgba(90,160,255,0.45)' : 'rgba(90,110,150,0.28)');
      // preview
      ctx.save();
      ctx.translate(cx + cW / 2, cy + 46);
      ctx.scale(1.9, 1.9);
      skinOf(e.id).draw(ctx, r.t);
      ctx.restore();
      // name + rarity
      ctx.textAlign = 'center';
      ctx.font = font(12, 800);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(e.name, cx + cW / 2, cy + 88);
      ctx.font = font(9, 700);
      ctx.fillStyle = e.color;
      ctx.fillText(e.rarityLabel, cx + cW / 2, cy + 102);
      // action
      if (e.equipped) {
        ctx.font = font(11, 800);
        ctx.fillStyle = '#ffd94d';
        ctx.fillText('\u2605 EQUIPPED', cx + cW / 2, cy + cH - 14);
        reg(r, g, `skin_equip_${e.id}`, cx, cy, cW, cH); // click = no-op equip
      } else if (e.owned) {
        button(r, g, `skin_equip_${e.id}`, 'EQUIP', cx + 14, cy + cH - 36, cW - 28, 26, '#6dff8c', 11);
      } else {
        const priceTxt = `${e.price} ${e.currency === 'cores' ? '\u25C6' : '\u25C7'}`;
        button(r, g, `skin_buy_${e.id}`, afford ? `BUY \u2014 ${priceTxt}` : priceTxt, cx + 14, cy + cH - 36, cW - 28, 26, afford ? '#ffd166' : '#8a97b0', 11);
      }
    }
  } else if (g.marketTab === 1) {
    // ---- drone bay (v1.3 companions) ----
    const listW = Math.min(760, W - 80);
    const lx = (W - listW) / 2;
    let ly = contentY + 6;
    ctx.textAlign = 'center';
    ctx.font = font(10.5, 500);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText('Buy once — one drone deploys with you every run. They cannot be targeted.', W / 2, contentY - 6);
    for (const d of COMPANIONS) {
      const owned = m.companionsOwned.includes(d.id);
      const equipped = m.companionEquipped === d.id;
      const afford = d.currency === 'cores' ? m.cores >= d.price : m.prisms >= d.price;
      panel(r, lx, ly, listW, 74, equipped ? 'rgba(255,217,77,0.7)' : afford ? 'rgba(90,160,255,0.45)' : 'rgba(90,110,150,0.28)');
      ctx.textAlign = 'left';
      ctx.font = font(14, 800);
      ctx.fillStyle = d.color;
      ctx.fillText(d.name, lx + 18, ly + 26);
      ctx.font = font(10.5, 500);
      ctx.fillStyle = '#aebdd4';
      ctx.fillText(d.desc, lx + 18, ly + 45);
      ctx.font = font(10, 700);
      ctx.fillStyle = owned ? '#6dff8c' : '#5a6a85';
      ctx.fillText(owned ? 'OWNED' : `${d.price} ${d.currency === 'cores' ? '\u25C6' : '\u25C7'}`, lx + 18, ly + 62);
      if (equipped) {
        ctx.font = font(11, 800);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffd94d';
        ctx.fillText('\u2605 DEPLOYED', lx + listW - 85, ly + 42);
        reg(r, g, `drone_equip_${d.id}`, lx + listW - 150, ly + 20, 130, 34);
      } else if (owned) {
        button(r, g, `drone_equip_${d.id}`, 'DEPLOY', lx + listW - 150, ly + 20, 130, 34, '#6dff8c', 12);
      } else {
        button(
          r,
          g,
          `drone_buy_${d.id}`,
          `BUY — ${d.price} ${d.currency === 'cores' ? '\u25C6' : '\u25C7'}`,
          lx + listW - 150,
          ly + 20,
          130,
          34,
          afford ? '#ffd166' : '#8a97b0',
          11
        );
      }
      ly += 86;
    }
  } else if (g.marketTab === 2) {
    // ---- boosters ----
    const listW = Math.min(760, W - 80);
    const lx = (W - listW) / 2;
    let ly = contentY + 6;
    ctx.textAlign = 'center';
    ctx.font = font(10.5, 500);
    ctx.fillStyle = '#8fa3c0';
    ctx.fillText('Consumables auto-apply to your NEXT run — one of each owned type fires per run.', W / 2, contentY - 6);
    for (const b of BOOSTERS) {
      const owned = m.boosters[b.id] ?? 0;
      const afford = b.currency === 'cores' ? m.cores >= b.price : m.prisms >= b.price;
      panel(r, lx, ly, listW, 74, afford ? 'rgba(90,160,255,0.45)' : 'rgba(90,110,150,0.28)');
      ctx.textAlign = 'left';
      ctx.font = font(14, 800);
      ctx.fillStyle = b.color;
      ctx.fillText(b.name, lx + 18, ly + 26);
      ctx.font = font(10.5, 500);
      ctx.fillStyle = '#aebdd4';
      ctx.fillText(b.desc, lx + 18, ly + 45);
      ctx.font = font(10, 700);
      ctx.fillStyle = owned > 0 ? '#6dff8c' : '#5a6a85';
      ctx.fillText(`OWNED: ${owned}`, lx + 18, ly + 62);
      button(r, g, `booster_buy_${b.id}`, `${b.price} ${b.currency === 'cores' ? '\u25C6' : '\u25C7'}`, lx + listW - 150, ly + 20, 130, 34, afford ? '#ffd166' : '#8a97b0', 12);
      ly += 86;
    }
  } else {
    // ---- prism exchange ----
    const pw = Math.min(620, W - 80);
    const px2 = (W - pw) / 2;
    const py2 = contentY + 20;
    panel(r, px2, py2, pw, 190, 'rgba(201,184,255,0.5)');
    ctx.textAlign = 'center';
    ctx.font = font(16, 800);
    ctx.fillStyle = '#c9b8ff';
    ctx.fillText('PRISM EXCHANGE', W / 2, py2 + 34);
    ctx.font = font(11, 500);
    ctx.fillStyle = '#aebdd4';
    ctx.fillText(`Convert ${EXCHANGE_CORES}\u25C6 CORES into ${EXCHANGE_PRISMS}\u25C7 PRISMS.`, W / 2, py2 + 62);
    ctx.fillText('A painful rate, but every path to PRIME is earnable through play:', W / 2, py2 + 80);
    ctx.fillText(`contracts, the free pass track, and this exchange. PRIME costs ${PRIME_PRICE}\u25C7.`, W / 2, py2 + 96);
    button(r, g, 'exchange_btn', `EXCHANGE ${EXCHANGE_CORES}\u25C6 \u2192 ${EXCHANGE_PRISMS}\u25C7`, px2 + pw / 2 - 170, py2 + 118, 340, 40, '#c9b8ff', 13);
    ctx.font = font(10, 500);
    ctx.fillStyle = '#5a6a85';
    ctx.fillText(`You have ${m.cores}\u25C6 and ${m.prisms}\u25C7.`, W / 2, py2 + 178);
  }

  button(r, g, 'market_back', 'BACK [ESC]', W / 2 - 110, H - 52, 220, 36, '#9adcff', 12);
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

  g.cardAnimT += 1 / 60; // slide-in clock

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
    // staggered spring slide-in
    const k = Math.max(0, Math.min(1, g.cardAnimT * 3.2 - i * 0.14));
    const back = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2); // easeOutBack-ish
    const yo = (1 - back) * 42;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.translate(0, yo);
    drawCard(r, g, card, i, x, y0, cardW, cardH);
    ctx.restore();
    ctx.globalAlpha = 1;
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

// ================= RELIC PICK (v1.3 — wave 3 bargain) =================

export function drawRelicPick(r: Renderer, g: Game): void {
  const ctx = r.ctx;
  const W = r.viewW;
  const H = r.viewH;
  dim(r, 0.78);

  ctx.textAlign = 'center';
  ctx.font = font(30, 800);
  ctx.fillStyle = '#ff5c8a';
  ctx.fillText('THE VOID OFFERS A BARGAIN', W / 2, H * 0.17);
  ctx.font = font(12, 600);
  ctx.fillStyle = '#8fa3c0';
  ctx.fillText('WAVE 3 — bind one relic to this run. Every gift has a price.', W / 2, H * 0.17 + 26);

  const cardW = Math.min(320, (W - 100) / 3 - 14);
  const cardH = Math.min(300, H * 0.46);
  const gap = 24;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (W - totalW) / 2;
  const y0 = H * 0.25;

  for (let i = 0; i < g.relicChoices.length; i++) {
    const rd: RelicDef = g.relicChoices[i];
    const x = x0 + i * (cardW + gap);
    const b = reg(r, g, `relic_${i}`, x, y0, cardW, cardH);
    const hover = b.hover;
    const lift = hover ? -6 : 0;

    ctx.save();
    ctx.translate(0, lift);
    if (hover) {
      ctx.globalCompositeOperation = 'lighter';
      r.drawGlow(x + cardW / 2, y0 + cardH / 2, cardW * 0.72, rd.color, 0.13);
      ctx.globalCompositeOperation = 'source-over';
    }
    panel(r, x, y0, cardW, cardH, hover ? rd.color : 'rgba(255,92,138,0.5)');

    // header strip
    ctx.fillStyle = 'rgba(30,14,26,0.85)';
    ctx.fillRect(x + 1, y0 + 1, cardW - 2, 28);
    ctx.font = font(10, 700);
    ctx.textAlign = 'left';
    ctx.fillStyle = rd.color;
    ctx.fillText('RELIC', x + 14, y0 + 19);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5a6a85';
    ctx.fillText(`[${i + 1}]`, x + cardW - 14, y0 + 19);

    // glyph
    ctx.globalCompositeOperation = 'lighter';
    r.drawGlow(x + cardW / 2, y0 + 86, 42, rd.color, 0.5);
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center';
    ctx.font = font(34, 800);
    ctx.fillStyle = rd.color;
    ctx.fillText(rd.glyph, x + cardW / 2, y0 + 98);

    // name
    ctx.font = font(15, 800);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(rd.name, x + cardW / 2, y0 + 136);

    // benefit
    ctx.font = font(11.5, 600);
    ctx.fillStyle = '#a8ffb8';
    let dy = y0 + 166;
    for (const line of wrapText(ctx, rd.desc, cardW - 32, 11.5, 600).slice(0, 3)) {
      ctx.fillText(line, x + cardW / 2, dy);
      dy += 15;
    }

    // tradeoff
    dy += 6;
    ctx.font = font(11, 700);
    ctx.fillStyle = '#ff9a8a';
    for (const line of wrapText(ctx, `COST: ${rd.trade}`, cardW - 32, 11, 700).slice(0, 3)) {
      ctx.fillText(line, x + cardW / 2, dy);
      dy += 14;
    }

    ctx.restore();
  }

  ctx.font = font(11, 600);
  ctx.fillStyle = '#5a6a85';
  ctx.fillText('press 1 / 2 / 3 — or click a card', W / 2, y0 + cardH + 42);
}
