import { META_UPGRADES, type MetaUpgradeId } from './constants';

export interface MetaState {
  crystals: number;
  upgrades: Partial<Record<MetaUpgradeId, number>>;
}

export function loadMeta(): MetaState {
  try {
    return JSON.parse(localStorage.getItem('towerMeta') ?? 'null') ?? { crystals: 0, upgrades: {} };
  } catch {
    return { crystals: 0, upgrades: {} };
  }
}

export function saveMeta(m: MetaState) {
  localStorage.setItem('towerMeta', JSON.stringify(m));
}

export function metaVal(meta: MetaState, id: MetaUpgradeId): number {
  const lvl = meta.upgrades[id] ?? 0;
  switch (id) {
    case 'playerHp':     return lvl * 25;
    case 'playerDmg':    return 1 + lvl * 0.2;
    case 'towerHp':      return lvl * 100;
    case 'outpostHp':    return lvl * 40;
    case 'startGold':    return lvl * 30;
    case 'outpostRange': return lvl * 30;
  }
}
