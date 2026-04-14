# Crystal Bastion Expansion Parking Lot

Status: Parked until after the balancing editor/config workflow is built.

## Source inputs
- `Crystal_Bastion_Low_Impact_Expansion_Plan.docx`
- Radu follow-up notes from Telegram thread on 2026-04-14

## High-level direction
Keep the game readable and fast, but allow deeper long-term progression and more direct control over tower building and balance tuning.

## What the original DOCX proposed
- Keep the current moment-to-moment loop mostly unchanged.
- Keep waves short and readable.
- During a wave, the player should mostly move and dash.
- Add only a small set of tower families rather than a large tower subsystem.
- Restrict tower building to intermissions.
- Add passive repair mechanics.
- Make Wave 14 the first real clear point.
- Allow claiming the win or continuing into endless.
- Add a simple difficulty ladder.
- Add a small set of character archetypes.
- Expand the card pool modestly.
- Roll the expansion out in stages instead of shipping everything at once.

## Radu changes / overrides to the DOCX

### Towers
- Do NOT cap tower count at 4.
- Player should be able to build as many towers as they want, as long as they can afford them.
- Tower cost can differ per tower type.
- Each tower should have its own level instead of sharing one global tower level.
- Cards should be able to upgrade tower levels.
- The right sidebar should show tower levels similarly to how weapon levels are shown.
- Tower placement should use keys `1-4` on desktop.
- On mobile, show one button per tower type for placement.

### Tower roster
Keep the current 3 towers and add 2 more:
- Add a melee tower that damages in all directions around itself.
- Add a sniper tower with longer range, higher damage, and slower fire rate.

### Repair system
Replace the heavier passive-repair concept with a clearer numeric repair-level system:
- Repair should be a run stat/level upgraded via cards.
- Base repair value should be small, around `0.5 HP/sec`.
- Highest reasonable end should be around `5 HP/sec`.
- Also keep an intermission replenishment card for all towers.

### Wave 14 clear / endless
- At Wave 14, player can either stop and bank the win or continue forever.
- If the player continues into endless, they should still keep the Wave 14 win/unlock.
- Continuing endless should not risk losing the clear credit already earned.

### Characters
- Current character direction from the DOCX is liked.
- Character system is still desired later.

## New major priority added by Radu: balancing editor / config workflow
This is now the first priority and should happen before the larger gameplay expansion.

### Goal
Add a persistent balancing/config interface that exposes the game's numeric tuning in one structured place and lets Radu experiment safely before promoting values into the shipped default JSON.

### Required behavior
- There should be a page/screen that can be opened at any time.
- Suggested hidden shortcut: pressing `8`, `9`, and `0` together.
- The page should act like an overview/editor for the game's balancing values.
- It should support export and import.
- Overrides should persist in localStorage.
- The same data format should also live as a JSON file inside the game repo.
- Once a tuned override is considered good, that JSON can replace the default shipped JSON.

### Config scope
The balancing JSON should include, eventually:
- player stats
- enemy stats
- level/wave stats
- card stats
- weapon stats
- tower stats
- player level multipliers
- difficulty multipliers
- effectively all gameplay-affecting numbers

### Override behavior
- Game should support a local override config layered on top of the default config.
- There should be a way to clear the override and return to the default config.
- Ideally this should work even mid-run.
- When returning to the game after changing values, the run should continue with recomputed values.

### Recompute philosophy
Radu wants the run state to be treated as reconstructable from:
- list of cards owned
- current HP values for player/base/towers/enemies
- other current runtime state

That means balancing changes should ideally be reapplied through recomputation rather than only affecting newly spawned entities.

## Active implementation priority
Build the balancing editor/config interface first, using the current game as-is.

## Deferred until after the balance editor
- unlimited typed tower building
- per-tower leveling and tower-level cards
- tower HUD/sidebar changes for per-tower levels
- 1-4 build hotkeys and mobile tower buttons
- melee tower
- sniper tower
- repair-level card system
- intermission replenishment card
- Wave 14 clear/endless flow
- difficulty ladder
- characters
- wider card pool and progression changes

## Notes for later implementation
- The balancing system should be designed in a way that supports all deferred features without another total rewrite.
- The config schema should be broad and nested enough that future additions can slot into it cleanly.
- The first pass can focus on current systems, but the data model should anticipate future towers, difficulties, and character modifiers.
