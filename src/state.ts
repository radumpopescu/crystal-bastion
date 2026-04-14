import type { Runtime } from './types';
import { ACTIVE_BALANCE_CONFIG, AUTO_CONSTRUCT_MODES, DASH_DURATION, DASH_SPEED, ISO_SCALE, MAX_WEAPON_SLOTS, META_UPGRADES, OUTPOST_HP_BASE, OUTPOST_RANGE, PLAYER_HP_BASE, PLAYER_SPEED, PLAYER_SPAWN_OFFSET_Y, SHOP_REFRESH_COST, STARTING_GOLD, STAT_UPGRADES, TOWER_ATK_DMG, TOWER_ATK_RANGE, TOWER_ATK_SPEED, TOWER_AURA_DMG, TOWER_AURA_R, TOWER_HP_BASE, TOWER_MULTISHOT, TOWER_RANGE, WEAPONS, WAVE_INTERVAL, buildInitialGameState } from './constants';
import { clamp } from './utils';
import { loadMeta, metaValue, saveMeta } from './meta';

export const DEV_MENU_HOLD_MS = 2000;
export const DEV_WEAPON_IDS = Object.keys(WEAPONS);
export const DEV_CARD_IDS = STAT_UPGRADES.map(stat => stat.id);

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('Canvas 2D context unavailable');

function detectMobileLandscape(width = window.innerWidth, height = window.innerHeight) {
  const ua = navigator.userAgent || '';
  const coarse = matchMedia?.('(pointer: coarse)')?.matches || navigator.maxTouchPoints > 0;
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const landscape = width >= height;
  const compactViewport = width <= 960 || height <= 540;
  return landscape && compactViewport && (coarse || mobileUa);
}

function getViewportSize() {
  const vv = window.visualViewport;
  const width = Math.round(vv?.width || window.innerWidth);
  const height = Math.round(vv?.height || window.innerHeight);
  return { width, height };
}

function syncViewport() {
  const { width, height } = getViewportSize();
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}

syncViewport();

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
  fps: 60,
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
    changelogScroll: 0,
    maxChangelogScroll: 0,
    changelogBackBtn: null,
    versionBtn: null,
    devMenuBtns: [],
    levelupWeaponBtns: [],
    levelupShopLockBtns: [],
    levelupBaseUpgradeBtns: [],
    isMobileLandscape: detectMobileLandscape(canvas.width, canvas.height),
    mobileDrawerOpen: false,
    mobileDrawerTab: 'loadout',
    mobileScrollY: 0,
    mobileScrollMax: 0,
    mobileScrollArea: null,
    mobileDrawerToggleBtn: null,
    mobileDrawerTabBtns: [],
  },
  dev: {
    menuHoldStart: 0,
    menuStatus: 'Configure a sandbox loadout, then start a test wave.',
    config: null,
  },
};

window.addEventListener('resize', () => {
  syncViewport();
  R.W = R.canvas.width;
  R.H = R.canvas.height;
  R.ui.isMobileLandscape = detectMobileLandscape(R.W, R.H);
  if (!R.ui.isMobileLandscape) {
    R.ui.mobileDrawerOpen = false;
    R.ui.mobileScrollY = 0;
  }
});

window.visualViewport?.addEventListener('resize', () => {
  syncViewport();
  R.W = R.canvas.width;
  R.H = R.canvas.height;
  R.ui.isMobileLandscape = detectMobileLandscape(R.W, R.H);
});

(window as any).__CB_RUNTIME = R;

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
  R.game = buildInitialGameState(ACTIVE_BALANCE_CONFIG, R.meta, opts);
}

export function createDefaultDevConfig() {
  const weaponLevels = Object.fromEntries(DEV_WEAPON_IDS.map(id => [id, 0]));
  const defaults = Array.isArray(ACTIVE_BALANCE_CONFIG?.player?.base?.startWeapons) ? ACTIVE_BALANCE_CONFIG.player.base.startWeapons : ['pistol'];
  defaults.forEach((id: string) => {
    if (weaponLevels[id] !== undefined) weaponLevels[id] = 1;
  });
  if (metaVal('startWpn') > 0 && weaponLevels.rifle !== undefined) weaponLevels.rifle = Math.max(weaponLevels.rifle, 1);
  return {
    gold: STARTING_GOLD + metaVal('startGold') + metaVal('freeDeploy') * (ACTIVE_BALANCE_CONFIG?.economy?.freeDeployGold || 0),
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
  R.ui.waveStartBtn = null;
  R.dev.menuStatus = message;
  R.state = 'devmenu';
  return true;
}
