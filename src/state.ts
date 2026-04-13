import type { Runtime } from './types';
import { AUTO_CONSTRUCT_MODES, DASH_DURATION, DASH_SPEED, ISO_SCALE, META_UPGRADES, OUTPOST_HP_BASE, OUTPOST_RANGE, PLAYER_HP_BASE, PLAYER_SPEED, STAT_UPGRADES, TOWER_ATK_DMG, TOWER_ATK_RANGE, TOWER_ATK_SPEED, TOWER_AURA_DMG, TOWER_AURA_R, TOWER_HP_BASE, TOWER_RANGE, WEAPONS, WAVE_INTERVAL } from './constants';
import { clamp } from './utils';
import { loadMeta, metaValue, saveMeta } from './meta';

export const DEV_MENU_HOLD_MS = 2000;
export const DEV_WEAPON_IDS = Object.keys(WEAPONS);
export const DEV_CARD_IDS = STAT_UPGRADES.map(stat => stat.id);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

export const R: Runtime = {
  canvas,
  ctx,
  W: canvas.width,
  H: canvas.height,
  mouseX: 0,
  mouseY: 0,
  mouseInside: false,
  hoverRegions: [],
  cam: { sx: 0, sy: 0 },
  state: 'menu',
  prevState: 'menu',
  game: null,
  meta: loadMeta(),
  lastTime: 0,
  ui: {
    waveStartBtn: null,
    refreshAllBtn: null,
    continueBtn: null,
    rerollBtn: null,
    refreshShopBtn: null,
    menuBtns: [],
    gameoverBtns: [],
    pauseBtns: [],
    cardBookScroll: 0,
    cardBookBackBtn: null,
    metaBtns: [],
    metaBackBtn: null,
    metaScroll: 0,
    maxMetaScroll: 0,
    devMenuBtns: [],
    levelupWeaponBtns: [],
    levelupShopLockBtns: [],
    levelupBaseUpgradeBtns: [],
  },
  dev: {
    menuHoldStart: 0,
    menuStatus: 'Configure a sandbox loadout, then start a test wave.',
    config: null,
  },
};

window.addEventListener('resize', () => {
  R.canvas.width = window.innerWidth;
  R.canvas.height = window.innerHeight;
  R.W = R.canvas.width;
  R.H = R.canvas.height;
});

if ('autoConstructEnabled' in R.meta) {
  delete R.meta.autoConstructEnabled;
  saveMeta(R.meta);
}

export function metaVal(id: string) {
  return metaValue(R.meta, id);
}

export function w2s(wx: number, wy: number, wz = 0) {
  return {
    sx: R.W / 2 + (wx - wy) * ISO_SCALE - R.cam.sx,
    sy: R.H / 2 + (wx + wy) * ISO_SCALE * 0.5 - wz * ISO_SCALE * 0.5 - R.cam.sy,
  };
}

export function makeWeapon(id: string) {
  return { id, level:1, cooldown:0, spinup:0 };
}

export function newGame(opts: any = {}) {
  const playerHpBonus = metaVal('playerHp');
  const startGold = opts.startGold ?? (30 + metaVal('startGold'));
  const baseDashCharges = 2 + metaVal('extraDash');
  const towerHpBonus = metaVal('towerHp');
  const opHpBonus = metaVal('outpostHp');
  const towerAtkMult = metaVal('towerAtk') || 1;
  const towerRangeBonus = metaVal('towerRange');
  const towerSpdMult = metaVal('towerAtkSpd') || 1;
  const opAtkMult = metaVal('outpostAtk') || 1;
  const opRangeBonus = metaVal('outpostRange');
  const waveDelayBonus = metaVal('waveDelay');
  const freeOutposts = metaVal('freeDeploy');

  const startWeapons = Array.isArray(opts.startWeapons)
    ? opts.startWeapons
        .filter((w: any) => w?.id && WEAPONS[w.id] && (w.level || 0) > 0)
        .map((w: any) => ({ ...makeWeapon(w.id), level: clamp(w.level || 1, 1, 4) }))
    : (() => {
        const defaults = [makeWeapon('pistol')];
        if (metaVal('startWpn') > 0) defaults.push(makeWeapon('rifle'));
        return defaults;
      })();

  R.game = {
    tick: 0,
    wave: 0,
    waveTimer: 8,
    waveActive: false,
    monstersLeft: 0,
    gold: startGold,
    crystalsEarned: 0,
    waveDelayBonus,
    earlyBonusMult: 1 + metaVal('earlyBonus'),
    outpostDiscount: 0,
    freeOutpost: freeOutposts,

    tower: {
      x:0, y:0,
      hp: TOWER_HP_BASE + towerHpBonus,
      maxHp: TOWER_HP_BASE + towerHpBonus,
      range: TOWER_RANGE,
      auraR: TOWER_AURA_R, auraDmg: TOWER_AURA_DMG,
      atkRange: TOWER_ATK_RANGE + towerRangeBonus,
      atkDmg: TOWER_ATK_DMG * towerAtkMult,
      atkSpeed: TOWER_ATK_SPEED * towerSpdMult,
      atkCooldown: 0,
      upgrades: { hp:0, range:0, dmg:0 },
    },

    player: {
      x:0, y:-70,
      hp: PLAYER_HP_BASE + playerHpBonus,
      maxHp: PLAYER_HP_BASE + playerHpBonus,
      _baseMaxHp: PLAYER_HP_BASE + playerHpBonus,
      speed: PLAYER_SPEED,
      dmgMult: metaVal('playerDmg') || 1,
      atkSpdMult: 1, rangeMult: 1,
      armor: metaVal('playerArmor') || 0,
      lifesteal: 0,
      regen: metaVal('playerRegen') || 0,
      luck: 0, goldFinder: 0,
      maxDashes: baseDashCharges,
      dashes: baseDashCharges,
      _baseMaxDashes: baseDashCharges,
      dashLevel: 0,
      dashSpeed: DASH_SPEED,
      dashDuration: DASH_DURATION,
      dashCooldown: 0,
      dashing: false, dashTimer: 0,
      dashVx: 0, dashVy: 0,
      weapons: startWeapons,
      invincible: 0, flashTimer: 0, dead: false,
      facing: { x:1, y:0 },
    },

    outposts: [],
    opHpBonus, opAtkMult, opRangeBonus,
    monsters: [],
    projectiles: [],
    particles: [],
    dmgNumbers: [],
    levelUpCards: null,
    rerollsLeft: 1,
    shopCards: null,
    shopRefreshCost: 20,
    keys: {},
    showUpgradeMenu: false,
    upgradeMenuCooldown: 0,
      runCardCounts: {},
    runCardOrder: [],
    devSession: !!opts.devSession,
  };

  if (opts.startGold == null) R.game.gold += freeOutposts * 35;
}

export function createDefaultDevConfig() {
  const weaponLevels = Object.fromEntries(DEV_WEAPON_IDS.map(id => [id, 0]));
  weaponLevels.pistol = 1;
  if (metaVal('startWpn') > 0) weaponLevels.rifle = Math.max(weaponLevels.rifle, 1);
  return {
    gold: 30 + metaVal('startGold') + metaVal('freeDeploy') * 35,
    wave: 1,
    weaponLevels,
    cardCounts: Object.fromEntries(DEV_CARD_IDS.map(id => [id, 0])),
  };
}

R.dev.config = createDefaultDevConfig();

export function resetDevConfig() {
  R.dev.config = createDefaultDevConfig();
}

export function devCardLimit(stat: any) {
  return stat.max ?? 8;
}

export function devCardColor(stat: any) {
  if (stat.id.startsWith('tower')) return '#f39c12';
  if (stat.id.startsWith('outpost')) return '#3498db';
  return stat.rarity === 'rare' ? '#9b59b6' : stat.rarity === 'uncommon' ? '#2ecc71' : '#95a5a6';
}

export function finishDevSession(message: string) {
  if (!R.game?.devSession) return false;
  R.game.waveActive = false;
  R.game.waveTimer = WAVE_INTERVAL + (R.game.waveDelayBonus || 0);
  R.game.monsters = [];
  R.game.projectiles = [];
  R.game.particles = [];
  R.game.dmgNumbers = [];
  R.game.levelUpCards = null;
  R.game.shopCards = null;
  R.game._pickedFreeCard = null;
  R.game._anyBought = false;
  R.game.showUpgradeMenu = false;
  R.ui.waveStartBtn = null;
  R.dev.menuStatus = message;
  R.state = 'devmenu';
  return true;
}
