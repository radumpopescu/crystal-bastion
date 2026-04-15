# Crystal Bastion Expansion Implementation Plan

> For Hermes: Use subagent-driven-development skill to implement this plan task-by-task.

Goal: Expand Crystal Bastion in staged slices without bypassing the new balance system, so every new gameplay parameter lives in the shipped balance JSON, local overrides, runtime-balance wiring, and the balance editor.

Architecture: Treat the balance config as the single source of truth for expansion features. Every feature slice must add schema/config defaults first, then runtime readers in `src/runtime-balance.ts`, then editor exposure in `src/balance-editor.ts`, and only then gameplay/UI behavior in `src/systems.ts`, `src/state.ts`, `src/render.ts`, and `src/input.ts`.

Tech Stack: TypeScript, canvas UI, JSON-backed balance config, localStorage override layer, runtime-balance indirection, browser-based manual QA, targeted `.mjs` tests.

---

## Global rules for every expansion slice

1. Add defaults to `src/balance-config.default.json`.
2. Expose the new values through `src/runtime-balance.ts`.
3. Surface them in `src/balance-editor.ts` with readable labels/help text.
4. Keep import/export/local override compatibility through `src/balance-config.ts`.
5. Add or extend tests before implementation.
6. Rebuild, browser-check, and console-check after each meaningful slice.
7. Bump `src/version.ts` and prepend `src/changelog.ts` for each shipped gameplay slice.
8. Commit and push after each meaningful slice.

## Step plan

### Step 1: Expansion schema foundation
Objective: Create the config/editor/runtime structure needed so future expansion work does not reintroduce hardcoded gameplay numbers.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/balance-editor.ts`
- Modify: `src/balance-config.ts`
- Test: `tests/runtime-balance.test.mjs`
- Test: `tests/balance-config.test.mjs`

Deliverables:
- Add new top-level config sections for future-safe expansion data, likely including:
  - `towerTypes`
  - `towerProgression`
  - `runStats.repair`
  - `intermission`
  - `endless`
  - `difficulty`
  - `characters`
- Editor sections exist even if some gameplay consumers are not implemented yet.
- Runtime getters exist for all new sections.

### Step 2: Typed tower roster foundation
Objective: Replace the current single generic tower model with a typed tower-definition system that supports the existing tower set plus future new towers.

Files likely touched:
- Modify: `src/runtime-balance.ts`
- Modify: `src/constants.ts`
- Modify: `src/state.ts`
- Modify: `src/systems.ts`
- Modify: `src/render.ts`
- Modify: `src/types.ts`
- Modify: `src/balance-config.default.json`
- Modify: `src/balance-editor.ts`
- Test: tower/runtime tests

Deliverables:
- Current tower logic reads from per-type config definitions instead of one generic tower blob.
- Existing three towers become explicit typed entries in config.
- Cost, range, damage, fire rate, visuals, and placement constraints are type-specific and editable.

### Step 3: Build controls and tower-selection UX
Objective: Add the player-facing controls for choosing which tower type to place on desktop and mobile.

Files likely touched:
- Modify: `src/input.ts`
- Modify: `src/mobile-controls.ts`
- Modify: `src/render.ts`
- Modify: `src/state.ts`
- Modify: `src/types.ts`
- Modify: `src/balance-config.default.json`
- Modify: `src/balance-editor.ts`

Deliverables:
- Desktop hotkeys `1-4` (or expanded mapping if roster size requires it).
- Mobile one-button-per-tower-type placement controls.
- HUD clearly shows selected tower type and cost.
- All button labels and hotkeys reflect config-backed tower definitions.

### Step 4: Per-tower leveling model
Objective: Move from one shared tower level to per-tower-instance leveling that can be modified by cards and shown in the sidebar.

Files likely touched:
- Modify: `src/state.ts`
- Modify: `src/systems.ts`
- Modify: `src/render.ts`
- Modify: `src/runtime-balance.ts`
- Modify: `src/balance-config.default.json`
- Modify: `src/balance-editor.ts`
- Test: progression/runtime tests

Deliverables:
- Each tower instance stores its own level.
- Per-level growth rules live in config.
- Sidebar/UI shows per-tower levels in a readable way similar to weapon levels.
- Cards can target tower progression through config-driven effects.

### Step 5: New tower types — melee and sniper
Objective: Add the two requested tower archetypes using the typed-tower system and full balance-editor support.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/systems.ts`
- Modify: `src/render.ts`
- Modify: `src/balance-editor.ts`
- Test: tower behavior tests

Deliverables:
- Melee tower damages around itself in all directions.
- Sniper tower has long range, high damage, slow rate.
- Their stats, level scaling, visuals, and costs all come from balance config.

### Step 6: Repair stat and intermission replenishment
Objective: Add the new repair-level run stat plus the separate intermission replenishment card path, both fully config-driven.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/systems.ts`
- Modify: `src/state.ts`
- Modify: `src/render.ts`
- Modify: `src/balance-editor.ts`
- Test: run-card/runtime tests

Deliverables:
- Repair starts near `0.5 HP/sec` by default and scales through cards/config.
- High-end tuning can reach around `5 HP/sec` via config, not code constants.
- Separate intermission replenishment card remains available and config-backed.

### Step 7: Wave 14 clear and endless continuation
Objective: Add the branch point at Wave 14 where the player can bank the win and optionally continue into endless without losing clear credit.

Files likely touched:
- Modify: `src/state.ts`
- Modify: `src/systems.ts`
- Modify: `src/render.ts`
- Modify: `src/input.ts`
- Modify: `src/run-persistence.ts`
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/balance-editor.ts`
- Test: progression/state tests

Deliverables:
- Config-backed wave-clear milestone settings.
- UI choice at Wave 14: claim win or continue.
- Endless continuation keeps Wave 14 clear credit.
- Endless scaling parameters live in config/editor.

### Step 8: Difficulty ladder
Objective: Add a small difficulty system whose modifiers are completely balance-config driven.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/state.ts`
- Modify: `src/render.ts`
- Modify: `src/input.ts`
- Modify: `src/balance-editor.ts`
- Test: difficulty/runtime tests

Deliverables:
- Difficulty definitions with readable labels and multipliers.
- New-run difficulty selection UI.
- Enemy/economy/wave/player modifiers all come from config.

### Step 9: Character archetype framework
Objective: Add the character system on top of the new runtime balance layer so archetypes become data-driven instead of special-cased.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/state.ts`
- Modify: `src/render.ts`
- Modify: `src/input.ts`
- Modify: `src/balance-editor.ts`
- Test: character/runtime tests

Deliverables:
- Character definitions in config.
- Selection UI for new runs.
- Starting modifiers/loadout/passives driven by config.

### Step 10: Expanded card pool and balancing pass
Objective: Add the new card content only after the systems they depend on exist and are config-driven.

Files likely touched:
- Modify: `src/balance-config.default.json`
- Modify: `src/runtime-balance.ts`
- Modify: `src/systems.ts`
- Modify: `src/render.ts`
- Modify: `src/balance-editor.ts`
- Test: card/runtime tests

Deliverables:
- New tower-level cards, repair cards, intermission cards, endless-support cards, and any character/difficulty-linked cards.
- All card tuning is editable through the balance editor and exportable JSON.

### Step 11: Mid-run recompute hardening
Objective: Improve the balancing-system promise so applying/importing config during a run recomputes as much active state as possible for expansion systems too.

Files likely touched:
- Modify: `src/runtime-balance.ts`
- Modify: `src/state.ts`
- Modify: `src/systems.ts`
- Modify: `src/balance-editor.ts`
- Test: recompute/runtime tests

Deliverables:
- Existing towers/entities recompute more aggressively from active config.
- Expansion features obey apply/import without needing a fresh reload wherever feasible.

### Step 12: Final integration and balancing pass
Objective: Verify the expansion slices work together cleanly on desktop and mobile and that the editor can tune all major new systems.

Files likely touched:
- Modify as needed across `src/`
- Update: `src/version.ts`
- Update: `src/changelog.ts`
- Update/add tests
- Optionally add docs notes under `docs/plans/`

Deliverables:
- Integrated feature set with no hardcoded shadow values for expansion systems.
- Updated changelog and version.
- Manual QA pass on live build.

## Recommended implementation order

If we want the safest path with the least rewrite risk, do the work in this order:
1. Step 1 — expansion schema foundation
2. Step 2 — typed tower roster foundation
3. Step 3 — build controls and tower-selection UX
4. Step 4 — per-tower leveling model
5. Step 5 — melee and sniper towers
6. Step 6 — repair stat and replenishment
7. Step 7 — Wave 14 clear + endless
8. Step 8 — difficulty ladder
9. Step 9 — character archetypes
10. Step 10 — expanded card pool
11. Step 11 — mid-run recompute hardening
12. Step 12 — final integration/balance polish

## First-slice recommendation

Start with Step 1, then Step 2.
Reason: they create the data model and runtime/editor contract that every later expansion feature depends on. If we skip them and jump directly to a feature, we risk reintroducing hardcoded values and having to rewrite it again.
