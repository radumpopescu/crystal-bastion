import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createBalanceConfigStore,
  deepMergeBalanceConfig,
  defaultBalanceConfig,
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
