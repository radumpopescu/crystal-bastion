import defaultConfigJson from './balance-config.default.json' with { type: 'json' };

export const BALANCE_OVERRIDE_STORAGE_KEY = 'crystalBastionBalanceOverride';

export type BalanceConfig = any;
export type BalanceOverride = any;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

type CreateStoreOptions = {
  storage?: StorageLike | null;
  storageKey?: string;
};

export const defaultBalanceConfig: BalanceConfig = cloneValue(defaultConfigJson);
export const balanceConfigStore = createBalanceConfigStore({ storageKey: BALANCE_OVERRIDE_STORAGE_KEY });

function isPlainObject(value: any) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function deepMergeBalanceConfig(base: any, overlay: any): any {
  if (overlay == null) return cloneValue(base);
  if (Array.isArray(base) || Array.isArray(overlay)) return cloneValue(overlay);
  if (!isPlainObject(base) || !isPlainObject(overlay)) return cloneValue(overlay);

  const merged: Record<string, any> = {};
  const keys = new Set([...Object.keys(base), ...Object.keys(overlay)]);
  for (const key of keys) {
    if (!(key in overlay)) merged[key] = cloneValue(base[key]);
    else if (!(key in base)) merged[key] = cloneValue(overlay[key]);
    else merged[key] = deepMergeBalanceConfig(base[key], overlay[key]);
  }
  return merged;
}

function parseOverrideJson(raw: string | null) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!isPlainObject(parsed)) throw new Error('Balance override must be a JSON object.');
  return parsed;
}

export function createBalanceConfigStore(options: CreateStoreOptions = {}) {
  const storageKey = options.storageKey || BALANCE_OVERRIDE_STORAGE_KEY;
  const storage = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : null);
  let override = storage ? parseOverrideJson(storage.getItem(storageKey)) : null;

  const getDefault = () => cloneValue(defaultBalanceConfig);
  const getOverride = () => cloneValue(override || {});
  const getActive = () => deepMergeBalanceConfig(defaultBalanceConfig, override || {});

  const persist = () => {
    if (!storage) return;
    if (!override || !Object.keys(override).length) {
      storage.removeItem(storageKey);
      return;
    }
    storage.setItem(storageKey, JSON.stringify(override));
  };

  return {
    storageKey,
    getDefault,
    getOverride,
    getActive,
    hasOverride() {
      return !!override && Object.keys(override).length > 0;
    },
    setOverride(nextOverride: BalanceOverride) {
      if (!isPlainObject(nextOverride)) throw new Error('Balance override must be an object.');
      override = cloneValue(nextOverride);
      persist();
      return getActive();
    },
    mergeOverride(partialOverride: BalanceOverride) {
      if (!isPlainObject(partialOverride)) throw new Error('Balance override patch must be an object.');
      override = deepMergeBalanceConfig(override || {}, partialOverride);
      persist();
      return getActive();
    },
    clearOverride() {
      override = null;
      persist();
      return getActive();
    },
    exportActiveConfig() {
      return JSON.stringify(getActive(), null, 2);
    },
    exportOverrideConfig() {
      return JSON.stringify(getOverride(), null, 2);
    },
    importOverrideFromJson(rawJson: string) {
      const parsed = parseOverrideJson(rawJson);
      override = parsed || {};
      persist();
      return getActive();
    },
  };
}

export function listBalanceSections(config: BalanceConfig = defaultBalanceConfig) {
  return Object.entries(config).map(([id, value]) => ({
    id,
    label: humanizeKey(id),
    kind: Array.isArray(value) ? 'array' : isPlainObject(value) ? 'object' : 'value',
  }));
}

export function listNumericFields(value: any, path: string[] = []) {
  if (typeof value === 'number') {
    return [{
      path,
      key: path.join('.'),
      label: humanizeKey(path[path.length - 1] || 'value'),
      value,
    }];
  }

  if (Array.isArray(value)) {
    const fields: any[] = [];
    value.forEach((entry, index) => {
      fields.push(...listNumericFields(entry, [...path, String(index)]));
    });
    return fields;
  }

  if (isPlainObject(value)) {
    return Object.entries(value).flatMap(([key, entry]) => listNumericFields(entry, [...path, key]));
  }

  return [];
}

export function setValueAtPath(target: any, path: string[], nextValue: any) {
  if (!path.length) return nextValue;
  const root = cloneValue(target);
  let cursor = root;
  for (let index = 0; index < path.length - 1; index++) {
    const part = path[index];
    const nextPart = path[index + 1];
    if (Array.isArray(cursor)) {
      const arrIndex = Number(part);
      cursor[arrIndex] = cloneValue(cursor[arrIndex]);
      cursor = cursor[arrIndex];
    } else {
      if (!isPlainObject(cursor[part])) cursor[part] = /^\d+$/.test(nextPart) ? [] : {};
      else cursor[part] = cloneValue(cursor[part]);
      cursor = cursor[part];
    }
  }
  const last = path[path.length - 1];
  if (Array.isArray(cursor)) cursor[Number(last)] = nextValue;
  else cursor[last] = nextValue;
  return root;
}

const WEAPON_MULTIPLIER_FIELDS = [
  'dmg',
  'range',
  'rate',
  'projSpeed',
  'projSize',
  'spread',
  'blastR',
  'arcAngle',
  'maxRate',
] as const;

const WEAPON_ADDITIVE_FIELDS = [
  'pellets',
  'chains',
  'spinup',
] as const;

function roundWeaponValue(value: number | null) {
  if (value == null) return null;
  if (Number.isInteger(value)) return value;
  return Number(value.toFixed(2));
}

export function getWeaponLevelConfig(weapon: any, level: number) {
  return (weapon?.levels || []).find((row: any) => row.level === level) || null;
}

export function computeWeaponLevelStats(weapon: any, level: number) {
  const row = getWeaponLevelConfig(weapon, level) || {};
  const computed: Record<string, any> = {
    level,
    cost: row.cost ?? null,
  };

  for (const field of WEAPON_MULTIPLIER_FIELDS) {
    const base = weapon?.[field];
    if (base == null) {
      computed[field] = null;
      continue;
    }
    const multiplier = row[`${field}Multiplier`] ?? 1;
    computed[field] = roundWeaponValue(base * multiplier);
  }

  for (const field of WEAPON_ADDITIVE_FIELDS) {
    const base = weapon?.[field];
    const additive = row[`${field}Add`] ?? 0;
    if (base == null && !additive) {
      computed[field] = null;
      continue;
    }
    computed[field] = roundWeaponValue((base ?? 0) + additive);
  }

  computed.bonusText = row.bonusText ?? null;
  return computed;
}

export function summarizeWeaponLevelPreviewRows(weapon: any) {
  return (weapon?.levels || []).map((row: any, index: number) => computeWeaponLevelStats(weapon, row.level ?? index + 1));
}

function humanizeKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}
