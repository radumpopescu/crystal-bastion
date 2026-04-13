import {
  TOWER_RANGE, TOWER_HP_BASE, TOWER_AURA_RADIUS, TOWER_AURA_DMG,
  TOWER_ATK_RANGE, TOWER_ATK_DMG, TOWER_ATK_SPEED,
  PLAYER_HP_BASE, PLAYER_SPEED, PLAYER_ATK_RANGE, PLAYER_ATK_DMG, PLAYER_ATK_SPEED,
  TOWER_UPGRADES, META_UPGRADES,
} from './constants';
import { loadMeta, saveMeta, metaVal, type MetaState } from './meta';
import type { GameState } from './types';
import { inButton } from './utils';
import { getAnchors } from './systems/anchors';
import { tryPlaceOutpost } from './systems/outpost';
import { updatePlayer } from './systems/player';
import { updateMonsters, spawnWave } from './systems/monsters';
import { updateProjectiles } from './systems/combat';
import { updateTowerAndOutposts, applyTowerUpgrade } from './systems/tower';
import { updateParticles, updateDmgNumbers } from './systems/particles';
import {
  render, nextWaveBtn,
  renderUpgradeMenu,
} from './ui/render';
import {
  renderMenu, handleMenuClick, menuButtons,
  renderGameover, handleGameoverClick, gameoverButtons,
  renderMetaScreen, handleMetaClick, metaButtons, metaBackBtn,
  type ScreenState,
} from './ui/screens';
import * as renderModule from './ui/render';
import * as screensModule from './ui/screens';

// ─── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
const W = canvas.width, H = canvas.height;

// ─── STATE ───────────────────────────────────────────────────────────────────
let meta: MetaState = loadMeta();
let state: ScreenState = 'menu';
let game: GameState;
let prevState: ScreenState = 'menu'; // for back button in meta screen

function newGame() {
  const towerHpBonus      = metaVal(meta, 'towerHp');
  const playerHpBonus     = metaVal(meta, 'playerHp');
  const dmgMult           = metaVal(meta, 'playerDmg');
  const outpostHpBonus    = metaVal(meta, 'outpostHp');
  const startGold         = 80 + metaVal(meta, 'startGold');
  const outpostRangeBonus = metaVal(meta, 'outpostRange');

  game = {
    tick: 0, wave: 0, waveTimer: 5,
    waveActive: false, monstersLeft: 0,
    gold: startGold, crystalsEarned: 0,
    camera: { x: 0, y: 0 },
    tower: {
      x: 0, y: 0,
      hp: TOWER_HP_BASE + towerHpBonus,
      maxHp: TOWER_HP_BASE + towerHpBonus,
      range: TOWER_RANGE,
      auraRadius: TOWER_AURA_RADIUS,
      auraDmg: TOWER_AURA_DMG,
      atkRange: TOWER_ATK_RANGE,
      atkDmg: TOWER_ATK_DMG,
      atkSpeed: TOWER_ATK_SPEED,
      atkCooldown: 0,
      upgrades: { hp: 0, range: 0, aura: 0 },
    },
    player: {
      x: 0, y: -60,
      hp: PLAYER_HP_BASE + playerHpBonus,
      maxHp: PLAYER_HP_BASE + playerHpBonus,
      speed: PLAYER_SPEED,
      atkRange: PLAYER_ATK_RANGE,
      atkDmg: PLAYER_ATK_DMG * dmgMult,
      atkSpeed: PLAYER_ATK_SPEED,
      atkCooldown: 0,
      invincible: 0, flashTimer: 0, dead: false,
    },
    outposts: [],
    outpostRangeBonus,
    outpostHpBonus,
    monsters: [], projectiles: [], particles: [], dmgNumbers: [],
    keys: {}, showUpgradeMenu: false, upgradeMenuCooldown: 0,
  };
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (!game) return;
  game.keys[e.code] = true;
  if (state === 'playing') {
    if (e.code === 'KeyE') tryPlaceOutpost(game);
    if (e.code === 'KeyU') toggleUpgradeMenu();
    if (e.code === 'Escape') game.showUpgradeMenu = false;
  }
});
window.addEventListener('keyup', e => { if (game) game.keys[e.code] = false; });

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;

  if (state === 'menu') {
    const action = handleMenuClick(mx, my, screensModule.menuButtons);
    if (action === 'play') { newGame(); state = 'playing'; }
    if (action === 'meta') { prevState = 'menu'; state = 'metascreen'; }
  } else if (state === 'gameover') {
    const action = handleGameoverClick(mx, my, screensModule.gameoverButtons);
    if (action === 'play') { newGame(); state = 'playing'; }
    if (action === 'meta') { prevState = 'gameover'; state = 'metascreen'; }
  } else if (state === 'metascreen') {
    const result = handleMetaClick(mx, my, screensModule.metaButtons, screensModule.metaBackBtn, meta, prevState);
    if (result?.action === 'upgrade') {
      const upg = META_UPGRADES.find(u => u.id === result.id)!;
      const lvl = (meta.upgrades as any)[upg.id] ?? 0;
      if (lvl < upg.max && meta.crystals >= upg.cost) {
        meta.crystals -= upg.cost;
        (meta.upgrades as any)[upg.id] = lvl + 1;
        saveMeta(meta);
      }
    }
    if (result?.action === 'back') state = result.to;
  } else if (state === 'playing') {
    if (game.showUpgradeMenu) handleUpgradeClick(mx, my);
    handleHudClick(mx, my);
  }
});

// ─── UPGRADE MENU ─────────────────────────────────────────────────────────────
function toggleUpgradeMenu() {
  if (game.upgradeMenuCooldown > 0) return;
  const { dist: d } = { dist: Math.hypot(game.player.x - game.tower.x, game.player.y - game.tower.y) };
  if (d > game.tower.range * 0.8) return;
  game.showUpgradeMenu = !game.showUpgradeMenu;
  game.upgradeMenuCooldown = 0.3;
}

function handleUpgradeClick(mx: number, my: number) {
  const menuX = W / 2 - 160, menuY = H / 2 - 140;
  TOWER_UPGRADES.forEach((upg, i) => {
    const lvl = game.tower.upgrades[upg.id as keyof typeof game.tower.upgrades] || 0;
    if (lvl >= upg.max) return;
    const cost = upg.cost[lvl];
    const bx = menuX, by = menuY + 50 + i * 70;
    if (mx >= bx && mx <= bx + 320 && my >= by && my <= by + 50 && game.gold >= cost) {
      game.gold -= cost;
      (game.tower.upgrades as any)[upg.id]++;
      applyTowerUpgrade(game, upg.id);
    }
  });
}

function handleHudClick(mx: number, my: number) {
  if (renderModule.nextWaveBtn && !game.waveActive && inButton(mx, my, renderModule.nextWaveBtn)) {
    startNextWave();
  }
}

// ─── WAVES ───────────────────────────────────────────────────────────────────
function startNextWave() {
  game.wave++;
  spawnWave(game, game.wave);
  game.crystalsEarned = Math.floor(game.wave * 1.5);
}

function updateWave(dt: number) {
  if (game.waveActive) return;
  game.waveTimer -= dt;
  if (game.waveTimer <= 0) startNextWave();
}

// ─── GAME LOOP ────────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts: number) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (state === 'playing') {
    game.tick += dt;
    if (game.upgradeMenuCooldown > 0) game.upgradeMenuCooldown -= dt;
    updatePlayer(game, dt);
    updateMonsters(game, dt);
    updateProjectiles(game, dt);
    updateTowerAndOutposts(game, dt);
    updateParticles(game, dt);
    updateDmgNumbers(game, dt);
    updateWave(dt);
    game.camera.x += (game.player.x - game.camera.x) * 8 * dt;
    game.camera.y += (game.player.y - game.camera.y) * 8 * dt;
    if (game.tower.hp <= 0 || game.player.dead) {
      meta.crystals += game.crystalsEarned;
      saveMeta(meta);
      state = 'gameover';
    }
  }

  // Render
  ctx.clearRect(0, 0, W, H);
  if (state === 'menu') {
    renderMenu(ctx, W, H, meta);
  } else if (state === 'gameover') {
    renderGameover(ctx, W, H, game.wave, game.crystalsEarned, meta.crystals, game.player.dead);
  } else if (state === 'metascreen') {
    renderMetaScreen(ctx, W, H, meta);
  } else {
    render(ctx, canvas, game, meta, state);
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
