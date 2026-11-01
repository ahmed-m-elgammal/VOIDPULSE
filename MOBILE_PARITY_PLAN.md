# VOIDPULSE — MOBILE PARITY PLAN · v1.6.0 "MIRROR"

> **Goal: mobile is not a lookalike. Mobile IS VOIDPULSE.**
> One game core, one save, one balance — two shells (desktop pointer/keyboard, touch).
> Covers everything: data layer ("db") → simulation → rendering → UI/UX → audio → input → store.

---

## 0. Diagnosis — why the mobile build feels wrong

v1.5.0 obeyed the *"mobile/ never imports from outside"* rule literally, so the game was
**re-invented from scratch** as a lite clone instead of porting the real one. That rule
solved the wrong problem: it isolated mobile from *scaffolding*, and in doing so isolated
it from *the game itself*.

| System | Desktop VOIDPULSE (source of truth) | mobile/ v1.5.0 lite | Verdict |
| --- | --- | --- | --- |
| Weapons | **10** — pulse, orbit, arc, nova, seeker, frost, scatter, rail, tether, mirror (`content.ts`) | 6 simplified | replace |
| Evolutions | cyclone, tempest, seismic, hornet, railstorm (`EVO_MAP`) | none | add |
| Enemies | **12+ AI types** — mote, drifter, sprinter, spitter, splitter, shard, bulwark, orbiter, volatile, lancer, mender, phantom (`ENEMIES`, 53 defs incl. weapons/perks ids) | 8 lookalike AIs | replace |
| Bosses | `BOSSES[]` bullet-pattern bosses (radial, fan, …), boss-death victory flow | 1 "Warden" every 5th | replace |
| Elites | v1.4 elite vanguard floor creep + affixes | none | add |
| Level-up cards | weapon / passive / evolve / heal generator (`cards.ts`) | 14 fixed perks | replace |
| Meta perks | 10 (might, swift, vitality, focus, capacitor, magnet, phantom, plating, greed, tempo) | none | add |
| Relics | v1.3 one-per-run bargains at wave 3 (vampire, overclock, voidPact…) | none | add |
| Companions | v1.3 drone bay — magnetite, lumen, aegis… bought in Black Market | none | add |
| VOID DIAL | pre-run mutation toggles + MUTANT ×1.5 BP XP bonus | none | add |
| Daily Breach | date-seeded run, prisms, personal ghost | none | add |
| Battle Pass S1 | 30 levels, prime, BP XP | none | add |
| Contracts | 15-id pool, 3 slots, progress | none | add |
| Achievements | full set w/ life stats tracking | none | add |
| Skins / hulls | 9 skins + titles + boosters | 3 hulls | replace |
| Economy | Cores **and** Prisms, Black Market | Cores only | replace |
| Victory | **wave 15 → victory → endless** (`waves.ts:198`) | wave 10 | fix |
| Save | `voidpulse_save_v2` schema v3 + full sanitizer + v1→v2 migration | separate lite save | replace |
| Balance numbers | tuned across 4 versions + sim-verified | re-invented | replace |

**Conclusion:** don't upgrade the clone — **delete it** and put the real core under the
mobile shell. The lite sim (~760 lines: `mobile/src/sim/*`) and lite config are retired.

---

## 1. The one architecture decision: **one core, two shells**

The decisive fact: the desktop game is **already headless-capable**. `scripts/sim.ts` runs
`new Game(new AudioEngine())` with no renderer, no DOM, no React, at a fixed 1/60 step —
and the whole engine (2,121-line `game.ts`, combat, waves, bosses, cards, economy,
ascension, relics, companions, mutations, daily) passes with zero errors. The renderer
(`render.ts`) and canvas UI (`renderUI.ts`) are **already separate modules** called from
outside the sim.

So parity is not a port. It is a **re-plumb**:

```
┌──────────────────────────── ONE CORE (pure TS, DOM-free) ───────────────────────────┐
│ src/game/*: game, combat, content, waves, bosses, cards, player, economy, save,     │
│ ascension, relics, companions, mutations, daily, achievements, skins, types, utils, │
│ audio (WebAudio engine — platform-agnostic)                                         │
└──────────────┬───────────────────────────────────────────────┬──────────────────────┘
               │                                               │
   DESKTOP SHELL (as today)                       MOBILE SHELL (mobile/, rebuilt v1.6.0)
   GameCanvas.tsx + render.ts + renderUI.ts       mobile/src/*: touch input → zero-alloc
   pointer + keyboard                             renderer, canvas HUD, DOM glass screens,
                                                  haptics, lifecycle, Capacitor-ready build
```

### 1.1 Rule amendment (replaces the v1.5.0 isolation rule)

> **OLD:** "All mobile code lives only in `mobile/`, never import from outside `mobile/`."
>
> **NEW (MIRROR rule):**
> 1. `mobile/` imports **only** from the pure core modules listed above — the same files
>    the headless sim imports. Single source of truth: one balance change lands on both
>    platforms the same second.
> 2. `mobile/` **never** imports: `render.ts`, `renderUI.ts`, `GameCanvas.tsx`,
>    `src/components/**`, `src/app/**`, React, Next. (Those belong to the desktop shell.)
> 3. `mobile/src/` keeps owning everything *presentation*: input, renderer, HUD, screens,
>    ports, build. Desktop shell never imports from `mobile/`.
> 4. The core stays **pure**: no `window`/`document` access outside save.ts's guarded
>    `typeof window` checks; no allocation-heavy patterns in the per-tick path.
> 5. **Enforcement is mechanical, not aspirational:** an ESLint `no-restricted-imports`
>    override for `mobile/**` (whitelist the core, ban everything else) + a CI check
>    (`bun scripts/parity-check.ts`) that fails the build on any violation or content drift.

### 1.2 Why not a literal copy-paste fork

Copying `src/game/*` into `mobile/src/sim/` gives parity *today* and guaranteed drift
*tomorrow*: 4 versions of balance live only in one place today (v1.1 weapons, v1.2
elites/mutations, v1.3 relics/drones, v1.4 ascension). Every future tune would need two
edits and eventually someone forgets. The user's instinct — "copy and paste and be exact"
— is satisfied **better** by importing the real files: it's copy-paste that never rots.
(Fallback if ever needed: the fork path is still available; nothing in this plan blocks it.)

---

## 2. Data layer ("db") — one profile everywhere

The game is and stays **offline-first, zero-backend**. The unused Prisma/SQLite scaffold
remains out of scope. Parity here means: **the same save, readable by both shells.**

| Concern | Decision |
| --- | --- |
| Store | `localStorage`, same key **`voidpulse_save_v2`** (schema v3 + sanitizer already battle-tested with v1→v2 migration) |
| Web | `/` and `/m/` share one origin → **one profile automatically**. Start a run on desktop, open your phone browser on the same account/origin later — cores, pass, ascension all there (per-browser, as today) |
| Capacitor (v1.7) | WebView is same-origin per app → the same `localStorage` code works unmodified; no db rewrite. Storage persists across app updates |
| Cross-device transfer | v1.6 adds **Export/Import code** in settings: the save serialized to a compact base64 string (copy-paste between devices). Cheap, no server, unblocks store testers |
| Cloud sync | Deferred to v2 accounts (as per V2_PLAN); schema is already one JSON blob — trivial to lift later |
| Conflicts | Single-writer per origin (as desktop today). Save-on-meta-change only (already the case), not per-frame |
| Quota / private mode | Existing try/catch swallow is correct; surface a "progress won't persist" toast in the mobile shell |
| Mobile-lite save retirement | One-time migration: if `voidpulse_save_v2` absent but mobile-lite key present, convert lite cores → Cores once, then delete lite key |

---

## 3. Simulation parity — "exact" made testable

1. **Delete** `mobile/src/sim/*` + `mobile/src/config.ts` (lite clone). The core is
   `src/game/*`, consumed directly.
2. **Determinism harness** — extend `scripts/sim.ts` into `scripts/parity-sim.ts`:
   run N seeds × M minutes through (a) the raw core, (b) the core as mounted by the
   mobile shell entry, assert identical wave/kills/score/hp timelines. This is the
   drift alarm for the entire project's future.
3. **Fixed step**: mobile loop already ticks at fixed accumulator steps — keep 1/60
   logic steps (render at display rate) so the core behaves identically on 60/120 Hz.
4. **Allocation budget**: core hot path is desktop-tested but not allocation-audited.
   Add a sim mode that snapshots `heapUsed` every 1,000 ticks and fails on growth →
   guarantees the 60/120 Hz zero-alloc contract survives the merge.
5. **Input contract**: audit `game.ts` input fields (mouse aim, keys, buttons). The
   mobile touch adapter writes **the same fields**. Any weapon needing mouse-precise
   aim gets an `autoAim` assist path in the shell (never in the core) — see §5.

---

## 4. Rendering parity — same look, mobile rules intact

The v1.5.0 renderer rules all stand (zero-alloc, DPR≤2, pre-baked, no per-frame
gradients) — but the **content of what is drawn** must match `render.ts`:

| Item | Work |
| --- | --- |
| Palette | Import color tokens from one shared module (extract from `render.ts`/`palette.ts`); colorblind variants (off/protan/deutan/tritan) come free with the core settings |
| Sprites | Extend the bake atlas: 12+ enemy types × elite variants, all boss bodies + pattern telegraphs, 9 skins, relic glyphs (†, Ω, ◇), drone models, orbiter/shard effects |
| FX parity | Damage numbers (toggle exists in settings), frost fields, arc chains, tether beams, nova rings, rail tracers, orbit trails, death shatter particles, shard pickups w/ magnet — port the *visual recipes* from `render.ts` into pooled renderers |
| Camera | Keep velocity-lead 0.12 + trauma shake, but source shake events from the **core's** event list (boss slam, elite die, overdrive) and respect `settings.shake` + `reducedMotion` |
| HUD | Keep floating mobile HUD (hull/dash/wave/timer/score/kills/XP) but add core-state extras: overdrive meter, relic glyph, companion icon, contract tick toast, daily/pass indicators on menus |
| Arena | Same world size/bounds as desktop (core owns it) |

---

## 5. Touch input mapping — the only place mobile re-thinks controls

Desktop reads pointer+keyboard; the touch adapter writes the **same Game input fields**:

| Desktop | Mobile |
| --- | --- |
| Move (WASD) | Floating stick L (55dp/10% deadzone) — unchanged from v1.5.0 |
| Aim (mouse) + fire | All weapons audited; most are proximity/auto (nova, orbit, frost, tether, mirror, seeker are self-evidently auto). For aimed weapons: right-drag aims; otherwise **auto-aim nearest** (v1.5.0 behavior kept). Aim-assist cone ±12° snap for rail/scatter |
| Dash (space) | Dash button 52dp + pie cooldown — unchanged |
| Overdrive | Overdrive button, appears at full charge — unchanged |
| Level-up choice (click card) | 3-card modal, 48dp targets, reroll/banish if the card UI has them |
| VOID DIAL toggles (title screen) | VOID DIAL sheet: full-screen list, big toggles, MUTANT bonus banner |
| Menus (mouse) | DOM glass screens (§6) |

---

## 6. UI/UX shell v2 — every desktop screen gets a mobile screen

The desktop's canvas `renderUI.ts` screens stay desktop-only. Mobile rebuilds each one
as DOM glass (safe-area, 48dp targets) **driven by the same core meta state** — so they
can't lie about what you own:

| Desktop screen | Mobile screen |
| --- | --- |
| Title | Title + PLAY / DAILY BREACH / VOID DIAL entry; best score/wave/pass level strip |
| Hull / skin select | Garage: swipe carousel, 9 skins, stats, unlock costs, titles equip |
| Black Market | Market drawer: meta perks grid, **drone bay** tab (buy/equip companions), boosters |
| Battle Pass S1 | Pass screen: 30-tile track, BP XP bar, prime status |
| Contracts | Contracts drawer: 3 slots, progress bars, reroll |
| Achievements | Achievements list w/ life-stats footer |
| Ascension tree (v1.4) | Vertical scroll of node rows w/ req chains + rank pips (tree graph → list; the req chain is linear enough. Pinch-canvas tree rejected: cost > value on phones) |
| Settings | Drawer: volMaster/Music/Sfx sliders, haptics toggle (mobile-only), colorblind select, shake, dmg numbers, reduced motion, reduce flash, **60/120 FPS cap**, export/import save |
| Run HUD | Canvas HUD (v1.5.0, extended per §4) |
| Level-up cards | Modal, unchanged rules from `cards.ts` (weapon/passive/evolve/heal) |
| Relic offer (wave 3) | Full-screen bargain modal: desc + trade, permanent |
| Game Over / Victory / Endless | Stats + Cores + Prisms + BP XP gained + contract ticks + achievements unlocked; big RESTART; endless banner at wave 15 victory |
| Daily Breach result | Daily card: seed #, personal ghost score, prism payout |

Navigation model: Title ⇄ (Garage · Market · Pass · Contracts · Achievements · Ascension · Daily · Void Dial · Settings) as full-screen sheets with back gesture; in-run = HUD only + pause drawer. No hamburger, no tabs bar — thumb arcs decide placement (nav bottom, destructive top-left away).

---

## 7. Audio & haptics

- `AudioEngine` is plain WebAudio and **already injected into Game** → mobile mounts the
  same engine (unlock/resume on first pointerdown — iOS requires it; v1.5.0's AudioPort
  becomes a thin wrapper). Every SFX the core calls (`seeker`, `nova`, `victory`, …)
  exists by construction — no re-synthesis, no missing sounds.
- Music/ambience: same engine channels (volMusic already in settings).
- Haptics stays mobile-only: 10ms dash/gem pickup · 25ms hull hit · 50ms wave/boss/death;
  toggle in settings; `navigator.vibrate` guarded.

## 8. Lifecycle & battery (unchanged contract)

visibilitychange → autopause + 1 FPS throttle; 60/120 FPS cap setting; DPR≤2; pause
stops the accumulator, not the meta. All v1.5.0 rules carry over verbatim.

---

## 9. Phases

| Phase | Version | Scope | Exit criteria |
| --- | --- | --- | --- |
| **P0 — Re-plumb** | v1.6.0-alpha | Rule amendment + ESLint whitelist + `parity-check.ts`; delete `mobile/src/sim/*`; mount real `Game` behind the touch adapter (fix any DOM leak the audit finds); save unification + lite-save migration | `parity-sim` identical timelines desktop-vs-mobile-mount; typecheck/lint/sim green |
| **P1 — Render parity** | v1.6.0-beta | Bake atlas for all enemies/bosses/skins/glyphs; FX recipes ported; palette tokens shared; HUD extended (overdrive/relic/drone) | side-by-side screenshots desktop vs mobile indistinguishable per entity |
| **P2 — Meta screens** | v1.6.0-rc | §6 screens: Garage/Market/Pass/Contracts/Achievements/Ascension/Void Dial/Daily/Settings + relic modal + endless flow | every core meta field reachable & mutable from mobile UI; save round-trips |
| **P3 — Feel pass** | **v1.6.0 MIRROR** | Shake/trauma tuning per core events, hit-stop, audio mix on device, aim-assist tuning, battery profile (60 vs 120) | 60fps mid-tier Android (4GB) full wave-15 build-up; iPhone SE class stable |
| **P4 — Store track** | v1.7.0 | Capacitor wrap, static export, icons/splash, Play Data Safety ("collects nothing") — **rename decision gates the bundle ID** | store listing draft ready |

Estimates: P0 ≈ 1 session, P1 ≈ 2, P2 ≈ 2, P3 ≈ 1, P4 ≈ 1 + store paperwork.

---

## 10. Acceptance checklist (v1.6.0 ships only when all true)

- [ ] `bun scripts/parity-sim.ts` — 10 seeds × 15 min: core vs mobile-mount timelines **identical**
- [ ] Content parity test: every id in WEAPONS/ENEMIES/BOSSES/EVO_MAP/META_PERKS/RELICS/COMPANIONS/MUTATIONS/ASC_NODES/CONTRACT_POOL/skins loads in the mobile runtime
- [ ] Victory at wave 15 → endless; relic at wave 3; drone bay purchasable; daily grants prisms
- [ ] Same `voidpulse_save_v2` read/written by `/` and `/m/` on one origin; export/import round-trips
- [ ] Zero heap growth over 10,000 mobile-shell ticks (allocation budget test)
- [ ] 60 fps on mid-tier Android during wave-12 peak entity load; DPR≤2 enforced
- [ ] All §6 screens present, ≥48dp targets, safe-area clean on notched device
- [ ] `bunx tsc --noEmit` + `bunx eslint .` + `bun scripts/sim.ts` green; ESLint whitelist blocks any forbidden import

## 11. Risks

| Risk | Mitigation |
| --- | --- |
| `game.ts` hides DOM assumptions (it was never *required* to be DOM-free, just never used DOM) | P0 audit is exactly this; sim proves the logic path already |
| Full content > lite perf on old devices | Allocation budget + bake atlas sizes measured in P1; 30fps safety profile as last resort |
| Same-origin save: user runs both shells in one browser, conflicting writes | Save-on-change only (already true); last-writer-wins documented; export/import as manual merge hatch |
| Scope creep on screens | §6 is the closed list; anything else waits for v2 |
| Rename lands mid-P4 | Only blocks bundle ID + store listing; code name-free until then |
