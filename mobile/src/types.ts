/**
 * VOIDPULSE MOBILE — shell types + hot-path discipline note.
 * Game types come from the core (src/game/types) — never redefine them here.
 */

/** Scratch discipline: hot-path functions use ONLY local primitives (`let`)
 *  and module-level pre-allocated state. No object/array literals, no
 *  closures, no .map/.filter inside tick/draw. */
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : (v > hi ? hi : v);
}
