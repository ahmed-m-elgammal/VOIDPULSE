/**
 * VOIDPULSE MOBILE — DOM screens (v1.6.0 "MIRROR").
 * Every screen is driven by the CORE's state (game.meta / game.cards /
 * game.relicChoices). All DOM churn happens on state transitions — never in
 * the tick — so the zero-alloc hot-path contract holds.
 */
import { rt, startRun as coreStartRun, prefs, savePrefs } from '../bridge';
import { setHaptics, hapHeavy } from '../haptics';
import { resetCamera } from '../camera';
import { resetRenderCaches, showWaveBanner } from './render';
import { PALETTES } from '../palette';
import { bakeAll } from '../sprites';
import { ENEMIES, BOSSES } from '../../../src/game/content';
import { SKINS, SKIN_IDS } from '../../../src/game/skins';
import type { CardOption, RelicDef } from '../../../src/game/types';

// ---------------------------------------------------------------- elements
const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

const scrTitle = $('screen-title');
const scrGarage = $('screen-garage');
const modalPerk = $('modal-perk');
const drawer = $('drawer-pause');
const scrOver = $('screen-gameover');
const btnPause = $('btn-pause');

const garageTrack = $('garage-track');
const garageCores = $('garage-cores');
const perkCards = $('perk-cards');

let drawerFrom: 'run' | 'title' = 'title';
let modalMode: 'perk' | 'relic' = 'perk';

// ---------------------------------------------------------------- helpers
function hideAll(): void {
  scrTitle.hidden = true;
  scrGarage.hidden = true;
  modalPerk.hidden = true;
  drawer.hidden = true;
  scrOver.hidden = true;
  btnPause.hidden = true;
}

function showTitle(): void {
  hideAll();
  const m = rt.game.meta.data;
  $('title-bests').textContent =
    'BEST ' + m.bestScore + '  ·  WAVE ' + m.bestWave +
    '  ·  ◆ ' + m.cores + '  ·  ✦ ' + m.prisms;
  scrTitle.hidden = false;
}

/** Shell-side run start (core startRun + shell resets). */
export function startRun(daily = false): void {
  rt.audio.sfx('select');
  coreStartRun(daily);
  resetCamera(rt.game.player.x, rt.game.player.y);
  resetRenderCaches();
  hideAll();
  btnPause.hidden = false;
}

// ---------------------------------------------------------------- pause
function openPause(from: 'run' | 'title'): void {
  drawerFrom = from;
  if (rt.game.state === 'playing') rt.game.togglePause();
  btnPause.hidden = true;
  $('btn-resume').hidden = from !== 'run';
  $('btn-abandon').hidden = from !== 'run';
  drawer.hidden = false;
  syncSettingsUI();
}

export function closePauseToRun(): void {
  drawer.hidden = true;
  if (drawerFrom === 'run') {
    if (rt.game.state === 'paused') rt.game.togglePause();
    btnPause.hidden = false;
  } else {
    showTitle();
  }
}

export function openPauseAuto(): void { openPause('run'); }
export function openPauseFromTitle(): void { openPause('title'); }

// ---------------------------------------------------------------- run end
function finishRun(won: boolean): void {
  const g = rt.game;
  hapHeavy();
  hideAll();
  const t = $('go-title');
  t.textContent = won ? 'VICTORY' : 'GAME OVER';
  t.className = won ? 'win' : 'lose';
  const newBest = g.score > rt.bestAtStart.score || g.wave > rt.bestAtStart.wave;
  $('go-newbest').hidden = !newBest;
  $('go-score').textContent = '' + (g.score | 0);
  $('go-wave').textContent = '' + g.wave;
  $('go-kills').textContent = '' + g.kills;
  $('go-time').textContent = '' + ((g.time / 60) | 0) + ':' + ('0' + ((g.time | 0) % 60)).slice(-2);
  $('go-cores').textContent = '◆ +' + (g.coresEarned | 0) + ' CORES BANKED';
  $('btn-continue-endless').hidden = !won;
  scrOver.hidden = false;
}

// ---------------------------------------------------------------- level-up cards
export function openPerkModal(): void {
  modalMode = 'perk';
  btnPause.hidden = true;
  modalPerk.hidden = false;
  rt.audio.sfx('levelup');
  fillCardModal();
}

function openRelicModal(): void {
  modalMode = 'relic';
  btnPause.hidden = true;
  modalPerk.hidden = false;
  rt.audio.sfx('charge');
  fillRelicModal();
}

const KIND_TAG: Record<string, string> = {
  evolve: 'EVOLVE',
  weapon: 'WEAPON',
  passive: 'MODULE',
  heal: 'REPAIR',
};

function fillCardModal(): void {
  const g = rt.game;
  let html = '';
  const cards = g.cards;
  for (let i = 0; i < cards.length; i++) {
    const c: CardOption = cards[i];
    const tag = KIND_TAG[c.kind] ?? 'MODULE';
    html += '<button class="perk-card" data-card="' + i + '" style="border-color:' + c.color + '55">'
      + '<span class="ptag" style="color:' + c.color + '">' + tag + '</span>'
      + '<span class="pname">' + c.title + '</span>'
      + '<span class="pdesc">' + c.desc + '</span>'
      + '<span class="ptag">' + c.levelText + '</span></button>';
  }
  perkCards.innerHTML = html;
  $('perk-title').textContent = '◆ LEVEL ' + g.player.level;
  const rr = $('btn-reroll');
  rr.hidden = g.rerolls <= 0;
  rr.textContent = '⟳ REROLL (' + g.rerolls + ')';
}

function fillRelicModal(): void {
  const choices = rt.game.relicChoices;
  let html = '';
  for (let i = 0; i < choices.length; i++) {
    const r: RelicDef = choices[i];
    html += '<button class="perk-card" data-relic="' + i + '" style="border-color:' + r.color + '66">'
      + '<span class="ptag" style="color:' + r.color + ';font-size:22px">' + r.glyph + '</span>'
      + '<span class="pname">' + r.name + '</span>'
      + '<span class="pdesc">' + r.desc + '</span>'
      + '<span class="pdesc" style="opacity:.55">✕ ' + r.trade + '</span></button>';
  }
  perkCards.innerHTML = html;
  $('perk-title').textContent = '◆ THE BARGAIN';
  $('btn-reroll').hidden = true;
}

function onCardTap(ev: Event): void {
  const el = ev.target as HTMLElement;
  const card = el.closest('[data-card]') as HTMLElement | null;
  const relic = el.closest('[data-relic]') as HTMLElement | null;
  if (card) {
    rt.audio.sfx('select');
    rt.game.chooseCard(parseInt(card.getAttribute('data-card') || '0', 10));
    if (rt.game.state === 'levelup' && rt.game.cards.length > 0) {
      fillCardModal(); // chained level-up — refill in place
    } else {
      modalPerk.hidden = true;
      btnPause.hidden = rt.game.state !== 'playing';
    }
  } else if (relic) {
    rt.audio.sfx('select');
    rt.game.chooseRelic(parseInt(relic.getAttribute('data-relic') || '0', 10));
    modalPerk.hidden = true;
    btnPause.hidden = rt.game.state !== 'playing';
  }
}

function onReroll(): void {
  if (modalMode !== 'perk' || rt.game.rerolls <= 0) return;
  rt.audio.sfx('reroll');
  rt.game.rerollCards();
  fillCardModal();
}

// ---------------------------------------------------------------- garage (skins)
function statBar(label: string, pct: number): string {
  return '<div class="stat"><b>' + label + '</b><span class="bar"><i style="width:' + pct + '%"></i></span></div>';
}

function buildGarage(): void {
  const m = rt.game.meta.data;
  garageCores.textContent = '◆ ' + m.cores + ' · ✦ ' + m.prisms;
  let html = '';
  for (let i = 0; i < SKIN_IDS.length; i++) {
    const id = SKIN_IDS[i];
    const s = SKINS[id];
    const owned = m.skinsOwned.includes(id);
    const equipped = m.skinEquipped === id;
    const cur = s.currency === 'prisms' ? '✦' : '◆';
    html += '<div class="gcard glass' + (owned ? '' : ' locked') + '" style="border-color:' + s.color + '44">'
      + '<h3>' + s.name + (equipped ? '<span style="color:#7dffd4">●</span>' : '') + '</h3>'
      + '<div class="tag">' + s.rarity.toUpperCase() + ' — ' + s.desc + '</div>'
      + statBar('STRIKE', s.rarity === 'prime' ? 100 : s.rarity === 'epic' ? 80 : s.rarity === 'rare' ? 60 : 40)
      + (owned
        ? (equipped
          ? '<button class="btn primary" disabled style="opacity:.6">EQUIPPED</button>'
          : '<button class="btn" data-equip="' + id + '">Equip</button>')
        : (s.price > 0
          ? '<button class="btn" data-buy="' + id + '">' + cur + ' ' + s.price + ' Unlock</button>'
          : '<button class="btn" disabled style="opacity:.5">' + (s.currency === 'pass' ? 'PASS REWARD' : 'LOCKED') + '</button>'))
      + '</div>';
  }
  garageTrack.innerHTML = html;
}

function onGarageTap(ev: Event): void {
  const el = ev.target as HTMLElement;
  const eq = el.closest('[data-equip]') as HTMLElement | null;
  const buy = el.closest('[data-buy]') as HTMLElement | null;
  if (eq) {
    rt.game.equipSkin(eq.getAttribute('data-equip') || '');
    rt.audio.sfx('select');
    rt.game.meta.save();
    buildGarage();
  } else if (buy) {
    const id = buy.getAttribute('data-buy') || '';
    const before = rt.game.meta.data.skinsOwned.length;
    rt.game.buySkin(id);
    if (rt.game.meta.data.skinsOwned.length > before) {
      rt.audio.sfx('buy');
      rt.game.meta.save();
    } else {
      const s = SKINS[id];
      const cur = s.currency === 'prisms' ? '✦' : '◆';
      rt.audio.sfx('uiMove');
      garageCores.textContent = 'NEED ' + cur + ' ' + s.price;
    }
    buildGarage();
  }
}

export function showGarage(): void {
  hideAll();
  buildGarage();
  scrGarage.hidden = false;
}

export function openGarage(): void { showGarage(); }

// ---------------------------------------------------------------- settings
const CB_MODES = ['off', 'deutan', 'protan', 'tritan'];

function syncSettingsUI(): void {
  const s = rt.game.meta.data.settings;
  ($('rng-master') as HTMLInputElement).value = '' + Math.round(s.volMaster * 100);
  ($('rng-sfx') as HTMLInputElement).value = '' + Math.round(s.volSfx * 100);
  ($('rng-music') as HTMLInputElement).value = '' + Math.round(s.volMusic * 100);
  $('tgl-haptics').className = 'switch' + (prefs.haptics ? ' on' : '');
  const cbIdx = CB_MODES.indexOf(s.colorblind);
  const palBtns = $('seg-palette').children;
  for (let i = 0; i < palBtns.length; i++) {
    (palBtns[i] as HTMLElement).className = 'btn' + (i === (cbIdx < 0 ? 0 : cbIdx) ? ' on' : '');
  }
  const fpsBtns = $('seg-fps').children;
  (fpsBtns[0] as HTMLElement).className = 'btn' + (!prefs.fps120 ? ' on' : '');
  (fpsBtns[1] as HTMLElement).className = 'btn' + (prefs.fps120 ? ' on' : '');
}

/** Palette index → core colorblind mode + sprite rebake. */
function applyPalette(idx: number): void {
  const pal = PALETTES[idx] || PALETTES[0];
  document.documentElement.style.setProperty('--acc', pal.css);
  const bossColors: string[] = [];
  for (let i = 0; i < BOSSES.length; i++) bossColors.push(BOSSES[i].color);
  bakeAll(pal, ENEMIES, bossColors);
}

function bindSettings(): void {
  const bindRange = (id: string, key: 'volMaster' | 'volSfx' | 'volMusic') => {
    $(id).addEventListener('input', (ev) => {
      const v = parseInt((ev.target as HTMLInputElement).value, 10) / 100;
      rt.game.meta.data.settings[key] = v;
      rt.audio.setVolumes(
        rt.game.meta.data.settings.volMaster,
        rt.game.meta.data.settings.volMusic,
        rt.game.meta.data.settings.volSfx,
      );
      rt.game.meta.save();
    });
  };
  bindRange('rng-master', 'volMaster');
  bindRange('rng-sfx', 'volSfx');
  bindRange('rng-music', 'volMusic');

  $('tgl-haptics').addEventListener('click', () => {
    prefs.haptics = !prefs.haptics;
    setHaptics(prefs.haptics);
    savePrefs();
    syncSettingsUI();
    rt.audio.sfx('select');
  });

  $('seg-palette').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-pal]') as HTMLElement | null;
    if (!b) return;
    const idx = parseInt(b.getAttribute('data-pal') || '0', 10);
    rt.game.meta.data.settings.colorblind = CB_MODES[idx] as typeof rt.game.meta.data.settings.colorblind;
    rt.game.meta.save();
    applyPalette(idx);
    syncSettingsUI();
    rt.audio.sfx('select');
  });

  $('seg-fps').addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-fps]') as HTMLElement | null;
    if (!b) return;
    prefs.fps120 = b.getAttribute('data-fps') === '1';
    savePrefs();
    syncSettingsUI();
    rt.audio.sfx('select');
  });

  $('btn-resume').addEventListener('click', () => { rt.audio.sfx('select'); closePauseToRun(); });
  $('btn-abandon').addEventListener('click', () => {
    rt.audio.sfx('select');
    drawer.hidden = true;
    rt.game.quitToTitle(); // flow hook swaps to the title screen
  });
}

// ---------------------------------------------------------------- boot & bind
export function initScreens(): void {
  // core state → shell screens (assigned before the loop starts)
  rt.flow = {
    onLevelUp: openPerkModal,
    onRelicPick: openRelicModal,
    onRunEnd: finishRun,
    onTitle: showTitle,
    onWave: () => { showWaveBanner(); hapHeavy(); },
  };

  $('btn-start').addEventListener('click', () => startRun(false));
  $('btn-daily').addEventListener('click', () => startRun(true));
  $('btn-garage').addEventListener('click', () => { rt.audio.sfx('select'); showGarage(); });
  $('btn-settings-title').addEventListener('click', () => { rt.audio.sfx('select'); openPauseFromTitle(); });
  $('btn-garage-back').addEventListener('click', () => { rt.audio.sfx('select'); showTitle(); });
  garageTrack.addEventListener('click', onGarageTap);
  perkCards.addEventListener('click', onCardTap);
  $('btn-reroll').addEventListener('click', onReroll);
  btnPause.addEventListener('click', () => { rt.audio.sfx('select'); openPause('run'); });
  $('btn-restart').addEventListener('click', () => startRun(rt.game.lastRunDaily === true));
  $('btn-continue-endless').addEventListener('click', () => {
    rt.audio.sfx('select');
    scrOver.hidden = true;
    rt.game.continueEndless();
    btnPause.hidden = false;
  });
  $('btn-go-garage').addEventListener('click', () => { rt.audio.sfx('select'); showGarage(); });
  $('btn-go-title').addEventListener('click', () => { rt.audio.sfx('select'); rt.game.quitToTitle(); });
  bindSettings();

  const cbIdx = CB_MODES.indexOf(rt.game.meta.data.settings.colorblind);
  applyPalette(cbIdx < 0 ? 0 : cbIdx);
  showTitle();
}
