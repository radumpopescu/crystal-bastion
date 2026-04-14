# Crystal Bastion Balance Editor Implementation Plan

Goal: Add a hidden, always-available balancing interface for the current game that loads a default repo JSON, supports localStorage overrides, import/export/reset, and can reapply values mid-run.

Architecture:
- Create a pure balance-config module that owns the default schema, override merge, import/export, localStorage persistence, and recompute helpers.
- Create a DOM overlay editor for interaction instead of trying to force a dense numeric editor entirely into canvas rendering.
- Keep the current game playable while making runtime values derive from a central balance config wherever practical in this first pass.

Tech stack:
- TypeScript in `src/`
- Bundled JSON config imported into the app
- LocalStorage for persistent override
- Simple DOM overlay appended to `document.body`
- Node built-in test runner for pure config-module tests

## Planned phases

1. Add pure balance config module and default JSON
2. Add tests for merge/import/export/reset behavior
3. Route current gameplay constants through the new config module
4. Add runtime recompute support for the current game state
5. Add hidden balance editor overlay with sectioned numeric controls
6. Add import/export/reset/apply actions
7. Build and verify in browser

## Important scope rule for this pass
This first implementation targets the current game systems, not the full future expansion. The schema should be broad enough to grow later, but the first version only needs to fully wire values that already exist in the current game.

## Key acceptance criteria
- Opening shortcut exists and works during menu and runs
- Mobile has a practical way to open the editor too
- Overrides persist in localStorage
- Default config exists as a JSON file in the repo
- Export/import uses the same JSON shape
- Reset returns to shipped defaults
- Applying changes mid-run updates current stats without discarding the run
- Current save/restore keeps working
- The editor is schema-driven and sectioned; it is NOT a raw JSON text editor
- The UI follows the JSON structure with dedicated grouped controls for weapons, run cards, meta upgrades, enemies, waves, economy, base, and towers
- JSON export/import remains available, but direct editing happens through structured inputs and controls
