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
