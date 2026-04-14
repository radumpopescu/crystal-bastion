import { ACTIVE_BALANCE_CONFIG, metaValueFromConfig } from './constants';

export function loadMeta() {
  try {
    return JSON.parse(localStorage.getItem('towerMeta3d') || 'null') || { crystals:0, upgrades:{} };
  } catch {
    return { crystals:0, upgrades:{} };
  }
}

export function saveMeta(meta: any) {
  localStorage.setItem('towerMeta3d', JSON.stringify(meta));
}

export function metaValue(meta: any, id: string) {
  return metaValueFromConfig(ACTIVE_BALANCE_CONFIG, meta, id);
}
