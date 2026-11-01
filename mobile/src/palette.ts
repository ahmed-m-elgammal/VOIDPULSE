/**
 * VOIDPULSE MOBILE — color-vision palettes.
 * Palette index persisted in settings; sprites re-baked on change.
 * Leaf module (no imports).
 */

export interface Palette {
  name: string;
  css: string;        // DOM accent
  player: string;     // player hull stroke / bolts
  engine: string;     // engine glow
  enemy: string;      // chaser faction stroke
  enemy2: string;     // ranged faction stroke
  enemy3: string;     // heavy faction stroke
  boss: string;
  gem: string;
  core: string;
  hurt: string;
  heal: string;
}

export const PALETTES: Palette[] = [
  {
    name: 'DEFAULT', css: '#00e5ff',
    player: '#00e5ff', engine: '#7df6ff',
    enemy: '#ff4d7e', enemy2: '#d96bff', enemy3: '#c44dff',
    boss: '#ff3d5e', gem: '#7dffd4', core: '#ffe066', hurt: '#ff5c5c', heal: '#6dffb0',
  },
  { // deuteranomaly-safe: blue vs orange
    name: 'DEUTAN', css: '#4dc3ff',
    player: '#4dc3ff', engine: '#b0e7ff',
    enemy: '#ffa14d', enemy2: '#ffc94d', enemy3: '#ff8a3d',
    boss: '#ff7a33', gem: '#8ad6ff', core: '#ffd466', hurt: '#ff9d5c', heal: '#9ee7ff',
  },
  { // protanomaly-safe: blue vs gold
    name: 'PROTAN', css: '#66d9ff',
    player: '#66d9ff', engine: '#c2f0ff',
    enemy: '#ffd24d', enemy2: '#ffec8a', enemy3: '#e8b83d',
    boss: '#ffbf33', gem: '#99e6ff', core: '#ffe98a', hurt: '#ffd98a', heal: '#aaf0ff',
  },
  { // tritanomaly-safe: rose vs teal
    name: 'TRITAN', css: '#5cffd4',
    player: '#5cffd4', engine: '#c2fff0',
    enemy: '#ff6bb0', enemy2: '#ff9dc9', enemy3: '#e05c9e',
    boss: '#ff4d9e', gem: '#5cffd4', core: '#fff0b0', hurt: '#ff8ab8', heal: '#bafff0',
  },
];
