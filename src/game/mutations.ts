// ===== VOIDPULSE :: VOID DIAL — pre-run mutations (risk-reward toggles) =====
// Toggled from the title screen; persisted in the save; applied at startRun.
// Stack 3+ to earn the MUTANT pass bonus (×1.5 BP XP for that run).

export interface MutationDef {
  id: string;
  name: string;
  desc: string; // what it changes in the run
  reward: string; // what it pays you back
  color: string;
}

export const MUTATIONS: MutationDef[] = [
  {
    id: 'cursedCores',
    name: 'CURSED CORES',
    desc: 'Enemies move 30% faster.',
    reward: '+50% XP',
    color: '#6dff8c',
  },
  {
    id: 'glassHull',
    name: 'GLASS HULL',
    desc: 'Max hull reduced 40%.',
    reward: '+40% damage',
    color: '#ff7d5c',
  },
  {
    id: 'swarmProtocol',
    name: 'SWARM PROTOCOL',
    desc: '+80% spawn density, raised enemy cap.',
    reward: '+30% score',
    color: '#d96bff',
  },
  {
    id: 'ironMan',
    name: 'IRON MAN',
    desc: 'No repair orbs drop. Wave-clear heal gone.',
    reward: '+100% cores',
    color: '#ffd166',
  },
];

export const MUTANT_BONUS_MULT = 1.5; // BP XP multiplier at 3+ active mutations
export const SWARM_SCORE_MULT = 1.3;

export function mutationIds(): string[] {
  return MUTATIONS.map((m) => m.id);
}

export function isMutation(id: string): boolean {
  return MUTATIONS.some((m) => m.id === id);
}
