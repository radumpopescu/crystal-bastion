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
  const lvl = meta.upgrades[id] || 0;
  switch (id) {
    case 'playerHp':     return lvl * 20;
    case 'playerRegen':  return lvl * 0.1;
    case 'playerArmor':  return lvl * 0.06;
    case 'playerDmg':    return 1 + lvl * 0.15;
    case 'extraDash':    return lvl;
    case 'startGold':    return lvl * 35;
    case 'crystalBonus': return lvl * 0.20;
    case 'earlyBonus':   return lvl * 0.30;
    case 'towerHp':      return lvl * 200;
    case 'towerAtk':     return 1 + lvl * 0.25;
    case 'towerRange':   return lvl * 100;
    case 'towerAtkSpd':  return 1 + lvl * 0.20;
    case 'outpostHp':    return lvl * 80;
    case 'outpostAtk':   return 1 + lvl * 0.30;
    case 'outpostRange': return lvl * 100;
    case 'startWpn':     return lvl;
    case 'waveDelay':    return lvl * 8;
    case 'freeDeploy':   return lvl;
    default:             return 0;
  }
}
