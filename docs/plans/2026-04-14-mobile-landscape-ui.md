# Mobile Landscape UI Implementation Plan

> For Hermes: Use subagent-driven-development style execution where useful, but keep edits coordinated because most work touches the same render/state/input files.

Goal: Add a mobile-specific landscape layout for Crystal Bastion while preserving the current desktop presentation.

Architecture: Detect a mobile-landscape viewport in runtime, compute shared UI layout helpers, and render alternate compact overlays/panels only when the device matches the mobile profile. Keep desktop coordinates and behavior unchanged. On mobile, replace dual sidebars with a single toggleable drawer, compact HUD blocks, scrollable panel sections, and touch-friendly controls.

Tech Stack: TypeScript, Bun build script, single-canvas UI rendering, browser-based manual QA.

---

## Acceptance criteria

- Desktop layout remains visually equivalent to the current version.
- Mobile landscape automatically switches to a compact layout.
- Playing HUD fits on a landscape phone without clipping critical information.
- Level-up/shop flow works on mobile with one toggleable sidebar instead of two always-visible sidebars.
- Card Book and Relics screens remain usable on mobile with scrollable content and readable controls.
- Touch input works for the new mobile-only controls.
- QA includes both desktop and mobile screenshots/visual verification.

---

## Task 1: Add runtime viewport/device UI state

Objective: Create a single source of truth for desktop vs mobile layout decisions.

Files:
- Modify: src/types.ts
- Modify: src/state.ts

Steps:
1. Extend RuntimeUI with mobile UI state fields such as isMobileLandscape, drawerOpen, activeDrawerTab, mobileScrollY, dragScrollState, and rectangles for mobile-only buttons.
2. Add a helper in state.ts that derives UI mode from window size/user agent/touch capability. Prefer a conservative rule like short viewport height + touch/mobile UA + landscape orientation.
3. Recompute this UI mode on startup and resize.
4. Ensure desktop defaults preserve existing behavior.

Verification:
- Build succeeds.
- Logging or temporary inspection confirms desktop stays desktop and a phone-like landscape viewport becomes mobile.

## Task 2: Create reusable layout helpers for desktop and mobile

Objective: Centralize coordinates so rendering logic does not hardcode desktop assumptions everywhere.

Files:
- Modify: src/render.ts
- Modify: src/systems.ts

Steps:
1. Add helper functions for compact spacing, font sizes, panel bounds, and safe touch target sizes.
2. Split current sidebar/layout calculations into desktop and mobile variants.
3. Keep existing desktop luPositions behavior as the default branch.
4. Add mobile positions for:
   - compact top HUD strip
   - bottom-left or bottom-center action area
   - single right-side drawer
   - toggle button for the drawer
   - scrollable panel content viewport

Verification:
- Build succeeds.
- No desktop regressions in menu/game screens.

## Task 3: Mobile-friendly playing HUD

Objective: Make the active gameplay HUD fit on a landscape phone.

Files:
- Modify: src/render.ts
- Modify: src/systems.ts if click targets need updates

Steps:
1. Add a compact mobile HUD branch inside renderHUD().
2. Shrink HP, gold, wave, and pause controls.
3. Remove or condense desktop-only control hint blocks on mobile.
4. Reduce or reposition the minimap so it does not overlap essential controls.
5. Make the wave-start button touch-friendly and visually obvious.
6. Add a drawer toggle button for tower/loadout stats on mobile.

Verification:
- Build succeeds.
- In mobile view, no major HUD box should overlap critical play space.

## Task 4: Replace dual level-up sidebars with one mobile drawer

Objective: Make the wave-complete/shop flow usable on a phone.

Files:
- Modify: src/render.ts
- Modify: src/systems.ts
- Modify: src/input.ts
- Modify: src/types.ts if extra button rects are needed

Steps:
1. Keep the current dual-sidebar level-up layout for desktop.
2. For mobile, render one compact drawer that can switch between tabs such as BASE and LOADOUT.
3. Add a touch-friendly toggle/tab control.
4. Constrain drawer body to a scrollable region so long stats/card lists remain reachable.
5. Reduce card dimensions for free-pick/shop cards on mobile and keep them readable.
6. Ensure SELL, LOCK, REFRESH, DONE, and buy interactions remain tappable.

Verification:
- Build succeeds.
- Mobile view can complete a wave-end flow without hidden or clipped controls.

## Task 5: Mobile menu, relics, and card book adaptations

Objective: Make non-game screens usable in landscape on phones.

Files:
- Modify: src/render.ts
- Modify: src/input.ts

Steps:
1. Menu: convert the right action sidebar into a stacked or overlay section sized for landscape phones; reduce decorative art footprint if needed.
2. Relics: reduce card size/column count on mobile and keep scrolling usable.
3. Card Book: replace the permanent left nav sidebar with a compact header/toggle or horizontal tab selector on mobile.
4. Ensure back buttons remain visible and large enough.
5. Preserve existing desktop layout for all screens.

Verification:
- Build succeeds.
- Mobile menu, relics, and card book all remain navigable without unreadably tiny text.

## Task 6: Add touch/mobile input support for new controls and scrolling

Objective: Ensure mobile-only UI can actually be used.

Files:
- Modify: src/input.ts
- Modify: src/systems.ts
- Modify: src/state.ts if needed

Steps:
1. Add pointer/touch handling for mobile drawer toggle and tab buttons.
2. Add drag or swipe scrolling for mobile-only panel areas where wheel scrolling is unavailable.
3. Make tap handling share logic with existing click interactions where possible.
4. Prevent accidental desktop regressions from duplicate event handling.

Verification:
- Build succeeds.
- Mobile controls can be operated without mouse wheel or keyboard.

## Task 7: QA and polish

Objective: Verify desktop is preserved and mobile layout looks good across key screens.

Files:
- No code-specific requirement; may include minor polish edits in src/render.ts or src/input.ts

Steps:
1. Build the game.
2. Serve dist and test desktop menu, gameplay HUD, level-up/shop, relics, and card book.
3. Test the same flows under a landscape phone viewport.
4. Capture screenshots for before/after comparison.
5. Fix any overlapping text, clipped controls, or untappable elements.

Verification commands:
- bun run build
- Use browser-based visual inspection on the served app

Definition of done:
- Desktop still looks correct.
- Mobile landscape automatically uses the compact layout.
- Single-sidebar/drawer flow works.
- All key screens are readable and operable.
