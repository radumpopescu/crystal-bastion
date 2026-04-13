export const TW = 40;
export const TH = 20;
export const ENTITY_H = 22;
export const SHADOW_SCALE = 0.35;
export const ISO_SCALE = TW / 80;

export const WORLD_TILES = 28;
export const TILE_SIZE = 80;
export const AUTO_CONSTRUCT_MODES = [
  { label:'OFF', spacing:0 },
  { label:'1m',  spacing:TILE_SIZE * 1 },
  { label:'2m',  spacing:TILE_SIZE * 2 },
  { label:'5m',  spacing:TILE_SIZE * 5 },
  { label:'10m', spacing:TILE_SIZE * 10 },
];

export const TOWER_RANGE = 700;
export const OUTPOST_RANGE = 550;
export const LEASH_WARN = 0.88;
export const LEASH_DMG = 0;

export const TOWER_HP_BASE = 600;
export const TOWER_ATK_RANGE = 300;
export const TOWER_ATK_DMG = 28;
export const TOWER_ATK_SPEED = 0.9;
export const TOWER_AURA_R = 140;
export const TOWER_AURA_DMG = 4;

export const PLAYER_HP_BASE = 130;
export const PLAYER_SPEED = 280;
export const PLAYER_RADIUS = 18;
export const DASH_SPEED = 480;
export const DASH_DURATION = 0.18;
export const DASH_COOLDOWN = 1.2;

export const OUTPOST_HP_BASE = 100;
export const OUTPOST_COST = 55;

export const WAVE_INTERVAL = 34;
export const BASE_MONSTERS = 4;
export const MONSTER_SCALE = 1.22;

export const WEAPONS: Record<string, any> = {
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

export const STAT_UPGRADES: any[] = [
  { id:'maxHp',      icon:'❤️',  name:'Max HP',        desc:'+40 max health',              apply:(p: any)  => { p.maxHp += 40; p.hp = Math.min(p.hp + 40, p.maxHp); },
    max:8,  count:(p: any) => Math.round((p.maxHp - (p._baseMaxHp || p.maxHp)) / 40) },
  { id:'regen',      icon:'💚',  name:'Regeneration',  desc:'+1.5 HP/sec regen',           apply:(p: any)  => { p.regen = (p.regen || 0) + 1.5; },
    max:6,  count:(p: any) => Math.round((p.regen || 0) / 1.5) },
  { id:'lifesteal',  icon:'🩸',  name:'Life Steal',    desc:'+10% lifesteal on hit',       apply:(p: any)  => { p.lifesteal = (p.lifesteal || 0) + 0.10; },
    max:5,  count:(p: any) => Math.round((p.lifesteal || 0) / 0.10) },
  { id:'damage',     icon:'💢',  name:'Raw Damage',    desc:'+22% all weapon damage',      apply:(p: any)  => { p.dmgMult = (p.dmgMult || 1) * 1.22; },
    max:6,  count:(p: any) => Math.round(Math.log((p.dmgMult || 1)) / Math.log(1.22)) },
  { id:'atkspd',     icon:'⚡',  name:'Attack Speed',  desc:'+22% attack speed',           apply:(p: any)  => { p.atkSpdMult = (p.atkSpdMult || 1) * 1.22; },
    max:6,  count:(p: any) => Math.round(Math.log((p.atkSpdMult || 1)) / Math.log(1.22)) },
  { id:'movespd',    icon:'👟',  name:'Move Speed',    desc:'+35 movement speed',          apply:(p: any)  => { p.speed += 35; },
    max:5,  count:(p: any) => Math.round((p.speed - PLAYER_SPEED) / 35) },
  { id:'range',      icon:'🔭',  name:'Range',         desc:'+22% weapon range',           apply:(p: any)  => { p.rangeMult = (p.rangeMult || 1) * 1.22; },
    max:5,  count:(p: any) => Math.round(Math.log((p.rangeMult || 1)) / Math.log(1.22)) },
  { id:'armor',      icon:'🛡️',  name:'Armor',         desc:'Reduce all damage by 12%',    apply:(p: any)  => { p.armor = Math.min(0.85, (p.armor || 0) + 0.12); },
    max:5,  count:(p: any) => Math.round((p.armor || 0) / 0.12),
    available:(p: any) => (p.armor || 0) < 0.85 },
  { id:'goldFinder', icon:'💵',  name:'Gold Finder',   desc:'+20% gold from kills',        apply:(p: any)  => { p.goldFinder = (p.goldFinder || 0) + 0.20; },
    max:5,  count:(p: any) => Math.round((p.goldFinder || 0) / 0.20) },
  { id:'luck',       icon:'🍀',  name:'Lucky',         desc:'+1 luck: rarer cards more often', apply:(p: any) => { p.luck = (p.luck || 0) + 1; }, rarity:'uncommon',
    max:4,  count:(p: any) => p.luck || 0 },
  { id:'dash',       icon:'💨',  name:'Dash Charge',   desc:'+1 max dash charge',          apply:(p: any)  => { p.maxDashes = (p.maxDashes || 1) + 1; p.dashes = Math.min((p.dashes || 1) + 1, p.maxDashes); },
    max:4,  count:(p: any) => (p.maxDashes || 1) - 1 },
  { id:'towerRepair',  icon:'🏰',  name:'Base Repair',     desc:'Restore 200 base HP',          apply:(_p: any, g: any)  => { g.tower.hp = Math.min(g.tower.hp + 200, g.tower.maxHp); }, rarity:'uncommon',
    available:(_p: any, g: any) => g.tower.hp < g.tower.maxHp },
  { id:'towerBoost',   icon:'🗼',  name:'Base Overcharge', desc:'+30% base damage this run',    apply:(_p: any, g: any)  => { g.tower.atkDmg = Math.round(g.tower.atkDmg * 1.30); }, rarity:'uncommon' },
  { id:'towerRadar',   icon:'📡',  name:'Base Radar',      desc:'+120 base attack range',       apply:(_p: any, g: any)  => { g.tower.atkRange += 120; }, rarity:'uncommon' },
  { id:'towerSpeed',   icon:'🌀',  name:'Base Rapid Fire', desc:'+35% base fire rate',          apply:(_p: any, g: any)  => { g.tower.atkSpeed *= 1.35; }, rarity:'uncommon' },
  { id:'outpostRepair',icon:'🔧',  name:'Repair Towers',   desc:'Fully heal all towers',        apply:(_p: any, g: any)  => { for (const op of g.outposts) op.hp = op.maxHp; }, rarity:'uncommon',
    available:(_p: any, g: any) => g.outposts.some((op: any) => op.hp < op.maxHp) },
  { id:'outpostBoost', icon:'⚔️',  name:'Tower Arsenal',   desc:'+40% tower damage this run',   apply:(_p: any, g: any)  => { for (const op of g.outposts) op.atkDmg = Math.round(op.atkDmg * 1.40); }, rarity:'uncommon',
    available:(_p: any, g: any) => g.outposts.length > 0 },
  { id:'outpostCheap', icon:'💰',  name:'Supply Lines',    desc:'Towers cost 5 less gold',      apply:(_p: any, g: any)  => { g.outpostDiscount = (g.outpostDiscount || 0) + 5; }, rarity:'uncommon',
    available:(_p: any, g: any) => { const cur = OUTPOST_COST - (g.outpostDiscount || 0); return cur > 10; } },
];

export const META_UPGRADES: any[] = [
  { id:'playerHp',      label:'Reinforced Body',    desc:'+30 max HP',                cost:6,  max:8,  cat:'player' },
  { id:'playerRegen',   label:'Regeneration',       desc:'+0.75 HP/sec regen',        cost:8,  max:5,  cat:'player' },
  { id:'playerArmor',   label:'Battle Armor',       desc:'+6% damage reduction',      cost:10, max:5,  cat:'player' },
  { id:'playerDmg',     label:'Raw Power',          desc:'+15% all damage',           cost:10, max:6,  cat:'player' },
  { id:'extraDash',     label:'Nimble',             desc:'+1 starting dash',          cost:8,  max:3,  cat:'player' },
  { id:'startGold',     label:'Scavenger',          desc:'+35 starting gold',         cost:5,  max:6,  cat:'econ' },
  { id:'crystalBonus',  label:'Crystal Magnet',     desc:'+20% crystals from each wave', cost:12, max:5,  cat:'econ' },
  { id:'earlyBonus',    label:'Blitzkrieg',         desc:'+30% early wave gold bonus',cost:10, max:4,  cat:'econ' },
  { id:'towerHp',       label:'Fortified Base',     desc:'+200 base HP',              cost:8,  max:6,  cat:'tower' },
  { id:'towerAtk',      label:'Base Arsenal',       desc:'+25% base damage',          cost:10, max:5,  cat:'tower' },
  { id:'towerRange',    label:'Base Radar',         desc:'+100 base attack range',    cost:9,  max:4,  cat:'tower' },
  { id:'towerAtkSpd',   label:'Rapid Fire',         desc:'+20% base fire rate',       cost:10, max:4,  cat:'tower' },
  { id:'outpostHp',     label:'Reinforced Towers',  desc:'+80 tower HP',              cost:9,  max:5,  cat:'outpost' },
  { id:'outpostAtk',    label:'Tower Cannons',      desc:'+30% tower damage',         cost:10, max:4,  cat:'outpost' },
  { id:'outpostRange',  label:'Extended Network',   desc:'+100 tower zone range',     cost:9,  max:4,  cat:'outpost' },
  { id:'startWpn',      label:'Head Start',         desc:'Start with Assault Rifle',  cost:12, max:1,  cat:'unlock' },
  { id:'waveDelay',     label:'Respite',            desc:'+8s between waves',         cost:8,  max:4,  cat:'unlock' },
  { id:'freeDeploy',    label:'Engineer Corps',     desc:'Start with extra gold',     cost:15, max:3,  cat:'unlock' },
  { id:'autoConstruct', label:'Auto-Construct',     desc:'Shift cycles auto-build tower spacing while walking', cost:20, max:1, cat:'unlock' },
];

export const TOWER_UPGRADES: any[] = [
  { id:'hp',    label:'Base HP +150',     cost:[60,100,150], max:3 },
  { id:'range', label:'Base Range +60',   cost:[70,120],     max:2 },
  { id:'dmg',   label:'Base Damage +40%', cost:[80,130],     max:2 },
];

export const MONSTER_DEF: Record<string, any> = {
  grunt:  { hp:50,  speed:70,  dmg:9,  gold:3,  radius:14, color:'#e74c3c' },
  rusher: { hp:28,  speed:145, dmg:6,  gold:2,  radius:10, color:'#e67e22' },
  brute:  { hp:220, speed:48,  dmg:24, gold:7,  radius:22, color:'#8e44ad' },
  tank:   { hp:500, speed:32,  dmg:35, gold:14, radius:28, color:'#2c3e50' },
};
