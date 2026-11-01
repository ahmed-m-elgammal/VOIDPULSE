/**
 * VOIDPULSE — MIRROR import-rule checker (MOBILE_PARITY_PLAN.md §1.1).
 *
 * Fails when any file under mobile/src imports something outside the pure
 * core whitelist (desktop renderer, React/Next, app scaffolding), or when
 * the core content tables fail to load.
 *
 * Usage: bun scripts/parity-check.ts
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// ---- the whitelist: pure core modules the shell may import ----
const CORE_ALLOWED = new Set([
  'game', 'audio', 'content', 'combat', 'waves', 'bosses', 'cards', 'player',
  'economy', 'save', 'ascension', 'relics', 'companions', 'mutations', 'daily',
  'achievements', 'skins', 'types', 'utils',
]);

const FORBIDDEN = [
  /src\/game\/render(\.ts)?['"]/,
  /src\/game\/renderUI(\.ts)?['"]/,
  /src\/components\//,
  /src\/app\//,
  /src\/lib\//,
  /src\/hooks\//,
  /from ['"]react['"]/,
  /from ['"]react-dom/,
  /from ['"]next/,
];

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith('.ts')) out.push(p);
  }
}

const files: string[] = [];
walk('mobile/src', files);

let violations = 0;
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  const importLines = src.split('\n').filter((l) => l.trim().startsWith('import '));
  for (const line of importLines) {
    // external whitelisted core: ../../src/game/<mod> (any depth)
    const core = line.match(/(?:\.\.\/)+src\/game\/([a-zA-Z]+)(\.js)?['"]/);
    if (core) {
      if (!CORE_ALLOWED.has(core[1])) {
        console.log('VIOLATION ' + f + ' → core module not whitelisted: ' + core[1]);
        violations++;
      }
      continue;
    }
    if (/(?:\.\.\/)+src\//.test(line) || /@?\//.test(line.match(/from ['"]([^'"]+)['"]/)?.[1] ?? '')) {
      const path = line.match(/from ['"]([^'"]+)['"]/)?.[1] ?? '';
      if (path.startsWith('.') && !path.includes('src/')) continue; // relative within mobile/
      if (!path.startsWith('.')) {
        // bare import (react, next, node fs…) — only node: allowed (parity scripts live outside mobile/)
        console.log('VIOLATION ' + f + ' → non-core import: ' + path);
        violations++;
        continue;
      }
    }
    for (const re of FORBIDDEN) {
      if (re.test(line)) {
        console.log('VIOLATION ' + f + ' → forbidden import: ' + line.trim());
        violations++;
        break;
      }
    }
  }
}

// ---- content parity smoke: the real tables must load headlessly ----
const content = await import('../src/game/content');
const counts = {
  weapons: Object.keys(content.WEAPONS).length,
  enemies: Object.keys(content.ENEMIES).length,
  bosses: content.BOSSES.length,
  metaPerks: content.META_PERKS.length,
};
console.log('core content: ' + JSON.stringify(counts));
if (counts.weapons < 8 || counts.enemies < 10 || counts.bosses < 1) {
  console.log('VIOLATION core content tables look truncated');
  violations++;
}

if (violations > 0) {
  console.log('FAIL — ' + violations + ' MIRROR rule violations across ' + files.length + ' mobile files');
  process.exit(1);
}
console.log('OK — ' + files.length + ' mobile files clean against the MIRROR whitelist');
