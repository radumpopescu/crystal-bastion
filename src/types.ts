import type { MonsterType } from './constants';

export interface Tower {
  x: number; y: number;
  hp: number; maxHp: number;
  range: number;
  auraRadius: number; auraDmg: number;
  atkRange: number; atkDmg: number; atkSpeed: number; atkCooldown: number;
  upgrades: { hp: number; range: number; aura: number };
}

export interface Player {
  x: number; y: number;
  hp: number; maxHp: number;
  speed: number;
  atkRange: number; atkDmg: number; atkSpeed: number; atkCooldown: number;
  invincible: number;
  flashTimer: number;
  dead: boolean;
}

export interface Outpost {
  x: number; y: number;
  hp: number; maxHp: number;
  range: number;
  atkRange: number; atkDmg: number; atkSpeed: number; atkCooldown: number;
}

export interface Monster {
  x: number; y: number;
  type: MonsterType;
  hp: number; maxHp: number;
  speed: number; dmg: number;
  gold: number;
  radius: number; color: string;
  atkCooldown: number;
}

export interface Projectile {
  x: number; y: number;
  vx: number; vy: number;
  dmg: number;
  owner: 'player' | 'tower' | 'outpost';
  life: number;
}

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string; r: number;
}

export interface DmgNumber {
  x: number; y: number;
  val: number; life: number; color: string;
}

export interface GameState {
  tick: number;
  wave: number;
  waveTimer: number;
  waveActive: boolean;
  monstersLeft: number;
  gold: number;
  crystalsEarned: number;

  camera: { x: number; y: number };

  tower: Tower;
  player: Player;
  outposts: Outpost[];
  outpostRangeBonus: number;
  outpostHpBonus: number;

  monsters: Monster[];
  projectiles: Projectile[];
  particles: Particle[];
  dmgNumbers: DmgNumber[];

  keys: Record<string, boolean>;
  showUpgradeMenu: boolean;
  upgradeMenuCooldown: number;
}
