import test from 'node:test';
import assert from 'node:assert/strict';

import { deepMergeBalanceConfig, defaultBalanceConfig } from '../src/balance-config.ts';
import {
  buildRuntimeBalance,
  buildInitialGameState,
  computeCardGoldCost,
  computeEarlyStartBonus,
  computeOutpostCost,
  computeRerollBaseCost,
  getOutpostStatsForLevel,
  getTowerTypeDef,
  getTowerTypeIds,
  getUnlockedTowerTypeIds,
  metaValueFromConfig,
} from '../src/runtime-balance.ts';

test('tower selection helpers expose ordered ids and unlock filtering by wave', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    towerTypes: {
      standard: { slot: 1, label: 'Standard', unlockWave: 0 },
      burst: { slot: 2, label: 'Burst', unlockWave: 0 },
      support: { slot: 3, label: 'Support', unlockWave: 3 },
      sniper: { slot: 4, label: 'Sniper', unlockWave: 6 },
    },
  });

  assert.deepEqual(getTowerTypeIds(config), ['standard', 'burst', 'support', 'sniper']);
  assert.deepEqual(getUnlockedTowerTypeIds(config, 0), ['standard', 'burst']);
  assert.deepEqual(getUnlockedTowerTypeIds(config, 3), ['standard', 'burst', 'support']);
  assert.deepEqual(getUnlockedTowerTypeIds(config, 7), ['standard', 'burst', 'support', 'sniper']);
});

test('typed tower definitions drive per-type tower stats, ordering, and cost multipliers', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    towers: {
      generic: {
        hp: 100,
        buildRange: 550,
        damage: 20,
        attackRange: 240,
        attackSpeed: 0.85,
        levelDamageMultiplier: 1.28,
        levelRangeAdd: 18,
        cost: {
          base: 55,
          minimum: 10,
          perBuilt: 5,
          lateWaveStart: 8,
          lateWaveStep: 2,
        },
      },
    },
    towerTypes: {
      standard: {
        slot: 1,
        label: 'Standard',
        color: '#3498db',
        unlockWave: 0,
        costMultiplier: 1,
        hpMultiplier: 1,
        buildRangeMultiplier: 1,
        attackRangeMultiplier: 1,
        damageMultiplier: 1,
        attackSpeedMultiplier: 1,
        levelDamageMultiplier: 1,
        levelRangeAddMultiplier: 1,
      },
      burst: {
        slot: 2,
        label: 'Burst',
        color: '#e67e22',
        unlockWave: 0,
        costMultiplier: 1.2,
        hpMultiplier: 0.9,
        buildRangeMultiplier: 0.95,
        attackRangeMultiplier: 0.85,
        damageMultiplier: 1.35,
        attackSpeedMultiplier: 1.25,
        levelDamageMultiplier: 1.1,
        levelRangeAddMultiplier: 0.8,
      },
      support: {
        slot: 3,
        label: 'Support',
        color: '#2ecc71',
        unlockWave: 0,
        costMultiplier: 0.95,
        hpMultiplier: 1.05,
        buildRangeMultiplier: 1.15,
        attackRangeMultiplier: 1.2,
        damageMultiplier: 0.85,
        attackSpeedMultiplier: 0.9,
        levelDamageMultiplier: 0.95,
        levelRangeAddMultiplier: 1.35,
      },
    },
  });

  assert.deepEqual(getTowerTypeIds(config), ['standard', 'burst', 'support']);
  assert.equal(getTowerTypeDef(config, 'burst').label, 'Burst');
  assert.equal(getTowerTypeDef(config, 'missing').label, 'Standard');

  const burstStats = getOutpostStatsForLevel(config, 3, 1.1, 15, 8, 'burst');
  assert.equal(burstStats.maxHp, 98);
  assert.equal(burstStats.range, 537.5);
  assert.equal(burstStats.atkDmg, 58.8792);
  assert.equal(burstStats.atkRange, 232.8);
  assert.equal(burstStats.atkSpeed, 1.0625);
  assert.equal(computeOutpostCost(config, { outposts: [1, 2], wave: 8, outpostDiscount: 4 }, 'burst'), 72);
});

test('buildRuntimeBalance maps authoritative config domains into runtime registries', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    player: { base: { hp: 137, speed: 321 } },
    economy: { startingGold: 47, shopRefreshCost: 29 },
    base: { core: { damage: 31 } },
    towers: { generic: { damage: 23 } },
    waves: { interval: 44, baseMonsters: 9 },
    enemies: { grunt: { hp: 91 } },
    runCards: { statCards: { damage: { tuning: { perStack: 1.5 } } } },
    metaUpgrades: { playerHp: { levels: [{ level: 1, cost: 6, value: 222 }] } },
    baseUpgradeShop: { hp: { costs: [999, 1000, 1001, 1002, 1003] } },
    towerTypes: {
      sniper: { unlockWave: 5, costMultiplier: 1.8 },
    },
    towerProgression: {
      sharedLevelCards: { bonusLevelsPerPick: 2 },
    },
    runStats: {
      repair: { basePerSecond: 0.75, maxPerSecond: 6 },
    },
    intermission: {
      towerRefresh: { healPercent: 0.4 },
    },
    endless: {
      unlockWave: 16,
      enemyHpScalePerEndlessWave: 0.2,
    },
    difficulty: {
      veteran: { enemyHpMultiplier: 1.4 },
    },
    characters: {
      engineer: { baseHpMultiplier: 1.15, unlockCost: 25 },
    },
  });

  const runtime = buildRuntimeBalance(config);

  assert.equal(runtime.PLAYER_HP_BASE, 137);
  assert.equal(runtime.PLAYER_SPEED, 321);
  assert.equal(runtime.STARTING_GOLD, 47);
  assert.equal(runtime.SHOP_REFRESH_COST, 29);
  assert.equal(runtime.TOWER_ATK_DMG, 31);
  assert.equal(runtime.OUTPOST_ATK_DMG, 23);
  assert.equal(runtime.WAVE_INTERVAL, 44);
  assert.equal(runtime.BASE_MONSTERS, 9);
  assert.equal(runtime.MONSTER_DEF.grunt.hp, 91);
  assert.equal(runtime.STAT_UPGRADES.find((entry) => entry.id === 'damage').tuning.perStack, 1.5);
  assert.equal(runtime.META_UPGRADES.find((entry) => entry.id === 'playerHp').levels[0].value, 222);
  assert.equal(runtime.TOWER_UPGRADES.find((entry) => entry.id === 'hp').cost[0], 999);
  assert.equal(runtime.TOWER_TYPES.sniper.unlockWave, 5);
  assert.equal(runtime.TOWER_PROGRESSION.sharedLevelCards.bonusLevelsPerPick, 2);
  assert.equal(runtime.RUN_STATS.repair.basePerSecond, 0.75);
  assert.equal(runtime.INTERMISSION.towerRefresh.healPercent, 0.4);
  assert.equal(runtime.ENDLESS.unlockWave, 16);
  assert.equal(runtime.DIFFICULTY.veteran.enemyHpMultiplier, 1.4);
  assert.equal(runtime.CHARACTERS.engineer.baseHpMultiplier, 1.15);
});

test('metaValueFromConfig reads config-defined level values including multiplier defaults', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    metaUpgrades: {
      playerHp: {
        baseValue: 0,
        levels: [
          { level: 1, cost: 6, value: 25 },
          { level: 2, cost: 6, value: 50 },
        ],
      },
      towerAtk: {
        baseValue: 1,
        levels: [
          { level: 1, cost: 10, value: 1.4 },
          { level: 2, cost: 10, value: 1.9 },
        ],
      },
    },
  });

  assert.equal(metaValueFromConfig(config, { upgrades: {} }, 'playerHp'), 0);
  assert.equal(metaValueFromConfig(config, { upgrades: { playerHp: 2 } }, 'playerHp'), 50);
  assert.equal(metaValueFromConfig(config, { upgrades: {} }, 'towerAtk'), 1);
  assert.equal(metaValueFromConfig(config, { upgrades: { towerAtk: 2 } }, 'towerAtk'), 1.9);
});

test('buildInitialGameState uses config for player, economy, base, towers, and meta upgrades', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    player: { base: { hp: 140, speed: 300, maxWeaponSlots: 7, startingDashCharges: 3, spawnOffsetY: -120 } },
    economy: { startingGold: 55, shopRefreshCost: 27, freeDeployGold: 40 },
    base: { core: { hp: 650, buildRange: 710, attackRange: 330, damage: 35, attackSpeed: 1.1, auraRadius: 150, auraDamage: 5, multishot: 2 } },
    towers: { generic: { hp: 120, buildRange: 580, damage: 24, attackRange: 255, attackSpeed: 0.95 } },
    metaUpgrades: {
      playerHp: { baseValue: 0, levels: [{ level: 1, cost: 6, value: 25 }] },
      startGold: { baseValue: 0, levels: [{ level: 1, cost: 5, value: 11 }] },
      freeDeploy: { baseValue: 0, levels: [{ level: 1, cost: 15, value: 2 }] },
      startSlot: { baseValue: 0, levels: [{ level: 1, cost: 18, value: 1 }] },
      towerAtk: { baseValue: 1, levels: [{ level: 1, cost: 10, value: 1.5 }] },
      towerRange: { baseValue: 0, levels: [{ level: 1, cost: 9, value: 80 }] },
    },
  });

  const game = buildInitialGameState(config, { upgrades: { playerHp: 1, startGold: 1, freeDeploy: 1, startSlot: 1, towerAtk: 1, towerRange: 1 } }, {});

  assert.equal(game.selectedTowerType, 'standard');
  assert.deepEqual(game.availableTowerTypes, ['standard', 'burst', 'support']);
  assert.equal(game.gold, 146);
  assert.equal(game.player.hp, 165);
  assert.equal(game.player.maxHp, 165);
  assert.equal(game.player.y, -120);
  assert.equal(game.player.maxDashes, 3);
  assert.equal(game.maxWeaponSlots, 8);
  assert.equal(game.shopRefreshCost, 27);
  assert.equal(game.tower.maxHp, 650);
  assert.equal(game.tower.range, 710);
  assert.equal(game.tower.atkRange, 410);
  assert.equal(game.tower.atkDmg, 52.5);
  assert.equal(game.tower.multishot, 2);
  assert.equal(game.opHpBonus, 0);
  assert.equal(game.outpostDiscount, 0);
});

test('economy helpers use config-defined values', () => {
  const config = deepMergeBalanceConfig(defaultBalanceConfig, {
    economy: {
      rerollBaseCost: 6,
      cardCost: {
        common: 20,
        uncommon: 30,
        rare: 50,
        weaponUpgradeDiscountMultiplier: 0.5,
        waveScale: 0.1,
      },
      earlyStartBonus: {
        base: 10,
        minimum: 4,
        waveScale: 0.25,
      },
    },
    towers: {
      generic: {
        cost: {
          base: 70,
          minimum: 12,
          perBuilt: 7,
          lateWaveStart: 5,
          lateWaveStep: 3,
        },
      },
    },
    metaUpgrades: {
      rerolls: { baseValue: 0, levels: [{ level: 1, cost: 10, value: 2 }] },
    },
  });

  assert.equal(computeRerollBaseCost(config, { upgrades: { rerolls: 1 } }), 4);
  assert.equal(computeCardGoldCost(config, { rarity: 'rare', type: 'weapon', newLevel: 2 }, 4, 5), 28);
  assert.equal(computeCardGoldCost(config, { rarity: 'common', type: 'stat' }, 4, 5), 21);
  assert.equal(computeEarlyStartBonus(config, 3, 8, 5), 80);
  assert.equal(computeOutpostCost(config, { outposts: [1, 2], wave: 8, outpostDiscount: 4 }), 89);
});
