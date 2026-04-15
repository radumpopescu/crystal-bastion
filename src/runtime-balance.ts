import { balanceConfigStore, computeWeaponLevelStats, defaultBalanceConfig } from './balance-config.ts';

const store = balanceConfigStore;

export let ACTIVE_BALANCE_CONFIG: any = store.getActive();

export let PLAYER_HP_BASE = 0;
export let PLAYER_SPEED = 0;
export let PLAYER_RADIUS = 0;
export let DASH_SPEED = 0;
export let DASH_DURATION = 0;
export let DASH_COOLDOWN = 0;
export let STARTING_DASH_CHARGES = 2;
export let MAX_WEAPON_SLOTS = 0;
export let PLAYER_SPAWN_OFFSET_Y = -70;
export let PLAYER_HIT_FLASH = 0.15;
export let PLAYER_HIT_INVULN = 0.16;
export let PLAYER_DASH_INVULN_BONUS = 0.05;

export let STARTING_GOLD = 0;
export let SHOP_REFRESH_COST = 0;
export let FREE_DEPLOY_GOLD = 0;
export let REROLL_BASE_COST = 0;
export let SHOP_OFFER_COUNT = 4;
export let LEVELUP_OFFER_COUNT = 4;
export let CARD_RARITY_WEIGHTS: any = {};
export let EARLY_START_BONUS: any = {};

export let TOWER_HP_BASE = 0;
export let TOWER_RANGE = 0;
export let TOWER_ATK_RANGE = 0;
export let TOWER_ATK_DMG = 0;
export let TOWER_ATK_SPEED = 0;
export let TOWER_AURA_R = 0;
export let TOWER_AURA_DMG = 0;
export let TOWER_MULTISHOT = 1;

export let OUTPOST_HP_BASE = 0;
export let OUTPOST_RANGE = 0;
export let OUTPOST_ATK_DMG = 0;
export let OUTPOST_ATK_RANGE = 0;
export let OUTPOST_ATK_SPEED = 0;
export let OUTPOST_LEVEL_DAMAGE_MULTIPLIER = 1;
export let OUTPOST_LEVEL_RANGE_ADD = 0;
export let OUTPOST_MAX_LEVEL = 5;
export let OUTPOST_COST = 0;
export let OUTPOST_COST_RULES: any = {};
export let OUTPOST_PLACEMENT: any = {};

export let WAVE_INTERVAL = 0;
export let WAVE_STARTING_DELAY = 0;
export let BASE_MONSTERS = 0;
export let WAVE_CONFIG: any = {};
export let WAVE_SPAWN_CONFIG: any = {};
export let WAVE_CRYSTAL_REWARD: any = {};
export let WAVE_ENEMY_MIX: any = {};
export let MONSTER_ATTACK_COOLDOWN = 0.95;
export let MONSTER_SPAWN_ATTACK_COOLDOWN_MAX = 1.5;
export let MONSTER_CONTACT_BUFFER = 8;
export let STRUCTURE_CONTACT_RADIUS = 22;

export let WEAPONS: Record<string, any> = {};
export let MONSTER_DEF: Record<string, any> = {};
export let STAT_UPGRADES: any[] = [];
export let META_UPGRADES: any[] = [];
export let TOWER_UPGRADES: any[] = [];
export let TOWER_TYPES: Record<string, any> = {};
export let TOWER_PROGRESSION: any = {};
export let RUN_STATS: any = {};
export let INTERMISSION: any = {};
export let ENDLESS: any = {};
export let DIFFICULTY: Record<string, any> = {};
export let CHARACTERS: Record<string, any> = {};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function towerTypeSortValue([id, entry]: [string, any]) {
  return [entry?.slot ?? Number.MAX_SAFE_INTEGER, id] as const;
}

function round(value: number) {
  if (Number.isInteger(value)) return value;
  return Number(value.toFixed(4));
}

function getPlayerBase(config: any) {
  return config.player?.base || defaultBalanceConfig.player.base;
}

function getEconomy(config: any) {
  return config.economy || defaultBalanceConfig.economy;
}

function getBaseCore(config: any) {
  return config.base?.core || defaultBalanceConfig.base.core;
}

function getTowerConfig(config: any) {
  return config.towers?.generic || defaultBalanceConfig.towers.generic;
}

function getWaveConfig(config: any) {
  return config.waves || defaultBalanceConfig.waves;
}

function getTowerTypes(config: any) {
  return config.towerTypes || defaultBalanceConfig.towerTypes || {};
}

export function getTowerTypeIds(config: any) {
  return Object.entries<any>(getTowerTypes(config))
    .sort((a, b) => {
      const [slotA, idA] = towerTypeSortValue(a as [string, any]);
      const [slotB, idB] = towerTypeSortValue(b as [string, any]);
      return slotA - slotB || String(idA).localeCompare(String(idB));
    })
    .map(([id]) => id);
}

export function getTowerTypeDef(config: any, towerTypeId?: string | null) {
  const towerTypes = getTowerTypes(config);
  const orderedIds = getTowerTypeIds(config);
  const fallbackId = orderedIds[0] || 'standard';
  const resolvedId = towerTypeId && towerTypes[towerTypeId] ? towerTypeId : fallbackId;
  const entry = clone(towerTypes[resolvedId] || {});
  return {
    id: resolvedId,
    label: entry.label || resolvedId.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[._-]+/g, ' ').replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
    color: entry.color || '#3498db',
    description: entry.description || '',
    slot: entry.slot ?? 1,
    unlockWave: entry.unlockWave ?? 0,
    costMultiplier: entry.costMultiplier ?? 1,
    hpMultiplier: entry.hpMultiplier ?? 1,
    buildRangeMultiplier: entry.buildRangeMultiplier ?? entry.rangeMultiplier ?? 1,
    attackRangeMultiplier: entry.attackRangeMultiplier ?? entry.rangeMultiplier ?? 1,
    damageMultiplier: entry.damageMultiplier ?? 1,
    attackSpeedMultiplier: entry.attackSpeedMultiplier ?? 1,
    levelDamageMultiplier: entry.levelDamageMultiplier ?? 1,
    levelRangeAddMultiplier: entry.levelRangeAddMultiplier ?? 1,
    maxLevelBonus: entry.maxLevelBonus ?? 0,
    placement: {
      minAnchorDistanceMultiplier: entry.placement?.minAnchorDistanceMultiplier ?? 1,
      connectionFactorMultiplier: entry.placement?.connectionFactorMultiplier ?? 1,
    },
    ...entry,
  };
}

function getTowerProgression(config: any) {
  return config.towerProgression || defaultBalanceConfig.towerProgression || {};
}

function getRunStatsConfig(config: any) {
  return config.runStats || defaultBalanceConfig.runStats || {};
}

function getIntermissionConfig(config: any) {
  return config.intermission || defaultBalanceConfig.intermission || {};
}

function getEndlessConfig(config: any) {
  return config.endless || defaultBalanceConfig.endless || {};
}

function getDifficultyConfig(config: any) {
  return config.difficulty || defaultBalanceConfig.difficulty || {};
}

function getCharacterConfig(config: any) {
  return config.characters || defaultBalanceConfig.characters || {};
}

function getMetaUpgradeDef(config: any, id: string) {
  return config.metaUpgrades?.[id] || null;
}

function getRunCardDef(config: any, id: string) {
  return config.runCards?.statCards?.[id] || null;
}

function getBaseUpgradeDef(config: any, id: string) {
  return config.baseUpgradeShop?.[id] || null;
}

function getMetaLevelValue(def: any, level: number) {
  if (!def) return 0;
  if (level <= 0) return def.baseValue ?? 0;
  const row = (def.levels || []).find((entry: any) => entry.level === level);
  if (row) return row.value;
  const last = (def.levels || [])[def.levels.length - 1];
  return last?.value ?? def.baseValue ?? 0;
}

export function metaValueFromConfig(config: any, meta: any, id: string) {
  const def = getMetaUpgradeDef(config, id);
  if (!def) return 0;
  const lvl = meta?.upgrades?.[id] || 0;
  return getMetaLevelValue(def, lvl);
}

function buildWeapons(config: any) {
  const weapons = clone(config.weapons || {});
  for (const [id, weapon] of Object.entries<any>(weapons)) {
    weapon.id = weapon.id || id;
    weapon.levelBonus = weapon.levelBonus || (weapon.levels || []).map((row: any) => row.bonusText || null);
    weapon.maxLevel = Math.max(1, weapon.levels?.length || 1);
  }
  return weapons;
}

function buildMonsters(config: any) {
  const enemies = clone(config.enemies || {});
  for (const enemy of Object.values<any>(enemies)) {
    enemy.dmg = enemy.damage;
  }
  return enemies;
}

function buildMetaUpgrades(config: any) {
  return Object.values(clone(config.metaUpgrades || {})).map((entry: any) => ({
    id: entry.id,
    label: entry.label,
    desc: entry.description,
    cost: entry.baseCost,
    max: entry.maxLevel,
    cat: entry.category,
    baseValue: entry.baseValue ?? 0,
    levels: entry.levels || [],
    category: entry.category,
  }));
}

function countForMultiplier(current: number, base: number, perStack: number) {
  if (!perStack || perStack === 1) return 0;
  const safeCurrent = current || base;
  if (safeCurrent <= 0 || base <= 0) return 0;
  return Math.round(Math.log(safeCurrent / base) / Math.log(perStack));
}

function getRunCardCount(card: any, player: any, game: any) {
  const tuning = card.tuning || {};
  switch (tuning.effectType) {
    case 'flat_add':
      switch (tuning.stat) {
        case 'player.maxHp': return Math.round(((player.maxHp || 0) - (player._baseMaxHp || player.maxHp || 0)) / (tuning.perStack || 1));
        case 'player.regen': return Math.round((player.regen || 0) / (tuning.perStack || 1));
        case 'player.lifesteal': return Math.round((player.lifesteal || 0) / (tuning.perStack || 1));
        case 'player.speed': return Math.round(((player.speed || 0) - (player._baseSpeed || player.speed || 0)) / (tuning.perStack || 1));
        case 'player.goldFinder': return Math.round((player.goldFinder || 0) / (tuning.perStack || 1));
        case 'player.luck': return Math.round((player.luck || 0) / (tuning.perStack || 1));
        case 'player.maxDashes': return Math.max(0, (player.maxDashes || 0) - (player._baseMaxDashes || 0));
        case 'base.attackRange': return Math.round(((game.tower.atkRange || 0) - (game.tower._baseAtkRange || game.tower.atkRange || 0)) / (tuning.perStack || 1));
        case 'towers.costDiscount': return Math.round((game.outpostDiscount || 0) / (tuning.perStack || 1));
        default: return 0;
      }
    case 'flat_add_clamped':
      return Math.round((player.armor || 0) / (tuning.perStack || 1));
    case 'multiplier':
      switch (tuning.stat) {
        case 'player.damage': return countForMultiplier(player.dmgMult || 1, 1, tuning.perStack || 1);
        case 'player.attackSpeed': return countForMultiplier(player.atkSpdMult || 1, 1, tuning.perStack || 1);
        case 'player.range': return countForMultiplier(player.rangeMult || 1, 1, tuning.perStack || 1);
        case 'base.damage': return countForMultiplier(game.tower.atkDmg || 1, game.tower._baseAtkDmg || game.tower.atkDmg || 1, tuning.perStack || 1);
        case 'base.attackSpeed': return countForMultiplier(game.tower.atkSpeed || 1, game.tower._baseAtkSpeed || game.tower.atkSpeed || 1, tuning.perStack || 1);
        case 'towers.damage': return countForMultiplier(game.opAtkMult || 1, 1, tuning.perStack || 1);
        default: return 0;
      }
    case 'compound':
      return player.dashLevel || 0;
    case 'level_up_all_towers':
      return Math.max(0, (game.outpostLevel || 1) - 1);
    default:
      return 0;
  }
}

function isRunCardAvailable(card: any, player: any, game: any) {
  const tuning = card.tuning || {};
  const count = getRunCardCount(card, player, game);
  if (card.maxStacks != null && count >= card.maxStacks) return false;
  switch (tuning.effectType) {
    case 'flat_add_clamped':
      return (player.armor || 0) < (tuning.clampMax ?? 1);
    case 'instant_restore':
      return game.tower.hp < game.tower.maxHp;
    case 'instant_full_heal':
      return game.outposts.some((op: any) => op.hp < op.maxHp);
    case 'level_up_all_towers':
      return (game.outpostLevel || 1) < (tuning.maxLevel || OUTPOST_MAX_LEVEL);
    case 'flat_add':
      if (tuning.stat === 'towers.costDiscount') {
        const rules = (getTowerConfig(ACTIVE_BALANCE_CONFIG).cost || {});
        return Math.max((rules.minimum ?? 10), (rules.base ?? 0) - (game.outpostDiscount || 0)) > (rules.minimum ?? 10);
      }
      return true;
    default:
      return true;
  }
}

function applyRunCardEffect(card: any, player: any, game: any) {
  const tuning = card.tuning || {};
  switch (tuning.effectType) {
    case 'flat_add':
      switch (tuning.stat) {
        case 'player.maxHp':
          player.maxHp += tuning.perStack;
          player.hp = Math.min(player.hp + tuning.perStack, player.maxHp);
          break;
        case 'player.regen': player.regen = (player.regen || 0) + tuning.perStack; break;
        case 'player.lifesteal': player.lifesteal = (player.lifesteal || 0) + tuning.perStack; break;
        case 'player.speed': player.speed += tuning.perStack; break;
        case 'player.goldFinder': player.goldFinder = (player.goldFinder || 0) + tuning.perStack; break;
        case 'player.luck': player.luck = (player.luck || 0) + tuning.perStack; break;
        case 'player.maxDashes':
          player.maxDashes = (player.maxDashes || 0) + tuning.perStack;
          player.dashes = Math.min((player.dashes || 0) + tuning.perStack, player.maxDashes);
          break;
        case 'base.attackRange':
          game.tower.atkRange += tuning.perStack;
          break;
        case 'towers.costDiscount':
          game.outpostDiscount = (game.outpostDiscount || 0) + tuning.perStack;
          break;
      }
      break;
    case 'flat_add_clamped':
      player.armor = Math.min(tuning.clampMax ?? 1, (player.armor || 0) + tuning.perStack);
      break;
    case 'multiplier':
      switch (tuning.stat) {
        case 'player.damage': player.dmgMult = (player.dmgMult || 1) * tuning.perStack; break;
        case 'player.attackSpeed': player.atkSpdMult = (player.atkSpdMult || 1) * tuning.perStack; break;
        case 'player.range': player.rangeMult = (player.rangeMult || 1) * tuning.perStack; break;
        case 'base.damage': game.tower.atkDmg = round((game.tower.atkDmg || 1) * tuning.perStack); break;
        case 'base.attackSpeed': game.tower.atkSpeed = round((game.tower.atkSpeed || 1) * tuning.perStack); break;
        case 'towers.damage':
          game.opAtkMult = round((game.opAtkMult || 1) * tuning.perStack);
          for (const op of game.outposts) op.atkDmg = round((op.atkDmg || 1) * tuning.perStack);
          break;
      }
      break;
    case 'compound':
      player.dashLevel = (player.dashLevel || 0) + (tuning.values?.levelPerStack || 1);
      player.dashSpeed = round((player.dashSpeed || DASH_SPEED) * (tuning.values?.dashSpeedMultiplier || 1));
      player.dashDuration = round((player.dashDuration || DASH_DURATION) * (tuning.values?.dashDurationMultiplier || 1));
      break;
    case 'instant_restore':
      game.tower.hp = Math.min(game.tower.maxHp, game.tower.hp + (tuning.amount || 0));
      break;
    case 'instant_full_heal':
      for (const op of game.outposts) op.hp = op.maxHp;
      break;
    case 'level_up_all_towers': {
      const maxLevel = tuning.maxLevel || OUTPOST_MAX_LEVEL;
      const nextLevel = Math.min((game.outpostLevel || 1) + (tuning.perStack || 1), maxLevel);
      game.outpostLevel = nextLevel;
      for (const op of game.outposts) {
        const stats = getOutpostStatsForLevel(ACTIVE_BALANCE_CONFIG, nextLevel, game.opAtkMult || 1, game.opRangeBonus || 0, game.opHpBonus || 0, op.towerType || game.selectedTowerType);
        op.maxHp = stats.maxHp;
        op.range = stats.range;
        op.atkDmg = stats.atkDmg;
        op.atkRange = stats.atkRange;
        op.atkSpeed = stats.atkSpeed;
        op.towerType = stats.towerTypeId;
        op.towerLabel = stats.label;
        op.color = stats.color;
      }
      break;
    }
  }
}

function buildStatUpgrades(config: any) {
  return Object.values(clone(config.runCards?.statCards || {})).map((card: any) => ({
    id: card.id,
    icon: card.icon,
    name: card.name,
    desc: card.description,
    rarity: card.rarity,
    max: card.maxStacks,
    tuning: card.tuning,
    apply: (p: any, g: any) => applyRunCardEffect(card, p, g),
    count: (p: any, g: any) => getRunCardCount(card, p, g),
    available: (p: any, g: any) => isRunCardAvailable(card, p, g),
  }));
}

function buildTowerUpgrades(config: any) {
  return Object.values(clone(config.baseUpgradeShop || {})).map((entry: any) => ({
    id: entry.id,
    label: entry.label,
    cost: entry.costs,
    max: entry.maxLevel,
    effect: entry.effect,
  }));
}

function buildWaveEnemyMix(config: any) {
  return clone(config.waves?.enemyMix || {
    rusher: { startWave: 1, chance: 0.28 },
    brute: { startWave: 3, chance: 0.18 },
    tank: { startWave: 6, chance: 0.09 },
  });
}

export function buildRuntimeBalance(config: any) {
  const player = getPlayerBase(config);
  const economy = getEconomy(config);
  const baseCore = getBaseCore(config);
  const tower = getTowerConfig(config);
  const waves = getWaveConfig(config);
  const towerTypes = getTowerTypes(config);
  const towerProgression = getTowerProgression(config);
  const runStats = getRunStatsConfig(config);
  const intermission = getIntermissionConfig(config);
  const endless = getEndlessConfig(config);
  const difficulty = getDifficultyConfig(config);
  const characters = getCharacterConfig(config);

  return {
    PLAYER_HP_BASE: player.hp,
    PLAYER_SPEED: player.speed,
    PLAYER_RADIUS: player.radius,
    DASH_SPEED: player.dashSpeed,
    DASH_DURATION: player.dashDuration,
    DASH_COOLDOWN: player.dashCooldown,
    STARTING_DASH_CHARGES: player.startingDashCharges ?? 2,
    MAX_WEAPON_SLOTS: player.maxWeaponSlots,
    PLAYER_SPAWN_OFFSET_Y: player.spawnOffsetY ?? -70,
    PLAYER_HIT_FLASH: player.hitFlashDuration ?? 0.15,
    PLAYER_HIT_INVULN: player.hitInvulnerability ?? 0.16,
    PLAYER_DASH_INVULN_BONUS: player.dashInvulnerabilityBonus ?? 0.05,
    STARTING_GOLD: economy.startingGold,
    SHOP_REFRESH_COST: economy.shopRefreshCost,
    FREE_DEPLOY_GOLD: economy.freeDeployGold,
    REROLL_BASE_COST: economy.rerollBaseCost,
    SHOP_OFFER_COUNT: economy.shopOfferCount ?? 4,
    LEVELUP_OFFER_COUNT: economy.levelupOfferCount ?? 4,
    CARD_RARITY_WEIGHTS: clone(economy.rarityWeights || { commonBase: 4, uncommonBase: 2, rareBase: 1, uncommonPerLuckHalf: 1, rarePerLuck: 1, commonLuckPenaltyPerPoint: 1 }),
    EARLY_START_BONUS: clone(economy.earlyStartBonus),
    TOWER_HP_BASE: baseCore.hp,
    TOWER_RANGE: baseCore.buildRange,
    TOWER_ATK_RANGE: baseCore.attackRange,
    TOWER_ATK_DMG: baseCore.damage,
    TOWER_ATK_SPEED: baseCore.attackSpeed,
    TOWER_AURA_R: baseCore.auraRadius,
    TOWER_AURA_DMG: baseCore.auraDamage,
    TOWER_MULTISHOT: baseCore.multishot,
    OUTPOST_HP_BASE: tower.hp,
    OUTPOST_RANGE: tower.buildRange,
    OUTPOST_ATK_DMG: tower.damage,
    OUTPOST_ATK_RANGE: tower.attackRange,
    OUTPOST_ATK_SPEED: tower.attackSpeed,
    OUTPOST_LEVEL_DAMAGE_MULTIPLIER: tower.levelDamageMultiplier,
    OUTPOST_LEVEL_RANGE_ADD: tower.levelRangeAdd,
    OUTPOST_MAX_LEVEL: tower.maxLevel ?? 5,
    OUTPOST_COST: tower.cost?.base ?? 55,
    OUTPOST_COST_RULES: clone(tower.cost || {}),
    OUTPOST_PLACEMENT: clone(tower.placement || {}),
    WAVE_INTERVAL: waves.interval,
    WAVE_STARTING_DELAY: waves.startingDelay,
    BASE_MONSTERS: waves.baseMonsters,
    WAVE_CONFIG: clone(waves),
    WAVE_SPAWN_CONFIG: clone(waves.spawn || {}),
    WAVE_CRYSTAL_REWARD: clone(waves.crystalReward || {}),
    WAVE_ENEMY_MIX: buildWaveEnemyMix(config),
    MONSTER_ATTACK_COOLDOWN: waves.attackCooldown ?? 0.95,
    MONSTER_SPAWN_ATTACK_COOLDOWN_MAX: waves.initialAttackCooldownMax ?? 1.5,
    MONSTER_CONTACT_BUFFER: waves.monsterContactBuffer ?? 8,
    STRUCTURE_CONTACT_RADIUS: waves.structureContactRadius ?? 22,
    WEAPONS: buildWeapons(config),
    MONSTER_DEF: buildMonsters(config),
    STAT_UPGRADES: buildStatUpgrades(config),
    META_UPGRADES: buildMetaUpgrades(config),
    TOWER_UPGRADES: buildTowerUpgrades(config),
    TOWER_TYPES: clone(towerTypes),
    TOWER_PROGRESSION: clone(towerProgression),
    RUN_STATS: clone(runStats),
    INTERMISSION: clone(intermission),
    ENDLESS: clone(endless),
    DIFFICULTY: clone(difficulty),
    CHARACTERS: clone(characters),
  };
}

function assignRuntimeBalance(runtime: any) {
  ({
    PLAYER_HP_BASE,
    PLAYER_SPEED,
    PLAYER_RADIUS,
    DASH_SPEED,
    DASH_DURATION,
    DASH_COOLDOWN,
    STARTING_DASH_CHARGES,
    MAX_WEAPON_SLOTS,
    PLAYER_SPAWN_OFFSET_Y,
    PLAYER_HIT_FLASH,
    PLAYER_HIT_INVULN,
    PLAYER_DASH_INVULN_BONUS,
    STARTING_GOLD,
    SHOP_REFRESH_COST,
    FREE_DEPLOY_GOLD,
    REROLL_BASE_COST,
    SHOP_OFFER_COUNT,
    LEVELUP_OFFER_COUNT,
    CARD_RARITY_WEIGHTS,
    EARLY_START_BONUS,
    TOWER_HP_BASE,
    TOWER_RANGE,
    TOWER_ATK_RANGE,
    TOWER_ATK_DMG,
    TOWER_ATK_SPEED,
    TOWER_AURA_R,
    TOWER_AURA_DMG,
    TOWER_MULTISHOT,
    OUTPOST_HP_BASE,
    OUTPOST_RANGE,
    OUTPOST_ATK_DMG,
    OUTPOST_ATK_RANGE,
    OUTPOST_ATK_SPEED,
    OUTPOST_LEVEL_DAMAGE_MULTIPLIER,
    OUTPOST_LEVEL_RANGE_ADD,
    OUTPOST_MAX_LEVEL,
    OUTPOST_COST,
    OUTPOST_COST_RULES,
    OUTPOST_PLACEMENT,
    WAVE_INTERVAL,
    WAVE_STARTING_DELAY,
    BASE_MONSTERS,
    WAVE_CONFIG,
    WAVE_SPAWN_CONFIG,
    WAVE_CRYSTAL_REWARD,
    WAVE_ENEMY_MIX,
    MONSTER_ATTACK_COOLDOWN,
    MONSTER_SPAWN_ATTACK_COOLDOWN_MAX,
    MONSTER_CONTACT_BUFFER,
    STRUCTURE_CONTACT_RADIUS,
    WEAPONS,
    MONSTER_DEF,
    STAT_UPGRADES,
    META_UPGRADES,
    TOWER_UPGRADES,
    TOWER_TYPES,
    TOWER_PROGRESSION,
    RUN_STATS,
    INTERMISSION,
    ENDLESS,
    DIFFICULTY,
    CHARACTERS,
  } = runtime);
}

export function applyRuntimeBalance(config = store.getActive()) {
  ACTIVE_BALANCE_CONFIG = clone(config);
  assignRuntimeBalance(buildRuntimeBalance(ACTIVE_BALANCE_CONFIG));
  return ACTIVE_BALANCE_CONFIG;
}

export function getWeaponMaxLevel(weaponId: string) {
  return WEAPONS[weaponId]?.maxLevel || WEAPONS[weaponId]?.levels?.length || 1;
}

export function getWeaponStats(weaponId: string, level: number) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return null;
  return computeWeaponLevelStats(weapon, level);
}

export function getOutpostStatsForLevel(config: any, level: number, opAtkMult = 1, opRangeBonus = 0, opHpBonus = 0, towerTypeId?: string | null) {
  const tower = getTowerConfig(config);
  const progression = getTowerProgression(config);
  const towerType = getTowerTypeDef(config, towerTypeId);
  const effectiveLevel = Math.max(1, level || 1);
  const levelDamageMultiplier = (tower.levelDamageMultiplier ?? progression.levelDamageMultiplier ?? 1) * (towerType.levelDamageMultiplier ?? 1);
  const levelRangeAdd = (tower.levelRangeAdd ?? progression.levelRangeAdd ?? 0) * (towerType.levelRangeAddMultiplier ?? 1);
  return {
    towerTypeId: towerType.id,
    label: towerType.label,
    color: towerType.color,
    maxLevel: (tower.maxLevel ?? progression.baseMaxLevel ?? 5) + (towerType.maxLevelBonus ?? 0),
    maxHp: round((tower.hp || 0) * (towerType.hpMultiplier ?? 1) + opHpBonus),
    range: round((tower.buildRange || 0) * (towerType.buildRangeMultiplier ?? 1) + opRangeBonus),
    atkDmg: round((tower.damage || 0) * (towerType.damageMultiplier ?? 1) * Math.pow(levelDamageMultiplier || 1, Math.max(0, effectiveLevel - 1)) * opAtkMult),
    atkRange: round((tower.attackRange || 0) * (towerType.attackRangeMultiplier ?? 1) + levelRangeAdd * Math.max(0, effectiveLevel - 1)),
    atkSpeed: round((tower.attackSpeed || 0) * (towerType.attackSpeedMultiplier ?? 1)),
  };
}

export function computeOutpostCost(config: any, game: any, towerTypeId?: string | null) {
  const rules = getTowerConfig(config).cost || {};
  const towerType = getTowerTypeDef(config, towerTypeId || game?.selectedTowerType);
  const built = game?.outposts?.length || 0;
  const wave = game?.wave || 0;
  const discount = game?.outpostDiscount || 0;
  const scaledBase = Math.round((rules.base ?? 0) * (towerType.costMultiplier ?? 1));
  const base = scaledBase - discount;
  const latePenalty = Math.max(0, wave - (rules.lateWaveStart ?? 0)) * (rules.lateWaveStep ?? 0);
  return Math.max(rules.minimum ?? 0, Math.round(base + built * (rules.perBuilt ?? 0) + latePenalty));
}

export function computeRerollBaseCost(config: any, meta: any) {
  return Math.max(1, (getEconomy(config).rerollBaseCost || 0) - (metaValueFromConfig(config, meta, 'rerolls') || 0));
}

export function computeCardGoldCost(config: any, card: any, wave: number, shopDiscount = 0) {
  const economy = getEconomy(config);
  const rarityBase = economy.cardCost?.[card.rarity] ?? economy.cardCost?.common ?? 0;
  const waveMult = 1 + Math.max(0, wave - 1) * (economy.cardCost?.waveScale ?? 0);
  const isUpgrade = card.type === 'weapon' && (card.newLevel || 1) > 1;
  const discountMult = isUpgrade ? (economy.cardCost?.weaponUpgradeDiscountMultiplier ?? 1) : 1;
  return Math.max(1, Math.round(rarityBase * discountMult * waveMult) - shopDiscount);
}

export function computeEarlyStartBonus(config: any, wave: number, waveTimer: number, earlyBonusMult = 1) {
  const tuning = getEconomy(config).earlyStartBonus || {};
  const raw = Math.round((tuning.base ?? 0) + wave * (tuning.waveScale ?? 0) * Math.max(0, waveTimer));
  return Math.max(tuning.minimum ?? 0, Math.round(raw * earlyBonusMult));
}

export function buildInitialGameState(config: any, meta: any, opts: any = {}) {
  const player = getPlayerBase(config);
  const economy = getEconomy(config);
  const baseCore = getBaseCore(config);
  const towerTypeIds = getTowerTypeIds(config);
  const selectedTowerType = getTowerTypeDef(config, opts.selectedTowerType).id;
  const freeOutposts = metaValueFromConfig(config, meta, 'freeDeploy');
  const startGoldMeta = metaValueFromConfig(config, meta, 'startGold');
  const playerHpBonus = metaValueFromConfig(config, meta, 'playerHp');
  const towerHpBonus = metaValueFromConfig(config, meta, 'towerHp');
  const towerAtkMult = metaValueFromConfig(config, meta, 'towerAtk') || 1;
  const towerRangeBonus = metaValueFromConfig(config, meta, 'towerRange') || 0;
  const towerSpdMult = metaValueFromConfig(config, meta, 'towerAtkSpd') || 1;
  const towerAuraMult = metaValueFromConfig(config, meta, 'towerAura') || 1;
  const opHpBonus = metaValueFromConfig(config, meta, 'outpostHp') || 0;
  const opAtkMult = metaValueFromConfig(config, meta, 'outpostAtk') || 1;
  const opRangeBonus = metaValueFromConfig(config, meta, 'outpostRange') || 0;
  const baseDashCharges = (player.startingDashCharges ?? STARTING_DASH_CHARGES) + (metaValueFromConfig(config, meta, 'extraDash') || 0);
  const startWeapons = Array.isArray(opts.startWeapons)
    ? opts.startWeapons.filter((w: any) => w?.id && WEAPONS[w.id]).map((w: any) => ({ id: w.id, level: Math.max(1, Math.min(getWeaponMaxLevel(w.id), w.level || 1)), cooldown: 0, spinup: 0 }))
    : (() => {
        const defaults = (player.startWeapons || ['pistol']).map((id: string) => ({ id, level: 1, cooldown: 0, spinup: 0 }));
        if ((metaValueFromConfig(config, meta, 'startWpn') || 0) > 0 && !defaults.some((weapon: any) => weapon.id === 'rifle') && WEAPONS.rifle) defaults.push({ id: 'rifle', level: 1, cooldown: 0, spinup: 0 });
        return defaults;
      })();

  const gold = (opts.startGold ?? (economy.startingGold + startGoldMeta)) + (opts.startGold == null ? freeOutposts * economy.freeDeployGold : 0);
  return {
    tick: 0,
    wave: 0,
    waveTimer: getWaveConfig(config).startingDelay,
    waveActive: false,
    monstersLeft: 0,
    gold,
    crystalsEarned: 0,
    waveDelayBonus: metaValueFromConfig(config, meta, 'waveDelay') || 0,
    earlyBonusMult: 1 + (metaValueFromConfig(config, meta, 'earlyBonus') || 0),
    outpostDiscount: metaValueFromConfig(config, meta, 'outpostCheap') || 0,
    shopDiscount: metaValueFromConfig(config, meta, 'shopDiscount') || 0,
    freeOutpost: freeOutposts,
    selectedTowerType,
    availableTowerTypes: towerTypeIds,
    tower: {
      x: 0,
      y: 0,
      hp: baseCore.hp + towerHpBonus,
      maxHp: baseCore.hp + towerHpBonus,
      range: baseCore.buildRange,
      auraR: baseCore.auraRadius,
      auraDmg: round(baseCore.auraDamage * towerAuraMult),
      atkRange: baseCore.attackRange + towerRangeBonus,
      atkDmg: round(baseCore.damage * towerAtkMult),
      atkSpeed: round(baseCore.attackSpeed * towerSpdMult),
      atkCooldown: 0,
      multishot: baseCore.multishot,
      upgrades: { hp: 0, range: 0, dmg: 0, multishot: 0 },
      _baseAtkDmg: round(baseCore.damage * towerAtkMult),
      _baseAtkRange: baseCore.attackRange + towerRangeBonus,
      _baseAtkSpeed: round(baseCore.attackSpeed * towerSpdMult),
    },
    player: {
      x: 0,
      y: player.spawnOffsetY ?? -70,
      hp: player.hp + playerHpBonus,
      maxHp: player.hp + playerHpBonus,
      _baseMaxHp: player.hp + playerHpBonus,
      _baseSpeed: player.speed + (metaValueFromConfig(config, meta, 'playerSpeed') || 0),
      speed: player.speed + (metaValueFromConfig(config, meta, 'playerSpeed') || 0),
      dmgMult: metaValueFromConfig(config, meta, 'playerDmg') || 1,
      atkSpdMult: 1,
      rangeMult: 1,
      armor: metaValueFromConfig(config, meta, 'playerArmor') || 0,
      lifesteal: 0,
      regen: metaValueFromConfig(config, meta, 'playerRegen') || 0,
      luck: 0,
      goldFinder: 0,
      maxDashes: baseDashCharges,
      dashes: baseDashCharges,
      _baseMaxDashes: baseDashCharges,
      dashLevel: 0,
      dashSpeed: player.dashSpeed,
      dashDuration: player.dashDuration,
      dashCooldown: 0,
      dashing: false,
      dashTimer: 0,
      dashVx: 0,
      dashVy: 0,
      weapons: startWeapons,
      invincible: 0,
      flashTimer: 0,
      dead: false,
      facing: { x: 1, y: 0 },
    },
    outpostLevel: 1,
    killStats: { player: 0, base: 0, tower: 0 },
    outposts: [],
    opHpBonus,
    opAtkMult,
    opRangeBonus,
    monsters: [],
    projectiles: [],
    particles: [],
    dmgNumbers: [],
    levelUpCards: null,
    rerollsLeft: 1 + (metaValueFromConfig(config, meta, 'rerolls') || 0),
    shopCards: null,
    shopRefreshCost: economy.shopRefreshCost,
    maxWeaponSlots: player.maxWeaponSlots + (metaValueFromConfig(config, meta, 'startSlot') || 0),
    keys: {},
    touchMove: { x: 0, y: 0 },
    runCardCounts: {},
    runCardOrder: [],
    devSession: !!opts.devSession,
  };
}

applyRuntimeBalance(ACTIVE_BALANCE_CONFIG);

if (typeof window !== 'undefined') {
  window.addEventListener('crystal-bastion:balance-config-applied', (event: any) => {
    applyRuntimeBalance(event?.detail?.config || store.getActive());
  });
}
