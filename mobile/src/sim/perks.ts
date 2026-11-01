/**
 * VOIDPULSE MOBILE — perk catalog & no-alloc 3-card draw.
 * applyPerk lives in player.ts (same module as the state it mutates).
 */
import { applyPerk } from './player';

export const PERK_NAME: string[] = [
  'OVERCHARGE', 'RAPID CYCLER', 'VECTOR THRUST', 'REINFORCED HULL',
  'PHASE COILS', 'SPLIT BARREL', 'LANCER ROUNDS', 'CRIT MATRIX',
  'TRACTOR FIELD', 'VOID CACHE', 'HYPER VELOCITY', 'OD CAPACITOR',
  'NANITE SWARM', 'STATIC THORNS',
];

export const PERK_DESC: string[] = [
  '+25% damage',
  '+18% fire rate',
  '+12% move speed',
  '+25 max hull, repair 25',
  'dash recharges 20% faster',
  '+1 projectile (max 3)',
  'shots pierce +1 enemy',
  '+10% crit chance (x2 dmg)',
  '+45% pickup magnet range',
  '+20% XP from gems',
  '+25% projectile speed',
  '+30% overdrive charge rate',
  'regenerate 0.8 hull / s',
  'contact enemies take 12 dmg',
];

export const PERK_COUNT = 14;

// deck draw — pre-allocated, Fisher-Yates refill, zero alloc per level-up
const deck = new Int32Array(PERK_COUNT);
let deckPos = PERK_COUNT;

function refillDeck(): void {
  for (let i = 0; i < PERK_COUNT; i++) deck[i] = i;
  for (let i = PERK_COUNT - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = deck[i]; deck[i] = deck[j]; deck[j] = t;
  }
  deckPos = 0;
}

/** Draw up to 3 unique perk ids into dest. Returns count written. */
export function drawPerks(dest: Int32Array): number {
  let n = 0;
  while (n < 3) {
    if (deckPos >= PERK_COUNT) refillDeck();
    dest[n++] = deck[deckPos++];
  }
  return n;
}

export function choosePerk(id: number): void {
  applyPerk(id);
}
