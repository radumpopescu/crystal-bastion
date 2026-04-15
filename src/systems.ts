import { ACTIVE_BALANCE_CONFIG, AUTO_CONSTRUCT_SPACING, BASE_MONSTERS, CARD_RARITY_WEIGHTS, DASH_COOLDOWN, DASH_DURATION, DASH_SPEED, EARLY_START_BONUS, LEASH_DMG, LEVELUP_OFFER_COUNT, MAX_WEAPON_SLOTS, MONSTER_ATTACK_COOLDOWN, MONSTER_CONTACT_BUFFER, MONSTER_DEF, MONSTER_SCALE, MONSTER_SPAWN_ATTACK_COOLDOWN_MAX, OUTPOST_COST, OUTPOST_HP_BASE, OUTPOST_PLACEMENT, OUTPOST_RANGE, PLAYER_DASH_INVULN_BONUS, PLAYER_HIT_FLASH, PLAYER_HIT_INVULN, PLAYER_RADIUS, PLAYER_SPEED, SHOP_OFFER_COUNT, STAT_UPGRADES, STRUCTURE_CONTACT_RADIUS, TILE_SIZE, TOWER_TYPES, TOWER_UPGRADES, WAVE_CONFIG, WAVE_CRYSTAL_REWARD, WAVE_ENEMY_MIX, WAVE_INTERVAL, WAVE_SPAWN_CONFIG, WEAPONS, computeCardGoldCost, computeOutpostCost, computeRerollBaseCost, getOutpostStatsForLevel, getTowerTypeDef, getUnlockedTowerTypeIds, getWeaponMaxLevel, getWeaponStats } from './constants';
import { DEV_WEAPON_IDS, R, devCardLimit, finishDevSession, makeWeapon, metaVal, newGame } from './state';
import { clamp, dist, inBtn, shuffle } from './utils';
import { saveMeta } from './meta';

export function getAnchors() {
  const game = R.game;
  const anchors = [{ x:game.tower.x, y:game.tower.y, range:game.tower.range }];
  for (const op of game.outposts) anchors.push({ x:op.x, y:op.y, range:op.range });
  return anchors;
}

export function nearestAnchor(x: number, y: number) {
  let best = null;
  let bestD = Infinity;
  for (const a of getAnchors()) {
    const d = dist(x, y, a.x, a.y);
    if (d < bestD) { bestD = d; best = a; }
  }
  return { anchor: best, dist: bestD };
}

export function getOutpostCost(towerTypeId?: string | null) {
  return computeOutpostCost(ACTIVE_BALANCE_CONFIG, R.game, towerTypeId);
}

function getCurrentTowerTypeId(game = R.game) {
  return game?.selectedTowerType || Object.keys(TOWER_TYPES || {})[0] || 'standard';
}

function getCurrentTowerType(game = R.game) {
  return getTowerTypeDef(ACTIVE_BALANCE_CONFIG, getCurrentTowerTypeId(game));
}

export function getAvailableTowerTypeIds(game = R.game) {
  if (!game) return getUnlockedTowerTypeIds(ACTIVE_BALANCE_CONFIG, 0);
  const wave = game.waveActive ? game.wave : Math.max(0, game.wave || 0);
  return getUnlockedTowerTypeIds(ACTIVE_BALANCE_CONFIG, wave);
}

export function syncAvailableTowerTypes(game = R.game) {
  if (!game) return [];
  const available = getAvailableTowerTypeIds(game);
  game.availableTowerTypes = available;
  if (!available.includes(game.selectedTowerType)) game.selectedTowerType = available[0] || getCurrentTowerTypeId(game);
  return available;
}

export function selectTowerType(towerTypeId: string, game = R.game) {
  if (!game) return false;
  const available = syncAvailableTowerTypes(game);
  if (!available.includes(towerTypeId)) return false;
  game.selectedTowerType = towerTypeId;
  return true;
}

function canPlaceOutpostAt(px: number, py: number, towerTypeId?: string | null) {
  const game = R.game;
  const towerType = getTowerTypeDef(ACTIVE_BALANCE_CONFIG, towerTypeId || getCurrentTowerTypeId(game));
  const stats = getOutpostStatsForLevel(ACTIVE_BALANCE_CONFIG, game.outpostLevel || 1, game.opAtkMult || 1, game.opRangeBonus || 0, game.opHpBonus || 0, towerType.id);
  const minAnchorDistance = (OUTPOST_PLACEMENT.minAnchorDistance || 65) * (towerType.placement?.minAnchorDistanceMultiplier ?? 1);
  const connectionFactor = (OUTPOST_PLACEMENT.connectionFactor || 0.6) * (towerType.placement?.connectionFactorMultiplier ?? 1);
  let canConnect = false;
  for (const a of getAnchors()) {
    if (dist(px, py, a.x, a.y) <= a.range + stats.range * connectionFactor) { canConnect = true; break; }
  }
  if (!canConnect) return false;
  for (const a of getAnchors()) {
    if (dist(px, py, a.x, a.y) < minAnchorDistance) return false;
  }
  return true;
}

function outpostStatsForLevel(level: number, game: any, towerTypeId?: string | null) {
  return getOutpostStatsForLevel(ACTIVE_BALANCE_CONFIG, level, game.opAtkMult || 1, game.opRangeBonus || 0, game.opHpBonus || 0, towerTypeId || getCurrentTowerTypeId(game));
}

function placeOutpostAt(px: number, py: number, towerTypeId?: string | null) {
  const game = R.game;
  const towerType = getTowerTypeDef(ACTIVE_BALANCE_CONFIG, towerTypeId || getCurrentTowerTypeId(game));
  const level = game.outpostLevel || 1;
  const stats = outpostStatsForLevel(level, game, towerType.id);
  game.outposts.push({ x:px, y:py, hp:stats.maxHp, maxHp:stats.maxHp, range:stats.range, ...stats, atkCooldown:0, towerType:towerType.id, towerLabel:towerType.label, color:towerType.color });
  spawnParticles(px, py, towerType.color || '#27ae60', 12, 60);
}

export function upgradeOutpostLevel(game: any) {
  const currentTypeStats = getOutpostStatsForLevel(ACTIVE_BALANCE_CONFIG, game.outpostLevel || 1, game.opAtkMult || 1, game.opRangeBonus || 0, game.opHpBonus || 0, game.selectedTowerType);
  const maxLevel = currentTypeStats.maxLevel || 5;
  const newLevel = Math.min((game.outpostLevel || 1) + 1, maxLevel);
  game.outpostLevel = newLevel;
  for (const op of game.outposts) {
    const stats = outpostStatsForLevel(newLevel, game, op.towerType || game.selectedTowerType);
    op.maxHp = stats.maxHp;
    op.range = stats.range;
    op.atkDmg = stats.atkDmg;
    op.atkRange = stats.atkRange;
    op.atkSpeed = stats.atkSpeed;
    op.color = stats.color;
  }
  for (const op of game.outposts) spawnParticles(op.x, op.y, op.color || '#f1c40f', 10, 60);
}

export function tryPlaceOutpostAt(px: number, py: number, towerTypeId?: string | null) {
  const game = R.game;
  const resolvedTowerTypeId = towerTypeId || getCurrentTowerTypeId(game);
  const cost = getOutpostCost(resolvedTowerTypeId);
  const free = (game.freeOutpost || 0) > 0;
  if (!free && game.gold < cost) return false;
  if (!canPlaceOutpostAt(px, py, resolvedTowerTypeId)) return false;
  if (free) game.freeOutpost--;
  else game.gold -= cost;
  placeOutpostAt(px, py, resolvedTowerTypeId);
  return true;
}

export function tryPlaceOutpost() {
  const game = R.game;
  return tryPlaceOutpostAt(game.player.x, game.player.y, getCurrentTowerTypeId(game));
}

export function handlePlayingClick(mx: number, my: number) {
  if (mx >= R.W - 46 && mx <= R.W - 10 && my >= 10 && my <= 46) { R.state = 'paused'; return; }
  if (R.ui.waveStartBtn && !R.game.waveActive && inBtn(mx, my, R.ui.waveStartBtn)) {
    startNextWave(true);
  }
}

export function startNextWave(early = false) {
  const game = R.game;
  if (early && game.waveTimer > 0) {
    const totalWindow = WAVE_INTERVAL + (game.waveDelayBonus || 0);
    const bonusFraction = totalWindow > 0 ? game.waveTimer / totalWindow : 0;
    const bonusGold = Math.max(
      EARLY_START_BONUS.minimum || 0,
      Math.round((EARLY_START_BONUS.base || 0) * bonusFraction * (game.earlyBonusMult || 1) * (1 + game.wave * (EARLY_START_BONUS.waveScale || 0)))
    );
    game.gold += bonusGold;
    spawnDmgNum(game.player.x, game.player.y - 40, `+${bonusGold}g EARLY BONUS`, '#f1c40f');
  }

  game.wave++;
  syncAvailableTowerTypes(game);
  const count = Math.floor(BASE_MONSTERS + game.wave * (WAVE_CONFIG.monstersPerWave || 0) + Math.pow(game.wave, WAVE_CONFIG.wavePower || 1));
  const hpScale = 1 + (game.wave - 1) * (WAVE_CONFIG.hpScalePerWave || 0) + Math.max(0, game.wave - (WAVE_CONFIG.hpScaleAfterWave || 0)) * (WAVE_CONFIG.hpScaleLateBonus || 0);
  const spdScale = 1 + (game.wave - 1) * (WAVE_CONFIG.speedScalePerWave || 0);
  const dmgScale = 1 + (game.wave - 1) * (WAVE_CONFIG.damageScalePerWave || 0);

  let maxAnchorDist = game.tower.range;
  for (const op of game.outposts) {
    const d = Math.hypot(op.x - game.tower.x, op.y - game.tower.y) + op.range;
    if (d > maxAnchorDist) maxAnchorDist = d;
  }
  const spawnBase = maxAnchorDist + (WAVE_SPAWN_CONFIG.baseOffset || 0);

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spawnR = spawnBase + Math.random() * (WAVE_SPAWN_CONFIG.randomOffset || 0);
    const sx = game.tower.x + Math.cos(angle) * spawnR;
    const sy = game.tower.y + Math.sin(angle) * spawnR;

    let type = 'grunt';
    const r = Math.random();
    if (game.wave >= (WAVE_ENEMY_MIX.rusher?.startWave || Infinity) && r < (WAVE_ENEMY_MIX.rusher?.chance || -1)) type = 'rusher';
    if (game.wave >= (WAVE_ENEMY_MIX.brute?.startWave || Infinity) && r < (WAVE_ENEMY_MIX.brute?.chance || -1)) type = 'brute';
    if (game.wave >= (WAVE_ENEMY_MIX.tank?.startWave || Infinity) && r < (WAVE_ENEMY_MIX.tank?.chance || -1)) type = 'tank';

    const T = MONSTER_DEF[type];
    game.monsters.push({
      x:sx, y:sy, type,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale,
      speed: T.speed * spdScale, dmg: T.dmg * dmgScale,
      gold: T.gold, radius: T.radius, color: T.color,
      atkCooldown: Math.random() * MONSTER_SPAWN_ATTACK_COOLDOWN_MAX,
      animPhase: Math.random() * Math.PI * 2,
    });
  }
  game.monstersLeft = count;
  game.waveActive = true;
  game._waveCrystalReward = Math.max(1, Math.floor(((WAVE_CRYSTAL_REWARD.base || 1) + Math.floor(game.wave / (WAVE_CRYSTAL_REWARD.waveStep || 4))) * (1 + (metaVal('crystalBonus') || 0))));
}

export function isStatUpgradeAvailable(stat: any, p = R.game.player, g = R.game) {
  if (stat.available && !stat.available(p, g)) return false;
  if (stat.max !== undefined && stat.count && stat.count(p, g) >= stat.max) return false;
  return true;
}

function getWeaponCardPool(game = R.game) {
  const p = game.player;
  const newCards: any[] = [];
  const upgradeCards: any[] = [];
  for (const id of Object.keys(WEAPONS)) {
    const existing = p.weapons.find((w: any) => w.id === id);
    const maxLevel = getWeaponMaxLevel(id);
    if (existing) {
      if (existing.level < maxLevel) upgradeCards.push({ type:'weapon', weaponId:id, newLevel: existing.level + 1, rarity: WEAPONS[id].rarity });
    } else {
      newCards.push({ type:'weapon', weaponId:id, newLevel:1, rarity: WEAPONS[id].rarity });
    }
  }
  const atCap = p.weapons.length >= (game.maxWeaponSlots || MAX_WEAPON_SLOTS);
  if (atCap) return upgradeCards;
  return [...upgradeCards, ...upgradeCards, ...newCards];
}

export function weaponCardNeedsSlot(card: any, game = R.game) {
  if (!card || card.type !== 'weapon') return false;
  const existing = game.player.weapons.find((w: any) => w.id === card.weaponId);
  return !existing && game.player.weapons.length >= (game.maxWeaponSlots || MAX_WEAPON_SLOTS);
}

export function generateCards() {
  const game = R.game;
  const pool: any[] = [];
  const p = game.player;

  pool.push(...getWeaponCardPool(game));

  for (const s of STAT_UPGRADES) {
    if (!isStatUpgradeAvailable(s, game.player, game)) continue;
    pool.push({ type:'stat', statId:s.id, rarity:s.rarity || 'common' });
  }

  const lk = game.player.luck || 0;
  const wCommon = Math.max(1, (CARD_RARITY_WEIGHTS.commonBase || 4) - lk * (CARD_RARITY_WEIGHTS.commonLuckPenaltyPerPoint || 1));
  const wUncommon = (CARD_RARITY_WEIGHTS.uncommonBase || 2) + Math.floor(lk * (CARD_RARITY_WEIGHTS.uncommonPerLuckHalf || 0.5));
  const wRare = (CARD_RARITY_WEIGHTS.rareBase || 1) + lk * (CARD_RARITY_WEIGHTS.rarePerLuck || 1);
  const weighted = pool.flatMap(c =>
    c.rarity === 'rare' ? Array(wRare).fill(c) : c.rarity === 'uncommon' ? Array(wUncommon).fill(c) : Array(wCommon).fill(c)
  );
  shuffle(weighted);
  const seen = new Set();
  const cards: any[] = [];
  for (const c of weighted) {
    const key = c.type === 'weapon' ? c.weaponId : c.statId;
    if (!seen.has(key)) { seen.add(key); cards.push(c); }
    if (cards.length >= LEVELUP_OFFER_COUNT) break;
  }
  return cards;
}

function rerollBaseCost() {
  return computeRerollBaseCost(ACTIVE_BALANCE_CONFIG, R.meta);
}

function cardGoldCost(card: any) {
  return computeCardGoldCost(ACTIVE_BALANCE_CONFIG, card, R.game.wave, R.game?.shopDiscount || 0);
}

export function generateShopCards(n = SHOP_OFFER_COUNT) {
  const game = R.game;
  const pool: any[] = [];
  const p = game.player;
  const lockedCards = (game.shopCards || [])
    .filter((card: any) => card && card._locked && !card._bought && isCardStillAvailable(card, game))
    .map((card: any) => ({ ...card, _locked: true, _bought: false }));
  const lockedKeys = new Set(lockedCards.map((card: any) => (card.type === 'weapon' ? card.weaponId : card.statId)));
  pool.push(...getWeaponCardPool(game));
  for (const s of STAT_UPGRADES) {
    if (!isStatUpgradeAvailable(s, game.player, game)) continue;
    pool.push({ type:'stat', statId:s.id, rarity:s.rarity || 'common' });
  }

  const lk2 = game.player.luck || 0;
  const wC2 = Math.max(1, (CARD_RARITY_WEIGHTS.commonBase || 4) - lk2 * (CARD_RARITY_WEIGHTS.commonLuckPenaltyPerPoint || 1));
  const wU2 = (CARD_RARITY_WEIGHTS.uncommonBase || 2) + Math.floor(lk2 * (CARD_RARITY_WEIGHTS.uncommonPerLuckHalf || 0.5));
  const wR2 = (CARD_RARITY_WEIGHTS.rareBase || 1) + lk2 * (CARD_RARITY_WEIGHTS.rarePerLuck || 1);
  const weighted = pool.flatMap(c => c.rarity === 'rare' ? Array(wR2).fill(c) : c.rarity === 'uncommon' ? Array(wU2).fill(c) : Array(wC2).fill(c));
  shuffle(weighted);
  const seen = new Set();
  const cards: any[] = [...lockedCards];
  for (const c of weighted) {
    const key = c.type === 'weapon' ? c.weaponId : c.statId;
    if (lockedKeys.has(key)) continue;
    const inFree = game.levelUpCards && game.levelUpCards.some((fc: any) => {
      const fkey = fc.type === 'weapon' ? fc.weaponId : fc.statId;
      return fkey === key;
    });
    if (!seen.has(key) && !inFree) { seen.add(key); cards.push({ ...c, cost: cardGoldCost(c) }); }
    if (cards.length >= n) break;
  }
  return cards;
}

function isCardStillAvailable(card: any, game = R.game) {
  if (!card) return false;
  if (card.type === 'weapon') {
    const existing = game.player.weapons.find((w: any) => w.id === card.weaponId);
    if (existing) return existing.level < getWeaponMaxLevel(card.weaponId) && card.newLevel === existing.level + 1;
    return card.newLevel === 1;
  }
  const stat = STAT_UPGRADES.find(s => s.id === card.statId);
  return !!stat && isStatUpgradeAvailable(stat, game.player, game);
}

function getRunCardKey(card: any) {
  return card.type === 'weapon' ? `weapon:${card.weaponId}` : `stat:${card.statId}`;
}

function getRunCardMeta(entry: any) {
  if (entry.type === 'weapon') {
    const def = WEAPONS[entry.weaponId];
    return def ? {
      icon: def.icon,
      name: def.name,
      desc: def.desc,
      color: def.color,
      levelBonus: def.levelBonus,
    } : null;
  }
  const stat = STAT_UPGRADES.find(s => s.id === entry.statId);
  return stat ? {
    icon: stat.icon,
    name: stat.name,
    desc: stat.desc,
    color: stat.id === 'outpostCheap' ? '#f1c40f' : stat.id.startsWith('tower') ? '#f39c12' : stat.id.startsWith('outpost') ? '#3498db' : '#2ecc71',
    max: stat.max,
    count: stat.count,
  } : null;
}

function recordRunCard(card: any) {
  const game = R.game;
  if (!game?.runCardCounts || !game?.runCardOrder) return;
  const key = getRunCardKey(card);
  const existing = game.runCardCounts[key];
  if (existing) {
    existing.count++;
  } else {
    game.runCardCounts[key] = card.type === 'weapon'
      ? { key, type:'weapon', weaponId: card.weaponId, count:1 }
      : { key, type:'stat', statId: card.statId, count:1 };
    game.runCardOrder.push(key);
  }
}

export function getRunCardEntries() {
  const game = R.game;
  if (!game?.runCardCounts || !game?.runCardOrder) return [];
  return game.runCardOrder
    .map((key: string) => game.runCardCounts[key])
    .filter(Boolean)
    .map((entry: any) => {
      const meta = getRunCardMeta(entry);
      return meta ? { ...entry, ...meta } : null;
    })
    .filter(Boolean);
}

export function getLoadoutStats() {
  const p = R.game.player;
  const towerCost = getOutpostCost();
  const towerDiscount = R.game.outpostDiscount || 0;
  return [
    { icon:'❤️', name:'HP',            value: `${Math.round(p.hp)} / ${Math.round(p.maxHp)}` },
    { icon:'💚', name:'Regen',        value: `${(p.regen || 0).toFixed(1)}/s` },
    { icon:'🩸', name:'Lifesteal',    value: `${(p.lifesteal || 0).toFixed(2)}/hit` },
    { icon:'💢', name:'Damage',       value: `${Math.round((p.dmgMult || 1) * 100)}%` },
    { icon:'⚡', name:'Atk Speed',    value: `${Math.round((p.atkSpdMult || 1) * 100)}%` },
    { icon:'👟', name:'Move Speed',   value: `${Math.round(p.speed || 0)}` },
    { icon:'🔭', name:'Range',        value: `${Math.round((p.rangeMult || 1) * 100)}%` },
    { icon:'🛡️', name:'Armor',        value: `${Math.round((p.armor || 0) * 100)}%` },
    { icon:'💵', name:'Gold Find',    value: `${Math.round((p.goldFinder || 0) * 100)}%` },
    { icon:'🗼', name:'Tower Cost',   value: towerDiscount > 0 ? `${towerCost}g (-${towerDiscount})` : `${towerCost}g` },
    { icon:'🍀', name:'Luck',         value: `${p.luck || 0}` },
    { icon:'🌀', name:'Dash Level',   value: `${p.dashLevel || 0}/5` },
    { icon:'💨', name:'Dash Charges', value: `${p.maxDashes || 0}` },
  ];
}

export function getBaseStats() {
  const t = R.game.tower;
  return [
    { icon:'🏰', name:'Base HP',       value: `${Math.ceil(t.hp)} / ${t.maxHp}` },
    { icon:'🧱', name:'Build Zone',    value: `${Math.round(t.range)}` },
    { icon:'🎯', name:'Turret Range',  value: `${Math.round(t.atkRange)}` },
    { icon:'💥', name:'Turret Damage', value: `${Math.round(t.atkDmg)}` },
    { icon:'⚡', name:'Fire Rate',     value: `${t.atkSpeed.toFixed(2)}/s` },
    { icon:'🔥', name:'Aura DPS',      value: `${Math.round(t.auraDmg)}` },
    { icon:'🎱', name:'Multishot',     value: `${t.multishot || 1} targets` },
  ];
}

export function buyTowerUpgrade(upgradeId: string) {
  const game = R.game;
  const upg = TOWER_UPGRADES.find(entry => entry.id === upgradeId);
  if (!upg) return false;
  const lvl = game.tower.upgrades[upg.id] || 0;
  if (lvl >= upg.max) return false;
  const cost = upg.cost[lvl];
  if (game.gold < cost) return false;
  game.gold -= cost;
  game.tower.upgrades[upg.id]++;
  const effect = upg.effect || {};
  if (effect.target === 'base.core.hp' && effect.mode === 'add') {
    game.tower.maxHp += effect.value;
    game.tower.hp = Math.min(game.tower.hp + effect.value, game.tower.maxHp);
  }
  if (effect.target === 'base.core.buildRange' && effect.mode === 'add') game.tower.range += effect.value;
  if (effect.target === 'base.core.damage' && effect.mode === 'multiply') game.tower.atkDmg = Math.round(game.tower.atkDmg * effect.value);
  if (effect.target === 'base.core.multishot' && effect.mode === 'add') game.tower.multishot = (game.tower.multishot || 1) + effect.value;
  return true;
}

export function sellWeapon(slotIndex: number) {
  const game = R.game;
  const weapon = game.player.weapons[slotIndex];
  if (!weapon) return false;
  game.player.weapons.splice(slotIndex, 1);
  game._cardActionHint = `${WEAPONS[weapon.id].name} removed. Empty slot ready for a new weapon.`;
  return true;
}

export function applyCard(card: any) {
  const game = R.game;
  const p = game.player;
  if (card.type === 'weapon') {
    const existing = p.weapons.find((w: any) => w.id === card.weaponId);
    if (existing) existing.level = card.newLevel;
    else {
      if (p.weapons.length >= (R.game?.maxWeaponSlots || MAX_WEAPON_SLOTS)) return false;
      p.weapons.push({ ...makeWeapon(card.weaponId), level: clamp(card.newLevel || 1, 1, getWeaponMaxLevel(card.weaponId)) });
    }
  } else {
    const s = STAT_UPGRADES.find(s => s.id === card.statId);
    if (s) s.apply(p, game);
  }
  recordRunCard(card);
  game._cardActionHint = null;
  return true;
}

export function luCardDims() {
  if (R.ui.isMobileLandscape) {
    const availH = Math.max(160, R.H - 150);
    const cardH = Math.max(118, Math.min(160, Math.floor((availH - 26) / 2)));
    const cardW = Math.round(cardH * (165 / 255));
    const gap = 8;
    return { w: cardW, h: cardH, gap };
  }
  const availH = R.H - 90 - 120;
  const cardH = Math.max(160, Math.min(255, Math.floor(availH / 2)));
  const cardW = Math.round(cardH * (175 / 255));
  const gap = Math.max(8, Math.min(16, Math.floor(cardW * 0.09)));
  return { w: cardW, h: cardH, gap };
}

export function luPositions() {
  if (R.ui.isMobileLandscape) {
    const rightPanelW = Math.min(236, Math.max(172, R.W * 0.34));
    const rightPanelX = R.W - rightPanelW - 10;
    const leftPanelX = 0;
    const leftPanelW = 0;
    const centerLeft = 10;
    const centerRight = rightPanelX - 10;
    const centerW = centerRight - centerLeft;
    const { w: rawCW, h: cH, gap: rawGap } = luCardDims();
    const maxCards = Math.max(4, R.game?.levelUpCards?.length || 0, R.game?.shopCards?.length || 0);
    const maxCardW = Math.floor((centerW - 16 - (maxCards - 1) * rawGap) / maxCards);
    const cW = Math.min(rawCW, Math.max(78, maxCardW));
    const gap = rawGap;
    const centerX = (centerLeft + centerRight) / 2;
    const HEADER_H = 54;
    const BOT_H = 44;
    const SEC_GAP = 18;
    const freeTop = HEADER_H + 14;
    const shopTop = freeTop + cH + SEC_GAP + 18;
    return { cW, cH, gap, centerX, freeTop, shopTop, BOT_H, leftPanelX, leftPanelW, rightPanelX, rightPanelW };
  }
  const leftPanelW = Math.max(180, Math.min(220, R.W * 0.17));
  const rightPanelW = Math.max(160, Math.min(230, R.W * 0.17));
  const leftPanelX = 12;
  const rightPanelX = R.W - rightPanelW - 12;
  const centerLeft = leftPanelX + leftPanelW + 20;
  const centerRight = rightPanelX - 20;
  const centerW = centerRight - centerLeft;

  // Fit 4 cards + gaps + section padding into the available center width
  const { w: rawCW, h: cH, gap: rawGap } = luCardDims();
  const maxCardW = Math.floor((centerW - 28 - 3 * rawGap) / 4);
  const cW = Math.min(rawCW, maxCardW);
  const gap = rawGap;

  const centerX = (centerLeft + centerRight) / 2;
  const HEADER_H = 72;
  const BOT_H = 52;
  const SEC_GAP = 40;
  const freeTop = HEADER_H + 26;
  const shopTop = freeTop + cH + SEC_GAP + 24;
  return { cW, cH, gap, centerX, freeTop, shopTop, BOT_H, leftPanelX, leftPanelW, rightPanelX, rightPanelW };
}

export function getMobileLevelupLayout(game = R.game) {
  const { w: rawCW, h: rawCH, gap } = luCardDims();
  const sidePad = 10;
  const topY = 56;
  const botBarH = 44;
  const rightPanelW = Math.min(236, Math.max(172, R.W * 0.34));
  const rightPanelX = R.W - rightPanelW - 10;
  const contentLeft = sidePad;
  const contentRight = rightPanelX - 10;
  const contentW = Math.max(200, contentRight - contentLeft);
  const maxCols = Math.max(1, Math.min(4, Math.floor((contentW + gap) / (rawCW + gap))));
  const maxCardW = Math.floor((contentW - Math.max(0, maxCols - 1) * gap) / maxCols);
  const cW = Math.min(rawCW, maxCardW);
  const cH = Math.round(rawCH * (cW / rawCW));
  const freeCards = game.levelUpCards || [];
  const shopCards = game.shopCards || [];
  const freePicked = freeCards.length === 0;
  const summaryScale = 0.64;
  const summaryW = Math.max(56, Math.round(cW * summaryScale));
  const summaryH = Math.max(82, Math.round(cH * summaryScale));
  const gridHeight = (count: number) => {
    if (count <= 0) return 0;
    const cols = Math.min(maxCols, count);
    const rows = Math.ceil(count / cols);
    return rows * cH + Math.max(0, rows - 1) * gap;
  };
  const getCardRect = (count: number, index: number, startY: number) => {
    const cols = Math.min(maxCols, Math.max(1, count));
    const row = Math.floor(index / cols);
    const col = index % cols;
    const itemsInRow = Math.min(cols, count - row * cols);
    const rowW = itemsInRow * cW + Math.max(0, itemsInRow - 1) * gap;
    const startX = contentLeft + (contentW - rowW) / 2;
    return { x: startX + col * (cW + gap), y: startY + row * (cH + gap), w: cW, h: cH };
  };

  const panelY = topY;
  const panelH = Math.max(cH + 44, R.H - panelY - botBarH - 12);
  const freeGridY = panelY + 34;
  const shopGridY = panelY + 34;
  const pickedSummaryX = contentLeft + 8;
  const pickedSummaryY = panelY + 8;

  return {
    cW,
    cH,
    gap,
    sidePad,
    topY,
    botBarH,
    contentLeft,
    contentRight,
    contentW,
    panelY,
    panelH,
    maxCols,
    freePicked,
    freeCards,
    shopCards,
    freeGridY,
    shopGridY,
    rightPanelX,
    rightPanelW,
    summaryW,
    summaryH,
    pickedSummaryX,
    pickedSummaryY,
    getCardRect,
    gridHeight,
  };
}

export function handleCardClick(mx: number, my: number) {
  const game = R.game;
  if (!game.levelUpCards) return;
  for (const btn of R.ui.levelupBaseUpgradeBtns || []) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      buyTowerUpgrade(btn.upgradeId);
      return;
    }
  }
  for (const btn of R.ui.levelupWeaponBtns || []) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      sellWeapon(btn.slotIndex);
      return;
    }
  }
  for (const btn of R.ui.levelupShopLockBtns || []) {
    if (mx >= btn.x && mx <= btn.x + btn.w && my >= btn.y && my <= btn.y + btn.h) {
      const card = game.shopCards?.[btn.cardIndex];
      if (!card || card._bought) return;
      const lockLabel = card.type === 'weapon'
        ? WEAPONS[card.weaponId].name
        : (STAT_UPGRADES.find((stat: any) => stat.id === card.statId)?.name || 'Card');
      card._locked = !card._locked;
      game._cardActionHint = card._locked
        ? `${lockLabel} locked for the next wave-end shop.`
        : 'Card unlocked.';
      return;
    }
  }

  if (R.ui.isMobileLandscape) {
    for (const tabBtn of R.ui.mobileDrawerTabBtns || []) {
      if (mx >= tabBtn.x && mx <= tabBtn.x + tabBtn.w && my >= tabBtn.y && my <= tabBtn.y + tabBtn.h) {
        R.ui.mobileDrawerTab = tabBtn.tab;
        R.ui.mobileScrollY = 0;
        return;
      }
    }
    const layout = getMobileLevelupLayout(game);
    if (!layout.freePicked && layout.freeGridY != null) {
      for (let i = 0; i < layout.freeCards.length; i++) {
        const rect = layout.getCardRect(layout.freeCards.length, i, layout.freeGridY);
        if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
          const card = layout.freeCards[i];
          if (weaponCardNeedsSlot(card, game)) {
            game._cardActionHint = `Sell a weapon slot first to take ${WEAPONS[card.weaponId].name}.`;
            return;
          }
          const applied = applyCard(card);
          if (!applied) return;
          game._pickedFreeCard = game.levelUpCards[i];
          game.levelUpCards = [];
          R.ui.mobileScrollY = 0;
          return;
        }
      }
      return;
    }
    if (layout.freePicked && layout.shopGridY != null) {
      for (let i = 0; i < layout.shopCards.length; i++) {
        const rect = layout.getCardRect(layout.shopCards.length, i, layout.shopGridY);
        if (mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h) {
          const card = layout.shopCards[i];
          if (game.gold >= card.cost && !card._bought) {
            if (weaponCardNeedsSlot(card, game)) {
              game._cardActionHint = `Sell a weapon slot first to buy ${WEAPONS[card.weaponId].name}.`;
              return;
            }
            game.gold -= card.cost;
            const applied = applyCard(card);
            if (!applied) {
              game.gold += card.cost;
              return;
            }
            card._locked = false;
            card._bought = true;
            game._anyBought = true;
          }
          return;
        }
      }
    }
  } else {
    const { cW, cH, gap, centerX, freeTop, shopTop } = luPositions();

    const freeN = game.levelUpCards.length;
    const fTotalW = freeN * cW + (freeN - 1) * gap;
    const fStartX = centerX - fTotalW / 2;
    for (let i = 0; i < freeN; i++) {
      const bx = fStartX + i * (cW + gap);
      const by = freeTop;
      if (mx >= bx && mx <= bx + cW && my >= by && my <= by + cH) {
        const card = game.levelUpCards[i];
        if (weaponCardNeedsSlot(card, game)) {
          game._cardActionHint = `Sell a weapon slot first to take ${WEAPONS[card.weaponId].name}.`;
          return;
        }
        const applied = applyCard(card);
        if (!applied) return;
        game._pickedFreeCard = game.levelUpCards[i];
        game.levelUpCards = [];
        return;
      }
    }

    const sCards = game.shopCards || [];
    const sTotalW = sCards.length * cW + (sCards.length - 1) * gap;
    const sStartX = centerX - sTotalW / 2;
    for (let i = 0; i < sCards.length; i++) {
      const card = sCards[i];
      const bx = sStartX + i * (cW + gap);
      const by = shopTop;
      if (mx >= bx && mx <= bx + cW && my >= by && my <= by + cH) {
        if (game.gold >= card.cost && !card._bought) {
          if (weaponCardNeedsSlot(card, game)) {
            game._cardActionHint = `Sell a weapon slot first to buy ${WEAPONS[card.weaponId].name}.`;
            return;
          }
          game.gold -= card.cost;
          const applied = applyCard(card);
          if (!applied) {
            game.gold += card.cost;
            return;
          }
          card._locked = false;
          card._bought = true;
          game._anyBought = true;
        }
        return;
      }
    }
  }

  if (R.ui.refreshAllBtn && inBtn(mx, my, R.ui.refreshAllBtn)) {
    const cost = game._rerollCost ?? rerollBaseCost();
    if (game.gold < cost) return;
    game.gold -= cost;
    game._rerollCost = cost + 3;
    const freePicked = !game.levelUpCards || game.levelUpCards.length === 0;
    if (!freePicked) { game.levelUpCards = generateCards(); game._pickedFreeCard = null; }
    game.shopCards = generateShopCards(4);
    game._cardActionHint = null;
    return;
  }

  if (R.ui.continueBtn && inBtn(mx, my, R.ui.continueBtn)) {
    game.levelUpCards = null;
    game._cardActionHint = null;
    R.ui.mobileScrollY = 0;
    R.state = 'playing';
    game.waveTimer = WAVE_INTERVAL + (game.waveDelayBonus || 0);
  }
}

export function updatePlayer(dt: number) {
  const game = R.game;
  const p = game.player;
  p._walkMoved = false;
  if (p.dead) return;
  const startX = p.x;
  const startY = p.y;

  if (p.regen) {
    p.hp = Math.min(p.hp + p.regen * dt, p.maxHp);
  }

  if (p.dashing) {
    p.dashTimer -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
    if (p.dashTimer <= 0) { p.dashing = false; p.invincible = Math.max(p.invincible, 0.1); }
  } else {
    let dx = 0, dy = 0;
    if (game.keys['KeyW'] || game.keys['ArrowUp'])    { dx -= 1; dy -= 1; }
    if (game.keys['KeyS'] || game.keys['ArrowDown'])  { dx += 1; dy += 1; }
    if (game.keys['KeyA'] || game.keys['ArrowLeft'])  { dx -= 1; dy += 1; }
    if (game.keys['KeyD'] || game.keys['ArrowRight']) { dx += 1; dy -= 1; }
    const touch = game.touchMove;
    if (touch) {
      dx += touch.x;
      dy += touch.y;
    }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len;
      dy /= len;
      p.facing = { x:dx, y:dy };
      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
      p._walkMoved = true;
    }
  }

  if (p.dashCooldown > 0) {
    p.dashCooldown -= dt;
    if (p.dashCooldown <= 0 && p.dashes < p.maxDashes) {
      p.dashes++;
      if (p.dashes < p.maxDashes) p.dashCooldown = DASH_COOLDOWN;
    }
  }

  if (p.flashTimer > 0) p.flashTimer -= dt;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.hp <= 0) p.dead = true;
  p._walkMoved = p._walkMoved && dist(startX, startY, p.x, p.y) > 1;

  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    if (def.mode === 'minigun') {
      const any = game.monsters.length > 0;
      if (any) w.spinup = Math.min(1, w.spinup + dt * 0.8);
      else w.spinup = Math.max(0, w.spinup - dt * 0.4);
    }
    if (w.cooldown > 0) { w.cooldown -= dt; continue; }

    const rate = calcRate(def, w, p);
    const range = calcRange(def, w, p);
    const target = nearestMonster(p.x, p.y, range);
    if (!target) continue;

    fireWeapon(w, def, p, target);
    w.cooldown = 1 / rate;
  }
}

function calcDmg(def: any, w: any, p: any) {
  const stats = getWeaponStats(w.id, w.level) || {};
  return (stats.dmg ?? def.dmg) * (p.dmgMult || 1);
}

function calcRate(def: any, w: any, p: any) {
  const stats = getWeaponStats(w.id, w.level) || {};
  let rate = (stats.rate ?? def.rate) * (p.atkSpdMult || 1);
  if (def.mode === 'minigun') {
    const baseRate = stats.rate ?? def.rate;
    const maxRate = stats.maxRate ?? def.maxRate ?? baseRate;
    rate = baseRate + (maxRate - baseRate) * (w.spinup || 0);
    rate *= (p.atkSpdMult || 1);
  }
  return rate;
}

function calcRange(def: any, w: any, p: any) {
  const stats = getWeaponStats(w.id, w.level) || {};
  return (stats.range ?? def.range) * (p.rangeMult || 1);
}

function nearestMonster(x: number, y: number, maxR: number) {
  const game = R.game;
  let best = null;
  let bestD = maxR;
  for (const m of game.monsters) {
    const d = dist(x, y, m.x, m.y);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function nearestMonsters(x: number, y: number, maxR: number, count: number) {
  const game = R.game;
  const inRange = game.monsters
    .map((m: any) => ({ m, d: dist(x, y, m.x, m.y) }))
    .filter(({ d }: any) => d <= maxR)
    .sort((a: any, b: any) => a.d - b.d)
    .slice(0, count)
    .map(({ m }: any) => m);
  return inRange;
}

function addProjectile(projectile: any) {
  const game = R.game;
  const life = projectile.life ?? 1;
  const size = projectile.size ?? 5;
  game.projectiles.push({
    age: 0,
    maxLife: projectile.maxLife ?? life,
    length: Math.max(6, projectile.length ?? size * 2.6),
    width: Math.max(2, projectile.width ?? size * 0.75),
    trailColor: projectile.trailColor || projectile.color,
    coreColor: projectile.coreColor || '#ffffff',
    glow: projectile.glow ?? 10,
    rot: projectile.rot ?? 0,
    spin: projectile.spin ?? 0,
    ...projectile,
  });
}

function createBoltPoints(x1: number, y1: number, x2: number, y2: number, segments = 6, spread = 24) {
  const points = [{ x:x1, y:y1 }];
  const nx = -(y2 - y1);
  const ny = x2 - x1;
  const nLen = Math.hypot(nx, ny) || 1;
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const baseX = x1 + (x2 - x1) * t;
    const baseY = y1 + (y2 - y1) * t;
    const falloff = 1 - Math.abs(t - 0.5) * 1.3;
    const offset = (Math.random() - 0.5) * spread * falloff;
    points.push({
      x: baseX + nx / nLen * offset,
      y: baseY + ny / nLen * offset,
    });
  }
  points.push({ x:x2, y:y2 });
  return points;
}

function spawnSparkBurst(x: number, y: number, color: string, count: number, speed: number, spread = Math.PI * 2, baseAngle = 0) {
  const game = R.game;
  for (let i = 0; i < count; i++) {
    const ang = baseAngle + (Math.random() - 0.5) * spread;
    const vel = speed * (0.45 + Math.random() * 0.75);
    game.particles.push({
      x, y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel,
      life: 0.14 + Math.random() * 0.14,
      maxLife: 0.28,
      color,
      r: 2 + Math.random() * 2,
      width: 1 + Math.random() * 1.2,
      type: 'spark',
    });
  }
}

function spawnSmokePuffs(x: number, y: number, count: number, size: number, speed: number, color = '#64748b') {
  const game = R.game;
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const vel = speed * (0.2 + Math.random() * 0.5);
    game.particles.push({
      x, y,
      vx: Math.cos(ang) * vel,
      vy: Math.sin(ang) * vel - speed * 0.25,
      life: 0.28 + Math.random() * 0.26,
      maxLife: 0.6,
      color,
      r: size * (0.4 + Math.random() * 0.45),
      grow: 12 + Math.random() * 10,
      type: 'smoke',
    });
  }
}

function spawnShockRing(x: number, y: number, color: string, maxRadius: number, lineWidth = 2, life = 0.22) {
  R.game.particles.push({ x, y, life, maxLife: life, color, maxRadius, lineWidth, type:'ring' });
}

function spawnMuzzleFlash(x: number, y: number, angle: number, color: string, size = 16) {
  spawnSparkBurst(x, y, color, 4, 120, 0.7, angle);
  spawnShockRing(x + Math.cos(angle) * 10, y + Math.sin(angle) * 10, color, size, 1.5, 0.08);
}

function spawnProjectileImpact(p: any) {
  switch (p.visual) {
    case 'sniper':
      spawnSparkBurst(p.x, p.y, '#d9c2ff', 8, 170);
      spawnShockRing(p.x, p.y, '#b388ff', 18, 2.5, 0.12);
      break;
    case 'shotgun':
      spawnSparkBurst(p.x, p.y, '#ffbe82', 5, 95);
      break;
    case 'flame':
      spawnSparkBurst(p.x, p.y, '#ff9348', 3, 50);
      spawnSmokePuffs(p.x, p.y, 1, 6, 12, '#5b4636');
      break;
    case 'boomerang':
      spawnSparkBurst(p.x, p.y, '#ff9dc8', 4, 80);
      break;
    default:
      spawnSparkBurst(p.x, p.y, p.color, 4, 80);
      break;
  }
}

function fireWeapon(w: any, def: any, owner: any, target: any) {
  const dmg = calcDmg(def, w, owner);
  const weaponStats = getWeaponStats(w.id, w.level) || {};
  const ox = owner.x, oy = owner.y;
  const tx = target.x, ty = target.y;
  const aimAng = Math.atan2(ty - oy, tx - ox);

  switch (def.mode) {
    case 'basic':
      if (w.id === 'rifle') {
        spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', false, {
          visual: 'rifle',
          trailColor: '#5cf2a0',
          coreColor: '#f4fff9',
          length: 18,
          width: 3,
          glow: 13,
          life: 1.1,
        });
        spawnMuzzleFlash(ox, oy, aimAng, '#5cf2a0', 14);
      } else {
        spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', false, {
          visual: 'pistol',
          trailColor: '#8ecbff',
          coreColor: '#ffffff',
          length: 15,
          width: 4,
          glow: 11,
        });
        spawnMuzzleFlash(ox, oy, aimAng, '#8ecbff', 12);
      }
      break;

    case 'minigun':
      spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', false, {
        visual: 'minigun',
        trailColor: '#8fd8ff',
        coreColor: '#ffffff',
        length: 12,
        width: 2.4,
        glow: 10,
        life: 0.95,
      });
      if (Math.random() < 0.6) spawnMuzzleFlash(ox, oy, aimAng, '#8fd8ff', 10);
      break;

    case 'shotgun': {
      const pellets = weaponStats.pellets ?? def.pellets;
      const baseAng = aimAng;
      for (let i = 0; i < pellets; i++) {
        const spread = (i / (pellets - 1) - 0.5) * def.spread;
        const ang = baseAng + spread;
        const speed = def.projSpeed * (0.85 + Math.random() * 0.3);
        addProjectile({
          x:ox, y:oy,
          vx:Math.cos(ang) * speed, vy:Math.sin(ang) * speed,
          dmg, size:def.projSize, color:def.color, life:0.45,
          owner:'player', pierce:false, type:'basic',
          visual:'shotgun',
          trailColor:'#ffb56f',
          coreColor:'#fff2d8',
          length:10,
          width:3.2,
          glow:8,
        });
      }
      spawnMuzzleFlash(ox, oy, baseAng, '#ff9d4d', 18);
      break;
    }

    case 'pierce':
      spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', true, {
        visual: 'sniper',
        trailColor: '#c79bff',
        coreColor: '#ffffff',
        length: 28,
        width: 3.6,
        glow: 18,
        life: 1.4,
      });
      spawnMuzzleFlash(ox, oy, aimAng, '#c79bff', 20);
      break;

    case 'melee': {
      const range = weaponStats.range ?? def.range;
      const baseAng = Math.atan2(ty - oy, tx - ox);
      const halfArc = def.arcAngle / 2;
      const hits = new Set();
      for (const m of R.game.monsters) {
        const d = dist(ox, oy, m.x, m.y);
        if (d > range + m.radius) continue;
        const ang = Math.atan2(m.y - oy, m.x - ox);
        let diff = ang - baseAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= halfArc) hits.add(m);
      }
      hits.forEach((m: any) => {
        dealDamage(m, dmg, owner);
        spawnParticles(m.x, m.y, def.color, 5, 60);
      });
      for (let i = 0; i < 8; i++) {
        const ang = baseAng - halfArc + (i / 7) * def.arcAngle;
        const r = range * (0.5 + Math.random() * 0.5);
        spawnParticles(ox + Math.cos(ang) * r, oy + Math.sin(ang) * r, def.color, 2, 30);
      }
      break;
    }

    case 'flame': {
      const baseAng = aimAng;
      for (let i = 0; i < 4; i++) {
        const ang = baseAng + (Math.random() - 0.5) * 0.5;
        const speed = def.projSpeed * (0.6 + Math.random() * 0.6);
        addProjectile({
          x:ox, y:oy,
          vx:Math.cos(ang) * speed, vy:Math.sin(ang) * speed,
          dmg,
          size: 6 + Math.random() * 5,
          color: Math.random() > 0.5 ? '#ff6b35' : '#f1c40f',
          life: 0.26 + Math.random() * 0.12,
          owner:'player', pierce:false, type:'flame',
          visual:'flame',
          trailColor:'#ff9348',
          coreColor:'#fff4a8',
          glow:12,
          spin:(Math.random() - 0.5) * 4,
        });
      }
      if (Math.random() < 0.35) spawnMuzzleFlash(ox, oy, baseAng, '#ff9348', 12);
      break;
    }

    case 'grenade':
      addProjectile({
        x:ox, y:oy,
        vx:(tx - ox) / dist(ox, oy, tx, ty) * def.projSpeed,
        vy:(ty - oy) / dist(ox, oy, tx, ty) * def.projSpeed,
        dmg,
        blastR: weaponStats.blastR ?? def.blastR,
        size:def.projSize,
        color:def.color,
        life:1.2,
        maxLife:1.2,
        owner:'player',
        pierce:false,
        type:'grenade',
        visual:'grenade',
        tx, ty,
        rot: Math.random() * Math.PI * 2,
        spin: 9 + Math.random() * 4,
        fuseTimer: 0.05,
      });
      spawnMuzzleFlash(ox, oy, aimAng, '#ffd54f', 14);
      break;

    case 'lightning': {
      const chains = weaponStats.chains ?? def.chains;
      let current = { x:ox, y:oy };
      const hit = new Set();
      let near = target;
      for (let i = 0; i < chains && near; i++) {
        hit.add(near);
        dealDamage(near, dmg, owner);
        R.game.particles.push({
          x:current.x, y:current.y, tx:near.x, ty:near.y,
          life:0.18, maxLife:0.18, type:'bolt', color:'#a29bfe',
          points: createBoltPoints(current.x, current.y, near.x, near.y, 7, 26),
        });
        spawnSparkBurst(near.x, near.y, '#d8c7ff', 4, 90);
        current = near;
        near = null;
        let bestD2 = 220;
        for (const m of R.game.monsters) {
          if (hit.has(m)) continue;
          const d2 = dist(current.x, current.y, m.x, m.y);
          if (d2 < bestD2) { bestD2 = d2; near = m; }
        }
      }
      break;
    }

    case 'boomerang': {
      const ang = aimAng;
      addProjectile({
        x:ox, y:oy,
        startX:ox, startY:oy,
        vx:Math.cos(ang) * def.projSpeed,
        vy:Math.sin(ang) * def.projSpeed,
        dmg,
        size:def.projSize,
        color:def.color,
        life:1.0,
        owner:'player',
        pierce:true,
        type:'boomerang',
        visual:'boomerang',
        ang,
        rot: ang,
        spin: 14,
        returning:false,
        hits:new Set(),
      });
      break;
    }
  }
}

function spawnProj(ox: number, oy: number, tx: number, ty: number, dmg: number, speed: number, size: number, color: string, owner: string, pierce: boolean, opts: any = {}) {
  const d = dist(ox, oy, tx, ty);
  if (d === 0) return;
  const travelLife = d / Math.max(1, speed) + 0.18;
  const life = Math.max(opts.life ?? 0, travelLife);
  addProjectile({
    x:ox, y:oy,
    startX:ox, startY:oy,
    vx:(tx - ox) / d * speed, vy:(ty - oy) / d * speed,
    dmg, size, color,
    life,
    maxLife: opts.maxLife ?? life,
    owner, pierce,
    type: opts.type || 'basic',
    ...opts,
  });
}

export function updateMonsters(dt: number) {
  const game = R.game;
  const t = game.tower;
  for (let i = game.monsters.length - 1; i >= 0; i--) {
    const m = game.monsters[i];

    if (dist(m.x, m.y, t.x, t.y) <= t.auraR) {
      m.hp -= t.auraDmg * dt;
      if (m.hp <= 0) { killMonster(i, 'base'); continue; }
    }

    const targets = [
      { x:t.x, y:t.y, isStruct:true, ref:t },
      { x:game.player.x, y:game.player.y, isStruct:false, ref:game.player },
      ...game.outposts.map((op: any) => ({ x:op.x, y:op.y, isStruct:true, ref:op })),
    ];
    const nearest = targets.reduce((b, t2) => {
      const d = dist(m.x, m.y, t2.x, t2.y);
      return d < b.d ? { d, t:t2 } : b;
    }, { d:Infinity, t:null as any });
    const tgt = nearest.t;
    if (!tgt) continue;

    const d = nearest.d;
    const contactR = (tgt.isStruct ? STRUCTURE_CONTACT_RADIUS : PLAYER_RADIUS) + m.radius;

    if (d > contactR) {
      m.x += (tgt.x - m.x) / d * m.speed * dt;
      m.y += (tgt.y - m.y) / d * m.speed * dt;
    }

    if (m.atkCooldown > 0) { m.atkCooldown -= dt; continue; }
    if (d > contactR + MONSTER_CONTACT_BUFFER) continue;
    m.atkCooldown = MONSTER_ATTACK_COOLDOWN;

    if (!tgt.isStruct) {
      if (game.player.invincible <= 0 && !game.player.dashing) {
        const dmg = m.dmg * (1 - (game.player.armor || 0));
        game.player.hp -= dmg;
        game.player.flashTimer = PLAYER_HIT_FLASH;
        game.player.invincible = PLAYER_HIT_INVULN;
        spawnDmgNum(game.player.x, game.player.y - 24, Math.round(dmg), '#ff6b6b');
      }
    } else {
      tgt.ref.hp -= m.dmg;
      spawnDmgNum(tgt.x, tgt.y - 24, Math.round(m.dmg), '#ff6b6b');
      if (tgt.ref.hp <= 0 && tgt.ref !== t) {
        const idx = game.outposts.indexOf(tgt.ref);
        if (idx !== -1) { spawnParticles(tgt.ref.x, tgt.ref.y, '#e74c3c', 20, 80); game.outposts.splice(idx, 1); }
      }
    }
  }
}

export function updateAutoConstruct() {
  const game = R.game;
  if (!(R.meta.upgrades['autoConstruct'] > 0)) return;
  const p = game.player;
  if (!(game.keys['ShiftLeft'] || game.keys['ShiftRight'])) return;
  if (p.dashing || !p._walkMoved) return;
  const { anchor, dist: anchorDist } = nearestAnchor(p.x, p.y);
  if (!anchor) return;
  if (anchorDist < AUTO_CONSTRUCT_SPACING) return;
  if (tryPlaceOutpostAt(p.x, p.y)) {
    spawnDmgNum(p.x, p.y - 28, 'AUTO 1m', '#27ae60');
  }
}

export function getBaseTurretMounts(t: any) {
  const count = Math.max(1, Math.min(5, t?.multishot || 1));
  const layouts: Record<number, Array<{ dx: number; dy: number }>> = {
    1: [{ dx: 0, dy: 0 }],
    2: [{ dx: -12, dy: 0 }, { dx: 12, dy: 0 }],
    3: [{ dx: -14, dy: -4 }, { dx: 14, dy: -4 }, { dx: 0, dy: 12 }],
    4: [{ dx: -14, dy: -8 }, { dx: 14, dy: -8 }, { dx: -14, dy: 10 }, { dx: 14, dy: 10 }],
    5: [{ dx: -14, dy: -8 }, { dx: 14, dy: -8 }, { dx: -14, dy: 10 }, { dx: 14, dy: 10 }, { dx: 0, dy: 2 }],
  };
  return (layouts[count] || layouts[1]).map((mount, index) => ({
    index,
    x: t.x + mount.dx,
    y: t.y + mount.dy,
  }));
}

export function updateStructures(dt: number) {
  const game = R.game;
  const t = game.tower;
  if (t.atkCooldown > 0) t.atkCooldown -= dt;
  else {
    const targets = nearestMonsters(t.x, t.y, t.atkRange, t.multishot || 1);
    if (targets.length > 0) {
      const mounts = getBaseTurretMounts(t);
      targets.forEach((m: any, index: number) => {
        const mount = mounts[Math.min(index, mounts.length - 1)] || { x: t.x, y: t.y };
        const aimD = dist(mount.x, mount.y, m.x, m.y) || 1;
        const muzzleX = mount.x + (m.x - mount.x) / aimD * 12;
        const muzzleY = mount.y + (m.y - mount.y) / aimD * 12;
        spawnProj(muzzleX, muzzleY, m.x, m.y, t.atkDmg, 460, 8, '#f1c40f', 'base', false, {
          visual:'tower',
          trailColor:'#ffe082',
          coreColor:'#fffbe8',
          length:16,
          width:4,
          glow:12,
          life:1.2,
          startZ:70,
        });
      });
      t.atkCooldown = 1 / t.atkSpeed;
    }
  }
  for (const op of game.outposts) {
    if (op.atkCooldown > 0) { op.atkCooldown -= dt; continue; }
    const m = nearestMonster(op.x, op.y, op.atkRange);
    if (m) {
      spawnProj(op.x, op.y, m.x, m.y, op.atkDmg, 420, 6, '#27ae60', 'tower', false, {
        visual:'structure',
        trailColor:'#78f3a5',
        coreColor:'#f3fff7',
        length:14,
        width:3,
        glow:10,
        life:1.1,
        startZ:40,
      });
      op.atkCooldown = 1 / op.atkSpeed;
    }
  }
}

export function updateProjectiles(dt: number) {
  const game = R.game;
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    if (!p) continue;
    p.life -= dt;
    p.age = (p.age || 0) + dt;
    if (p.spin) p.rot += p.spin * dt;
    if (p.life <= 0) { game.projectiles.splice(i, 1); continue; }

    if (p.type === 'flame') {
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.renderSize = (p.renderSize || p.size) + dt * 10;
      if (Math.random() < dt * 12) spawnSmokePuffs(p.x, p.y, 1, 4, 10, '#5a4634');
    }

    if (p.type === 'grenade') {
      p.fuseTimer = (p.fuseTimer || 0) - dt;
      if (p.fuseTimer <= 0) {
        p.fuseTimer = 0.05;
        spawnSparkBurst(p.x, p.y, '#ffd54f', 1, 45, 0.7, Math.atan2(p.vy, p.vx) + Math.PI);
        if (Math.random() < 0.7) spawnSmokePuffs(p.x, p.y, 1, 4, 8);
      }
    }

    if (p.type === 'boomerang') {
      if (!p.returning && p.life < 0.5) {
        p.returning = true;
        const owner = game.player;
        const d = dist(p.x, p.y, owner.x, owner.y);
        p.vx = (owner.x - p.x) / d * 320;
        p.vy = (owner.y - p.y) / d * 320;
      }
      if (p.returning) {
        const owner = game.player;
        const d = dist(p.x, p.y, owner.x, owner.y);
        if (d < 20) { game.projectiles.splice(i, 1); continue; }
        p.vx = (owner.x - p.x) / d * 320;
        p.vy = (owner.y - p.y) / d * 320;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.type === 'grenade' && dist(p.x, p.y, p.tx, p.ty) < 30) {
      explodeGrenade(p);
      game.projectiles.splice(i, 1);
      continue;
    }

    if (p.owner === 'base' || p.owner === 'tower' || p.owner === 'structure' || p.owner === 'player') {
      for (let j = game.monsters.length - 1; j >= 0; j--) {
        const m = game.monsters[j];
        if (p.hits && p.hits.has(m)) continue;
        if (dist(p.x, p.y, m.x, m.y) < m.radius + p.size) {
          const killed = dealDamage(m, p.dmg, p.owner === 'player' ? game.player : null);
          if (p.hits) p.hits.add(m);
          spawnProjectileImpact(p);
          if (killed) killMonster(j, p.owner);
          if (!p.pierce) { game.projectiles.splice(i, 1); break; }
        }
      }
    }
  }
}

function explodeGrenade(p: any) {
  const game = R.game;
  spawnShockRing(p.x, p.y, '#ffd54f', p.blastR * 0.7, 4, 0.22);
  spawnParticles(p.x, p.y, '#f1c40f', 20, 100);
  spawnParticles(p.x, p.y, '#ff6b35', 14, 70);
  spawnSparkBurst(p.x, p.y, '#ffd54f', 14, 180);
  spawnSmokePuffs(p.x, p.y, 7, 12, 55, '#6b7280');
  for (let j = game.monsters.length - 1; j >= 0; j--) {
    const m = game.monsters[j];
    if (dist(p.x, p.y, m.x, m.y) < p.blastR + m.radius) {
      const killed = dealDamage(m, p.dmg, game.player);
      if (killed) killMonster(j, 'player');
    }
  }
}

function dealDamage(monster: any, rawDmg: number, owner: any) {
  monster.hp -= rawDmg;
  spawnDmgNum(monster.x, monster.y - monster.radius, Math.round(rawDmg), '#fff');
  if (owner && owner.lifesteal) {
    owner.hp = Math.min(owner.hp + owner.lifesteal, owner.maxHp);
  }
  return monster.hp <= 0;
}

function killMonster(i: number, owner = 'player') {
  const game = R.game;
  const m = game.monsters[i];
  const goldMult = 1 + (game.player.goldFinder || 0);
  const gold = Math.round(m.gold * goldMult);
  game.gold += gold;
  spawnParticles(m.x, m.y, m.color, 10, 55);
  spawnDmgNum(m.x, m.y, gold, '#f1c40f');
  if (!game.killStats) game.killStats = { player: 0, base: 0, tower: 0 };
  if (owner === 'player') game.killStats.player++;
  else if (owner === 'base') game.killStats.base++;
  else if (owner === 'tower') game.killStats.tower++;
  game.monsters.splice(i, 1);
  game.monstersLeft = Math.max(0, game.monstersLeft - 1);
  checkWaveEnd();
}

function checkWaveEnd() {
  const game = R.game;
  if (game.waveActive && game.monsters.length === 0) {
    game.waveActive = false;
    game.projectiles = [];
    const waveCrystalReward = game._waveCrystalReward || 0;
    if (waveCrystalReward > 0) {
      R.meta.crystals += waveCrystalReward;
      game.crystalsEarned = (game.crystalsEarned || 0) + waveCrystalReward;
      saveMeta(R.meta);
      spawnDmgNum(game.player.x, game.player.y - 58, `+${waveCrystalReward}💎`, '#a855f7');
    }
    game.waveTimer = WAVE_INTERVAL + (game.waveDelayBonus || 0);
    if (game.devSession) {
      finishDevSession(`Wave ${game.wave} cleared. Adjust the preset and run again.`);
      return;
    }
    game._rerollCost = rerollBaseCost();
    game.levelUpCards = generateCards();
    game.shopCards = generateShopCards(4);
    game._pickedFreeCard = null;
    game._anyBought = false;
    game._cardActionHint = game.shopCards.some((card: any) => card?._locked && !card._bought)
      ? 'Locked cards stay in the shop for the next wave-end offer.'
      : null;
    R.state = 'levelup';
  }
}

function spawnParticles(x: number, y: number, color: string, count: number, speed: number) {
  const game = R.game;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx:Math.cos(a) * s, vy:Math.sin(a) * s, life:0.5 + Math.random() * 0.3, maxLife:0.8, color, r:2 + Math.random() * 3, type:'circle' });
  }
}

function spawnDmgNum(x: number, y: number, val: any, color?: string) {
  const v = typeof val === 'string' ? val : Math.round(val);
  R.game.dmgNumbers.push({ x, y, val: v, life:1.5, color: color || '#fff' });
}

export function updateParticles(dt: number) {
  const game = R.game;
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    if (p.type === 'bolt' || p.type === 'ring') continue;
    if (p.type === 'smoke') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.92;
      p.r += (p.grow || 10) * dt;
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= p.type === 'spark' ? 0.88 : 0.91;
    p.vy *= p.type === 'spark' ? 0.88 : 0.91;
  }
}

export function updateDmgNums(dt: number) {
  const game = R.game;
  for (let i = game.dmgNumbers.length - 1; i >= 0; i--) {
    const d = game.dmgNumbers[i];
    d.y -= 32 * dt;
    d.life -= dt;
    if (d.life <= 0) game.dmgNumbers.splice(i, 1);
  }
}

export function tryDash() {
  const p = R.game.player;
  if (p.dashing || p.dashes <= 0) return;
  const dashDuration = p.dashDuration || DASH_DURATION;
  const dashSpeed = p.dashSpeed || DASH_SPEED;
  p.dashing = true;
  p.dashTimer = dashDuration;
  p.dashes--;
  if (p.dashCooldown <= 0) p.dashCooldown = DASH_COOLDOWN;
  p.invincible = dashDuration + PLAYER_DASH_INVULN_BONUS;
  p.dashVx = p.facing.x * dashSpeed;
  p.dashVy = p.facing.y * dashSpeed;
  spawnParticles(p.x, p.y, '#3498db', 8, 80);
}

export function buildDropChanceTable(luck?: number) {
  const game = R.game;
  const lk = luck ?? ((game && game.player && game.player.luck) || 0);
  const wC = Math.max(1, 4 - lk);
  const wU = 2 + Math.floor(lk * 0.5);
  const wR = 1 + lk;

  let nC = 0, nU = 0, nR = 0;
  const weaponCards = game
    ? getWeaponCardPool(game)
    : Object.keys(WEAPONS).map(id => ({ weaponId:id, rarity: WEAPONS[id].rarity }));
  for (const card of weaponCards) {
    const rarity = card.rarity || 'common';
    if (rarity === 'rare') nR++;
    else if (rarity === 'uncommon') nU++;
    else nC++;
  }
  for (const s of STAT_UPGRADES) {
    if (game && !isStatUpgradeAvailable(s, game.player, game)) continue;
    const rarity = s.rarity || 'common';
    if (rarity === 'rare') nR++;
    else if (rarity === 'uncommon') nU++;
    else nC++;
  }

  const totalWeight = nC * wC + nU * wU + nR * wR;
  if (totalWeight === 0) return { common: 0, uncommon: 0, rare: 0 };
  return {
    common:   Math.round(wC / totalWeight * 1000) / 10,
    uncommon: Math.round(wU / totalWeight * 1000) / 10,
    rare:     Math.round(wR / totalWeight * 1000) / 10,
  };
}

export function rarityDropChance(rarity: string, luck?: number) {
  const t = buildDropChanceTable(luck);
  return rarity === 'rare' ? t.rare : rarity === 'uncommon' ? t.uncommon : t.common;
}

export function startDevWave() {
  const startWeapons = DEV_WEAPON_IDS
    .filter(id => (R.dev.config.weaponLevels[id] || 0) > 0)
    .map(id => ({ id, level: clamp(R.dev.config.weaponLevels[id] || 1, 1, 4) }));
  newGame({
    startGold: clamp(Math.round(R.dev.config.gold || 0), 0, 999999),
    startWeapons,
  });
  for (const stat of STAT_UPGRADES) {
    const count = clamp(Math.round(R.dev.config.cardCounts[stat.id] || 0), 0, devCardLimit(stat));
    for (let i = 0; i < count; i++) {
      applyCard({ type:'stat', statId: stat.id, rarity: stat.rarity || 'common' });
    }
  }
  R.game.wave = clamp(Math.round(R.dev.config.wave || 1), 1, 999) - 1;
  R.game.waveTimer = 0;
  R.game.levelUpCards = null;
  R.game.shopCards = null;
  R.state = 'playing';
  startNextWave(false);
  R.dev.menuStatus = `Started a normal run at wave ${R.game.wave}.`;
}
