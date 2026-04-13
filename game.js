// ─── CANVAS ──────────────────────────────────────────────────────────────────
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let W = canvas.width, H = canvas.height;

window.addEventListener('resize', () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  W = canvas.width; H = canvas.height;
});

// ─── ISO CONSTANTS ───────────────────────────────────────────────────────────
const TW = 40;          // tile half-width on screen (for a 1-tile = TILE_SIZE unit)
const TH = 20;          // tile half-height on screen
const ENTITY_H = 22;    // entity float height above ground
const SHADOW_SCALE = 0.35;
const ISO_SCALE = TW / 80; // world units → screen: 1 tile (80wu) = TW*2 px

// cam stores screen-space offset (isometric projection of player position)
function w2s(wx, wy, wz = 0) {
  return {
    sx: W / 2 + (wx - wy) * ISO_SCALE - cam.sx,
    sy: H / 2 + (wx + wy) * ISO_SCALE * 0.5 - wz * ISO_SCALE * 0.5 - cam.sy,
  };
}

// ─── WORLD CONSTANTS ─────────────────────────────────────────────────────────
const WORLD_TILES = 28;
const TILE_SIZE   = 80;

const TOWER_RANGE    = 700;
const OUTPOST_RANGE  = 550;
const LEASH_WARN     = 0.88;
const LEASH_DMG      = 0;

const TOWER_HP_BASE  = 600;
const TOWER_ATK_RANGE = 300;
const TOWER_ATK_DMG   = 28;
const TOWER_ATK_SPEED = 0.9;
const TOWER_AURA_R    = 140;
const TOWER_AURA_DMG  = 4;

const PLAYER_HP_BASE  = 180;
const PLAYER_SPEED    = 280;
const PLAYER_RADIUS   = 18;
const DASH_SPEED      = 480;
const DASH_DURATION   = 0.18;
const DASH_COOLDOWN   = 1.2;

const OUTPOST_HP_BASE = 100;
const OUTPOST_COST    = 40;

const WAVE_INTERVAL   = 42;
const BASE_MONSTERS   = 4;
const MONSTER_SCALE   = 1.20;

// ─── WEAPON DEFINITIONS ──────────────────────────────────────────────────────
const WEAPONS = {
  pistol: {
    name:'Pistol', icon:'🔫', color:'#5dade2',
    desc:'Reliable sidearm. Consistent single shots.',
    dmg:22, range:240, rate:1.2, projSpeed:420, projSize:5,
    mode:'basic', rarity:'common',
    levelBonus: [null, '+25% dmg', '+30% fire rate', '+40% range & dmg'],
  },
  shotgun: {
    name:'Shotgun', icon:'💥', color:'#e67e22',
    desc:'Devastating spread at close range.',
    dmg:14, range:160, rate:0.55, projSpeed:380, projSize:5,
    mode:'shotgun', pellets:6, spread:0.45, rarity:'common',
    levelBonus: [null, '+2 pellets', '+35% dmg', '+45% dmg, +2 pellets'],
  },
  rifle: {
    name:'Assault Rifle', icon:'⚡', color:'#2ecc71',
    desc:'High fire rate automatic. Melts groups.',
    dmg:13, range:220, rate:3.5, projSpeed:480, projSize:4,
    mode:'basic', rarity:'common',
    levelBonus: [null, '+40% fire rate', '+30% dmg', '+50% dmg & rate'],
  },
  sniper: {
    name:'Sniper', icon:'🎯', color:'#9b59b6',
    desc:'Extreme range. Pierces through enemies.',
    dmg:70, range:500, rate:0.4, projSpeed:700, projSize:6,
    mode:'pierce', rarity:'rare',
    levelBonus: [null, '+50% dmg', '+30% rate', '+80% dmg, pierces all'],
  },
  sword: {
    name:'Sword', icon:'⚔️', color:'#e74c3c',
    desc:'Melee arc attack. Hits all nearby enemies.',
    dmg:45, range:90, rate:1.1,
    mode:'melee', arcAngle: Math.PI * 1.1, rarity:'common',
    levelBonus: [null, '+30% dmg & range', '+50% dmg', '+80% dmg, bigger arc'],
  },
  flamethrower: {
    name:'Flamethrower', icon:'🔥', color:'#ff6b35',
    desc:'Continuous short-range fire cone. Burns enemies.',
    dmg:8, range:140, rate:8, projSpeed:200, projSize:7,
    mode:'flame', rarity:'uncommon',
    levelBonus: [null, '+40% dmg', '+50% range', '+60% dmg & range'],
  },
  grenade: {
    name:'Grenade', icon:'💣', color:'#f1c40f',
    desc:'Arcing explosive. Destroys groups on impact.',
    dmg:80, range:300, rate:0.5, projSpeed:250, projSize:9,
    mode:'grenade', blastR:90, rarity:'uncommon',
    levelBonus: [null, '+40% blast radius', '+50% dmg', '+70% dmg & radius'],
  },
  lightning: {
    name:'Lightning', icon:'⚡🌩', color:'#a29bfe',
    desc:'Chains between 3 enemies instantly.',
    dmg:35, range:280, rate:0.9,
    mode:'lightning', chains:3, rarity:'rare',
    levelBonus: [null, '+2 chains', '+45% dmg', '+60% dmg, +3 chains'],
  },
  boomerang: {
    name:'Boomerang', icon:'🪃', color:'#fd79a8',
    desc:'Returns to you, hitting enemies twice.',
    dmg:38, range:260, rate:0.7, projSpeed:300, projSize:8,
    mode:'boomerang', rarity:'uncommon',
    levelBonus: [null, '+3 bounces', '+40% dmg', '+60% dmg, extra spin'],
  },
  minigun: {
    name:'Minigun', icon:'🌀', color:'#74b9ff',
    desc:'Insane fire rate after spin-up.',
    dmg:9, range:200, rate:0.5, maxRate:9, projSpeed:460, projSize:4,
    mode:'minigun', spinup:0, rarity:'rare',
    levelBonus: [null, '+50% dmg', 'faster spin-up', '+70% dmg & rate'],
  },
};

// ─── STAT UPGRADE POOL (in-run cards) ────────────────────────────────────────
// apply(player, game)
const STAT_UPGRADES = [
  // Player stats                                                                                                       max  statKey           countFn
  { id:'maxHp',      icon:'❤️',  name:'Max HP',        desc:'+50 max health',              apply:(p)  => { p.maxHp += 50; p.hp = Math.min(p.hp+50, p.maxHp); },
    max:8,  count:(p) => Math.round((p.maxHp - (p._baseMaxHp||p.maxHp)) / 50) },
  { id:'regen',      icon:'💚',  name:'Regeneration',  desc:'+2.5 HP/sec regen',           apply:(p)  => { p.regen = (p.regen||0) + 2.5; },
    max:6,  count:(p) => Math.round((p.regen||0) / 2.5) },
  { id:'lifesteal',  icon:'🩸',  name:'Life Steal',    desc:'+10% lifesteal on hit',       apply:(p)  => { p.lifesteal = (p.lifesteal||0) + 0.10; },
    max:5,  count:(p) => Math.round((p.lifesteal||0) / 0.10) },
  { id:'damage',     icon:'💢',  name:'Raw Damage',    desc:'+22% all weapon damage',      apply:(p)  => { p.dmgMult = (p.dmgMult||1) * 1.22; },
    max:6,  count:(p) => Math.round(Math.log((p.dmgMult||1)) / Math.log(1.22)) },
  { id:'atkspd',     icon:'⚡',  name:'Attack Speed',  desc:'+22% attack speed',           apply:(p)  => { p.atkSpdMult = (p.atkSpdMult||1) * 1.22; },
    max:6,  count:(p) => Math.round(Math.log((p.atkSpdMult||1)) / Math.log(1.22)) },
  { id:'movespd',    icon:'👟',  name:'Move Speed',    desc:'+35 movement speed',          apply:(p)  => { p.speed += 35; },
    max:5,  count:(p) => Math.round((p.speed - PLAYER_SPEED) / 35) },
  { id:'range',      icon:'🔭',  name:'Range',         desc:'+22% weapon range',           apply:(p)  => { p.rangeMult = (p.rangeMult||1) * 1.22; },
    max:5,  count:(p) => Math.round(Math.log((p.rangeMult||1)) / Math.log(1.22)) },
  { id:'armor',      icon:'🛡️',  name:'Armor',         desc:'Reduce all damage by 12%',    apply:(p)  => { p.armor = Math.min(0.85, (p.armor||0) + 0.12); },
    max:5,  count:(p) => Math.round((p.armor||0) / 0.12),
    available:(p) => (p.armor||0) < 0.85 },
  { id:'goldFinder', icon:'💵',  name:'Gold Finder',   desc:'+20% gold from kills',        apply:(p)  => { p.goldFinder = (p.goldFinder||0) + 0.20; },
    max:5,  count:(p) => Math.round((p.goldFinder||0) / 0.20) },
  { id:'luck',       icon:'🍀',  name:'Lucky',         desc:'+1 luck: rarer cards more often', apply:(p) => { p.luck = (p.luck||0) + 1; }, rarity:'uncommon',
    max:4,  count:(p) => p.luck||0 },
  { id:'dash',       icon:'💨',  name:'Dash Charge',   desc:'+1 max dash charge',          apply:(p)  => { p.maxDashes=(p.maxDashes||1)+1; p.dashes=Math.min((p.dashes||1)+1,p.maxDashes); },
    max:4,  count:(p) => (p.maxDashes||1) - 1 },
  // Tower cards
  { id:'towerRepair',  icon:'🏰',  name:'Tower Repair',    desc:'Restore 200 tower HP',         apply:(p,g)  => { g.tower.hp = Math.min(g.tower.hp+200, g.tower.maxHp); }, rarity:'uncommon' },
  { id:'towerBoost',   icon:'🗼',  name:'Tower Overcharge',desc:'+30% tower damage this run',   apply:(p,g)  => { g.tower.atkDmg = Math.round(g.tower.atkDmg*1.30); }, rarity:'uncommon' },
  { id:'towerRadar',   icon:'📡',  name:'Tower Radar',     desc:'+120 tower attack range',      apply:(p,g)  => { g.tower.atkRange += 120; }, rarity:'uncommon' },
  { id:'towerSpeed',   icon:'🌀',  name:'Tower Rapid Fire',desc:'+35% tower fire rate',         apply:(p,g)  => { g.tower.atkSpeed *= 1.35; }, rarity:'uncommon' },
  // Outpost cards
  { id:'outpostRepair',icon:'🔧',  name:'Repair Outposts', desc:'Fully heal all outposts',      apply:(p,g)  => { for(const op of g.outposts) op.hp = op.maxHp; }, rarity:'uncommon' },
  { id:'outpostBoost', icon:'⚔️',  name:'Outpost Arsenal', desc:'+40% outpost damage this run', apply:(p,g)  => { for(const op of g.outposts) op.atkDmg = Math.round(op.atkDmg*1.40); }, rarity:'uncommon' },
  { id:'outpostCheap', icon:'💰',  name:'Supply Lines',    desc:'Outposts cost 5 less gold',    apply:(p,g)  => { g.outpostDiscount = (g.outpostDiscount||0) + 5; }, rarity:'uncommon',
    available:(p,g) => { const cur = OUTPOST_COST - (g.outpostDiscount||0); return cur > 10; } },
  { id:'extraOutpost', icon:'🏗️',  name:'Rapid Deploy',    desc:'Place a free outpost now',     apply:(p,g)  => { g.freeOutpost = (g.freeOutpost||0) + 1; }, rarity:'rare' },
];

// ─── META ─────────────────────────────────────────────────────────────────────
function loadMeta() {
  try { return JSON.parse(localStorage.getItem('towerMeta3d')) || { crystals:0, upgrades:{} }; }
  catch { return { crystals:0, upgrades:{} }; }
}
function saveMeta(m) { localStorage.setItem('towerMeta3d', JSON.stringify(m)); }

const META_UPGRADES = [
  // ── Player ──
  { id:'playerHp',      label:'Reinforced Body',    desc:'+40 max HP',                cost:6,  max:8,  cat:'player' },
  { id:'playerRegen',   label:'Regeneration',        desc:'+1.5 HP/sec regen',         cost:8,  max:5,  cat:'player' },
  { id:'playerArmor',   label:'Battle Armor',        desc:'+6% damage reduction',      cost:10, max:5,  cat:'player' },
  { id:'playerDmg',     label:'Raw Power',           desc:'+15% all damage',           cost:10, max:6,  cat:'player' },
  { id:'extraDash',     label:'Nimble',              desc:'+1 starting dash',          cost:8,  max:3,  cat:'player' },
  // ── Economy ──
  { id:'startGold',     label:'Scavenger',           desc:'+50 starting gold',         cost:5,  max:6,  cat:'econ'   },
  { id:'crystalBonus',  label:'Crystal Magnet',      desc:'+25% crystals per run',     cost:12, max:5,  cat:'econ'   },
  { id:'earlyBonus',    label:'Blitzkrieg',          desc:'+30% early wave gold bonus',cost:10, max:4,  cat:'econ'   },
  // ── Tower ──
  { id:'towerHp',       label:'Fortified Tower',     desc:'+200 tower HP',             cost:8,  max:6,  cat:'tower'  },
  { id:'towerAtk',      label:'Tower Arsenal',       desc:'+25% tower damage',         cost:10, max:5,  cat:'tower'  },
  { id:'towerRange',    label:'Tower Radar',         desc:'+100 tower attack range',   cost:9,  max:4,  cat:'tower'  },
  { id:'towerAtkSpd',   label:'Rapid Fire',          desc:'+20% tower fire rate',      cost:10, max:4,  cat:'tower'  },
  // ── Outposts ──
  { id:'outpostHp',     label:'Reinforced Outposts', desc:'+80 outpost HP',            cost:9,  max:5,  cat:'outpost'},
  { id:'outpostAtk',    label:'Outpost Cannons',     desc:'+30% outpost damage',       cost:10, max:4,  cat:'outpost'},
  { id:'outpostRange',  label:'Extended Network',    desc:'+100 outpost zone range',   cost:9,  max:4,  cat:'outpost'},
  // ── Unlocks ──
  { id:'startWpn',      label:'Head Start',          desc:'Start with Assault Rifle',  cost:12, max:1,  cat:'unlock' },
  { id:'waveDelay',     label:'Respite',             desc:'+8s between waves',         cost:8,  max:4,  cat:'unlock' },
  { id:'freeDeploy',    label:'Engineer Corps',      desc:'Start with extra gold',     cost:15, max:3,  cat:'unlock' },
  { id:'autoConstruct', label:'Auto-Construct',       desc:'Hold Shift to auto-place outposts while walking', cost:20, max:1,  cat:'unlock' },
];

let meta = loadMeta();

function metaVal(id) {
  const lvl = meta.upgrades[id] || 0;
  switch(id) {
    case 'playerHp':    return lvl * 40;
    case 'playerRegen': return lvl * 1.5;
    case 'playerArmor': return lvl * 0.06;
    case 'playerDmg':   return 1 + lvl * 0.15;
    case 'extraDash':   return lvl;
    case 'startGold':   return lvl * 50;
    case 'crystalBonus':return lvl * 0.25;
    case 'earlyBonus':  return lvl * 0.30;
    case 'towerHp':     return lvl * 200;
    case 'towerAtk':    return 1 + lvl * 0.25;
    case 'towerRange':  return lvl * 100;
    case 'towerAtkSpd': return 1 + lvl * 0.20;
    case 'outpostHp':   return lvl * 80;
    case 'outpostAtk':  return 1 + lvl * 0.30;
    case 'outpostRange':return lvl * 100;
    case 'startWpn':    return lvl;
    case 'waveDelay':   return lvl * 8;
    case 'freeDeploy':  return lvl;
  }
  return 0;
}

// ─── CAMERA ──────────────────────────────────────────────────────────────────
const cam = { sx: 0, sy: 0 };

// ─── GAME STATE ──────────────────────────────────────────────────────────────
let state = 'menu'; // menu | playing | levelup | gameover | metascreen | paused
let game;
let prevState = 'menu';

function newGame() {
  const playerHpBonus   = metaVal('playerHp');
  const startGold       = 60 + metaVal('startGold');
  const towerHpBonus    = metaVal('towerHp');
  const opHpBonus       = metaVal('outpostHp');
  const towerAtkMult    = metaVal('towerAtk') || 1;
  const towerRangeBonus = metaVal('towerRange');
  const towerSpdMult    = metaVal('towerAtkSpd') || 1;
  const opAtkMult       = metaVal('outpostAtk') || 1;
  const opRangeBonus    = metaVal('outpostRange');
  const waveDelayBonus  = metaVal('waveDelay');
  const freeOutposts    = metaVal('freeDeploy');

  const startWeapons = [makeWeapon('pistol')];
  if (metaVal('startWpn') > 0) startWeapons.push(makeWeapon('rifle'));

  game = {
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
      speed: PLAYER_SPEED,
      dmgMult: metaVal('playerDmg') || 1,
      atkSpdMult: 1, rangeMult: 1,
      armor: metaVal('playerArmor') || 0,
      lifesteal: 0,
      regen: metaVal('playerRegen') || 0,
      luck: 0, goldFinder: 0,
      maxDashes: 2 + metaVal('extraDash'),
      dashes:    2 + metaVal('extraDash'),
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
  };

  // Engineer Corps: bonus starting gold per level (enough to place outposts)
  game.gold += freeOutposts * 50;
  if (false) { // old free-outpost placement (kept for reference)
    const ang = 0;
    const maxHp = OUTPOST_HP_BASE + opHpBonus;
    game.outposts.push({
      x: Math.cos(ang) * 350, y: Math.sin(ang) * 350,
      hp: maxHp, maxHp,
      range: OUTPOST_RANGE + opRangeBonus,
      atkRange: 200, atkDmg: 18 * opAtkMult, atkSpeed: 0.85, atkCooldown: 0,
    });
  }
}

function makeWeapon(id) {
  return { id, level:1, cooldown:0, spinup:0 };
}

// ─── INPUT ───────────────────────────────────────────────────────────────────
window.addEventListener('keydown', e => {
  if (!game) return;
  game.keys[e.code] = true;
  if (state === 'playing' || state === 'paused') {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'playing') { state = 'paused'; game.showUpgradeMenu = false; }
      else state = 'playing';
      return;
    }
  }
  if (state === 'playing') {
    if (e.code === 'KeyE') tryPlaceOutpost();
    if (e.code === 'KeyU') toggleUpgradeMenu();
    if (e.code === 'Space') tryDash();
  }
});
window.addEventListener('keyup', e => { if (game) game.keys[e.code] = false; });
canvas.addEventListener('wheel', e => {
  // Normalise: mouse wheel gives ~100 deltaY per notch, trackpad gives small values.
  // Use a fixed step per "tick" for mouse, passthrough for trackpad.
  const step = Math.abs(e.deltaY) > 50 ? Math.sign(e.deltaY) * 60 : e.deltaY * 0.8;
  if (state === 'cardbook')   cardBookScroll  = Math.max(0, cardBookScroll  + step);
  if (state === 'metascreen') metaScroll      = clamp(metaScroll + step, 0, maxMetaScroll);
}, { passive:true });

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  if (state === 'menu')       handleMenuClick(mx, my);
  else if (state === 'gameover')   handleGameoverClick(mx, my);
  else if (state === 'metascreen') handleMetaClick(mx, my);
  else if (state === 'cardbook')   { if (cardBookBackBtn && inBtn(mx,my,cardBookBackBtn)) state='menu'; }
  else if (state === 'levelup')    handleCardClick(mx, my);
  else if (state === 'paused') {
    handlePauseClick(mx, my);
  } else if (state === 'playing') {
    if (game.showUpgradeMenu) handleUpgradeMenuClick(mx, my);
    else handlePlayingClick(mx, my);
  }
});

// ─── SAFE ZONE ───────────────────────────────────────────────────────────────
function getAnchors() {
  const a = [{ x:game.tower.x, y:game.tower.y, range:game.tower.range }];
  for (const op of game.outposts) a.push({ x:op.x, y:op.y, range:op.range });
  return a;
}

function nearestAnchor(x, y) {
  let best = null, bestD = Infinity;
  for (const a of getAnchors()) {
    const d = dist(x, y, a.x, a.y);
    if (d < bestD) { bestD = d; best = a; }
  }
  return { anchor: best, dist: bestD };
}

// ─── OUTPOST ─────────────────────────────────────────────────────────────────
function tryPlaceOutpost() {
  const cost = Math.max(10, OUTPOST_COST - (game.outpostDiscount || 0));
  const free = (game.freeOutpost || 0) > 0;
  if (!free && game.gold < cost) return;
  const { x:px, y:py } = game.player;
  const opRange = OUTPOST_RANGE + (game.opRangeBonus || 0);

  let canConnect = false;
  for (const a of getAnchors()) {
    if (dist(px, py, a.x, a.y) <= a.range + opRange * 0.6) { canConnect = true; break; }
  }
  if (!canConnect) return;
  for (const a of getAnchors()) {
    if (dist(px, py, a.x, a.y) < 65) return;
  }
  if (free) game.freeOutpost--;
  else game.gold -= cost;
  const maxHp = OUTPOST_HP_BASE + (game.opHpBonus || 0);
  const atkDmg = 18 * (game.opAtkMult || 1);
  game.outposts.push({ x:px, y:py, hp:maxHp, maxHp, range:opRange, atkRange:200, atkDmg, atkSpeed:0.85, atkCooldown:0 });
  spawnParticles(px, py, '#27ae60', 12, 60);
}

// ─── TOWER UPGRADES ──────────────────────────────────────────────────────────
const TOWER_UPGRADES = [
  { id:'hp',    label:'Tower HP +150',    cost:[60,100,150], max:3 },
  { id:'range', label:'Tower Range +60',  cost:[70,120],     max:2 },
  { id:'dmg',   label:'Tower Damage +40%',cost:[80,130],     max:2 },
];

function toggleUpgradeMenu() {
  if (game.upgradeMenuCooldown > 0) return;
  if (dist(game.player.x, game.player.y, game.tower.x, game.tower.y) > game.tower.range * 0.8) return;
  game.showUpgradeMenu = !game.showUpgradeMenu;
  game.upgradeMenuCooldown = 0.3;
}

function handleUpgradeMenuClick(mx, my) {
  const mX = W/2 - 165, mY = H/2 - 140;
  TOWER_UPGRADES.forEach((upg, i) => {
    const lvl = game.tower.upgrades[upg.id] || 0;
    if (lvl >= upg.max) return;
    const cost = upg.cost[lvl];
    const by = mY + 50 + i * 74;
    if (mx >= mX && mx <= mX+330 && my >= by && my <= by+54 && game.gold >= cost) {
      game.gold -= cost;
      game.tower.upgrades[upg.id]++;
      if (upg.id === 'hp')    { game.tower.maxHp += 150; game.tower.hp = Math.min(game.tower.hp+150, game.tower.maxHp); }
      if (upg.id === 'range') { game.tower.range += 60; }
      if (upg.id === 'dmg')   { game.tower.atkDmg = Math.round(game.tower.atkDmg * 1.4); }
    }
  });
}

function handlePlayingClick(mx, my) {
  // Pause button (top-right ⏸ area)
  if (mx >= W-46 && mx <= W-10 && my >= 10 && my <= 46) { state='paused'; return; }
  // Start wave button
  if (waveStartBtn && !game.waveActive && inBtn(mx, my, waveStartBtn)) {
    startNextWave(true); // early = give gold bonus
  }
}

// ─── WAVE SYSTEM ─────────────────────────────────────────────────────────────
let waveStartBtn = null;

function startNextWave(early = false) {
  // Early wave bonus: gold proportional to time remaining
  if (early && game.waveTimer > 0) {
    const bonusFraction = game.waveTimer / (WAVE_INTERVAL + (game.waveDelayBonus || 0));
    const bonusGold = Math.round(12 * bonusFraction * (game.earlyBonusMult || 1) * (1 + game.wave * 0.2));
    game.gold += bonusGold;
    spawnDmgNum(game.player.x, game.player.y - 40, `+${bonusGold}g EARLY BONUS`, '#f1c40f');
  }

  game.wave++;
  const count = Math.floor(BASE_MONSTERS * Math.pow(MONSTER_SCALE, game.wave - 1));
  const hpScale = 1 + (game.wave - 1) * 0.18;
  const spdScale = 1 + (game.wave - 1) * 0.03;

  // Find furthest anchor (tower or outpost) to determine spawn perimeter
  let maxAnchorDist = game.tower.range;
  for (const op of game.outposts) {
    const d = Math.hypot(op.x - game.tower.x, op.y - game.tower.y) + op.range;
    if (d > maxAnchorDist) maxAnchorDist = d;
  }
  const spawnBase = maxAnchorDist + 200;

  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spawnR = spawnBase + Math.random() * 220;
    const sx = game.tower.x + Math.cos(angle) * spawnR;
    const sy = game.tower.y + Math.sin(angle) * spawnR;

    let type = 'grunt';
    const r = Math.random();
    if (game.wave >= 3 && r < 0.20) type = 'rusher';
    if (game.wave >= 5 && r < 0.12) type = 'brute';
    if (game.wave >= 8 && r < 0.06) type = 'tank';

    const T = MONSTER_DEF[type];
    game.monsters.push({
      x:sx, y:sy, type,
      hp: T.hp * hpScale, maxHp: T.hp * hpScale,
      speed: T.speed * spdScale, dmg: T.dmg,
      gold: T.gold, radius: T.radius, color: T.color,
      atkCooldown: Math.random() * 1.5,
    });
  }
  game.monstersLeft = count;
  game.waveActive = true;
  const crystalMult = 1 + (metaVal('crystalBonus') || 0);
  game.crystalsEarned = Math.floor(game.wave * 3 * crystalMult);
}

const MONSTER_DEF = {
  grunt:  { hp:50,  speed:70,  dmg:9,  gold:4,  radius:14, color:'#e74c3c' },
  rusher: { hp:28,  speed:145, dmg:6,  gold:3,  radius:10, color:'#e67e22' },
  brute:  { hp:220, speed:48,  dmg:24, gold:10, radius:22, color:'#8e44ad' },
  tank:   { hp:500, speed:32,  dmg:35, gold:20, radius:28, color:'#2c3e50' },
};

// ─── LEVEL UP CARDS ───────────────────────────────────────────────────────────
function generateCards() {
  const pool = [];
  const p = game.player;
  const weaponIds = Object.keys(WEAPONS);

  // Weapon cards
  for (const id of weaponIds) {
    const existing = p.weapons.find(w => w.id === id);
    if (existing && existing.level < 4) {
      pool.push({ type:'weapon', weaponId:id, newLevel: existing.level + 1, rarity: WEAPONS[id].rarity });
    } else if (!existing && p.weapons.length < 6) {
      pool.push({ type:'weapon', weaponId:id, newLevel:1, rarity: WEAPONS[id].rarity });
    }
  }

  // Stat cards (skip maxed or unavailable)
  for (const s of STAT_UPGRADES) {
    if (s.available && !s.available(game.player, game)) continue;
    if (s.max !== undefined && s.count && s.count(game.player) >= s.max) continue;
    pool.push({ type:'stat', statId:s.id, rarity: s.rarity || 'common' });
  }

  // Shuffle with rarity weighting (luck reduces common weight, raises rare weight)
  const lk = game.player.luck || 0;
  const wCommon = Math.max(1, 4 - lk), wUncommon = 2 + Math.floor(lk * 0.5), wRare = 1 + lk;
  const weighted = pool.flatMap(c =>
    c.rarity === 'rare' ? Array(wRare).fill(c) : c.rarity === 'uncommon' ? Array(wUncommon).fill(c) : Array(wCommon).fill(c)
  );
  shuffle(weighted);
  const seen = new Set();
  const cards = [];
  for (const c of weighted) {
    const key = c.type === 'weapon' ? c.weaponId : c.statId;
    if (!seen.has(key)) { seen.add(key); cards.push(c); }
    if (cards.length >= 4) break;
  }
  // Pad if needed
  while (cards.length < 4) cards.push({ type:'stat', statId:'maxHp', rarity:'common' });
  return cards;
}

function cardGoldCost(card) {
  const rarityBase = { common: 18, uncommon: 32, rare: 55 };
  const base = rarityBase[card.rarity] || 18;
  const waveMult = 1 + (game.wave - 1) * 0.08;
  // Weapon upgrades (level up existing) are cheaper than new weapons
  if (card.type === 'weapon' && card.newLevel > 1) return Math.round(base * 0.75 * waveMult);
  return Math.round(base * waveMult);
}

function generateShopCards(n = 4) {
  const pool = [];
  const p = game.player;
  const weaponIds = Object.keys(WEAPONS);
  for (const id of weaponIds) {
    const existing = p.weapons.find(w => w.id === id);
    if (existing && existing.level < 4) pool.push({ type:'weapon', weaponId:id, newLevel: existing.level + 1, rarity: WEAPONS[id].rarity });
    else if (!existing && p.weapons.length < 6) pool.push({ type:'weapon', weaponId:id, newLevel:1, rarity: WEAPONS[id].rarity });
  }
  for (const s of STAT_UPGRADES) {
    if (s.available && !s.available(game.player, game)) continue;
    if (s.max !== undefined && s.count && s.count(game.player) >= s.max) continue;
    pool.push({ type:'stat', statId:s.id, rarity: s.rarity || 'common' });
  }

  const lk2 = game.player.luck || 0;
  const wC2 = Math.max(1, 4 - lk2), wU2 = 2 + Math.floor(lk2 * 0.5), wR2 = 1 + lk2;
  const weighted = pool.flatMap(c => c.rarity === 'rare' ? Array(wR2).fill(c) : c.rarity === 'uncommon' ? Array(wU2).fill(c) : Array(wC2).fill(c));
  shuffle(weighted);
  const seen = new Set();
  const cards = [];
  for (const c of weighted) {
    const key = c.type === 'weapon' ? c.weaponId : c.statId;
    // Don't duplicate free picks
    const inFree = game.levelUpCards && game.levelUpCards.some(fc => {
      const fkey = fc.type === 'weapon' ? fc.weaponId : fc.statId;
      return fkey === key;
    });
    if (!seen.has(key) && !inFree) { seen.add(key); cards.push({ ...c, cost: cardGoldCost(c) }); }
    if (cards.length >= n) break;
  }
  while (cards.length < n) cards.push({ type:'stat', statId:'damage', rarity:'common', cost: cardGoldCost({rarity:'common'}) });
  return cards;
}

function applyCard(card) {
  const p = game.player;
  if (card.type === 'weapon') {
    const existing = p.weapons.find(w => w.id === card.weaponId);
    if (existing) existing.level = card.newLevel;
    else p.weapons.push(makeWeapon(card.weaponId));
  } else {
    const s = STAT_UPGRADES.find(s => s.id === card.statId);
    if (s) s.apply(p, game);
  }
}

// Layout constants shared between render and click handler
// Level-up card sizes scale with viewport so both rows always fit
function luCardDims() {
  // Two rows of cards + header + reroll btn + shop header + continue btn must fit in H
  // Available height for both rows: H - 90 (top header) - 120 (gaps/buttons between/below)
  const availH = H - 90 - 120;
  const cardH = Math.max(160, Math.min(255, Math.floor(availH / 2)));
  const cardW = Math.round(cardH * (175 / 255));
  const gap = Math.max(8, Math.min(16, Math.floor(cardW * 0.09)));
  return { w: cardW, h: cardH, gap };
}
const LU_CARD_W = 175, LU_CARD_H = 255, LU_GAP = 16; // used as fallback reference in click handler
function luLayout(n, sectionY, cw, gap) {
  const totalW = n * cw + (n - 1) * gap;
  const startX = W / 2 - totalW / 2;
  return { startX, startY: sectionY };
}

// luPositions() returns card hit-test geometry matching renderLevelUpCards layout
function luPositions() {
  const { w: cW, h: cH, gap } = luCardDims();
  const panelW   = Math.min(220, W * 0.18);
  const loadoutW = panelW + 16;
  const centerX  = (W - loadoutW) / 2;         // center of the cards area (excluding loadout)
  const HEADER_H = 72, BOT_H = 52, SEC_GAP = 40;
  const availH   = H - HEADER_H - BOT_H;
  const freeTop  = HEADER_H + 26;
  const shopTop  = freeTop + cH + SEC_GAP + 24;
  return { cW, cH, gap, centerX, freeTop, shopTop, BOT_H };
}

function handleCardClick(mx, my) {
  if (!game.levelUpCards) return;
  const { cW, cH, gap, centerX, freeTop, shopTop, BOT_H } = luPositions();

  // ── Free pick ──
  const freeN = game.levelUpCards.length;
  const fTotalW = freeN * cW + (freeN-1) * gap;
  const fStartX = centerX - fTotalW/2;
  for (let i = 0; i < freeN; i++) {
    const bx = fStartX + i*(cW+gap), by = freeTop;
    if (mx >= bx && mx <= bx+cW && my >= by && my <= by+cH) {
      applyCard(game.levelUpCards[i]);
      game._pickedFreeCard = game.levelUpCards[i]; // remember for display
      game.levelUpCards = [];  // mark as picked (empty = chosen), keep screen open
      return;
    }
  }

  // ── Shop ──
  const sCards = game.shopCards || [];
  const sTotalW = sCards.length * cW + (sCards.length-1) * gap;
  const sStartX = centerX - sTotalW/2;
  for (let i = 0; i < sCards.length; i++) {
    const card = sCards[i];
    const bx = sStartX + i*(cW+gap), by = shopTop;
    if (mx >= bx && mx <= bx+cW && my >= by && my <= by+cH) {
      if (game.gold >= card.cost && !card._bought) {
        game.gold -= card.cost;
        applyCard(card);
        card._bought = true;    // mark as bought, keep in list for display
        game._anyBought = true; // disable refresh after buying
      }
      return;
    }
  }

  // ── Refresh All (bottom-left) ──
  if (refreshAllBtn && inBtn(mx, my, refreshAllBtn)) {
    if (game._anyBought) return; // locked after any purchase
    if (game.rerollsLeft <= 0) return;
    game.rerollsLeft--;
    const freePicked = !game.levelUpCards || game.levelUpCards.length === 0;
    if (!freePicked) { game.levelUpCards = generateCards(); game._pickedFreeCard = null; }
    game.shopCards = generateShopCards(4);
    return;
  }

  // ── Continue (bottom-right) ──
  if (continueBtn && inBtn(mx, my, continueBtn)) {
    game.levelUpCards = null;
    state = 'playing';
    game.waveTimer = WAVE_INTERVAL + (game.waveDelayBonus || 0);
  }
}

let refreshAllBtn = null, continueBtn = null;
// keep old names as null so nothing breaks
let rerollBtn = null, refreshShopBtn = null;

// ─── PLAYER UPDATE ───────────────────────────────────────────────────────────
function updatePlayer(dt) {
  const p = game.player;
  if (p.dead) return;

  // Regen
  if (p.regen) {
    p.hp = Math.min(p.hp + p.regen * dt, p.maxHp);
  }

  // Dash timer
  if (p.dashing) {
    p.dashTimer -= dt;
    p.x += p.dashVx * dt;
    p.y += p.dashVy * dt;
    if (p.dashTimer <= 0) { p.dashing = false; p.invincible = Math.max(p.invincible, 0.1); }
  } else {
    // Normal movement — isometric WASD
    let dx = 0, dy = 0;
    if (game.keys['KeyW'] || game.keys['ArrowUp'])    { dx -= 1; dy -= 1; }
    if (game.keys['KeyS'] || game.keys['ArrowDown'])  { dx += 1; dy += 1; }
    if (game.keys['KeyA'] || game.keys['ArrowLeft'])  { dx -= 1; dy += 1; }
    if (game.keys['KeyD'] || game.keys['ArrowRight']) { dx += 1; dy -= 1; }
    const len = Math.hypot(dx, dy);
    if (len > 0) {
      dx /= len; dy /= len;
      p.facing = { x:dx, y:dy };
      p.x += dx * p.speed * dt;
      p.y += dy * p.speed * dt;
    }
  }

  // Dash cooldown refill
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

  // Hold Shift = auto-place outposts while moving (requires meta unlock)
  if ((meta.upgrades['autoConstruct'] || 0) > 0 && meta.autoConstructEnabled !== false) {
    game._shiftPlaceCooldown = (game._shiftPlaceCooldown || 0) - dt;
    if ((game.keys['ShiftLeft'] || game.keys['ShiftRight']) && game._shiftPlaceCooldown <= 0) {
      tryPlaceOutpost();
      game._shiftPlaceCooldown = 0.6; // throttle: at most every 0.6s
    }
  }

  // Weapons
  for (const w of p.weapons) {
    const def = WEAPONS[w.id];
    // Minigun spinup
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

function calcDmg(def, w, p) {
  let dmg = def.dmg * p.dmgMult;
  if (w.level >= 2) dmg *= 1.25;
  if (w.level >= 3) dmg *= 1.35;
  if (w.level >= 4) dmg *= 1.50;
  return dmg;
}

function calcRate(def, w, p) {
  let rate = def.rate * p.atkSpdMult;
  if (def.mode === 'minigun') rate = def.rate + (def.maxRate - def.rate) * w.spinup;
  if (w.level >= 2 && def.levelBonus[1]?.includes('fire rate')) rate *= 1.40;
  if (w.level >= 3 && def.levelBonus[2]?.includes('fire rate')) rate *= 1.30;
  if (w.level >= 4 && def.levelBonus[3]?.includes('rate')) rate *= 1.50;
  return rate;
}

function calcRange(def, w, p) {
  let range = def.range * p.rangeMult;
  if (w.level >= 4 && def.levelBonus[3]?.includes('range')) range *= 1.40;
  return range;
}

function nearestMonster(x, y, maxR) {
  let best = null, bestD = maxR;
  for (const m of game.monsters) {
    const d = dist(x, y, m.x, m.y);
    if (d < bestD) { bestD = d; best = m; }
  }
  return best;
}

function fireWeapon(w, def, owner, target) {
  const dmg = calcDmg(def, w, owner);
  const ox = owner.x, oy = owner.y;
  const tx = target.x, ty = target.y;

  switch (def.mode) {
    case 'basic':
    case 'minigun':
      spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', false);
      break;

    case 'shotgun': {
      const pellets = def.pellets + (w.level >= 2 ? 2 : 0) + (w.level >= 4 ? 2 : 0);
      const baseAng = Math.atan2(ty - oy, tx - ox);
      for (let i = 0; i < pellets; i++) {
        const spread = (i / (pellets - 1) - 0.5) * def.spread;
        const ang = baseAng + spread;
        const speed = def.projSpeed * (0.85 + Math.random() * 0.3);
        game.projectiles.push({ x:ox, y:oy, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, dmg, size:def.projSize, color:def.color, life:0.6, owner:'player', pierce:false, type:'basic' });
      }
      break;
    }

    case 'pierce':
      spawnProj(ox, oy, tx, ty, dmg, def.projSpeed, def.projSize, def.color, 'player', true);
      break;

    case 'melee': {
      const arcMult = w.level >= 2 ? 1.3 : 1;
      const range = def.range * arcMult;
      const baseAng = Math.atan2(ty - oy, tx - ox);
      const halfArc = def.arcAngle / 2;
      const hits = new Set();
      for (const m of game.monsters) {
        const d = dist(ox, oy, m.x, m.y);
        if (d > range + m.radius) continue;
        const ang = Math.atan2(m.y - oy, m.x - ox);
        let diff = ang - baseAng;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        if (Math.abs(diff) <= halfArc) hits.add(m);
      }
      hits.forEach(m => {
        dealDamage(m, dmg, owner);
        spawnParticles(m.x, m.y, def.color, 5, 60);
      });
      // Visual arc particles
      for (let i = 0; i < 8; i++) {
        const ang = baseAng - halfArc + (i / 7) * def.arcAngle;
        const r = range * (0.5 + Math.random() * 0.5);
        spawnParticles(ox + Math.cos(ang)*r, oy + Math.sin(ang)*r, def.color, 2, 30);
      }
      break;
    }

    case 'flame': {
      const baseAng = Math.atan2(ty - oy, tx - ox);
      for (let i = 0; i < 3; i++) {
        const ang = baseAng + (Math.random() - 0.5) * 0.5;
        const speed = def.projSpeed * (0.6 + Math.random() * 0.6);
        game.projectiles.push({ x:ox, y:oy, vx:Math.cos(ang)*speed, vy:Math.sin(ang)*speed, dmg, size: 5 + Math.random()*5, color: Math.random()>0.5?'#ff6b35':'#f1c40f', life:0.35, owner:'player', pierce:false, type:'flame' });
      }
      break;
    }

    case 'grenade':
      game.projectiles.push({ x:ox, y:oy, vx:(tx-ox)/dist(ox,oy,tx,ty)*def.projSpeed, vy:(ty-oy)/dist(ox,oy,tx,ty)*def.projSpeed, dmg, blastR: def.blastR * (w.level>=2?1.4:1), size:def.projSize, color:def.color, life:1.2, owner:'player', pierce:false, type:'grenade', tx, ty });
      break;

    case 'lightning': {
      const chains = def.chains + (w.level >= 2 ? 2 : 0) + (w.level >= 4 ? 3 : 0);
      let current = { x:ox, y:oy };
      const hit = new Set();
      let near = target;
      for (let i = 0; i < chains && near; i++) {
        hit.add(near);
        dealDamage(near, dmg, owner);
        // Visual bolt
        game.particles.push({ x:current.x, y:current.y, tx:near.x, ty:near.y, life:0.25, maxLife:0.25, type:'bolt', color:'#a29bfe' });
        current = near;
        near = null;
        let bestD2 = 220;
        for (const m of game.monsters) {
          if (hit.has(m)) continue;
          const d2 = dist(current.x, current.y, m.x, m.y);
          if (d2 < bestD2) { bestD2 = d2; near = m; }
        }
      }
      break;
    }

    case 'boomerang': {
      const ang = Math.atan2(ty - oy, tx - ox);
      game.projectiles.push({ x:ox, y:oy, startX:ox, startY:oy, vx:Math.cos(ang)*def.projSpeed, vy:Math.sin(ang)*def.projSpeed, dmg, size:def.projSize, color:def.color, life: 1.0, owner:'player', pierce:true, type:'boomerang', ang, returning:false, hits:new Set() });
      break;
    }
  }
}

function spawnProj(ox, oy, tx, ty, dmg, speed, size, color, owner, pierce) {
  const d = dist(ox, oy, tx, ty);
  if (d === 0) return;
  game.projectiles.push({ x:ox, y:oy, vx:(tx-ox)/d*speed, vy:(ty-oy)/d*speed, dmg, size, color, life:2, owner, pierce, type:'basic' });
}

// ─── MONSTER UPDATE ──────────────────────────────────────────────────────────
function updateMonsters(dt) {
  const t = game.tower;
  for (let i = game.monsters.length - 1; i >= 0; i--) {
    const m = game.monsters[i];

    // Aura damage
    if (dist(m.x, m.y, t.x, t.y) <= t.auraR) {
      m.hp -= t.auraDmg * dt;
      if (m.hp <= 0) { killMonster(i); continue; }
    }

    // Find target
    const targets = [
      { x:t.x, y:t.y, isStruct:true, ref:t },
      { x:game.player.x, y:game.player.y, isStruct:false, ref:game.player },
      ...game.outposts.map(op => ({ x:op.x, y:op.y, isStruct:true, ref:op })),
    ];
    const nearest = targets.reduce((b, t2) => { const d=dist(m.x,m.y,t2.x,t2.y); return d<b.d?{d,t:t2}:b; }, {d:Infinity,t:null});
    const tgt = nearest.t;
    if (!tgt) continue;

    const d = nearest.d;
    const contactR = (tgt.isStruct ? 22 : PLAYER_RADIUS) + m.radius;

    if (d > contactR) {
      m.x += (tgt.x - m.x) / d * m.speed * dt;
      m.y += (tgt.y - m.y) / d * m.speed * dt;
    }

    if (m.atkCooldown > 0) { m.atkCooldown -= dt; continue; }
    if (d > contactR + 8) continue;
    m.atkCooldown = 1.4;

    if (!tgt.isStruct) {
      if (game.player.invincible <= 0 && !game.player.dashing) {
        const dmg = m.dmg * (1 - (game.player.armor || 0));
        game.player.hp -= dmg;
        game.player.flashTimer = 0.15;
        game.player.invincible = 0.45;
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

// ─── TOWER & OUTPOST SHOOTING ────────────────────────────────────────────────
function updateAutoConstruct() {
  if (!(meta.upgrades['autoConstruct'] > 0)) return;
  if (meta.autoConstructEnabled === false) return;
  const cost = Math.max(10, OUTPOST_COST - (game.outpostDiscount || 0));
  if (game.gold < cost * 1.5) return; // keep a buffer
  if (game.waveActive) return; // only build between waves

  // Find the best spot: on the perimeter of an existing anchor, away from other anchors
  const anchors = getAnchors();
  let bestSpot = null, bestScore = -1;

  for (const anchor of anchors) {
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      const cx = anchor.x + Math.cos(ang) * anchor.range * 0.85;
      const cy = anchor.y + Math.sin(ang) * anchor.range * 0.85;

      // Must not be too close to any existing anchor
      let tooClose = false;
      for (const other of anchors) {
        if (dist(cx, cy, other.x, other.y) < 70) { tooClose = true; break; }
      }
      if (tooClose) continue;

      // Score: prefer spots farther from tower (extends territory)
      const score = dist(cx, cy, game.tower.x, game.tower.y);
      if (score > bestScore) { bestScore = score; bestSpot = { x:cx, y:cy }; }
    }
  }

  if (!bestSpot) return;

  // Place it
  game.gold -= cost;
  const maxHp = OUTPOST_HP_BASE + (game.opHpBonus || 0);
  const atkDmg = 18 * (game.opAtkMult || 1);
  const opRange = OUTPOST_RANGE + (game.opRangeBonus || 0);
  game.outposts.push({ x:bestSpot.x, y:bestSpot.y, hp:maxHp, maxHp, range:opRange, atkRange:200, atkDmg, atkSpeed:0.85, atkCooldown:0 });
  spawnParticles(bestSpot.x, bestSpot.y, '#27ae60', 14, 60);
  spawnDmgNum(bestSpot.x, bestSpot.y - 30, '🤖 AUTO-BUILD', '#27ae60');
}

function updateStructures(dt) {
  const t = game.tower;
  if (t.atkCooldown > 0) t.atkCooldown -= dt;
  else {
    const m = nearestMonster(t.x, t.y, t.atkRange);
    if (m) { spawnProj(t.x, t.y, m.x, m.y, t.atkDmg, 460, 8, '#f1c40f', 'tower', false); t.atkCooldown = 1/t.atkSpeed; }
  }
  for (const op of game.outposts) {
    if (op.atkCooldown > 0) { op.atkCooldown -= dt; continue; }
    const m = nearestMonster(op.x, op.y, op.atkRange);
    if (m) { spawnProj(op.x, op.y, m.x, m.y, op.atkDmg, 420, 6, '#27ae60', 'structure', false); op.atkCooldown = 1/op.atkSpeed; }
  }
}

// ─── PROJECTILE UPDATE ───────────────────────────────────────────────────────
function updateProjectiles(dt) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.life -= dt;
    if (p.life <= 0) { game.projectiles.splice(i, 1); continue; }

    // Boomerang: reverse after half life
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

    // Grenade: check if near target, explode
    if (p.type === 'grenade' && dist(p.x, p.y, p.tx, p.ty) < 30) {
      explodeGrenade(p);
      game.projectiles.splice(i, 1);
      continue;
    }

    if (p.owner === 'tower' || p.owner === 'structure' || p.owner === 'player') {
      for (let j = game.monsters.length - 1; j >= 0; j--) {
        const m = game.monsters[j];
        if (p.hits && p.hits.has(m)) continue;
        if (dist(p.x, p.y, m.x, m.y) < m.radius + p.size) {
          const killed = dealDamage(m, p.dmg, p.owner === 'player' ? game.player : null);
          if (p.hits) p.hits.add(m);
          spawnParticles(p.x, p.y, p.color, 4, 40);
          if (killed) killMonster(j);
          if (!p.pierce) { game.projectiles.splice(i, 1); break; }
        }
      }
    }
  }
}

function explodeGrenade(p) {
  spawnParticles(p.x, p.y, '#f1c40f', 20, 100);
  spawnParticles(p.x, p.y, '#ff6b35', 14, 70);
  for (let j = game.monsters.length - 1; j >= 0; j--) {
    const m = game.monsters[j];
    if (dist(p.x, p.y, m.x, m.y) < p.blastR + m.radius) {
      const killed = dealDamage(m, p.dmg, game.player);
      if (killed) killMonster(j);
    }
  }
}

function dealDamage(monster, rawDmg, owner) {
  monster.hp -= rawDmg;
  spawnDmgNum(monster.x, monster.y - monster.radius, Math.round(rawDmg), '#fff');
  if (owner && owner.lifesteal) {
    owner.hp = Math.min(owner.hp + rawDmg * owner.lifesteal, owner.maxHp);
  }
  return monster.hp <= 0;
}

function killMonster(i) {
  const m = game.monsters[i];
  const goldMult = 1 + (game.player.goldFinder || 0);
  const gold = Math.round(m.gold * goldMult);
  game.gold += gold;
  spawnParticles(m.x, m.y, m.color, 10, 55);
  spawnDmgNum(m.x, m.y, gold, '#f1c40f');
  game.monsters.splice(i, 1);
  game.monstersLeft = Math.max(0, game.monstersLeft - 1);
  checkWaveEnd();
}

function checkWaveEnd() {
  if (game.waveActive && game.monsters.length === 0) {
    game.waveActive = false;
    game.waveTimer = WAVE_INTERVAL + (game.waveDelayBonus || 0); // always reset, even before card screen
    game.rerollsLeft = 1;
    game.levelUpCards = generateCards();
    game.shopCards = generateShopCards(4);
    game._pickedFreeCard = null;
    game._anyBought = false;
    state = 'levelup';
  }
}

// ─── PARTICLES ───────────────────────────────────────────────────────────────
function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({ x, y, vx:Math.cos(a)*s, vy:Math.sin(a)*s, life:0.5+Math.random()*0.3, maxLife:0.8, color, r:2+Math.random()*3, type:'circle' });
  }
}

function spawnDmgNum(x, y, val, color) {
  const v = typeof val === 'string' ? val : Math.round(val);
  game.dmgNumbers.push({ x, y, val: v, life:1.5, color: color || '#fff' });
}

function updateParticles(dt) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.life -= dt;
    if (p.life <= 0) { game.particles.splice(i, 1); continue; }
    if (p.type === 'bolt') continue; // static
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.91; p.vy *= 0.91;
  }
}

function updateDmgNums(dt) {
  for (let i = game.dmgNumbers.length - 1; i >= 0; i--) {
    const d = game.dmgNumbers[i];
    d.y -= 32 * dt; d.life -= dt;
    if (d.life <= 0) game.dmgNumbers.splice(i, 1);
  }
}

function tryDash() {
  const p = game.player;
  if (p.dashing || p.dashes <= 0) return;
  p.dashing = true;
  p.dashTimer = DASH_DURATION;
  p.dashes--;
  if (p.dashCooldown <= 0) p.dashCooldown = DASH_COOLDOWN;
  p.invincible = DASH_DURATION + 0.05;
  p.dashVx = p.facing.x * DASH_SPEED;
  p.dashVy = p.facing.y * DASH_SPEED;
  spawnParticles(p.x, p.y, '#3498db', 8, 80);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function dist(x1,y1,x2,y2) { return Math.hypot(x2-x1, y2-y1); }
function clamp(v,lo,hi) { return Math.max(lo, Math.min(hi, v)); }
function shuffle(arr) { for (let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];} return arr; }

// ─── UPDATE LOOP ─────────────────────────────────────────────────────────────
let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  if (state === 'playing') {
    game.tick += dt;
    if (game.upgradeMenuCooldown > 0) game.upgradeMenuCooldown -= dt;
    updatePlayer(dt);
    updateMonsters(dt);
    updateProjectiles(dt);
    updateStructures(dt);
    updateAutoConstruct();
    updateParticles(dt);
    updateDmgNums(dt);

    // Wave timer
    if (!game.waveActive) {
      game.waveTimer -= dt;
      if (game.waveTimer <= 0) startNextWave(false);
    }

    // Camera
    // Camera tracks player in iso screen space
    const targetSx = (game.player.x - game.player.y) * ISO_SCALE;
    const targetSy = (game.player.x + game.player.y) * ISO_SCALE * 0.5;
    cam.sx += (targetSx - cam.sx) * 7 * dt;
    cam.sy += (targetSy - cam.sy) * 7 * dt;

    if (game.tower.hp <= 0 || game.player.dead) {
      meta.crystals += game.crystalsEarned;
      saveMeta(meta);
      state = 'gameover';
    }
  }

  render();
  requestAnimationFrame(loop);
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, W, H);
  if (state === 'menu')       { renderMenu(); return; }
  if (state === 'gameover')   { renderGameover(); return; }
  if (state === 'metascreen') { renderMetaScreen(); return; }
  if (state === 'cardbook')   { renderCardBook(); return; }
  if (state === 'levelup')    { renderGame(); renderLevelUpCards(); return; }
  if (state === 'paused')     { renderGame(); renderPauseScreen(); return; }
  renderGame();
}

function renderGame() {
  renderFloor();
  renderSafeZones();

  // Depth sort: render back (high x+y) first
  const entities = [
    ...game.outposts.map(op => ({ ...op, _type:'outpost', _depth: op.x+op.y })),
    ...game.monsters.map(m  => ({ ...m,  _type:'monster', _depth: m.x+m.y })),
    { ...game.player, _type:'player', _depth: game.player.x+game.player.y },
    { ...game.tower,  _type:'tower',  _depth: game.tower.x+game.tower.y - 999 }, // tower always behind
  ];
  entities.sort((a,b) => a._depth - b._depth);

  renderStructuralBase(); // floor-level rings
  for (const e of entities) {
    if (e._type === 'tower')   renderTower();
    if (e._type === 'outpost') renderOutpost(game.outposts.find(op=>op.x===e.x&&op.y===e.y));
    if (e._type === 'monster') renderMonster(game.monsters.find(m=>m.x===e.x&&m.y===e.y));
    if (e._type === 'player')  renderPlayer();
  }

  renderProjectilesWorld();
  renderParticlesWorld();
  renderDmgNums();
  renderHUD();
  if (game.showUpgradeMenu) renderUpgradeMenu();
}

// ─── FLOOR ───────────────────────────────────────────────────────────────────
function renderFloor() {
  const visR = Math.ceil(Math.max(W, H) / (TW * 2)) + 4;
  // Recover approximate world tile center from player position
  const cx = Math.round(game.player.x / TILE_SIZE);
  const cy = Math.round(game.player.y / TILE_SIZE);

  for (let gx = -visR; gx <= visR; gx++) {
    for (let gy = -visR; gy <= visR; gy++) {
      const wx = (cx + gx) * TILE_SIZE;
      const wy = (cy + gy) * TILE_SIZE;
      const { sx, sy } = w2s(wx, wy);

      // Alternate tile colors
      const checker = (cx+gx+cy+gy) % 2 === 0;
      ctx.fillStyle = checker ? '#16213e' : '#1a2540';
      ctx.strokeStyle = '#0f1a30';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(sx,     sy - TH);
      ctx.lineTo(sx + TW, sy);
      ctx.lineTo(sx,     sy + TH);
      ctx.lineTo(sx - TW, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

// ─── SAFE ZONES ──────────────────────────────────────────────────────────────
function renderSafeZones() {
  for (const a of getAnchors()) {
    const { sx, sy } = w2s(a.x, a.y);
    const rsx = a.range * ISO_SCALE * 2;
    const rsy = rsx * 0.5;

    // Glow fill
    const grad = ctx.createRadialGradient(sx, sy, rsy * 0.4, sx, sy, rsy);
    grad.addColorStop(0, 'rgba(39,174,96,0)');
    grad.addColorStop(1, 'rgba(39,174,96,0.07)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI*2); ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(39,174,96,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI*2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function renderStructuralBase() {
  // Tower attack range
  const t = game.tower;
  const { sx, sy } = w2s(t.x, t.y);
  const rsx = t.atkRange * ISO_SCALE * 2;
  const rsy = rsx * 0.5;
  ctx.strokeStyle = 'rgba(241,196,15,0.10)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);
}

// ─── TOWER (ISO BOX) ─────────────────────────────────────────────────────────
function renderTower() {
  const t = game.tower;
  const { sx, sy } = w2s(t.x, t.y, 0);
  const bw = 30, bh = 48; // box half-width, height

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx, sy, bw*1.2, bw*0.5, 0, 0, Math.PI*2); ctx.fill();

  // Left wall
  ctx.fillStyle = '#1a2540';
  ctx.beginPath();
  ctx.moveTo(sx - bw, sy);
  ctx.lineTo(sx, sy + TH * 0.8);
  ctx.lineTo(sx, sy + TH * 0.8 - bh);
  ctx.lineTo(sx - bw, sy - bh);
  ctx.closePath(); ctx.fill();

  // Right wall
  ctx.fillStyle = '#253555';
  ctx.beginPath();
  ctx.moveTo(sx + bw, sy);
  ctx.lineTo(sx, sy + TH * 0.8);
  ctx.lineTo(sx, sy + TH * 0.8 - bh);
  ctx.lineTo(sx + bw, sy - bh);
  ctx.closePath(); ctx.fill();

  // Top face
  ctx.fillStyle = '#2c4070';
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx,      sy - bh - TH * 0.8);
  ctx.lineTo(sx + bw, sy - bh);
  ctx.lineTo(sx,      sy - bh + TH * 0.8);
  ctx.lineTo(sx - bw, sy - bh);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // Tower emblem
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⊕', sx, sy - bh - 2);
  ctx.textBaseline = 'alphabetic';

  // HP bar
  drawHpBar(sx - 36, sy - bh - 30, 72, 7, t.hp, t.maxHp, '#c0392b', '#27ae60');
}

// ─── OUTPOST (ISO SMALL BOX) ──────────────────────────────────────────────────
function renderOutpost(op) {
  if (!op) return;
  const { sx, sy } = w2s(op.x, op.y, 0);
  const bw = 14, bh = 24;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy, bw, bw*0.45, 0, 0, Math.PI*2); ctx.fill();

  ctx.fillStyle = '#0e2040';
  ctx.beginPath(); ctx.moveTo(sx-bw,sy); ctx.lineTo(sx,sy+TH*0.5); ctx.lineTo(sx,sy+TH*0.5-bh); ctx.lineTo(sx-bw,sy-bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#163060';
  ctx.beginPath(); ctx.moveTo(sx+bw,sy); ctx.lineTo(sx,sy+TH*0.5); ctx.lineTo(sx,sy+TH*0.5-bh); ctx.lineTo(sx+bw,sy-bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1e4080';
  ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx,sy-bh-TH*0.5); ctx.lineTo(sx+bw,sy-bh); ctx.lineTo(sx,sy-bh+TH*0.5); ctx.lineTo(sx-bw,sy-bh); ctx.closePath(); ctx.fill(); ctx.stroke();

  // Outpost attack range ring
  const rsx = op.atkRange * ISO_SCALE * 2;
  const rsy = rsx * 0.5;
  ctx.strokeStyle = 'rgba(52,152,219,0.18)';
  ctx.lineWidth = 1; ctx.setLineDash([3, 6]);
  ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI*2); ctx.stroke();
  ctx.setLineDash([]);

  drawHpBar(sx-20, sy-bh-18, 40, 5, op.hp, op.maxHp, '#e74c3c', '#3498db');
}

// ─── MONSTER ─────────────────────────────────────────────────────────────────
function renderMonster(m) {
  if (!m) return;
  const { sx, sy } = w2s(m.x, m.y, 0);
  const r = m.radius;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r*0.9, r*SHADOW_SCALE, 0, 0, Math.PI*2); ctx.fill();

  // Body
  ctx.fillStyle = m.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

  // Eye
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(sx + r*0.28, sy - ENTITY_H - r*0.2, r*0.28, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(sx + r*0.35, sy - ENTITY_H - r*0.2, r*0.14, 0, Math.PI*2); ctx.fill();

  // Vertical "leg" line to ground
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H + r); ctx.lineTo(sx, sy); ctx.stroke();

  if (m.hp < m.maxHp) {
    drawHpBar(sx - r, sy - ENTITY_H - r - 10, r*2, 4, m.hp, m.maxHp, '#e74c3c', '#e74c3c');
  }
}

// ─── PLAYER ──────────────────────────────────────────────────────────────────
function renderPlayer() {
  const p = game.player;
  const { sx, sy } = w2s(p.x, p.y, 0);
  const r = PLAYER_RADIUS;
  const flash = p.flashTimer > 0;

  // Dash trail
  if (p.dashing) {
    for (let i = 1; i <= 3; i++) {
      const tx2 = sx - p.dashVx * (i * 0.025) * ISO_SCALE;
      const ty2 = sy - p.dashVy * (i * 0.025) * TH / TILE_SIZE;
      ctx.globalAlpha = 0.25 / i;
      ctx.fillStyle = '#3498db';
      ctx.beginPath(); ctx.arc(tx2, ty2 - ENTITY_H, r, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r*1.1, r*0.45, 0, 0, Math.PI*2); ctx.fill();

  // Leg line
  ctx.strokeStyle = 'rgba(52,152,219,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H + r); ctx.lineTo(sx, sy); ctx.stroke();

  // Glow ring (always visible)
  ctx.shadowColor = p.dashing ? '#3498db' : '#00ffcc';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = p.dashing ? '#3498db' : '#00ffcc';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r + 3, 0, Math.PI*2); ctx.stroke();
  ctx.shadowBlur = 0;

  // Body
  ctx.fillStyle = flash ? '#ff6b6b' : '#dfe6e9';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r, 0, Math.PI*2); ctx.fill(); ctx.stroke();

  // Direction dot
  ctx.fillStyle = '#00ffcc';
  const fa = Math.atan2(p.facing.y, p.facing.x);
  ctx.beginPath(); ctx.arc(sx + Math.cos(fa)*(r-4), sy - ENTITY_H + Math.sin(fa)*(r-4), 4, 0, Math.PI*2); ctx.fill();

  // Weapon icons floating above
  const { sx:ws, sy:wy } = w2s(p.x, p.y, 0);
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    const def = WEAPONS[w.id];
    ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, ws + (i - (p.weapons.length-1)/2) * 16, wy - ENTITY_H - r - 14);
  }
  ctx.textBaseline = 'alphabetic';
}

// ─── PROJECTILES ─────────────────────────────────────────────────────────────
function renderProjectilesWorld() {
  for (const p of game.projectiles) {
    const { sx, sy } = w2s(p.x, p.y, 8);
    const r = p.size || 5;
    ctx.fillStyle = p.color;
    if (p.type === 'flame') {
      ctx.globalAlpha = p.life * 2.5;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (p.type === 'grenade') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI*2); ctx.fill();
    } else if (p.type === 'boomerang') {
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(game.tick * 8);
      ctx.fillStyle = p.color; ctx.beginPath();
      ctx.ellipse(0, 0, r, r*0.4, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    } else {
      // Trail
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx - p.vx * 0.03 * ISO_SCALE, sy - p.vy * 0.03 * ISO_SCALE * 0.5, r * 0.6, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = 1;
      // Glow + body
      ctx.shadowColor = p.color; ctx.shadowBlur = 12;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// ─── PARTICLES ───────────────────────────────────────────────────────────────
function renderParticlesWorld() {
  for (const p of game.particles) {
    const alpha = p.life / (p.maxLife || 0.8);
    ctx.globalAlpha = Math.max(0, alpha);

    if (p.type === 'bolt') {
      // Lightning bolt line
      const { sx:ax, sy:ay } = w2s(p.x, p.y, 10);
      const { sx:bx, sy:by } = w2s(p.tx, p.ty, 10);
      ctx.strokeStyle = p.color; ctx.lineWidth = 2;
      ctx.shadowColor = p.color; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      const { sx, sy } = w2s(p.x, p.y, 5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI*2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function renderDmgNums() {
  for (const d of game.dmgNumbers) {
    const { sx, sy } = w2s(d.x, d.y, 30);
    ctx.globalAlpha = Math.min(1, d.life);
    ctx.fillStyle = d.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.val, sx, sy);
  }
  ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function renderHUD() {
  const p = game.player, t = game.tower;

  // ── Tower HP — top center ──
  const tBarW = 260, tBarH = 52;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W/2 - tBarW/2 - 10, 8, tBarW + 20, tBarH, 8); ctx.fill();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('🏰 TOWER', W/2, 24);
  drawHpBar(W/2 - tBarW/2, 28, tBarW, 16, t.hp, t.maxHp, '#c0392b', '#e74c3c');
  ctx.fillStyle = '#ddd'; ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.ceil(t.hp)} / ${t.maxHp}`, W/2, 56);

  // ── Player HP — bottom left ──
  const pBarW = 220;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(10, H - 72, pBarW + 20, 62, 8); ctx.fill();
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillText('❤️ PLAYER', 18, H - 56);
  drawHpBar(18, H - 48, pBarW, 16, p.hp, p.maxHp, '#c0392b', '#27ae60');
  ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
  ctx.fillText(`${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`, 18, H - 22);

  // Dash pips
  for (let i = 0; i < p.maxDashes; i++) {
    ctx.fillStyle = i < p.dashes ? '#3498db' : '#1a2a3a';
    ctx.beginPath(); ctx.arc(18 + i*20, H - 10, 6, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#556'; ctx.font = '10px monospace';
  ctx.fillText('SPACE: dash', 18 + p.maxDashes*20 + 6, H - 6);

  // ── Pause — top right ──
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W - 50, 8, 42, 42, 8); ctx.fill();
  ctx.fillStyle = '#bdc3c7'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
  ctx.fillText('⏸', W - 29, 36);

  // ── Gold — top right (left of pause) ──
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W - 220, 8, 162, 42, 8); ctx.fill();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`⬡ ${game.gold}`, W - 60, 37);

  // ── Wave info — top left ──
  const waveBoxH = game.waveActive ? 80 : 110;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(10, 8, 230, waveBoxH, 8); ctx.fill();

  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${game.wave}`, 20, 32);

  if (game.waveActive) {
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 15px monospace';
    ctx.fillText(`👾 ${game.monsters.length} enemies`, 20, 56);
    waveStartBtn = null;
  } else {
    ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 15px monospace';
    ctx.fillText(`⏱ Next in ${Math.ceil(game.waveTimer)}s`, 20, 56);
    const earlyGold = Math.round(12 * (game.waveTimer / (WAVE_INTERVAL + (game.waveDelayBonus||0))) * (game.earlyBonusMult||1) * (1 + game.wave * 0.2));
    waveStartBtn = btn(125, 88, `▶ START  (+${earlyGold}g)`, '#e67e22', 220, 36);
  }

  // Weapons strip
  ctx.fillStyle = '#556'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(game.player.weapons.map(w => `${WEAPONS[w.id].icon}${w.level}`).join('  '), 20, game.waveActive ? 76 : game.waveActive ? 76 : 76);

  // ── Controls hint + crystals — above minimap ──
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rrect(W - 230, H - 280, 220, 70, 6); ctx.fill();
  ctx.fillStyle = '#666'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText('WASD move · SPACE dash', W - 14, H - 260);
  ctx.fillText('E: outpost · U: upgrades · P: pause', W - 14, H - 244);
  ctx.fillStyle = '#a855f7'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W - 14, H - 224);

  renderMinimap();
}

function renderMinimap() {
  const MM_SIZE  = 180;   // square size
  const MM_PAD   = 12;    // padding from edges
  const MM_SCALE = 0.055; // world units → minimap px
  const mx = W - MM_SIZE - MM_PAD;
  const my = H - MM_SIZE - MM_PAD;
  const cx = mx + MM_SIZE / 2;
  const cy = my + MM_SIZE / 2;

  // Background
  ctx.fillStyle = 'rgba(5,10,20,0.82)';
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.stroke();

  // Clip to minimap area
  ctx.save();
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.clip();

  function mm(wx, wy) {
    return { x: cx + wx * MM_SCALE, y: cy + wy * MM_SCALE };
  }

  // Safe zone circles
  for (const a of getAnchors()) {
    const { x, y } = mm(a.x, a.y);
    const r = a.range * MM_SCALE;
    ctx.strokeStyle = 'rgba(39,174,96,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.stroke();
    ctx.fillStyle = 'rgba(39,174,96,0.06)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
  }

  // Tower
  const tp = mm(game.tower.x, game.tower.y);
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 1.5;
  ctx.strokeRect(tp.x - 4, tp.y - 4, 8, 8);

  // Outposts
  for (const op of game.outposts) {
    const p2 = mm(op.x, op.y);
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 3, 0, Math.PI*2); ctx.fill();
  }

  // Monsters
  for (const m of game.monsters) {
    const p2 = mm(m.x, m.y);
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI*2); ctx.fill();
  }

  // Player
  const pp = mm(game.player.x, game.player.y);
  ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#00ffcc';
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 4, 0, Math.PI*2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.restore();

  // Label
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('MINIMAP', cx, my + MM_SIZE - 4);
}


// ─── UPGRADE MENU ─────────────────────────────────────────────────────────────
function renderUpgradeMenu() {
  const mX = W/2-165, mY = H/2-145;
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; rrect(mX-12, mY-12, 354, 300, 10); ctx.fill();
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2; rrect(mX-12, mY-12, 354, 300, 10); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER UPGRADES  (press U to close)', W/2, mY+14);
  TOWER_UPGRADES.forEach((upg, i) => {
    const lvl = game.tower.upgrades[upg.id]||0;
    const maxed = lvl>=upg.max;
    const cost = maxed?0:upg.cost[lvl];
    const canAfford = !maxed && game.gold>=cost;
    const by = mY+36+i*76;
    ctx.fillStyle = maxed?'#1a3a1a':canAfford?'#1a2a3a':'#2a1a1a';
    rrect(mX,by,330,58,6); ctx.fill();
    ctx.strokeStyle = maxed?'#27ae60':canAfford?'#3498db':'#444';
    ctx.lineWidth = 1.5; rrect(mX,by,330,58,6); ctx.stroke();
    ctx.fillStyle = maxed?'#27ae60':'#ecf0f1'; ctx.font='bold 13px monospace'; ctx.textAlign='left';
    ctx.fillText(upg.label, mX+10, by+22);
    ctx.fillStyle='#aaa'; ctx.font='11px monospace';
    ctx.fillText('●'.repeat(lvl)+'○'.repeat(upg.max-lvl), mX+10, by+42);
    if (!maxed) {
      ctx.fillStyle=canAfford?'#f1c40f':'#e74c3c'; ctx.font='bold 13px monospace'; ctx.textAlign='right';
      ctx.fillText(`⬡ ${cost}`, mX+325, by+22);
    } else {
      ctx.fillStyle='#27ae60'; ctx.font='bold 11px monospace'; ctx.textAlign='right';
      ctx.fillText('MAXED', mX+325, by+22);
    }
  });
  ctx.fillStyle='#666'; ctx.font='10px monospace'; ctx.textAlign='center';
  ctx.fillText('Press U or ESC to close', W/2, mY+280);
}

// ─── LEVEL UP CARDS ──────────────────────────────────────────────────────────
function drawCard(card, bx, by, cW, cH, opts = {}) {
  const isWeapon = card.type === 'weapon';
  const def = isWeapon ? WEAPONS[card.weaponId] : null;
  const stat = !isWeapon ? STAT_UPGRADES.find(s => s.id === card.statId) : null;
  const rarity = def?.rarity || stat?.rarity || 'common';
  const rarityColor = rarity === 'rare' ? '#9b59b6' : rarity === 'uncommon' ? '#e67e22' : '#3498db';
  const accentColor = isWeapon ? def.color : (opts.shopCard ? '#e67e22' : '#2ecc71');

  const bgColor = opts.picked ? '#0d2210' : opts.dimmed ? '#0a0a14' : '#0f1a2e';
  const borderColor = opts.picked ? '#27ae60' : opts.dimmed ? '#333' : accentColor;
  ctx.fillStyle = bgColor;
  rrect(bx, by, cW, cH, 10); ctx.fill();
  ctx.strokeStyle = borderColor; ctx.lineWidth = opts.picked ? 2.5 : 2;
  rrect(bx, by, cW, cH, 10); ctx.stroke();

  // Rarity stripe (green when picked)
  ctx.fillStyle = opts.picked ? '#27ae60' : rarityColor;
  rrect(bx, by, cW, 5, 4); ctx.fill();

  // Icon
  ctx.font = '38px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isWeapon ? def.icon : stat.icon, bx + cW/2, by + 50);

  // Name
  ctx.fillStyle = opts.dimmed ? '#666' : '#ecf0f1';
  ctx.font = 'bold 13px monospace'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(isWeapon ? def.name : stat.name, bx + cW/2, by + 92);

  // Level badge (weapon)
  if (isWeapon) {
    ctx.fillStyle = rarityColor;
    rrect(bx + cW/2 - 36, by + 98, 72, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
    const existing = game.player.weapons.find(w => w.id === card.weaponId);
    ctx.fillText(existing ? `LVL ${card.newLevel-1}→${card.newLevel}` : 'NEW', bx + cW/2, by + 111);
  }

  // Description
  ctx.fillStyle = opts.dimmed ? '#444' : '#aaa';
  ctx.font = '10px monospace';
  const desc = isWeapon ? def.desc : stat.desc;
  const words = desc.split(' '); let line = '', lineY = by + (isWeapon ? 132 : 112);
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > cW - 16) { ctx.fillText(line, bx + cW/2, lineY); lineY += 14; line = word; }
    else line = test;
  }
  if (line) ctx.fillText(line, bx + cW/2, lineY);

  // Level bonus
  if (isWeapon && def.levelBonus[card.newLevel-1]) {
    ctx.fillStyle = opts.dimmed ? '#555' : '#f1c40f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(def.levelBonus[card.newLevel-1], bx + cW/2, by + cH - 30);
  }

  // Bottom label
  if (opts.costLabel) {
    const canAfford = game.gold >= card.cost;
    ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(opts.costLabel, bx + cW/2, by + cH - 12);
  } else if (opts.dropChance != null) {
    ctx.fillStyle = '#555'; ctx.font = '10px monospace';
    ctx.fillText(`~${opts.dropChance}% chance`, bx + cW/2, by + cH - 12);
  } else if (!opts.dimmed) {
    ctx.fillStyle = accentColor; ctx.font = 'bold 11px monospace';
    ctx.fillText('CLICK TO CHOOSE', bx + cW/2, by + cH - 12);
  }

  ctx.textBaseline = 'alphabetic';
}

// Compute approximate drop chance % for a given rarity given current player luck
// Returns per-card drop % for each rarity so all cards together sum to 100%.
// Pool = all weapon new-unlock cards + all stat upgrades (representative baseline).
function buildDropChanceTable(luck) {
  const lk = luck ?? ((game && game.player && game.player.luck) || 0);
  const wC = Math.max(1, 4 - lk);
  const wU = 2 + Math.floor(lk * 0.5);
  const wR = 1 + lk;

  // Count cards by rarity (same pool shape as generateCards)
  let nC = 0, nU = 0, nR = 0;
  for (const def of Object.values(WEAPONS)) {
    const r = def.rarity || 'common';
    if (r === 'rare') nR++; else if (r === 'uncommon') nU++; else nC++;
  }
  for (const s of STAT_UPGRADES) {
    const r = s.rarity || 'common';
    if (r === 'rare') nR++; else if (r === 'uncommon') nU++; else nC++;
  }

  const totalWeight = nC * wC + nU * wU + nR * wR;
  if (totalWeight === 0) return { common: 0, uncommon: 0, rare: 0 };
  return {
    common:   Math.round(wC / totalWeight * 1000) / 10,   // one decimal
    uncommon: Math.round(wU / totalWeight * 1000) / 10,
    rare:     Math.round(wR / totalWeight * 1000) / 10,
  };
}

function rarityDropChance(rarity, luck) {
  const t = buildDropChanceTable(luck);
  return rarity === 'rare' ? t.rare : rarity === 'uncommon' ? t.uncommon : t.common;
}

function renderLevelUpCards() {
  const cards = game.levelUpCards;
  if (!cards) return;

  // ── Background ──
  ctx.fillStyle = 'rgba(4,8,20,0.93)'; ctx.fillRect(0, 0, W, H);

  const { w: cW, h: cH, gap } = luCardDims();
  const { freeTop, shopTop } = luPositions();

  // ── Loadout sidebar (right) ──
  const panelW = Math.max(160, Math.min(230, W * 0.17));
  const panelX = W - panelW - 12;
  ctx.fillStyle = '#0b1220';
  rrect(panelX, 0, panelW + 12, H, 0); ctx.fill();
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(panelX, 0); ctx.lineTo(panelX, H); ctx.stroke();

  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('LOADOUT', panelX + panelW/2, 28);

  // Weapons list
  let sideY = 48;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('WEAPONS', panelX + 10, sideY); sideY += 14;
  game.player.weapons.forEach(w => {
    const def = WEAPONS[w.id];
    ctx.fillStyle = def.color + 'cc'; ctx.font = '12px monospace';
    ctx.fillText(`${def.icon} ${def.name}`, panelX + 10, sideY);
    // level bar
    const barX = panelX + 10, barY = sideY + 3, barW = panelW - 20, pip = Math.floor((barW - 3*3) / 4);
    for (let lv = 0; lv < 4; lv++) {
      ctx.fillStyle = lv < w.level ? def.color : '#1e2a38';
      ctx.fillRect(barX + lv*(pip+3), barY, pip, 5);
    }
    ctx.fillStyle = '#556'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${w.level}/4`, panelX + panelW - 4, sideY);
    ctx.textAlign = 'left';
    sideY += 26;
  });

  // Stats list
  sideY += 6;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace';
  ctx.fillText('STATS', panelX + 10, sideY); sideY += 14;
  STAT_UPGRADES.filter(s => s.count && s.count(game.player) > 0 && s.max).forEach(s => {
    const cur = s.count(game.player);
    ctx.fillStyle = '#ccc'; ctx.font = '11px monospace';
    ctx.fillText(`${s.icon} ${s.name}`, panelX + 10, sideY);
    const pipW = Math.max(4, Math.floor((panelW - 20) / s.max) - 2);
    for (let p2 = 0; p2 < s.max; p2++) {
      ctx.fillStyle = p2 < cur ? '#2ecc71' : '#1a2a1a';
      ctx.fillRect(panelX + 10 + p2*(pipW+2), sideY + 3, pipW, 5);
    }
    ctx.fillStyle = '#556'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${cur}/${s.max}`, panelX + panelW - 4, sideY);
    ctx.textAlign = 'left';
    sideY += 22;
  });

  // ── Header ──
  const centerX = panelX / 2;
  ctx.fillStyle = '#1a2540';
  ctx.fillRect(0, 0, panelX, 66);
  ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 66); ctx.lineTo(panelX, 66); ctx.stroke();

  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`⚡ WAVE ${game.wave} COMPLETE`, centerX, 32);
  ctx.fillStyle = '#aaa'; ctx.font = '13px monospace';
  ctx.fillText(`Gold: ${game.gold} 🪙`, centerX - 80, 54);
  // Show picked status
  const freePicked = !cards || cards.length === 0;
  ctx.fillStyle = freePicked ? '#2ecc71' : '#e74c3c';
  ctx.font = '12px monospace'; ctx.textAlign = 'center';
  ctx.fillText(freePicked ? '✓ Free pick chosen' : '⬤ Choose a free card below', centerX + 60, 54);

  // ── FREE SECTION ──
  const fLabel = '✨  FREE PICK';
  ctx.fillStyle = freePicked ? '#1e3a1e' : '#0e1e2e';
  const freeCards = cards || [];
  const fTotalW = Math.max(1, freeCards.length) * cW + (Math.max(1, freeCards.length)-1)*gap;
  const fStartX = centerX - fTotalW/2;
  rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.fill();
  ctx.strokeStyle = freePicked ? '#27ae60' : '#2a4a6a'; ctx.lineWidth = 1.5;
  rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.stroke();

  ctx.fillStyle = freePicked ? '#27ae60' : '#5dade2';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText(fLabel, fStartX - 10, freeTop - 12);
  if (freePicked) {
    ctx.fillStyle = '#27ae60'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('✓ PICKED', fStartX + fTotalW + 10, freeTop - 12);
  }

  if (freePicked && game._pickedFreeCard) {
    // Show the picked card tinted green
    drawCard(game._pickedFreeCard, centerX - cW/2, freeTop, cW, cH, { picked: true });
  } else if (!freePicked) {
    freeCards.forEach((card, i) => {
      drawCard(card, fStartX + i*(cW+gap), freeTop, cW, cH);
    });
  }

  // ── SHOP SECTION ──
  const sCards = game.shopCards || [];
  const sTotalW = Math.max(1, sCards.length)*cW + (Math.max(1, sCards.length)-1)*gap;
  const sStartX = centerX - sTotalW/2;

  ctx.fillStyle = '#120e04';
  rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.fill();
  ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1.5;
  rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.stroke();

  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('🛒  SHOP', sStartX - 10, shopTop - 12);
  ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`Gold: ${game.gold} 🪙`, sStartX + sTotalW + 10, shopTop - 12);

  sCards.forEach((card, i) => {
    const bx = sStartX + i*(cW+gap);
    if (card._bought) {
      drawCard(card, bx, shopTop, cW, cH, { picked: true, costLabel: '✓ BOUGHT' });
    } else {
      const canAfford = game.gold >= card.cost;
      drawCard(card, bx, shopTop, cW, cH, {
        shopCard: true, dimmed: !canAfford, costLabel: `${card.cost}🪙`,
      });
    }
  });

  // ── Bottom bar ──
  const botY = H - 52;
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, botY, panelX, 52);
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, botY); ctx.lineTo(panelX, botY); ctx.stroke();

  // Refresh All — bottom-left (free rerolls only, locked after any buy)
  const canReroll = game.rerollsLeft > 0 && !game._anyBought;
  const refreshLabel = game._anyBought
    ? '🔒 Refresh locked'
    : game.rerollsLeft > 0
      ? `🔀 Refresh All  (${game.rerollsLeft} free)`
      : '🔀 No rerolls left';
  refreshAllBtn = btn(120, botY + 26, refreshLabel, canReroll ? '#5b2d8e' : '#252535', 220, 36);

  // Continue — bottom-right (of card area)
  continueBtn = btn(panelX - 110, botY + 26, '▶  DONE', '#27ae60', 180, 36);
}

// ─── MENU ────────────────────────────────────────────────────────────────────
let menuBtns = [];
function renderMenu() {
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0,0,W,H);
  // Stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i=0;i<100;i++) ctx.fillRect(i*137.5%W, i*73.3%H, 1.5, 1.5);

  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER SURVIVAL', W/2, H/2-130);
  ctx.fillStyle = '#7f8c8d'; ctx.font = '16px monospace';
  ctx.fillText('3D — Defend · Expand · Survive', W/2, H/2-88);
  ctx.fillStyle = '#f1c40f'; ctx.font = '14px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W/2, H/2-56);

  menuBtns = [
    btn(W/2, H/2+8,  'PLAY', '#27ae60'),
    btn(W/2, H/2+72, 'META UPGRADES 💎', '#8e44ad'),
    btn(W/2, H/2+136,'CARD BOOK 📖', '#2980b9'),
  ];
}

function handleMenuClick(mx, my) {
  if (menuBtns[0] && inBtn(mx,my,menuBtns[0])) { newGame(); state='playing'; }
  if (menuBtns[1] && inBtn(mx,my,menuBtns[1])) { prevState='menu'; metaScroll=0; state='metascreen'; }
  if (menuBtns[2] && inBtn(mx,my,menuBtns[2])) { cardBookScroll=0; state='cardbook'; }
}

// ─── GAME OVER ────────────────────────────────────────────────────────────────
let gameoverBtns = [];
function renderGameover() {
  ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 52px monospace'; ctx.textAlign = 'center';
  ctx.fillText(game.player.dead ? 'YOU DIED' : 'TOWER DESTROYED', W/2, H/2-140);
  ctx.fillStyle = '#ecf0f1'; ctx.font = '22px monospace';
  ctx.fillText(`Waves survived: ${game.wave}`, W/2, H/2-80);
  ctx.fillStyle = '#f1c40f'; ctx.font = '20px monospace';
  ctx.fillText(`+${game.crystalsEarned} crystals earned`, W/2, H/2-50);
  ctx.fillStyle = '#bdc3c7'; ctx.font = '15px monospace';
  ctx.fillText(`Weapons used: ${game.player.weapons.map(w=>WEAPONS[w.id].name+' Lv'+w.level).join(', ')}`, W/2, H/2-18);
  gameoverBtns = [
    btn(W/2-115, H/2+44, 'PLAY AGAIN', '#27ae60'),
    btn(W/2+115, H/2+44, 'UPGRADES 💎', '#8e44ad'),
  ];
}

function handleGameoverClick(mx,my) {
  if (gameoverBtns[0] && inBtn(mx,my,gameoverBtns[0])) { newGame(); state='playing'; }
  if (gameoverBtns[1] && inBtn(mx,my,gameoverBtns[1])) { prevState='gameover'; metaScroll=0; state='metascreen'; }
}

// ─── PAUSE SCREEN ─────────────────────────────────────────────────────────────
let pauseBtns = [];
function renderPauseScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 40px monospace'; ctx.textAlign='center';
  ctx.fillText('PAUSED', W/2, H/2 - 80);
  ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
  ctx.fillText('Press P or Escape to resume', W/2, H/2 - 44);
  pauseBtns = [
    btn(W/2, H/2+10,  '▶ RESUME', '#27ae60', 220, 44),
    btn(W/2, H/2+70, '🏠 QUIT TO MENU', '#c0392b', 220, 44),
  ];
}
function handlePauseClick(mx,my) {
  if (pauseBtns[0] && inBtn(mx,my,pauseBtns[0])) state='playing';
  if (pauseBtns[1] && inBtn(mx,my,pauseBtns[1])) { state='menu'; }
}

// ─── CARD BOOK ────────────────────────────────────────────────────────────────
let cardBookScroll = 0;
let cardBookBackBtn = null;
const CB_W = 148, CB_H = 215, CB_GAP = 10;

// Categories for the card book
const CB_SECTIONS = [
  {
    label: '⚔️  WEAPONS', color: '#e74c3c',
    cards: () => {
      const out = [];
      for (const [id, def] of Object.entries(WEAPONS)) {
        for (let lv = 1; lv <= 4; lv++) {
          out.push({ type:'weapon', weaponId:id, newLevel:lv, rarity:def.rarity });
        }
      }
      return out;
    },
  },
  {
    label: '🧍 PLAYER STATS', color: '#2ecc71',
    cards: () => STAT_UPGRADES
      .filter(s => !['towerRepair','towerBoost','towerRadar','towerSpeed','outpostRepair','outpostBoost','outpostCheap','extraOutpost'].includes(s.id))
      .map(s => ({ type:'stat', statId:s.id, rarity:s.rarity||'common' })),
  },
  {
    label: '🏰 TOWER CARDS', color: '#f39c12',
    cards: () => ['towerRepair','towerBoost','towerRadar','towerSpeed']
      .map(id => { const s = STAT_UPGRADES.find(x=>x.id===id); return s ? { type:'stat', statId:id, rarity:s.rarity||'uncommon' } : null; })
      .filter(Boolean),
  },
  {
    label: '🔵 OUTPOST CARDS', color: '#3498db',
    cards: () => ['outpostRepair','outpostBoost','outpostCheap','extraOutpost']
      .map(id => { const s = STAT_UPGRADES.find(x=>x.id===id); return s ? { type:'stat', statId:id, rarity:s.rarity||'uncommon' } : null; })
      .filter(Boolean),
  },
];

function renderCardBook() {
  ctx.fillStyle = '#070d1a'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#2980b9'; ctx.font = 'bold 26px monospace'; ctx.textAlign='center';
  ctx.fillText('📖 CARD BOOK', W/2, 36);

  // Drop chance legend — shows real per-card probabilities at current luck
  const lk = (game && game.player && game.player.luck) || 0;
  const t = buildDropChanceTable(lk);
  const legendY = 56;
  const items = [
    { label: 'Common',   color: '#3498db', pct: t.common   },
    { label: 'Uncommon', color: '#e67e22', pct: t.uncommon },
    { label: 'Rare',     color: '#9b59b6', pct: t.rare     },
  ];
  const legendTotalW = 420;
  let lx = W/2 - legendTotalW/2;
  ctx.font = '11px monospace'; ctx.textAlign = 'left';
  for (const it of items) {
    // Coloured pill
    ctx.fillStyle = it.color + '33';
    rrect(lx, legendY - 12, 132, 18, 4); ctx.fill();
    ctx.strokeStyle = it.color + '99'; ctx.lineWidth = 1;
    rrect(lx, legendY - 12, 132, 18, 4); ctx.stroke();
    ctx.fillStyle = it.color; ctx.font = 'bold 11px monospace';
    ctx.fillText(`${it.label}`, lx + 6, legendY);
    ctx.fillStyle = '#ddd'; ctx.font = '11px monospace';
    ctx.fillText(`${it.pct}% / card`, lx + 70, legendY);
    lx += 142;
  }
  if (lk > 0) {
    ctx.fillStyle = '#f1c40f'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`(Luck ${lk} active — rare/uncommon boosted)`, W/2, legendY + 16);
  }

  // Weapon cards: always 4 per row (one row per weapon)
  const WLEVELS = 4;
  const weaponIds = Object.keys(WEAPONS);
  // Fixed card width for weapons so exactly 4 fit with labels on left
  const WCB_W = Math.min(CB_W, Math.floor((W - 180 - CB_GAP * (WLEVELS-1)) / WLEVELS));
  const WCB_H = Math.round(WCB_W * (CB_H / CB_W));
  const WPANEL_W = WLEVELS * WCB_W + (WLEVELS-1) * CB_GAP;
  const WPANEL_X = W/2 - WPANEL_W/2;
  const WLABEL_W = WPANEL_X - 12; // left label area width

  // Stat card cols
  const statCols = Math.max(1, Math.floor((W - 48) / (CB_W + CB_GAP)));
  const statStartX = W/2 - (statCols*(CB_W+CB_GAP)-CB_GAP)/2;

  const SEC_HEADER_H = 36;
  const WPN_SUB_H = 24;  // per-weapon sub-header
  const topY = 74;
  const clipTop = topY;
  const clipBot = H - 48;

  const fakeGame = { player:{ weapons:[] }, outpostDiscount:0, outposts:[] };

  // ── Build a flat list of "draw ops" with Y positions ──
  // (compute curY twice: once to get totalH, once to draw)
  function layout(draw) {
    let y = topY - cardBookScroll;

    // ── WEAPONS section ──────────────────────────────────
    {
      const sec = CB_SECTIONS[0]; // weapons
      const secLabelY = y;
      if (draw && secLabelY + SEC_HEADER_H >= clipTop && secLabelY < clipBot) {
        ctx.fillStyle = sec.color + '1a';
        rrect(WPANEL_X - 4, secLabelY, WPANEL_W + 8, SEC_HEADER_H, 6); ctx.fill();
        ctx.strokeStyle = sec.color + '66'; ctx.lineWidth = 1.5;
        rrect(WPANEL_X - 4, secLabelY, WPANEL_W + 8, SEC_HEADER_H, 6); ctx.stroke();
        ctx.fillStyle = sec.color; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
        ctx.fillText(sec.label, W/2, secLabelY + SEC_HEADER_H - 10);
      }
      y += SEC_HEADER_H + 6;

      for (const wid of weaponIds) {
        const def = WEAPONS[wid];
        const rowH = WPN_SUB_H + WCB_H + CB_GAP;

        if (draw && y + rowH >= clipTop && y < clipBot) {
          // Weapon sub-header (left label)
          const subY = y;
          // Dim bg strip
          ctx.fillStyle = def.color + '18';
          rrect(WPANEL_X - 4, subY, WPANEL_W + 8, WPN_SUB_H, 4); ctx.fill();
          // Icon + name
          ctx.font = '14px monospace'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
          ctx.fillStyle = def.color;
          ctx.fillText(`${def.icon} ${def.name}`, WPANEL_X + WPANEL_W, subY + WPN_SUB_H/2);
          // Rarity tag
          const rarityColor = def.rarity === 'rare' ? '#9b59b6' : def.rarity === 'uncommon' ? '#e67e22' : '#3498db';
          ctx.fillStyle = rarityColor; ctx.font = '10px monospace'; ctx.textAlign = 'left';
          ctx.fillText(def.rarity.toUpperCase(), WPANEL_X, subY + WPN_SUB_H/2 + 5);
          ctx.textBaseline = 'alphabetic';

          // 4 level cards in a row
          const lvColors = ['#555','#27ae60','#e67e22','#9b59b6'];
          for (let lv = 1; lv <= WLEVELS; lv++) {
            const bx = WPANEL_X + (lv-1)*(WCB_W+CB_GAP);
            const by = subY + WPN_SUB_H;
            const card = { type:'weapon', weaponId:wid, newLevel:lv, rarity:def.rarity };
            const savedGame = game; game = fakeGame;
            drawCard(card, bx, by, WCB_W, WCB_H, { dropChance: rarityDropChance(card.rarity) });
            game = savedGame;
            // Level badge overlay
            ctx.fillStyle = lvColors[lv-1];
            ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
            ctx.fillText(`LV ${lv}`, bx + WCB_W/2, by + WCB_H - 2);
          }
        }
        y += WPN_SUB_H + WCB_H + CB_GAP + 6;
      }
      y += 14; // section bottom gap
    }

    // ── Stat sections ─────────────────────────────────────
    for (let si = 1; si < CB_SECTIONS.length; si++) {
      const sec = CB_SECTIONS[si];
      const cards = sec.cards();
      const rows = Math.ceil(cards.length / statCols);
      const secH = SEC_HEADER_H + 6 + rows*(CB_H+CB_GAP) + 14;

      if (draw && y + secH >= clipTop && y < clipBot) {
        // Section header
        const barY = y;
        ctx.fillStyle = sec.color + '1a';
        rrect(statStartX - 4, barY, statCols*(CB_W+CB_GAP)-CB_GAP+8, SEC_HEADER_H, 6); ctx.fill();
        ctx.strokeStyle = sec.color + '66'; ctx.lineWidth = 1.5;
        rrect(statStartX - 4, barY, statCols*(CB_W+CB_GAP)-CB_GAP+8, SEC_HEADER_H, 6); ctx.stroke();
        ctx.fillStyle = sec.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
        ctx.fillText(sec.label, statStartX + 4, barY + SEC_HEADER_H - 10);
        ctx.fillStyle = '#555'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
        ctx.fillText(`${cards.length} cards`, statStartX + statCols*(CB_W+CB_GAP)-CB_GAP+2, barY + SEC_HEADER_H - 10);

        const cardsY = barY + SEC_HEADER_H + 6;
        cards.forEach((card, idx) => {
          const col = idx % statCols;
          const row = Math.floor(idx / statCols);
          const bx = statStartX + col*(CB_W+CB_GAP);
          const by = cardsY + row*(CB_H+CB_GAP);
          if (by + CB_H < clipTop || by > clipBot) return;
          const savedGame = game; game = fakeGame;
          drawCard(card, bx, by, CB_W, CB_H, { dropChance: rarityDropChance(card.rarity) });
          game = savedGame;
        });
      }

      y += secH;
    }

    return y + cardBookScroll; // total content height
  }

  // Clamp scroll
  const totalH = layout(false);
  const maxScroll = Math.max(0, totalH - clipBot + 20);
  cardBookScroll = Math.min(cardBookScroll, maxScroll);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();
  layout(true);
  ctx.restore();

  // Bottom bar
  ctx.fillStyle = 'rgba(7,13,26,0.9)'; ctx.fillRect(0, clipBot, W, H - clipBot);
  ctx.fillStyle = '#444'; ctx.font = '11px monospace'; ctx.textAlign='center';
  ctx.fillText('↕  scroll with mouse wheel', W/2, clipBot + 16);
  cardBookBackBtn = btn(W/2, H - 18, '← BACK TO MENU', '#555', 220, 28);
}

function handleCardBookScroll(dy) {
  if (state !== 'cardbook') return;
  cardBookScroll = Math.max(0, cardBookScroll + dy);
}

// ─── META SCREEN ─────────────────────────────────────────────────────────────
let metaBtns = [], metaBackBtn2 = null;
let metaScroll = 0;
let maxMetaScroll = 0;
const CAT_COLORS = { player:'#e74c3c', econ:'#f1c40f', tower:'#f39c12', outpost:'#3498db', unlock:'#8e44ad' };
const CAT_LABELS = { player:'⚔️ PLAYER', econ:'💰 ECONOMY', tower:'🏰 TOWER', outpost:'🔵 OUTPOSTS', unlock:'🔓 UNLOCKS' };

function renderMetaScreen() {
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0,0,W,H);
  ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText('META UPGRADES', W/2, 42);
  ctx.fillStyle = '#f1c40f'; ctx.font = '16px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals available`, W/2, 66);

  metaBtns = [];
  const cols=3, cardW=245, cardH=106, gX=18, gY=12;
  const totalW = cols*cardW+(cols-1)*gX;
  const sX = W/2-totalW/2;
  const HEADER_H = 78;
  const clipTop = HEADER_H, clipBot = H - 52;
  const acUnlocked = (meta.upgrades['autoConstruct'] || 0) > 0;

  let layoutRow = 0, layoutCol = 0;
  let layoutLastCat = null;
  let contentBottom = clipTop;
  META_UPGRADES.forEach((upg) => {
    if (upg.cat !== layoutLastCat) {
      if (layoutCol !== 0) { layoutRow++; layoutCol = 0; }
      layoutRow += 0.22;
      layoutLastCat = upg.cat;
    }
    const cardTop = clipTop + layoutRow * (cardH + gY);
    contentBottom = Math.max(contentBottom, cardTop + cardH);
    layoutCol++;
    if (layoutCol >= cols) { layoutCol = 0; layoutRow++; }
  });
  if (acUnlocked) {
    const toggleTop = clipTop + (layoutRow + (layoutCol > 0 ? 1 : 0)) * (cardH + gY) + 12;
    contentBottom = Math.max(contentBottom, toggleTop + 42);
  }
  maxMetaScroll = Math.max(0, contentBottom - clipBot + 12);
  metaScroll = clamp(metaScroll, 0, maxMetaScroll);

  ctx.save();
  ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();

  let row = 0, col = 0;
  let lastCat = null;
  META_UPGRADES.forEach((upg) => {
    if (upg.cat !== lastCat) {
      if (col !== 0) { row++; col = 0; }
      const ly = clipTop + row * (cardH + gY) - metaScroll;
      if (ly > clipTop - 20 && ly < clipBot) {
        ctx.fillStyle = CAT_COLORS[upg.cat] || '#aaa';
        ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(CAT_LABELS[upg.cat] || upg.cat.toUpperCase(), sX, ly + 14);
      }
      row += 0.22;
      lastCat = upg.cat;
    }

    const bx = sX + col*(cardW+gX);
    const by = clipTop + row*(cardH+gY) - metaScroll;

    if (by + cardH >= clipTop && by <= clipBot) {
      const lvl = meta.upgrades[upg.id]||0;
      const maxed = lvl >= upg.max;
      const canAfford = !maxed && meta.crystals >= upg.cost;
      const catColor = CAT_COLORS[upg.cat] || '#8e44ad';

      ctx.fillStyle = maxed ? '#1a3a1a' : canAfford ? '#0f1a2e' : '#111';
      rrect(bx,by,cardW,cardH,7); ctx.fill();
      ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? catColor : '#2a2a2a';
      ctx.lineWidth = maxed||canAfford ? 2 : 1;
      rrect(bx,by,cardW,cardH,7); ctx.stroke();
      ctx.fillStyle = catColor + '33';
      rrect(bx,by,cardW,5,3); ctx.fill();

      ctx.fillStyle = maxed ? '#2ecc71' : '#dfe6e9'; ctx.font='bold 12px monospace'; ctx.textAlign='left';
      ctx.fillText(upg.label, bx+10, by+22);
      ctx.fillStyle='#95a5a6'; ctx.font='10px monospace';
      const descBottom = wrapText(upg.desc, bx+10, by+38, cardW-20, 12, 2);
      const dotsY = descBottom + 15;
      ctx.fillStyle = catColor;
      ctx.fillText('●'.repeat(lvl)+'○'.repeat(upg.max-lvl), bx+10, dotsY);

      if (!maxed) {
        ctx.fillStyle = canAfford?'#f1c40f':'#555'; ctx.font='11px monospace'; ctx.textAlign='right';
        ctx.fillText(`${upg.cost}💎`, bx+cardW-8, by+22);
        if (canAfford) {
          metaBtns.push({ ...btn(bx+cardW/2, by+cardH-18, 'UNLOCK', catColor, cardW-30, 26), id:upg.id, cost:upg.cost, max:upg.max });
        }
      } else {
        ctx.fillStyle='#27ae60'; ctx.font='bold 11px monospace'; ctx.textAlign='center';
        ctx.fillText('✓ MAXED', bx+cardW/2, by+cardH-10);
      }
    }

    col++;
    if (col >= cols) { col = 0; row++; }
  });

  // Auto-construct toggle
  if (acUnlocked) {
    const togOn = meta.autoConstructEnabled !== false;
    const tbx = sX, tby = clipTop + (row + (col>0?1:0)) * (cardH + gY) + 12 - metaScroll;
    if (tby + 42 >= clipTop && tby <= clipBot) {
      ctx.fillStyle = togOn ? '#1a3a2a' : '#1a1a1a';
      rrect(tbx, tby, totalW, 42, 7); ctx.fill();
      ctx.strokeStyle = togOn ? '#27ae60' : '#444'; ctx.lineWidth=1.5;
      rrect(tbx, tby, totalW, 42, 7); ctx.stroke();
      ctx.fillStyle = '#dfe6e9'; ctx.font='bold 12px monospace'; ctx.textAlign='left';
      ctx.fillText('🤖 Auto-Construct Outposts', tbx+14, tby+18);
      ctx.fillStyle='#95a5a6'; ctx.font='10px monospace';
      ctx.fillText('Hold Shift while walking to auto-place outposts', tbx+14, tby+34);
      const toggleBtn = btn(tbx + totalW - 70, tby+21, togOn ? 'ON ✓' : 'OFF', togOn ? '#27ae60' : '#555', 100, 30);
      metaBtns.push({ ...toggleBtn, id:'__toggleAutoConstruct' });
    }
  }

  ctx.restore();

  // Bottom bar
  ctx.fillStyle = 'rgba(10,15,30,0.95)'; ctx.fillRect(0, clipBot, W, H - clipBot);
  ctx.fillStyle = '#333'; ctx.font='11px monospace'; ctx.textAlign='center';
  ctx.fillText('↕ scroll with mouse wheel', W/2, clipBot + 16);
  metaBackBtn2 = btn(W/2, H-22, '← BACK', '#555', 160, 32);
}

function handleMetaClick(mx,my) {
  for (const b of metaBtns) {
    if (inBtn(mx,my,b)) {
      if (b.id === '__toggleAutoConstruct') {
        meta.autoConstructEnabled = meta.autoConstructEnabled === false ? true : false;
        saveMeta(meta); return;
      }
      const lvl = meta.upgrades[b.id]||0;
      if (lvl < b.max && meta.crystals >= b.cost) {
        meta.crystals -= b.cost;
        meta.upgrades[b.id] = lvl+1;
        saveMeta(meta);
      }
      return;
    }
  }
  if (metaBackBtn2 && inBtn(mx,my,metaBackBtn2)) state = prevState === 'gameover' ? 'gameover' : 'menu';
}

// ─── UI HELPERS ──────────────────────────────────────────────────────────────
// Draw text wrapping within maxW; returns final Y after last line.
function wrapText(text, x, y, maxW, lineH, maxLines = Infinity) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else { line = test; }
  }
  if (lines.length < maxLines && line) lines.push(line);

  const wasTruncated = lines.length >= maxLines && words.join(' ') !== lines.join(' ');
  if (wasTruncated) {
    let lastLine = lines[maxLines - 1];
    while (lastLine && ctx.measureText(lastLine + '…').width > maxW) {
      lastLine = lastLine.slice(0, -1);
    }
    lines[maxLines - 1] = (lastLine || '').trimEnd() + '…';
  }

  lines.forEach((wrappedLine, index) => {
    ctx.fillText(wrappedLine, x, y + index * lineH);
  });
  return y + Math.max(0, lines.length - 1) * lineH;
}

function btn(cx, cy, label, color, bw=200, bh=46) {
  const bx=cx-bw/2, by=cy-bh/2;
  ctx.fillStyle=color; rrect(bx,by,bw,bh,8); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.18)'; ctx.lineWidth=1; rrect(bx,by,bw,bh,8); ctx.stroke();
  ctx.fillStyle='#fff'; ctx.font='bold 14px monospace'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(label, cx, cy); ctx.textBaseline='alphabetic';
  return { cx, cy, bw, bh };
}

function inBtn(mx,my,b) {
  return mx>=b.cx-b.bw/2 && mx<=b.cx+b.bw/2 && my>=b.cy-b.bh/2 && my<=b.cy+b.bh/2;
}

function drawHpBar(x,y,w,h,hp,maxHp,bg,fg) {
  ctx.fillStyle=bg+'44'; rrect(x,y,w,h,h/2); ctx.fill();
  const pct = clamp(hp/maxHp,0,1);
  if (pct>0) { ctx.fillStyle=fg; rrect(x,y,w*pct,h,h/2); ctx.fill(); }
}

function rrect(x,y,w,h,r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r);
  ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
  ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
  ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
  ctx.closePath();
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
requestAnimationFrame(loop);
