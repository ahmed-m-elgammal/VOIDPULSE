// ===== VOIDPULSE :: math / rng / misc utilities =====

export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Mulberry32 seeded PRNG */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function fmtScore(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** Weighted pick from a list of [item, weight] pairs */
export function weightedPick<T>(items: [T, number][], rnd: () => number): T {
  let total = 0;
  for (const it of items) total += it[1];
  let roll = rnd() * total;
  for (const it of items) {
    roll -= it[1];
    if (roll <= 0) return it[0];
  }
  return items[items.length - 1][0];
}

export function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

/** in-place shuffle */
export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

/** remove items where dead === true, swap-pop */
export function sweepDead<T extends { dead?: boolean }>(arr: T[]): void {
  let i = 0;
  while (i < arr.length) {
    if (arr[i].dead) {
      arr[i] = arr[arr.length - 1];
      arr.pop();
    } else {
      i++;
    }
  }
}
