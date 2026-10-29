# VOIDPULSE — Post-v1.0 Idea Vault & Optimization Bible

> A grounded brainstorm for everything that comes after **v1.0.0** (Season One: VOIDPASS, Market, Leviathan).
> Every item below is checked against the actual codebase — things that already exist are marked ✅ so we don't rebuild them.
> **Leaderboard: intentionally skipped** per design decision. Competitive infrastructure adds server cost, cheating surface, and tuning debt; the systems below are built for self-driven replayability instead.

---

## 0. What already exists (audit snapshot)

| System | Status |
|---|---|
| Trauma-based screen shake (`g.shake()`, trauma² falloff) | ✅ |
| Hit-stop on impacts (`hitStop` in `game.ts`) | ✅ |
| Glow particles, particle bursts, caps (300 enemies / 320 ebullets / 900 particles) | ✅ |
| Floating damage texts (`MAX_TEXTS`) | ✅ |
| Afterimages (dash ghosts), bullet trails (seeker/lance) | ✅ |
| Cached vignette (offscreen canvas), freeze status effect | ✅ |
| Procedural WebAudio SFX + reroll/gem/freeze sounds | ✅ |
| 7 weapons + 6 evolutions, ~11 passives, card drafting + rerolls | ✅ |
| 12 enemy types, 4 bosses (Warden, Hive Matriarch, Null Sovereign, Dreaming Leviathan) | ✅ |
| VOIDPASS S1 (free + PRIME), Market (Supply + Exchange), Cores/Prisms, contracts | ✅ |
| 8 skins, 7 meta perks, RunStats, local saves | ✅ |
| Object pooling | ❌ arrays + `sweepDead()` GC churn |
| Spatial partitioning for collisions | ❌ brute-force sweeps |
| Settings menu (shake/flash/audio sliders, keybinds) | ❌ nothing found |
| Gamepad support | ❌ |
| Achievements, dailies, seeded runs, NG+ | ❌ |

---

## 1. JUICE — game feel upgrades (highest fun-per-effort)

### 1.1 Camera & time (the "weight" layer)
- **Kill-cam dilation** — on boss death: 0.15× timescale for 700ms, slow zoom toward the corpse, then snap-release with a 60-particle whiteout. Bosses die in slow motion *feels* earned.
- **Zoom breathing** — camera zooms out +8% as on-screen enemy count rises past 60, back in when calm. Makes hordes feel *epic* instead of cluttered.
- **Camera lead** — offset the camera 40–60px toward movement direction (smoothed). Cheap, transformative.
- **Hit-stop tiers** — extend existing `hitStop`:
  - crit: +40ms · elite kill: +90ms · evolution unlock: +250ms with zoom punch-in
  - player hit: +120ms with red frame flash (already scary, make it *felt*)
- **Dash micro-slow** — 90ms of 0.5× timescale on dash *exit*, paired with the existing afterimages. Gives the dash an "I-just-moved-through-space" pop.

### 1.2 Impact & destruction
- **Gib system** — enemies don't just burst: spawn 3–6 polygonal chunks (reuse enemy color) that spin, bounce off the "floor", and fade. Bodies → chunks → decal.
- **Ground decal layer** — a second offscreen canvas that accumulates scorch marks, frost patches, and void oil, fading at 0.5%/s and clearing per wave. Free atmosphere, zero per-frame cost after draw.
- **Shockwave rings** — expanding stroked circles on elite kills and big impacts. Two arcs, additive blend, gone in 300ms.
- **Overkill numbers** — floating text style tiers: normal (white 12px), crit (gold 18px, slight arc), overkill (red 24px + shake tick). One system, three feels.
- **Chain-kill pitch escalation** — each kill within 1.5s raises the pop SFX pitch a semitone (cap +7). The swarm collapsing into a kill-chain becomes *musical*. Cheapest audio win possible.

### 1.3 Kill streak / combo meter
- Combo counter UI (top-right): kills chain within 2s window → combo increments → at 10/25/50 triggers **"RAMPAGE / VOIDSTORM / ASCENDANT"** banner slams with an SFX stab and a music layer bump.
- Combo multiplies *core* drops slightly (1% per 10 combo, cap +25%) — rewards aggression, feeds the market loop.

### 1.4 Boss theater
- **Boss intro sequence** — letterbox bars, nameplate slam ("THE WARDEN" with 2-frame jitter), 1.2s of boss idle telegraphs, music switch. All scripted in the existing render layer, ~1 day of work.
- **Enrage states** — below 25% HP: palette shifts red, music tempo +10%, new attack unlocks, boss roars (SFX). Each of the 4 bosses gets one unique enrage move.
- **Phase transition** — full-screen flash + arena ring pulse + 2s of invulnerable repositioning between phases.

### 1.5 Player feedback
- **Low-HP state** — below 30% HP: heartbeat SFX loop, vignette pulses red with HP, all non-essential particles desaturate slightly. When you heal out: a satisfying "exhale" filter sweep.
- **Dash speed lines** — 6–8 radial streak particles + 1-frame screen stretch (scaleX 1.03) on dash.
- **Level-up freeze frame** — 150ms full freeze + radial burst before cards slide in; cards animate with spring overshoot (staggered 40ms).
- **Pickup synergy** — gem vacuum already exists ✅ → add a rising-pitch "vacuum chord" while sucking a large gem cluster. Money sounds good; XP should too.

### 1.6 Atmosphere
- **Ambient void motes** — 40 slow drifting background particles on a parallax layer (0.3× scroll), always on, near-zero cost.
- **Arena border shimmer** — the 2400×2400 boundary becomes a hex-field force line that ripples where enemies press against it. Turns an invisible wall into a *place*.
- **Procedural music layers** — split existing tracks into calm / combat / boss stems, crossfade by threat level (enemy count + boss alive). WebAudio already procedural, so stems are code.
- **Offscreen threat ping** — small directional arrow + soft ping when an elite spawns or a boss fires off-screen. Information = fairness.

### 1.7 UI juice
- Currency counters roll up (odometer style) instead of jumping.
- PRISM balance shimmer sweep (1-pass gradient) on change.
- Toast/skin-unlock cards drop in with bounce, holo-sheen for `prime` rarity items.
- XP bar: overfill wiggle + snap when a level is banked.

---

## 2. NEW GAMEPLAY CONTENT

### 2.1 Elite affix system (P1 — big value, one system, endless variety)
Elites roll 1–2 affixes from a pool, shown as a colored outline + icon:
| Affix | Effect |
|---|---|
| Thorned | returns 15% melee/contact damage |
| Hasted | +40% move/attack speed, trailing blur |
| Vampiric | heals nearby enemies, red drain beam |
| Shielded | breaks into 2 smaller copies on death |
| Frozen-Aura | slows the player in a radius |
| Explosive | detonates on death (telegraphed ring) |
| Mirror | reflects a % of bullet damage back |
Elite kill payout scales with affix count. This multiplies the existing 12 enemies into ~40 perceived variants.

### 2.2 Void mutations (optional risk-reward, P1)
Pre-run toggles ("VOID DIAL"), each grants +X% cores/prisms but complicates the run:
- **Cursed Cores** — +50% XP, enemies +30% speed
- **Glass Hull** — +40% damage, −40% max HP
- **Swarm Protocol** — +80% spawn density, caps raised
- **Iron Man** — no healing pickups, +100% cores
Stacking 3+ mutations awards a "MUTANT" pass multiplier for the season. Adds *difficulty self-selection* without touching the default curve.

### 2.3 In-run events (P1)
Timed world events announced with a banner + sound:
- **Elite Convoy** — a marching column with a loot vault at the end
- **Meteor Shower** — telegraphed circles rain meteors; each drops cores
- **Treasure Rift** — a timed portal; enter, 20s loot room, exit collapses
- **Rescue Pod** — defend a landing pod 30s → it becomes a turret for the next 2 waves

### 2.4 New weapons & evolutions (P2 — one batch of 3)
- **Rail Driver** — hold-to-charge piercing lance, rewards pacing
- **Tether Harpoon** — hooks an enemy, slings you or it; mobility-weapon hybrid
- **Mirror Blade** — melee arc that reflects projectiles (pairs with elite Mirror affix)
- New evolution pairings: frost+scatter → **GLACIER FAN**; seeker+capacitor → **SWARM QUEEN**

### 2.5 Companions (P2)
Small drones from the market/pass, one equipped per run:
- **Magnetite** — auto-collects gems in a radius
- **Lumen** — zaps the nearest enemy every 3s
- **Aegis** — blocks one hit per wave
Cosmetic + tactical, fits the currency sink loop.

### 2.6 Relics (P2, run-defining)
One relic per run, chosen at wave 3, with real tradeoffs:
- **Vampire Sigil** — kills heal 1 HP, healing pickups halved
- **Overclock Core** — +25% fire rate, weapons jam 1s every 30s
- **Void Pact** — start with −1 weapon slot, +1 passive slot

### 2.7 Second arena / biome (P2)
Palette + hazard swap (crushing pistons, pull-rifts, healing geysers) on the existing 2400×2400 world. Mostly renderer + a hazard entity type; the code is already data-driven via `content.ts`.

---

## 3. META SYSTEMS

- **Achievements (30–50)** — kill counts, no-dash runs, evolution unlocks, Leviathan solo-kill. Each pays cores/prisms; feeds the market without new sinks. Store in existing save blob.
- **Daily seeded challenge (no leaderboard)** — date-seeded run with fixed mutations; personal-best stamp + completion prism. Replayability without server infrastructure. The seed system also enables bug repro (share seed in bug reports).
- **ASCENSION (NG+)** — after winning: stackable ascension levels, each adds a permanent modifier (+enemy HP/density, elite floor) and ×cores multiplier. The medium-to-hard audience gets its endgame.
- **Bestiary / dossier** — every enemy killed N times unlocks its lore card + weak point note. Kills *already tracked* in RunStats — free progression feel.
- **Weapon mastery** — per-weapon XP → cosmetic muzzle glow tiers (1–5). Encourages build diversity.
- **Run recap & build card** — end screen already has RunStats ✅ → extend with DPS-by-weapon pie, damage-taken sources, timeline of picks; export a styled "build card" image for sharing.
- **VOIDPASS Season 2: "MIRRORFALL"** — new theme (inverted palettes, mirror-elite enemies at higher tiers), 12 new skins, prestige tiers past 50 that award ascending title flair. Structure reuses `PASS_TIERS` wholesale.
- **Workshop (core sink)** — permanent micro-upgrade tree (start +2% XP, +1 reroll cap, etc.) for long-term grinders with too many cores.

---

## 4. PERFORMANCE & ENGINEERING

### 4.1 The big three (P0 — do before any content)
1. **Sprite pre-baking** — procedural sprites are currently drawn as paths every frame. Pre-render each enemy/weapon/projectile variant to an offscreen canvas at load; per-frame becomes one `drawImage`. **Estimated 2–4× render throughput.**
2. **Spatial hash grid** — cell-size ~80px grid rebuilt per frame (or every 2 frames) for bullets-vs-enemies and enemy separation. Turns O(bullets×enemies) into O(bullets×neighbors). Critical at the 300-enemy cap.
3. **Object pooling** — preallocate max-size arrays for bullets/enemies/particles/texts with swap-remove; reuse `spawnParticle` objects. Eliminates GC hitches (the likely cause of any mid-wave stutter).

### 4.2 Adaptive quality (P1)
- FPS watchdog: if frame time >22ms for 30 frames → step down particle cap (900→450→200), then decal layer off, then render-scale 1.0→0.75 with canvas upscale. Game stays 60fps on weak hardware.
- `prefers-reduced-motion` respected automatically.

### 4.3 Determinism & tooling (P1)
- Fixed-timestep update (e.g., 120Hz) with render interpolation → seeded runs become reproducible.
- Extend `scripts/sim.ts` into a **balance bot**: runs 200 seeded headless games per build, reports win-rate/TTK/build-usage deltas in CI. No more hand-tuned regressions.
- Input replay = seed + input log; makes "the boss killed me through the wall" reports checkable.

### 4.4 Platform & polish (P2)
- **Gamepad support** — twin-stick mapping via the Gamepad API (aim currently keyboard-only; add mouse-aim parity or auto-aim + stick-dash).
- **Key remapping + settings menu** (see §6) — required before any wider release.
- **PWA manifest** — game is asset-free, so an installable offline PWA costs almost nothing and makes it a "real" product on phones/desktop.
- **Save hardening** — versioned migrations (already partially handled in `save.ts` ✅), LZ-string compression, corruption checksum with backup slot.

---

## 5. ECONOMY / MONETIZATION-LITE (simulated, fair-by-design)

- **Prime cosmetics line** — animated skins, kill-effect trails, victory stingers, arena themes, player cards. Pure visual, no power.
- **Weekly rotating Supply stock** — market already exists; add a rotation clock (seeded by week) + "back in stock" anticipation. Duplicate skins → auto-refund to cores.
- **Prism faucets rebalance** — achievements + dailies + ascension pay prisms so the PRIME pass stays attainable free over a season (target: a free player can afford PRIME by tier ~35 through play alone).
- **VOID CACHE (no paid randomness)** — earned purely by play (every 10 pass tiers): random cosmetic with duplicate protection. Excitement without pay-to-gamble optics.

---

## 6. ACCESSIBILITY & QoL (P0 — small, non-negotiable for shipping wide)

- **Settings menu** (currently none): master/music/SFX sliders, screen-shake slider (0–100%), flash reduction toggle, damage-numbers toggle, colorblind-safe palettes (protan/deutan/tritan variants of the neon set), pickup-magnet size, auto-aim strength.
- **Key remapping** + gamepad glyphs.
- **Assist mode ("VOID DIAL")** — separate from mutations: +player HP, −spawn density, slower bullets. No reward penalty — fun first.
- **Pause-screen build summary** + hover tooltips for every status effect icon.

---

## 7. PRIORITY MATRIX

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | Sprite pre-baking + spatial hash + pooling | M | huge perf headroom |
| **P0** | Settings menu + accessibility toggles | S | ships-wide enabler |
| **P0** | Hit-stop tiers, chain-kill pitch, dash pop, level-up freeze | S | instant feel upgrade |
| **P0** | Damage number tiers + shockwave rings + gib system | S/M | kills feel *massive* |
| **P1** | Boss intro theater + enrage states | M | 4 bosses × 2 = 8 experiences |
| **P1** | Elite affix system | M | 12 enemies → ~40 variants |
| **P1** | Combo meter + music stems | M | session energy |
| **P1** | Void mutations + daily seeds | M | replayability core |
| **P1** | Achievements + prism rebalance | S/M | economy life |
| **P1** | Adaptive quality + balance bot | M | stability + tuning speed |
| **P2** | 3 new weapons + 2 evolutions | M | build depth |
| **P2** | Companions + relics | M | run variety |
| **P2** | Second biome | L | visual variety |
| **P2** | VOIDPASS S2 "MIRRORFALL" | M | season retention |
| **P2** | Gamepad + PWA + save hardening | M | platform reach |
| **P2** | Bestiary + weapon mastery + build cards | M | meta-glue |

**Recommended v1.1 slice** (one focused iteration): sprite pre-bake + spatial hash + pooling → hit-stop tiers + gibs + shockwaves + damage tiers + chain-pitch → settings menu + colorblind palettes → boss intros + enrage. That single version makes the game *feel* like a 10× budget title before adding a single new enemy.

**Recommended v1.2 slice**: elite affixes + mutations + dailies + achievements + combo meter + music stems. ✅ **SHIPPED in v1.2.0** (8 elite affixes with pip visuals, VOID DIAL with 4 mutations + MUTANT ×1.5 BP bonus, DAILY BREACH date-seeded runs with 60◇ first-clear, 25 achievements in 4 tiers with toast payouts, RAMPAGE/VOIDSTORM/ASCENDANT combo meter with core payout, boss drone music stem + combo/elite intensity bumps).
**Recommended v1.3 slice**: new weapons/companions/relics + VOIDPASS S2 + ascension.

---

*Generated from a code audit of VOIDPULSE v1.0.0 — `src/game/{game,combat,render,content,waves,economy,save,audio,skins,bosses}.ts`. Leaderboard deliberately excluded.*
