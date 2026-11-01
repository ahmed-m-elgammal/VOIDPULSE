/**
 * VOIDPULSE MOBILE — DOM screens: title, garage, perk modal, pause/settings
 * drawer, game over / victory. All DOM churn happens on state transitions
 * (never in the tick), so the zero-alloc hot-path contract holds.
 */
import { ST_GARAGE, ST_PAUSED, ST_RUNNING, ST_TITLE, ST_GAMEOVER, ST_LEVELUP } from '../types';
import * as W from '../sim/world';
import * as P from '../sim/player';
import { HULLS } from '../sim/player';
import { drawPerks, PERK_NAME, PERK_DESC, choosePerk } from '../sim/perks';
import { save, persist, bankCores, recordRun, unlockHull, selectHull } from '../save';
import { PALETTES } from '../palette';
import { bakeAll } from '../sprites';
import { applyVolumes, sfxUi, sfxLevelUp, sfxDeath, sfxWave } from '../audio';
import { setHaptics, hapHeavy } from '../haptics';
import { resetCamera } from '../camera';
import { resetRenderCaches, showWaveBanner } from './render';
import { WORLD_W, WORLD_H } from '../config';

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
let lastWaveSeen = 1;

// scratch for perk draw (allocated once)
const perkScratch = new Int32Array(3);

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
  W.setState(ST_TITLE);
  scrTitle.hidden = false;
  $('title-bests').textContent =
    'BEST SCORE ' + save.bests.score + '  ·  WAVE ' + save.bests.wave +
    '  ·  KILLS ' + save.bests.kills + '  ·  ◆ ' + save.cores;
}

// ---------------------------------------------------------------- flow
export function startRun(): void {
  sfxUi();
  W.resetWorld();
  P.resetPlayer(save.hull);
  resetCamera(WORLD_W * 0.5, WORLD_H * 0.5);
  resetRenderCaches();
  lastWaveSeen = 1;
  hideAll();
  W.setState(ST_RUNNING);
  btnPause.hidden = false;
}

function openPause(from: 'run' | 'title'): void {
  drawerFrom = from;
  if (W.state === ST_RUNNING) {
    W.setState(ST_PAUSED);
    btnPause.hidden = true;
  }
  $('btn-resume').hidden = from !== 'run';
  $('btn-abandon').hidden = from !== 'run';
  drawer.hidden = false;
  syncSettingsUI();
}

export function closePauseToRun(): void {
  drawer.hidden = true;
  if (drawerFrom === 'run') {
    W.setState(ST_RUNNING);
    btnPause.hidden = false;
  } else {
    showTitle();
  }
}

export function openPauseAuto(): void { openPause('run'); }
export function openPauseFromTitle(): void { openPause('title'); }

export function finishRun(won: boolean): void {
  if (W.state === ST_GAMEOVER) return;
  const earned = ((W.score / 120) | 0) + W.wave;
  bankCores(earned);
  const newBest = recordRun(W.score | 0, W.wave, W.kills, W.runTime);
  if (!won) sfxDeath();
  hapHeavy();

  hideAll();
  W.setState(ST_GAMEOVER);
  const t = $('go-title');
  t.textContent = won ? 'VICTORY' : 'GAME OVER';
  t.className = won ? 'win' : 'lose';
  $('go-newbest').hidden = !newBest;
  $('go-score').textContent = '' + (W.score | 0);
  $('go-wave').textContent = '' + W.wave;
  $('go-kills').textContent = '' + W.kills;
  $('go-time').textContent = '' + ((W.runTime / 60) | 0) + ':' + ('0' + ((W.runTime | 0) % 60)).slice(-2);
  $('go-cores').textContent = '◆ +' + earned + ' CORES BANKED';
  scrOver.hidden = false;
}

// ---------------------------------------------------------------- perk modal
export function openPerkModal(): void {
  if (W.state !== ST_LEVELUP) {
    W.setState(ST_LEVELUP);
    btnPause.hidden = true;
    modalPerk.hidden = false;
    sfxLevelUp();
  }
  fillPerkCards();
}

function fillPerkCards(): void {
  drawPerks(perkScratch);
  let html = '';
  for (let k = 0; k < 3; k++) {
    const id = perkScratch[k];
    html += '<button class="perk-card" data-perk="' + id + '">'
      + '<span class="pname">' + PERK_NAME[id] + '</span>'
      + '<span class="pdesc">' + PERK_DESC[id] + '</span></button>';
  }
  perkCards.innerHTML = html;
  $('perk-title').textContent = '◆ LEVEL ' + P.pLevel;
}

function onPerkPick(ev: Event): void {
  const el = ev.target as HTMLElement;
  const card = el.closest('.perk-card') as HTMLElement | null;
  if (!card) return;
  const id = parseInt(card.getAttribute('data-perk') || '0', 10);
  sfxUi();
  choosePerk(id);
  P.consumeLevel();
  if (P.pendingLevels > 0) {
    fillPerkCards();
  } else {
    modalPerk.hidden = true;
    W.setState(ST_RUNNING);
    btnPause.hidden = false;
  }
}

// ---------------------------------------------------------------- garage
function statBar(label: string, v: number, max: number): string {
  const pct = Math.round((v / max) * 100);
  return '<div class="stat"><b>' + label + '</b><span class="bar"><i style="width:' + pct + '%"></i></span></div>';
}

function buildGarage(): void {
  garageCores.textContent = '◆ ' + save.cores;
  let html = '';
  for (let i = 0; i < HULLS.length; i++) {
    const h = HULLS[i];
    const owned = (save.unlocked & (1 << i)) !== 0;
    const selected = save.hull === i;
    html += '<div class="gcard glass' + (owned ? '' : ' locked') + '">'
      + '<h3>' + h.name + (selected ? '<span style="color:#7dffd4">●</span>' : '') + '</h3>'
      + '<div class="tag">' + h.tag + '</div>'
      + statBar('HULL', h.hp, 140)
      + statBar('SPEED', h.speed, 300)
      + statBar('DPS', h.dmg * h.fireRate, 34)
      + statBar('DASH', 3.2 - h.dashCd, 2)
      + (owned
        ? (selected
          ? '<button class="btn primary" data-sel="' + i + '" disabled style="opacity:.6">EQUIPPED</button>'
          : '<button class="btn" data-sel="' + i + '">Equip</button>')
        : '<button class="btn" data-unlock="' + i + '">◆ ' + h.cost + ' Unlock</button>')
      + '</div>';
  }
  garageTrack.innerHTML = html;
}

function onGarageTap(ev: Event): void {
  const el = ev.target as HTMLElement;
  const sel = el.closest('[data-sel]') as HTMLElement | null;
  const unl = el.closest('[data-unlock]') as HTMLElement | null;
  if (sel) {
    const idx = parseInt(sel.getAttribute('data-sel') || '0', 10);
    selectHull(idx);
    sfxUi();
    buildGarage();
  } else if (unl) {
    const idx = parseInt(unl.getAttribute('data-unlock') || '0', 10);
    const h = HULLS[idx];
    if (unlockHull(1 << idx, h.cost)) {
      sfxLevelUp();
      buildGarage();
    } else {
      sfxUi();
      garageCores.textContent = '◆ ' + save.cores + ' — NEED ◆ ' + (h.cost - save.cores);
    }
  }
}

export function showGarage(): void {
  hideAll();
  W.setState(ST_GARAGE);
  buildGarage();
  scrGarage.hidden = false;
}

export function openGarage(): void { showGarage(); }

// ---------------------------------------------------------------- settings
function syncSettingsUI(): void {
  const s = save.settings;
  ($('rng-master') as HTMLInputElement).value = '' + Math.round(s.master * 100);
  ($('rng-sfx') as HTMLInputElement).value = '' + Math.round(s.sfx * 100);
  ($('rng-music') as HTMLInputElement).value = '' + Math.round(s.music * 100);
  $('tgl-haptics').className = 'switch' + (s.haptics ? ' on' : '');
  const palBtns = $('seg-palette').children;
  for (let i = 0; i < palBtns.length; i++) {
    (palBtns[i] as HTMLElement).className = 'btn' + (s.palette === i ? ' on' : '');
  }
  const fpsBtns = $('seg-fps').children;
  (fpsBtns[0] as HTMLElement).className = 'btn' + (!s.fps120 ? ' on' : '');
  (fpsBtns[1] as HTMLElement).className = 'btn' + (s.fps120 ? ' on' : '');
}

function applyPalette(): void {
  const pal = PALETTES[save.settings.palette] || PALETTES[0];
  document.documentElement.style.setProperty('--acc', pal.css);
  bakeAll(pal);
}

function bindSettings(): void {
  const bindRange = (id: string, key: 'master' | 'sfx' | 'music') => {
    $(id).addEventListener('input', (ev) => {
      const v = parseInt((ev.target as HTMLInputElement).value, 10) / 100;
      save.settings[key] = v;
      applyVolumes(save.settings.master, save.settings.sfx, save.settings.music);
      persist();
    });
  };
  bindRange('rng-master', 'master');
  bindRange('rng-sfx', 'sfx');
  bindRange('rng-music', 'music');

  $('tgl-haptics').addEventListener('click', () => {
    save.settings.haptics = !save.settings.haptics;
    setHaptics(save.settings.haptics);
    syncSettingsUI();
    sfxUi();
    persist();
  });

  const palSeg = $('seg-palette');
  palSeg.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-pal]') as HTMLElement | null;
    if (!b) return;
    save.settings.palette = parseInt(b.getAttribute('data-pal') || '0', 10);
    applyPalette();
    syncSettingsUI();
    sfxUi();
    persist();
  });

  const fpsSeg = $('seg-fps');
  fpsSeg.addEventListener('click', (ev) => {
    const b = (ev.target as HTMLElement).closest('[data-fps]') as HTMLElement | null;
    if (!b) return;
    save.settings.fps120 = b.getAttribute('data-fps') === '1';
    syncSettingsUI();
    sfxUi();
    persist();
  });

  $('btn-resume').addEventListener('click', () => { sfxUi(); closePauseToRun(); });
  $('btn-abandon').addEventListener('click', () => { sfxUi(); finishRun(false); });
}

// ---------------------------------------------------------------- boot & bind
export function initScreens(): void {
  $('btn-start').addEventListener('click', startRun);
  $('btn-garage').addEventListener('click', () => { sfxUi(); showGarage(); });
  $('btn-settings-title').addEventListener('click', () => { sfxUi(); openPauseFromTitle(); });
  $('btn-garage-back').addEventListener('click', () => { sfxUi(); showTitle(); });
  garageTrack.addEventListener('click', onGarageTap);
  perkCards.addEventListener('click', onPerkPick);
  btnPause.addEventListener('click', () => { sfxUi(); openPause('run'); });
  $('btn-restart').addEventListener('click', startRun);
  $('btn-go-garage').addEventListener('click', () => { sfxUi(); showGarage(); });
  $('btn-go-title').addEventListener('click', () => { sfxUi(); showTitle(); });
  bindSettings();
  showTitle();
}

/** Called once per sim tick by the loop. */
export function tickFlow(): void {
  if (W.wave !== lastWaveSeen) {
    lastWaveSeen = W.wave;
    sfxWave();
    hapHeavy();
    showWaveBanner();
  }
}
