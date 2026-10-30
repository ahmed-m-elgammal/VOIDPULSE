# VOIDPULSE V2 — Design Bible: **DESCENT**

> The plan for the next major version of VOIDPULSE, written against the codebase as of **v1.4.0** (ASCENSION shipped, `90a9d44`).
> v1 is a *complete* game: win → unlock → ascend → prestige loop closed. That means v2 is not "more nodes on the tree" —
> it **changes the shape of the run**. Three flagship pillars, a stack of buildcraft systems, a social layer, and a slice
> roadmap that ships each piece without ever destabilizing the combat core.
>
> Working title: **VOIDPULSE: DESCENT** — because every run becomes a descent through three strata of the void.
> Companion docs: `ROADMAP.md` (v1.x idea vault, historical), `download/VOIDPULSE_IDEAS.md`.

---

## 0. Where v1 ended (audit snapshot @ v1.4.0)

| System | Status |
|---|---|
| Core loop: waves 1–15 → victory → endless | ✅ |
| 12 enemies, 4 bosses (Warden, Hive Matriarch, Null Sovereign, Dreaming Leviathan) | ✅ |
| 7 weapons + evolutions incl. first dual evolution GLACIER FAN | ✅ |
| Elite affixes (8), VOID DIAL mutations (4), combo meter (RAMPAGE/VOIDSTORM/ASCENDANT) | ✅ |
| DAILY BREACH — date-seeded, ghost-race friendly, **ascension-free by design** | ✅ |
| Relics (wave-3 pick), companion drones (DRONE BAY), 27 achievements | ✅ |
| ASCENSION (NG+): 9 nodes / 3 branches, +HP/density/elite-floor/boss-HP, ×cores payout | ✅ |
| VOIDPASS S1 "Crimson Abyss" (PRIME flag present), Market, Cores/Prisms, contracts, boosters | ✅ |
| Local save v3 (sanitized, versioned), server economy (Prisma/SQLite) | ✅ |
| Sprite pre-baking / spatial hash / object pooling (ROADMAP §4.1 P0) | ❌ still pending |
| Accounts / cloud save / server-authoritative anything | ❌ |
| Gamepad, PWA manifest, leaderboards (deliberately skipped in v1.0) | ❌ |

**Two v1.0 decisions get revisited in v2, with reasons documented inline:**
1. *No leaderboards* (v1.0: server cost + cheating surface). Revisited in §6.1 — the anti-cheat answer now exists: the game is deterministic and headless-simulated, so the server can **re-simulate every submitted run**.
2. *Local-only saves*. Revisited in §9 — monetization (accounts + entitlements) and the social layer both require identity. One prerequisite unlocks three systems.

---

## 1. Vision & design pillars

VOIDPULSE v1 answered: *"can a procedural, zero-asset arena roguelite feel like a real game?"* — yes.
v2 answers: *"why do I keep descending?"* — with routing decisions, build identity, and other people's ghosts.

**The four pillars (every item in this doc serves one):**

1. **Routing > grinding.** Runs contain *decisions about where to go*, not just what to shoot. (Pillar A — THE MAP)
2. **Identity > stats.** Players should say "I'm a Hivemaster" not "I have +12% fire rate". (Pillar B — HULLS)
3. **The world pushes back.** The arena stops being a static box; the Void becomes an antagonist. (Pillar C — LIVING ARENA)
4. **Watchable > optimized.** Everything that produces a clip, a replay, or a rivalry compounds. (§6 Social layer)

**Non-negotiable guardrails carried from v1:**
- **Never sell power.** Paid = cosmetics, content, support. Cores/ascension/perks stay earned-only.
- **Daily Breach stays pure.** No map, no ascension, no hazards — the seeded ghost-race baseline must remain comparable across versions.
- **The combat core is sacred.** New systems wrap around `waves.ts`/`combat.ts`; they don't rewrite them.
- **Every slice ships green**: `bunx tsc --noEmit` + `bunx eslint .` + `bun scripts/sim.ts` (suites extended per feature), push + tag as usual.

---

## 2. FLAGSHIP PILLAR A — THE MAP (the spine of v2.0)

### 2.1 What changes

Today a run is a linear ladder: wave 1 → 15 → victory. Under DESCENT, a normal run is a **descent through 3 biomes × 5 wave-strata**, and between every wave the player chooses the next node from 2–3 exits — Slay-the-Spire style routing built entirely out of systems v1 already shipped.

```
        [ THE CORE — wave 15 · Dreaming Leviathan · victory / stabilize ]
        |
   ┌────┴────┐
  ELITE   COMBAT          ← biome 3: LEVIATHAN TRENCH (waves 11–14)
   └────┬────┘
  FORGE ─ EVENT ─ COMBAT
   └────┬────┘
        ...                 ← biome 2: NULL FIELDS (waves 6–10, Null Sovereign)
   ┌────┴────┐
 MERCHANT  ELITE
   └────┬────┘
        ...                 ← biome 1: CRIMSON ABYSS (waves 1–5, The Warden)
      [ ENTRY ]
```

### 2.2 Node types (six, all reusing v1 systems)

| Node | What happens | Loot logic | Reuses |
|---|---|---|---|
| **COMBAT** | A standard wave exactly as today | Normal gems/cores | `waves.ts` unchanged |
| **ELITE AMBUSH** | Wave spawns with 2–3 guaranteed elites (roll 1–2 affixes each) | Shards ×3, +1 card choice on level-up | Elite system v1.2 |
| **MERCHANT HULK** | Mid-run shop; buys with **Shards** | See §2.4 stock table | Market UI patterns |
| **VOID EVENT** | One of five gamble rooms (§2.5) | High variance | Relic/dialog UI patterns |
| **FORGE** | Free +1 weapon level **or** apply an elemental core (§4.1) **or** reroll a relic | — | Card/blacksmith UI |
| **BOSS** | Biome gatekeeper (see §2.3) | Shards ×10, blessing draft (§4.2) | `bosses.ts` |

**Shards** are the new *in-run* currency: dropped by elites (3–6), bosses (10), and events. They are deliberately **separate from meta-Cores** so map spending never drains account progression. Unspent shards convert to Cores at run end (2:1) — hoarding is rewarded, but weakly.

### 2.3 Biomes & boss assignment

| Biome | Waves | Palette shift | Hazard flavor (v2.0: cosmetic-only) | Gatekeeper |
|---|---|---|---|---|
| **CRIMSON ABYSS** | 1–5 | Current look (unchanged) | — | **The Warden** |
| **NULL FIELDS** | 6–10 | Inverted blues/whites, "signal noise" motes | — | **Null Sovereign** |
| **LEVIATHAN TRENCH** | 11–15 | Deep teal/black, pressure motes, slow parallax | — | **Dreaming Leviathan** (victory, unchanged) |

The **Hive Matriarch** moves to a new slot: *mid-boss ambush* — a guaranteed ELITE AMBUSH node at wave 8 that opens with her and closes with a swarm burst. She keeps her full kit; she just becomes a *place on the map* instead of a fixed wave. Endless mode (post-victory) cycles all four as today.

### 2.4 Merchant Hulk stock (Shard prices)

| Stock slot | Item | Price |
|---|---|---|
| Weapons | Fill an empty weapon slot (2 offered) | 8–12 |
| Upgrade | +1 level to an owned weapon | 6 |
| Survive | Heal 50% | 4 |
| Utility | +1 reroll, +1 card choice next level-up | 3–5 |
| Luxury | Elemental core (unowned type) | 9 |
| Black market | Remove a curse (§4.2) or downgrade a mutation | 7 |

Stock is seeded per run; one slot per visit is "scarred" (discounted but cursed — e.g., weapon comes with −10% HP).

### 2.5 VOID EVENT rooms (five at v2.0)

1. **RIFT VAULT** — 20s timed loot room, then the exit collapses (ROADMAP §2.3 "Treasure Rift", finally placed).
2. **FOUNTAIN** — heal 40% now, or +10% max HP permanently but current HP drops to 30%.
3. **SACRIFICE** — lose your lowest-level passive, gain a relic slot effect for the run.
4. **GAMBLER'S PULSE** — 50%: +1 weapon level to a random owned weapon · 30%: nothing · 20%: a curse attaches (§4.2).
5. **MIRROR CACHE** — duplicate one owned passive for the run (once per run).

### 2.6 Map generation rules (pure data, fully sim-testable)

- Per biome: 5 strata; each stratum after a wave offers **2–3 exits** weighted by seed + depth.
- **Guarantees** (enforced by the generator, asserted by the sim):
  - ≥1 MERCHANT per run; ≥1 FORGE per biome; ≥1 EVENT per biome.
  - An ELITE AMBUSH exists in the stratum directly before every BOSS ("boss prep").
  - No more than 2 consecutive ELITE AMBUSH nodes.
- Generation lives in a new `src/game/map.ts` — pure functions: `(seed, depth) → NodeGraph`. No rendering, no state. This makes it trivially unit-testable and lets DAILY BREACH force `linear: true` to bypass it.
- **Daily Breach override**: `startRun({ daily: true })` sets `linear` — identical to v1.4 behavior. Ghost races stay comparable forever. *(This preserves the v1.4 "daily stays clean" decision, now applied to the map.)*

### 2.7 Ascension integration

The tree applies to the map **wholesale and unchanged** — `computeAscension()` feeds the same `g.asc` into every node type. Node-specific twists are *deferred* (see open questions §12) so v2.0 doesn't force tree rebalancing. One free synergy: ELITE VANGUARD makes ambushes richer automatically, which is exactly what that node's players want.

### 2.8 UI

- Between-wave map overlay: vertical descent ladder, current node pulsing, 2–3 exits lit; hover/press previews the node's promise ("ELITE AMBUSH — 3 elites · 12–18 shards").
- **Touch-first from day one** (mobile strategy, per our stack discussions): big tap targets, pressed states, no hover-only information.
- Keyboard: ↑/↓ cycle exits, Enter commit, node panel shows details.
- Run-end recap gains a **route stamp**: the actual path taken, rendered as a mini-ladder (shareable image target, §6.4).

### 2.9 Code mapping

| Change | File |
|---|---|
| Map generation, node state machine, shard wallet | **new `src/game/map.ts`** |
| `startRun` gains `{ map: true }`, wave transitions route through the node graph | `game.ts` (run director section) |
| Biome palettes + parallax swap per stratum | `render.ts` |
| Map overlay, merchant, forge, event rooms | `renderUI.ts` |
| `HULLS`-independent: node defs, SHARD_PRICES, EVENT tables | **new tables in `content.ts`** |
| RunStats gains route stamp + shard ledger | `types.ts` (RunStats) |
| MetaSave v4 (route history, bestiary prep — §9) | `save.ts` |
| TEST 2.7: generator guarantees, shard math, node effects, daily override | `scripts/sim.ts` |

**Risk: M.** Mitigation: every node reuses an existing system; the only genuinely new code is the generator and the overlay. Ship v2.0 with COMBAT/ELITE/MERCHANT only if time-boxed — FORGE and EVENTS can land in v2.2 with the Forge systems they serve.

---

## 3. FLAGSHIP PILLAR B — HULLS (playable archetypes)

### 3.1 The four hulls

One ship today; four identities in v2.1. A hull = base stats + passive + starting weapon + one **exclusive evolution**. Balance rule enforced by the balance bot (§10): *identical DPS ceiling at wave 15 within ±10%* — hulls change **risk curves**, not power.

| Hull | Fantasy | Base | Passive | Starts with | Exclusive evolution |
|---|---|---|---|---|---|
| **PULSE** | The original | 100 HP, standard speed, standard magnet | none — clean baseline | PULSE lv1 | (existing tree — untouched) |
| **WRAITH** | Glass cannon, dash-killer | **70 HP**, +12% speed, +20% dash cooldown reduction | **PHASE SHIFT** — dash i-frames extended; dash-through deals 15 dmg (feeds existing dashKills stat) | SCATTER lv1 | scatter+tether → **GHOSTLINE** (dash leaves 3 phantom blades) |
| **HIVEMASTER** | Drone commander | 90 HP, +15% pickup radius | **BROOD LINK** — starts with MAGNETITE regardless of ownership; drone slots +1; drone effects +30% | SEEKER lv1 | seeker+arc → **SWARM QUEEN** (seekers spawn minions on kill) |
| **LEECH** | Melee-range bruiser | **110 HP**, −10% speed, heal pickups −50% | **RED THIRST** — +25% damage within 140px; kills heal 1 HP (built-in Vampire Sigil, stacks if relic taken) | PRISM WARD lv1 | mirror+tether → **EXECUTIONER'S ARC** (reflected arcs chain) |

### 3.2 Unlocks (all earned, per the guardrail)

| Hull | Condition |
|---|---|
| PULSE | default |
| WRAITH | reach wave 10 in a run (any mode) |
| HIVEMASTER | own 2+ companion drones in the DRONE BAY |
| LEECH | 500+ lifetime dash kills (RunStats already tracks this) |

### 3.3 Save & code impact

- `MetaSave` v4: `hull: string`, `skinsOwned` becomes per-hull (`{pulse: [...], wraith: [...]}`) — migration maps existing skins to `pulse`.
- `content.ts` gains `HULLS` table; `player.ts` stats init reads hull; `game.ts` `startRun({ hull })`.
- Render: hull silhouettes are procedural variants of the existing ship glyph (triangle frame / diamond / hex-frame + orbit nodes / wedge) — no art pipeline, consistent with the zero-asset doctrine.
- Card drafting filters exclusive evolutions by hull.
- Sim: TEST 2.8 — hull stat resolution, unlock gating, balance-bot pass (n=200 per hull, §10).

**Risk: M.** The only real risk is balance; the balance bot turns it into a tuning table instead of forum drama.

---

## 4. BUILDCRAFT SYSTEMS (stack onto any spine)

### 4.1 FUSION LAB — elemental cores (v2.2)

GLACIER FAN (v1.3) proved hybrid evolutions. Generalize: **any weapon at max level + an elemental core at a Forge node = hybrid evolution.**

**Cores** (consumable, one per weapon, dropped by biome elites / merchant luxury slot / events):

| Core | Theme | On-hit effect |
|---|---|---|
| VOID | chain | hits arc to 1 nearby enemy at 40% dmg |
| ICE | control | 15% chill on hit (slows 30% for 1.5s) |
| EMBER | pressure | burn DoT 3% max-HP over 2s |
| GRAV | clustering | pulls hit enemies 30px toward impact point |

**Fusion matrix (launch set — 8):**

| Weapon + Core | Hybrid | Signature |
|---|---|---|
| pulse + ice | **GLACIER FAN** | (formalizes the v1.3 dual evolution into the system) |
| rail + void | **SINGULARITY LANCE** | piercing rail that chains between pierced targets |
| seeker + ember | **SWARM QUEEN** | seekers ignite; kills spawn mini-seekers |
| scatter + grav | **EVENT HORIZON** | pellets collapse targets inward |
| arc + ice | **PERMAFROST COIL** | chains slow; chained targets take +10% |
| mirror + void | **VOID MIRROR** | reflected projectiles become void projectiles |
| tether + ember | **FLARE HARPOON** | hooked target burns; reel explodes ember |
| novaLance + grav | **COLLAPSE LANCE** | nova implodes instead of explodes |

**Design budget:** hybrids = base max-level DPS **+15%, paid back in utility tradeoffs** (e.g., SINGULARITY trades raw pierce depth for chain utility). Sim asserts per-hybrid TTK deltas. Fusing consumes the core and locks that weapon's base-evolution path for the run — routing decisions again.

### 4.2 CURSED BLESSINGS — the boss draft (v2.2)

After each biome boss (3 per run): draft **one of two blessing+curse pairs — you take both or neither.** Risk-reward drafting is the ascension tree's in-run cousin.

**Blessings (10):** +1 dash charge · +15% fire rate · +1 passive slot · one revive at 30% HP · +20% elite cores · +50% gem magnet · +1 card choice · +2 rerolls · −10% damage taken while moving · evolution preview (see exact next-evolution requirement in cards).

**Curses (10):** elite chance +10% · healing −30% · −15% max HP · enemies +10% speed · enemy bullets +15% speed · pickups drift away from you · shield break silences fire 2s · −10% cores earned · elites enrage below 50% HP · +1 wave length (budget +25%).

**Named pairs (examples):** *BLOODSWORN PACT* (revive + healing −50%), *OVERDRIVE* (+20% fire rate + ebullet speed +15%), *GOLDEN VAIN* (+20% elite cores + cores −10%).

Curse state renders as HUD chips (same pattern as VOID DIAL mutation tags, v1.2). Merchant's "black market" slot can remove one curse (7 shards).

### 4.3 RELIC SETS (v2.2)

v1.3's three relics become **set starters**. Events/merchant/forge offer set pieces. Collect 2/3 for set bonuses:

| Set | Pieces | @2 | @3 |
|---|---|---|---|
| **VAMPIRE** | Sigil (v1.3) + Chalice + Brand | kills heal 2 | overheal converts to a 10-pt shield |
| **MACHINE** | Overclock Core (v1.3) + Servo + Matrix | +10% fire rate | every 45s: 5s guaranteed-no-jam overclock |
| **VOID** | Void Pact (v1.3) + Lens + Echo | +1 passive slot | passive effects +15% |

One relic per run still (v1.3 rule), but set pieces stack into the same slots — the wave-3 choice gains long-term meaning.

### 4.4 WEAPON MASTERY (v2.1, cheap retention glue)

Per-weapon XP (damage-based) persists across runs; 5 mastery levels:

| Lv | Reward |
|---|---|
| 1–2 | cosmetic muzzle-glow tiers (ROADMAP §3, finally placed) |
| 3 | unlock that weapon's fusion variant entry in the codex |
| 4 | +5% damage with that weapon (small, *earned* power — grind, not wallet) |
| 5 | mastery title ("RAILSTORM HERALD") |

Stored in MetaSave v4 as `mastery: Record<weaponId, number>`. Feeds achievements + the market's title shelf. Cost: one table + one stat hook.

---

## 5. FLAGSHIP PILLAR C — LIVING ARENA (v2.5, the world pushes back)

The arena stops being a static 2400×2400 box. **Telegraph-first design** (every hazard warns ≥1s, colorblind-safe palettes, respects `reduceFlash`):

| Hazard | Behavior | Counterplay |
|---|---|---|
| **Gravity well** | pull zone (rings telegraph), drags player & bullets 80px/s toward center | route around; GRAV users get +1 hybrid ammo on well kills |
| **Collapsing strata** | mid-wave, outer ring tiles dissolve inward (arena shrinks up to 25%) | constant repositioning; synergizes with anti-stall |
| **Tide phase** | every other wave: arena edge recedes 10%, then floods back | timing pressure, no permanent loss |
| **Corruption tiles** | standing on corrupted ground = 4 HP/s DoT; creepers spawn from it | clear creepers to reclaim ground |
| **VOID HUNTERS** | camp-punishers evolved from v1.0's "THE VOID HUNGERS": static >8s during a wave → 2 hunters teleport-ambush with a 1s warning ring | keep moving; hunters drop 2 shards each |

Boss 5 is designed *for* this pillar: **THE CARTOGRAPHER** (endless gatekeeper, wave 20) — "maps" the arena into hazard zones, converting existing hazard types into attack patterns. And the secret endless boss, **THE LISTENER** (wave 30+), adapts: it attacks with your most-used weapon (RunStats already knows).

**Prerequisite:** ROADMAP §4.1 P0 trio (sprite pre-bake, spatial hash, pooling) must land before this pillar — hazards + hunters + shrinking arena is exactly the workload that punishes brute-force sweeps.

**Risk: M-L** (touches everything). Which is why it's v2.5, not v2.0 — it deserves its own slice and its own balance pass.

---

## 6. SOCIAL LAYER (the web version's unfair advantage)

### 6.1 WEEKLY SEEDED GAUNTLET — leaderboards, revisited honestly

v1.0 skipped leaderboards (server cost, cheating surface, tuning debt). v2 revisits because two things changed:
1. **Accounts are landing anyway** (monetization prerequisite — §9).
2. **The game is deterministic and headless-simulatable** (`scripts/sim.ts`). That *is* the anti-cheat story:

```
Server posts weekly seed (Thu 00:00 UTC)
Player runs the seed (fixed mutations + fixed ascension snapshot)
Submission = seed + input log + final stats + client build hash
Server RE-SIMULATES the input log headlessly
  → stats match? accept score into top-100 ladder
  → mismatch? reject silently, flag for review
```

Rewards: exclusive cosmetic + prisms by ladder tier. The ladder is *weekly and disposable* — tuning debt stays bounded. **Daily Breach remains personal-best only** (untouched purity rule).

### 6.2 RIVAL ECHOES — async PvP with zero netcode

The ghost system turned *hostile*:
- Every completed (non-daily) run stores a compact **echo** (seed + input log + callsign + weapon mix — the same artifact the gauntlet validates).
- During normal runs, at waves 3/8/13: 25% chance a **RIVAL ECHO** invades as an elite-grade bosslet that *fights with the original player's weapon mix*.
- Beat it → shard/prism bounty + "ECHO SLAIN" tally + a title line; lose → it despawns after 20s, nothing lost.
- Callsigns: accounts give real handles; pre-accounts fallback = procedurally generated void names ("KESTREL-9", "NULL WIDOW").
- Opt-out toggle in settings (save v4 field), default ON.

### 6.3 CO-OP ARENA — explicitly a v3.0 stretch

2P shared arena, WebRTC peer-host, shared level pool, linked combo chains (+5% dmg per linked kill-chain), partner revive. **Listed here for honesty, not for v2** — netcode stresses determinism (which the gauntlet's anti-cheat depends on), fairness, and the sim. If it happens, it's its own major version with its own doc.

### 6.4 REPLAYS & BUILD CARDS — the marketing engine

- The gauntlet's input-log artifact doubles as the replay format: client re-sims for a kill-cam of your best run.
- Export a styled **build card** PNG from canvas (`toDataURL`): route stamp (§2.8), hull, weapons+fusions, relics, ascension snapshot, score. Zero video-encoding dependency.
- These are the clips that feed the funnel (ties directly into the monetization strategy: conversion follows audience, and clips make audiences).

---

## 7. CONTENT & FLAVOR

- **BESTIARY (v2.3)** — 16 launch entries (12 enemies + 4 bosses). Lore fragments drop first-time from elites/bosses; 3 lines each + weak-point note + lifetime kill stats (RunStats already tracks). Completion: cores/prisms + "ARCHIVIST" title. Stored in MetaSave v4.
- **Biome re-skins** — §2.3 palettes are v2.0 cosmetic; v2.5 adds ambient audio stems per biome (WebAudio is procedural — stems are code, ROADMAP §1.6).
- **Adaptive music** — extend the existing combo/elite intensity bumps (v1.2) with biome crossfades and a boss-stem tempo map (enrage = +10% tempo, ROADMAP §1.4).
- **VOIDPASS S2 "MIRRORFALL"** — theme rides the map: inverted Null Fields palettes, mirror-elites at high tiers, 12 skins (now per-hull!), prestige tiers past 50. Structure reuses `PASS_TIERS` wholesale. Timing: v2.1 or v2.3 (open question §12).

---

## 8. MODES MENU (cheap, high retention — one shared scaffold)

| Mode | Rules | Reward | Ships |
|---|---|---|---|
| **BOSS RUSH** | weekly-seeded boss gauntlet, fixed kit picked pre-run, no level-ups | cosmetic + prisms | v2.3 |
| **IRONMAN LEAGUE** | permadeath, one attempt per season, separate local ladder | exclusive hull trim | v2.3 |
| **DRAFT** | random starting weapon, 2-choice cards only, mutator stack | cores | v2.1 (hull unlock testing ground) |
| **GAUNTLET** | weekly mutator stack on normal runs (non-ranked) | BP XP | v2.0 |

All four are `startRun()` flag sets over existing systems — the scaffold is the mode enum + a mode-aware HUD, not four new games.

---

## 9. PLATFORM, SAVE & MONETIZATION INTEGRATION

### 9.1 Save v4 migration (one bump, all features)

New fields: `hull`, `skinsByHull`, `mastery`, `bestiary`, `echoOptOut`, `gauntletRecords`, `routeHistory` (last 10 route stamps). Migration: v3 → v4 maps `skinsOwned` → `skinsByHull.pulse`, everything else defaults. Same sanitization doctrine as v1.4's ascension loader.

### 9.2 Accounts & entitlements (prerequisite for §6, lands via the monetization roadmap)

Lightweight accounts (email/Google OAuth) + cloud save + `entitlements` table (Prisma/SQLite already in place) + Lemon Squeezy/Paddle webhook. VOIDPASS PRIME, Prism packs, and the Founder pack ride these rails. **v2 sells no power**: hulls are unlock-by-play (§3.2); Founder-pack content = WRAITH cosmetic trim + animated title + prisms.

### 9.3 Mobile

Map UI, hull select, and merchant are **touch-first from day one** (big targets, pressed states — the PWA/Capacitor path stays compatible; nothing in v2 requires hover or keyboard). The perf P0 trio (§5) is also the mobile battery budget.

### 9.4 Perf prerequisites (blocking, from ROADMAP §4.1)

1. Sprite pre-baking (2–4× render throughput) — before v2.0.
2. Spatial hash grid — before v2.5 (Living Arena), strongly recommended for v2.0 ambush waves.
3. Object pooling — before v2.0.
4. Balance bot (ROADMAP §4.3): 200 seeded headless runs per build, per-hull/per-fusion TTK + win-rate deltas in CI.

---

## 10. SLICE ROADMAP (how v2 ships without breaking v1)

| Slice | Name | Scope | Files | Risk |
|---|---|---|---|---|
| **v2.0** | **DESCENT** | Perf P0 trio → THE MAP (combat/elite/merchant nodes) → shards → biome palettes 1+2 → bestiary data hooks | `map.ts` (new), `game.ts`, `waves.ts`, `render.ts`, `renderUI.ts`, `content.ts`, `save.ts` v4, `sim.ts` TEST 2.7 | M |
| **v2.1** | **HULLS** | 4 hulls + hull select UI + DRAFT mode + mastery Lv1–4 + skins-per-hull + balance-bot hull pass | `content.ts`, `player.ts`, `game.ts`, `render.ts`, `save.ts` | M |
| **v2.2** | **FORGE & PACTS** | Fusion Lab (cores + 8 hybrids) + FORGE node + VOID EVENT rooms + Cursed Blessings + Relic Sets | `content.ts`, `combat.ts`, `cards.ts`, `renderUI.ts` | M |
| **v2.3** | **ECHOES** | Accounts + entitlements (prereq) → Weekly Gauntlet + server re-sim + Rival Echoes + Bestiary + build cards + BOSS RUSH + IRONMAN | `src/app/api/*`, `echo.ts` (new), `renderUI.ts`, server Prisma schema | L (first server-authoritative feature) |
| **v2.5** | **LIVING ARENA** | Hazards + VOID HUNTERS + THE CARTOGRAPHER + biome 3 deep re-skin + adaptive music | `combat.ts`, `render.ts`, `bosses.ts`, `audio.ts` | M-L |
| **v3.0** | **SYNCHRONY** (stretch) | Co-op + THE LISTENER + Steam premium flip evaluation | new doc | L |

Each slice ships green (tsc + eslint + extended sim), pushes `main`, and tags. The map's `linear` override and the daily purity rule are the invariants that keep every slice shippable.

---

## 11. PRIORITY MATRIX

| Priority | Item | Effort | Impact |
|---|---|---|---|
| **P0** | Perf trio (pre-bake, spatial hash, pooling) + balance bot | M | headroom for everything below |
| **P0** | THE MAP core (generator + 3 node types + shards) | M/L | *the* v2 identity change |
| **P1** | HULLS ×4 + mastery | M | build identity ×4 |
| **P1** | Fusion Lab + Forge + Cursed Blessings + Relic Sets | M | buildcraft depth |
| **P1** | Accounts + gauntlet + Rival Echoes | L | retention + async social |
| **P1** | VOIDPASS S2 "MIRRORFALL" | M | season continuity |
| **P2** | Living Arena hazards + Cartographer/Listener | M-L | spectacle + anti-stall evolution |
| **P2** | Bestiary + build cards + modes menu | S/M | glue + completionism |
| **P3** | Co-op | XL | launch-event material only |

---

## 12. OPEN QUESTIONS (decide before slicing)

1. **Shard → Core conversion rate** (2:1 proposed) — does hoarding feel like waste or thrift?
2. **Do ambush/echo elites count toward contracts?** (Yes proposed — but verify contract pacing at n=200 sim runs.)
3. **Null Sovereign's map slot** — biome 2 gatekeeper (proposed) vs endless gatekeeper with Matriarch at biome 2.
4. **Mastery Lv4 "+5% earned damage"** — keep the small grind-power, or stay 100% cosmetic until data says otherwise?
5. **S2 "MIRRORFALL" timing** — v2.1 (rides hull skins) vs v2.3 (rides gauntlet cosmetics).
6. **Echo callsigns pre-accounts** — procedural names (proposed) vs anonymous "RIVAL ECHO".
7. **Map + hull interaction** — can hull unlocks gate map nodes (Hivemaster-only drone node)? (Deferred — v2.1 data.)

---

*Written against VOIDPULSE v1.4.0 (`90a9d44`) — src/game/{game,combat,waves,render,renderUI,content,player,cards,relics,companions,ascension,mutations,daily,achievements,economy,bosses,skins,audio,save,types}.ts. Every "reuses" reference is checked against shipped code. Daily purity and no-paid-power are load-bearing walls — do not remove.*
