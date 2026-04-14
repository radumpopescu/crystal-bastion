import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeWeaponLevelStats,
  createBalanceConfigStore,
  deepMergeBalanceConfig,
  defaultBalanceConfig,
  summarizeWeaponLevelPreviewRows,
} from '../src/balance-config.ts';

test('deepMergeBalanceConfig overlays nested numeric values without dropping siblings', () => {
  const merged = deepMergeBalanceConfig(defaultBalanceConfig, {
    player: {
      base: {
        hp: 133,
      },
    },
    towers: {
      generic: {
        damage: 77,
      },
    },
  });

  assert.equal(merged.player.base.hp, 133);
  assert.equal(merged.player.base.speed, defaultBalanceConfig.player.base.speed);
  assert.equal(merged.towers.generic.damage, 77);
  assert.equal(merged.towers.generic.range, defaultBalanceConfig.towers.generic.range);
});

test('balance config store persists override and can clear it back to defaults', () => {
  const storage = new Map();
  const store = createBalanceConfigStore({
    storage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  });

  store.setOverride({
    enemies: {
      grunt: {
        hp: 91,
      },
    },
  });

  assert.equal(store.getActive().enemies.grunt.hp, 91);
  assert.match(String(storage.get(store.storageKey)), /"hp":91/);

  store.clearOverride();

  assert.equal(store.getActive().enemies.grunt.hp, defaultBalanceConfig.enemies.grunt.hp);
  assert.equal(storage.has(store.storageKey), false);
});

test('weapon preview rows compute final values from base stats and per-level modifiers', () => {
  const pistol = defaultBalanceConfig.weapons.pistol;
  const shotgun = defaultBalanceConfig.weapons.shotgun;

  assert.deepEqual(computeWeaponLevelStats(pistol, 1), {
    level: 1,
    cost: null,
    dmg: 22,
    range: 240,
    rate: 1.2,
    projSpeed: 420,
    projSize: 5,
    pellets: null,
    spread: null,
    blastR: null,
    chains: null,
    arcAngle: null,
    maxRate: null,
    spinup: null,
    bonusText: pistol.levels[0].bonusText,
  });

  assert.deepEqual(computeWeaponLevelStats(pistol, 4), {
    level: 4,
    cost: null,
    dmg: 55.69,
    range: 336,
    rate: 1.56,
    projSpeed: 420,
    projSize: 5,
    pellets: null,
    spread: null,
    blastR: null,
    chains: null,
    arcAngle: null,
    maxRate: null,
    spinup: null,
    bonusText: pistol.levels[3].bonusText,
  });

  assert.equal(computeWeaponLevelStats(shotgun, 4).pellets, 10);
});

test('weapon preview rows summarize all levels for editor tables', () => {
  const rows = summarizeWeaponLevelPreviewRows(defaultBalanceConfig.weapons.rifle);

  assert.equal(rows.length, 4);
  assert.equal(rows[0].level, 1);
  assert.equal(rows[1].rate, 4.9);
  assert.equal(rows[2].dmg, 21.94);
  assert.equal(rows[3].rate, 7.35);
});

test('balance config store exports and imports the same JSON shape', () => {
  const storage = new Map();
  const store = createBalanceConfigStore({
    storage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
      removeItem(key) {
        storage.delete(key);
      },
    },
  });

  store.setOverride({
    economy: {
      shopRefreshCost: 42,
    },
  });

  const exported = store.exportActiveConfig();
  const clone = createBalanceConfigStore({
    storage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
  });

  clone.importOverrideFromJson(exported);

  assert.equal(clone.getOverride().economy.shopRefreshCost, 42);
  assert.equal(clone.getActive().economy.shopRefreshCost, 42);
  assert.equal(clone.getActive().player.base.hp, store.getActive().player.base.hp);
});
