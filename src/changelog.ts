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
