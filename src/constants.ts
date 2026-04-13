// ─── WORLD ───────────────────────────────────────────────────────────────────
export const WORLD = 4000;
export const TILE = 80;

// ─── SAFE ZONE ───────────────────────────────────────────────────────────────
export const TOWER_RANGE = 220;
export const OUTPOST_RANGE = 200;
export const LEASH_WARN = 0.85;
export const LEASH_DMG = 8; // HP/s

// ─── TOWER ───────────────────────────────────────────────────────────────────
export const TOWER_HP_BASE = 500;
export const TOWER_AURA_RADIUS = 130;
export const TOWER_AURA_DMG = 5;
export const TOWER_ATK_RANGE = 260;
export const TOWER_ATK_DMG = 22;
export const TOWER_ATK_SPEED = 1.0;

// ─── PLAYER ──────────────────────────────────────────────────────────────────
export const PLAYER_HP_BASE = 160;
export const PLAYER_SPEED = 190;
export const PLAYER_ATK_RANGE = 160;
export const PLAYER_ATK_DMG = 18;
export const PLAYER_ATK_SPEED = 1.2;
export const PLAYER_RADIUS = 14;

// ─── OUTPOST ─────────────────────────────────────────────────────────────────
export const OUTPOST_HP_BASE = 80;
export const OUTPOST_COST = 40;

// ─── MONSTERS ────────────────────────────────────────────────────────────────
export const MONSTER_TYPES = {
  grunt:  { radius: 14, hp: 40,  speed: 70,  dmg: 8,  gold: 6,  color: '#e74c3c' },
  rusher: { radius: 10, hp: 22,  speed: 135, dmg: 5,  gold: 4,  color: '#e67e22' },
  brute:  { radius: 22, hp: 160, speed: 45,  dmg: 20, gold: 15, color: '#8e44ad' },
} as const;
export type MonsterType = keyof typeof MONSTER_TYPES;

// ─── WAVES ───────────────────────────────────────────────────────────────────
export const WAVE_INTERVAL = 30;
export const BASE_MONSTERS = 4;
export const MONSTER_SCALE = 1.22;

// ─── META UPGRADES ───────────────────────────────────────────────────────────
export const META_UPGRADES = [
  { id: 'playerHp',     label: 'Reinforced Body',  desc: '+25 max HP',          cost: 3, max: 4 },
  { id: 'playerDmg',    label: 'Sharp Weapons',     desc: '+20% attack damage',  cost: 3, max: 4 },
  { id: 'towerHp',      label: 'Fortified Tower',   desc: '+100 tower HP',       cost: 3, max: 4 },
  { id: 'outpostHp',    label: 'Reinforced Posts',  desc: '+40 outpost HP',      cost: 4, max: 3 },
  { id: 'startGold',    label: 'Scavenger',         desc: '+30 starting gold',   cost: 2, max: 5 },
  { id: 'outpostRange', label: 'Long Cables',       desc: '+30 outpost range',   cost: 4, max: 3 },
] as const;
export type MetaUpgradeId = typeof META_UPGRADES[number]['id'];

// ─── TOWER UPGRADES ──────────────────────────────────────────────────────────
export const TOWER_UPGRADES = [
  { id: 'hp',    label: 'Tower HP +100',   cost: [50, 80, 120] as number[], max: 3 },
  { id: 'range', label: 'Tower Range +50', cost: [60, 100]     as number[], max: 2 },
  { id: 'aura',  label: 'Aura Damage +10', cost: [70, 110]     as number[], max: 2 },
] as const;
