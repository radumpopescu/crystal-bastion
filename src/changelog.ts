import { GAME_VERSION } from './version';

export interface ChangelogEntry {
  version: string;
  title: string;
  date: string;
  changes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: GAME_VERSION,
    title: 'Repair and intermission replenishment are now balance-driven',
    date: '2026-04-15',
    changes: [
      'Added a new Maintenance Drones run-card path that increases passive structure repair over time using runStats.repair tuning from the balance config.',
      'Added a separate Replenishment Cycle card path that boosts automatic between-wave structure replenishment using intermission.towerRefresh config values.',
      'Gameplay sidebars now show the live repair-per-second rate and the current intermission refresh stack count so sustain tuning is readable in-run.',
    ],
  },
  {
    version: '2026.04.15.5',
    title: 'Melee and sniper towers joined the roster',
    date: '2026-04-15',
    changes: [
      'Added the Melee Tower as a close-range slam tower that damages enemies around itself instead of firing projectiles.',
      'Added the Sniper Tower as a long-range heavy-damage tower with slower cadence and faster precision shots.',
      'Both new towers are defined in the balance JSON/editor and use the same typed-tower runtime path as the existing Standard, Burst, and Support towers.',
    ],
  },
  {
    version: '2026.04.15.4',
    title: 'Towers now level individually',
    date: '2026-04-15',
    changes: [
      'Moved tower progression from one shared displayed tower level to per-tower-instance levels, with future tower builds inheriting bonus levels from tower-level cards.',
      'Tower Mastery and related tower-level effects now upgrade each placed tower individually while preserving the future-build bonus for towers placed later in the run.',
      'Tower rendering and sidebars now show per-tower levels so tower progression is readable per structure instead of as one global label.',
    ],
  },
  {
    version: '2026.04.15.3',
    title: 'Tower selection controls now work on desktop and mobile',
    date: '2026-04-15',
    changes: [
      'Added desktop tower-selection hotkeys so keys 1-4 switch the currently selected tower type instead of always building a single implicit tower.',
      'Added mobile one-button-per-tower-type controls and synced the mobile build button to the currently selected tower family.',
      'Gameplay HUD now shows the selected tower type and its current build cost so typed tower building is readable before placing a structure.',
    ],
  },
  {
    version: '2026.04.15.2',
    title: 'Typed tower roster foundation now drives tower stats',
    date: '2026-04-15',
    changes: [
      'Replaced the single generic tower path with typed tower definitions that now control tower cost, HP, build range, attack range, damage, fire rate, color, and placement multipliers.',
      'Initial tower roster now exposes three explicit current tower families through the balance JSON and editor: Standard, Burst, and Support.',
      'Placed towers now carry their tower type at runtime so future tower-selection controls and tower-specific progression can build on the same balance-driven foundation.',
    ],
  },
  {
    version: '2026.04.15.1',
    title: 'Expansion foundation now lives in the balance system',
    date: '2026-04-15',
    changes: [
      'Added expansion-foundation sections to the shipped balance JSON for tower types, tower progression, repair/intermission tuning, endless rules, difficulty profiles, and character archetypes.',
      'Runtime balance now exposes those new expansion domains so future gameplay work can read them from config instead of introducing new hardcoded values.',
      'The balance editor now documents and surfaces the new expansion sections so future features can be tuned through the same override/import/export workflow.',
    ],
  },
  {
    version: '2026.04.14.17',
    title: 'Runtime balance now reads from the editor config',
    date: '2026-04-14',
    changes: [
      'Gameplay runtime now derives core player, economy, base, tower, enemy, wave, weapon, meta-upgrade, and base-upgrade data from the balance config instead of separate hardcoded tables.',
      'Meta upgrade values, initial run setup, tower cost/scaling, wave formulas, shop pricing, and weapon level stats now share the same config source used by the balance editor.',
      'Added runtime-authority tests so config-to-game wiring is checked automatically instead of relying only on manual balancing passes.',
    ],
  },
  {
    version: '2026.04.14.16',
    title: 'Weapon level previews now show computed final values',
    date: '2026-04-14',
    changes: [
      'Weapon balance data now stores per-level multipliers and additive bonuses instead of duplicated per-level raw stats.',
      'The balance editor now shows editable base weapon stats, editable level modifiers, and a computed L1-L4 final-values table for each weapon.',
      'This keeps weapon tuning readable now and sets the pattern for other scaling systems that need both formulas and resulting values.',
    ],
  },
  {
    version: '2026.04.14.15',
    title: 'Steeper waves and anti-tower-spam economy',
    date: '2026-04-14',
    changes: [
      'Made wave progression much harsher, especially early on: more enemies, faster HP scaling, higher damage scaling, and earlier elite spawns.',
      'Outpost/tower cost now scales with how many towers you already built, plus extra pressure in later waves, so infinite tower spam is much harder.',
      'Between-wave HUD spacing was adjusted so the start button no longer gets covered by telemetry and weapon icons.',
    ],
  },
  {
    version: '2026.04.14.12',
    title: 'HUD telemetry and long-range projectile fix',
    date: '2026-04-14',
    changes: [
      'Added an FPS counter above the player health panel.',
      'Top-left wave HUD now shows tower count, and active waves also show a compact enemy-type breakdown.',
      'Base projectiles now live long enough to visually reach distant targets instead of disappearing early at very high range.',
      'Raised the in-run Base Range upgrade cap from 5 to 8 levels.',
    ],
  },
  {
    version: '2026.04.14.11',
    title: 'Base turret layout and weapon-card balance',
    date: '2026-04-14',
    changes: [
      'Base multishot now renders as distinct turret heads mounted on the same base instead of a single spread barrel cluster.',
      'Base projectiles now leave from the matching turret mount so multishot visually tracks each turret better.',
      'Weapon card offers now favor upgrades over brand-new weapons, and once all weapon slots are filled the weapon pool only offers upgrades.',
      'Also polished the tower HP overlay spacing and made the base render above nearby towers/outposts.',
    ],
  },
  {
    version: '2026.04.14.9',
    title: 'Tower HP display clarified',
    date: '2026-04-14',
    changes: [
      'Clarified the tower sidebar HP line so it explicitly shows total tower HP across all built towers.',
      'This makes it easier to judge how much HP a tower-heal card would restore overall.',
    ],
  },
  {
    version: '2026.04.14.8',
    title: 'Wave-end freeze fix',
    date: '2026-04-14',
    changes: [
      'Fixed the freeze that could happen when the last enemy died and wave-end cleanup cleared projectiles during projectile iteration.',
      'Projectile updates now safely skip cleared entries if the projectile list is reset mid-frame.',
    ],
  },
  {
    version: '2026.04.14.7',
    title: 'Built-in changelog screen',
    date: '2026-04-14',
    changes: [
      'Added an in-game changelog page.',
      'Clicking the version number on the main menu now opens the changelog.',
      'Established the workflow to update the version and changelog with each meaningful change.',
    ],
  },
  {
    version: '2026.04.14.6',
    title: 'Mobile controls and presentation polish',
    date: '2026-04-14',
    changes: [
      'Improved mobile joystick behavior, touch area, and on-screen guidance.',
      'Refined mobile between-wave flow, mobile sidebar behavior, and gameplay HUD.',
      'Clarified the early-wave-start gold bonus text and added between-wave run persistence.',
      'Improved procedural visuals, enemy animation stability, projectile cleanup, and multishot tower presentation.',
    ],
  },
];
