// ===== VOIDPULSE :: v1.3 relics — run-defining bargains =====
// Offered at the start of wave 3. Exactly one per run. Every relic
// gives as it takes; the pick is permanent for the run.

import type { RelicDef } from './types';

export const RELICS: RelicDef[] = [
  {
    id: 'vampire',
    name: 'VAMPIRE SIGIL',
    desc: 'Every kill restores 1 hull.',
    trade: 'Repair orbs restore half.',
    color: '#ff5c8a',
    glyph: '†',
  },
  {
    id: 'overclock',
    name: 'OVERCLOCK CORE',
    desc: '+25% weapon fire rate.',
    trade: 'Weapons jam for 1s every 30s.',
    color: '#ffb14d',
    glyph: 'Ω',
  },
  {
    id: 'voidPact',
    name: 'VOID PACT',
    desc: '+1 passive module slot.',
    trade: 'One fewer weapon slot (5).',
    color: '#c9b8ff',
    glyph: '◇',
  },
];

export function relicOf(id: string | null | undefined): RelicDef | null {
  if (!id) return null;
  return RELICS.find((r) => r.id === id) ?? null;
}
