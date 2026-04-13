import { AUTO_CONSTRUCT_MODES, ENTITY_H, ISO_SCALE, MAX_WEAPON_SLOTS, PLAYER_RADIUS, SHADOW_SCALE, STAT_UPGRADES, TH, TILE_SIZE, TW, TOWER_UPGRADES, WAVE_INTERVAL, WEAPONS, META_UPGRADES } from './constants';
import { R, devCardColor, devCardLimit, finishDevSession, newGame, resetDevConfig, w2s } from './state';
import { buildDropChanceTable, getAnchors, getLoadoutStats, getOutpostCost, getRunCardEntries, luCardDims, luPositions, rarityDropChance, startDevWave, weaponCardNeedsSlot } from './systems';
import { clamp, dist, inBtn } from './utils';
import { saveMeta } from './meta';
import type { BtnRect } from './types';

const CB_W = 148, CB_H = 215, CB_GAP = 10;
const CAT_COLORS: Record<string, string> = { player:'#e74c3c', econ:'#f1c40f', tower:'#f39c12', outpost:'#3498db', unlock:'#8e44ad' };
const CAT_LABELS: Record<string, string> = { player:'⚔️ PLAYER', econ:'💰 ECONOMY', tower:'🏰 BASE', outpost:'🔵 TOWERS', unlock:'🔓 UNLOCKS' };

const CB_SECTIONS = [
  {
    label: '⚔️  WEAPONS', color: '#e74c3c',
    note: 'Every weapon unlock and level-up offer.',
    cards: () => {
      const out: any[] = [];
      for (const [id, def] of Object.entries(WEAPONS)) {
        for (let lv = 1; lv <= 4; lv++) out.push({ type:'weapon', weaponId:id, newLevel:lv, rarity:(def as any).rarity });
      }
      return out;
    },
  },
  {
    label: '🧍 PLAYER STATS', color: '#2ecc71',
    note: 'Core player boosts that can appear throughout the run.',
    cards: () => STAT_UPGRADES
      .filter(s => !['towerRepair','towerBoost','towerRadar','towerSpeed','outpostRepair','outpostBoost','outpostCheap'].includes(s.id))
      .map(s => ({ type:'stat', statId:s.id, rarity:s.rarity || 'common' })),
  },
  {
    label: '🏰 BASE CARDS', color: '#f39c12',
    note: 'Base support cards. Some only roll when the base needs them.',
    cards: () => ['towerRepair','towerBoost','towerRadar','towerSpeed']
      .map(id => { const s = STAT_UPGRADES.find(x => x.id === id); return s ? { type:'stat', statId:id, rarity:s.rarity || 'uncommon' } : null; })
      .filter(Boolean),
  },
  {
    label: '🔵 TOWER CARDS', color: '#3498db',
    note: 'Tower support cards. Utility rolls only show up when useful.',
    cards: () => ['outpostRepair','outpostBoost','outpostCheap']
      .map(id => { const s = STAT_UPGRADES.find(x => x.id === id); return s ? { type:'stat', statId:id, rarity:s.rarity || 'uncommon' } : null; })
      .filter(Boolean),
  },
];

export function render() {
  const { ctx, W, H } = R;
  R.hoverRegions = [];
  ctx.clearRect(0, 0, W, H);
  if (R.state === 'menu')       { renderMenu(); return; }
  if (R.state === 'devmenu')    { renderDevMenu(); return; }
  if (R.state === 'gameover')   { renderGameover(); return; }
  if (R.state === 'metascreen') { renderMetaScreen(); return; }
  if (R.state === 'cardbook')   { renderCardBook(); return; }
  if (R.state === 'levelup')    { renderGame(); R.hoverRegions = []; renderLevelUpCards(); renderRunCardTooltip(); return; }
  if (R.state === 'paused')     { renderGame(); renderPauseScreen(); return; }
  renderGame();
  renderRunCardTooltip();
}

function renderGame() {
  const game = R.game;
  renderFloor();
  renderSafeZones();

  const entities = [
    ...game.outposts.map((op: any) => ({ ...op, _type:'outpost', _depth: op.x + op.y })),
    ...game.monsters.map((m: any)  => ({ ...m,  _type:'monster', _depth: m.x + m.y })),
    { ...game.player, _type:'player', _depth: game.player.x + game.player.y },
    { ...game.tower,  _type:'tower',  _depth: game.tower.x + game.tower.y - 999 },
  ];
  entities.sort((a: any, b: any) => a._depth - b._depth);

  renderStructuralBase();
  for (const e of entities) {
    if (e._type === 'tower')   renderTower();
    if (e._type === 'outpost') renderOutpost(game.outposts.find((op: any) => op.x === e.x && op.y === e.y));
    if (e._type === 'monster') renderMonster(game.monsters.find((m: any) => m.x === e.x && m.y === e.y));
    if (e._type === 'player')  renderPlayer();
  }

  renderProjectilesWorld();
  renderParticlesWorld();
  renderDmgNums();
  renderHUD();
  if (game.showUpgradeMenu) renderUpgradeMenu();
}

function renderFloor() {
  const { ctx, W, H } = R;
  const game = R.game;
  const visR = Math.ceil(Math.max(W, H) / (TW * 2)) + 4;
  const cx = Math.round(game.player.x / TILE_SIZE);
  const cy = Math.round(game.player.y / TILE_SIZE);
  for (let gx = -visR; gx <= visR; gx++) {
    for (let gy = -visR; gy <= visR; gy++) {
      const wx = (cx + gx) * TILE_SIZE;
      const wy = (cy + gy) * TILE_SIZE;
      const { sx, sy } = w2s(wx, wy);
      const checker = (cx + gx + cy + gy) % 2 === 0;
      ctx.fillStyle = checker ? '#16213e' : '#1a2540';
      ctx.strokeStyle = '#0f1a30';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy - TH);
      ctx.lineTo(sx + TW, sy);
      ctx.lineTo(sx, sy + TH);
      ctx.lineTo(sx - TW, sy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
}

function renderSafeZones() {
  const { ctx } = R;
  for (const a of getAnchors()) {
    const { sx, sy } = w2s(a.x, a.y);
    const rsx = a.range * ISO_SCALE * 2;
    const rsy = rsx * 0.5;
    const grad = ctx.createRadialGradient(sx, sy, rsy * 0.4, sx, sy, rsy);
    grad.addColorStop(0, 'rgba(39,174,96,0)');
    grad.addColorStop(1, 'rgba(39,174,96,0.07)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(39,174,96,0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function renderStructuralBase() {
  const { ctx } = R;
  const t = R.game.tower;
  const { sx, sy } = w2s(t.x, t.y);
  const rsx = t.atkRange * ISO_SCALE * 2;
  const rsy = rsx * 0.5;
  ctx.strokeStyle = 'rgba(241,196,15,0.10)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 8]);
  ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
}

function renderTower() {
  const { ctx } = R;
  const t = R.game.tower;
  const { sx, sy } = w2s(t.x, t.y, 0);
  const bw = 30, bh = 48;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx, sy, bw * 1.2, bw * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a2540';
  ctx.beginPath();
  ctx.moveTo(sx - bw, sy);
  ctx.lineTo(sx, sy + TH * 0.8);
  ctx.lineTo(sx, sy + TH * 0.8 - bh);
  ctx.lineTo(sx - bw, sy - bh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#253555';
  ctx.beginPath();
  ctx.moveTo(sx + bw, sy);
  ctx.lineTo(sx, sy + TH * 0.8);
  ctx.lineTo(sx, sy + TH * 0.8 - bh);
  ctx.lineTo(sx + bw, sy - bh);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2c4070';
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx, sy - bh - TH * 0.8);
  ctx.lineTo(sx + bw, sy - bh);
  ctx.lineTo(sx, sy - bh + TH * 0.8);
  ctx.lineTo(sx - bw, sy - bh);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⊕', sx, sy - bh - 2);
  ctx.textBaseline = 'alphabetic';
  drawHpBar(sx - 36, sy - bh - 30, 72, 7, t.hp, t.maxHp, '#c0392b', '#27ae60');
}

function renderOutpost(op: any) {
  if (!op) return;
  const { ctx } = R;
  const { sx, sy } = w2s(op.x, op.y, 0);
  const bw = 14, bh = 24;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy, bw, bw * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e2040';
  ctx.beginPath(); ctx.moveTo(sx - bw, sy); ctx.lineTo(sx, sy + TH * 0.5); ctx.lineTo(sx, sy + TH * 0.5 - bh); ctx.lineTo(sx - bw, sy - bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#163060';
  ctx.beginPath(); ctx.moveTo(sx + bw, sy); ctx.lineTo(sx, sy + TH * 0.5); ctx.lineTo(sx, sy + TH * 0.5 - bh); ctx.lineTo(sx + bw, sy - bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#1e4080';
  ctx.strokeStyle = '#3498db'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy - bh - TH * 0.5); ctx.lineTo(sx + bw, sy - bh); ctx.lineTo(sx, sy - bh + TH * 0.5); ctx.lineTo(sx - bw, sy - bh); ctx.closePath(); ctx.fill(); ctx.stroke();
  const rsx = op.atkRange * ISO_SCALE * 2;
  const rsy = rsx * 0.5;
  ctx.strokeStyle = 'rgba(52,152,219,0.18)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  drawHpBar(sx - 20, sy - bh - 18, 40, 5, op.hp, op.maxHp, '#e74c3c', '#3498db');
}

function renderMonster(m: any) {
  if (!m) return;
  const { ctx } = R;
  const { sx, sy } = w2s(m.x, m.y, 0);
  const r = m.radius;
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.9, r * SHADOW_SCALE, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = m.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(sx + r * 0.28, sy - ENTITY_H - r * 0.2, r * 0.28, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(sx + r * 0.35, sy - ENTITY_H - r * 0.2, r * 0.14, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H + r); ctx.lineTo(sx, sy); ctx.stroke();
  if (m.hp < m.maxHp) drawHpBar(sx - r, sy - ENTITY_H - r - 10, r * 2, 4, m.hp, m.maxHp, '#e74c3c', '#e74c3c');
}

function renderPlayer() {
  const { ctx } = R;
  const p = R.game.player;
  const { sx, sy } = w2s(p.x, p.y, 0);
  const r = PLAYER_RADIUS;
  const flash = p.flashTimer > 0;
  if (p.dashing) {
    for (let i = 1; i <= 3; i++) {
      const tx = sx - p.dashVx * (i * 0.025) * ISO_SCALE;
      const ty = sy - p.dashVy * (i * 0.025) * TH / TILE_SIZE;
      ctx.globalAlpha = 0.25 / i;
      ctx.fillStyle = '#3498db';
      ctx.beginPath(); ctx.arc(tx, ty - ENTITY_H, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(52,152,219,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H + r); ctx.lineTo(sx, sy); ctx.stroke();
  ctx.shadowColor = p.dashing ? '#3498db' : '#00ffcc';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = p.dashing ? '#3498db' : '#00ffcc';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = flash ? '#ff6b6b' : '#dfe6e9';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#00ffcc';
  const fa = Math.atan2(p.facing.y, p.facing.x);
  ctx.beginPath(); ctx.arc(sx + Math.cos(fa) * (r - 4), sy - ENTITY_H + Math.sin(fa) * (r - 4), 4, 0, Math.PI * 2); ctx.fill();
  const { sx:ws, sy:wy } = w2s(p.x, p.y, 0);
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    const def = WEAPONS[w.id];
    ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, ws + (i - (p.weapons.length - 1) / 2) * 16, wy - ENTITY_H - r - 14);
  }
  ctx.textBaseline = 'alphabetic';
}

function projectileScreenVector(vx: number, vy: number) {
  const dx = (vx - vy) * ISO_SCALE;
  const dy = (vx + vy) * ISO_SCALE * 0.5;
  const len = Math.hypot(dx, dy) || 1;
  return { dx, dy, len, ang: Math.atan2(dy, dx) };
}

function drawTracerProjectile(sx: number, sy: number, p: any, length = p.length, width = p.width) {
  const { ctx } = R;
  const { ang } = projectileScreenVector(p.vx, p.vy);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.lineCap = 'round';
  ctx.shadowColor = p.color;
  ctx.shadowBlur = p.glow || 10;
  ctx.strokeStyle = p.trailColor || p.color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(-length * 0.8, 0);
  ctx.lineTo(length * 0.22, 0);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = p.coreColor || '#ffffff';
  ctx.lineWidth = Math.max(1, width * 0.45);
  ctx.beginPath();
  ctx.moveTo(-length * 0.15, 0);
  ctx.lineTo(length * 0.38, 0);
  ctx.stroke();
  ctx.fillStyle = p.coreColor || '#ffffff';
  ctx.beginPath();
  ctx.arc(length * 0.35, 0, Math.max(1.4, width * 0.48), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBulletProjectile(sx: number, sy: number, p: any, opts: any = {}) {
  const { ctx } = R;
  const { ang } = projectileScreenVector(p.vx, p.vy);
  const bodyLength = opts.bodyLength ?? Math.max(7, p.length * 0.62);
  const bodyWidth = opts.bodyWidth ?? Math.max(2.2, p.width * 0.92);
  const tailLength = opts.tailLength ?? Math.max(2, bodyLength * 0.42);
  const bodyColor = opts.bodyColor || '#c6b07b';
  const tipColor = opts.tipColor || '#f4ecd4';
  const outline = opts.outline || '#5a4a2f';
  const glowColor = opts.glowColor || p.trailColor || p.color;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  if (tailLength > 0) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = glowColor;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = Math.max(1.2, bodyWidth * 0.85);
    ctx.beginPath();
    ctx.moveTo(-bodyLength * 0.7 - tailLength, 0);
    ctx.lineTo(-bodyLength * 0.45, 0);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = bodyColor;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1;
  rrect(-bodyLength * 0.58, -bodyWidth * 0.52, bodyLength * 0.72, bodyWidth * 1.04, bodyWidth * 0.42);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = tipColor;
  ctx.beginPath();
  ctx.moveTo(bodyLength * 0.08, -bodyWidth * 0.52);
  ctx.lineTo(bodyLength * 0.64, 0);
  ctx.lineTo(bodyLength * 0.08, bodyWidth * 0.52);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#fffdf4';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(-bodyLength * 0.38, -bodyWidth * 0.18);
  ctx.lineTo(bodyLength * 0.12, -bodyWidth * 0.18);
  ctx.stroke();
  ctx.restore();
}

function drawPelletProjectile(sx: number, sy: number, p: any, size = p.size * 0.6) {
  const { ctx } = R;
  const { ang } = projectileScreenVector(p.vx, p.vy);
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang);
  ctx.globalAlpha = 0.2;
  ctx.strokeStyle = p.trailColor || p.color;
  ctx.lineWidth = Math.max(1, size * 0.7);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-size * 2.1, 0);
  ctx.lineTo(-size * 0.6, 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#e3d6b8';
  ctx.strokeStyle = '#7a6640';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, Math.max(1.8, size), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawFlameProjectile(sx: number, sy: number, p: any) {
  const { ctx } = R;
  const { ang } = projectileScreenVector(p.vx, p.vy);
  const lifePct = clamp(p.life / (p.maxLife || 1), 0, 1);
  const size = p.renderSize || p.size;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(ang + (p.rot || 0) * 0.08);
  ctx.globalAlpha = Math.max(0.2, lifePct);
  ctx.fillStyle = '#ff6b35';
  ctx.beginPath(); ctx.ellipse(-size * 0.2, 0, size * 1.15, size * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffb347';
  ctx.beginPath(); ctx.ellipse(size * 0.18, 0, size * 0.72, size * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff2a8';
  ctx.beginPath(); ctx.ellipse(size * 0.42, 0, size * 0.34, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawGrenadeProjectile(p: any) {
  const { ctx } = R;
  const progress = clamp((p.age || 0) / (p.maxLife || 1), 0, 1);
  const lift = Math.sin(progress * Math.PI) * 90;
  const shadow = w2s(p.x, p.y, 0);
  const { sx, sy } = w2s(p.x, p.y, 12 + lift);
  ctx.fillStyle = 'rgba(0,0,0,0.24)';
  ctx.beginPath(); ctx.ellipse(shadow.sx, shadow.sy + 9, p.size * 1.3, p.size * 0.7, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.rot || 0);
  ctx.fillStyle = '#2c3e50';
  ctx.beginPath(); ctx.arc(0, 0, p.size, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f1c40f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, p.size * 0.72, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  ctx.strokeStyle = '#8b5e3c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -p.size + 1); ctx.lineTo(0, -p.size - 6); ctx.stroke();
  ctx.fillStyle = '#ffd54f';
  ctx.beginPath(); ctx.arc(0, -p.size - 7, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawBoomerangProjectile(sx: number, sy: number, p: any) {
  const { ctx } = R;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(p.rot || 0);
  ctx.lineCap = 'round';
  ctx.strokeStyle = p.color;
  ctx.lineWidth = Math.max(4, p.size * 0.48);
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(-p.size * 0.95, p.size * 0.45);
  ctx.lineTo(0, -p.size * 0.2);
  ctx.lineTo(p.size * 0.95, p.size * 0.45);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff1f7';
  ctx.lineWidth = Math.max(1.5, p.size * 0.16);
  ctx.beginPath();
  ctx.moveTo(-p.size * 0.65, p.size * 0.25);
  ctx.lineTo(0, -p.size * 0.02);
  ctx.lineTo(p.size * 0.65, p.size * 0.25);
  ctx.stroke();
  ctx.restore();
}

function renderProjectilesWorld() {
  const { ctx } = R;
  const game = R.game;
  for (const p of game.projectiles) {
    const { sx, sy } = w2s(p.x, p.y, 8);
    const r = p.size || 5;
    switch (p.visual || p.type) {
      case 'pistol':
        drawBulletProjectile(sx, sy, p, { bodyLength: 9, bodyWidth: 3, tailLength: 3, bodyColor: '#c8b07a', tipColor: '#f6edd2', outline: '#65532f', glowColor: '#9dd5ff' });
        break;
      case 'rifle':
        drawBulletProjectile(sx, sy, p, { bodyLength: 10.5, bodyWidth: 2.7, tailLength: 5, bodyColor: '#b9c6ce', tipColor: '#f7fbff', outline: '#5e6e78', glowColor: '#66f0a8' });
        break;
      case 'minigun':
        drawBulletProjectile(sx, sy, p, { bodyLength: 7.5, bodyWidth: 2.2, tailLength: 4, bodyColor: '#c2ccd4', tipColor: '#fbfeff', outline: '#60707c', glowColor: '#8fd8ff' });
        break;
      case 'shotgun':
        drawPelletProjectile(sx, sy, p, 2.3);
        break;
      case 'sniper':
        drawBulletProjectile(sx, sy, p, { bodyLength: 15.5, bodyWidth: 3.3, tailLength: 9, bodyColor: '#cdb5ff', tipColor: '#ffffff', outline: '#6b55a0', glowColor: '#d2b7ff' });
        break;
      case 'tower':
        drawTracerProjectile(sx, sy, p, 16, 4);
        break;
      case 'structure':
        drawTracerProjectile(sx, sy, p, 14, 3);
        break;
      case 'flame':
        drawFlameProjectile(sx, sy, p);
        break;
      case 'grenade':
        drawGrenadeProjectile(p);
        break;
      case 'boomerang':
        drawBoomerangProjectile(sx, sy, p);
        break;
      default:
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx - p.vx * 0.03 * ISO_SCALE, sy - p.vy * 0.03 * ISO_SCALE * 0.5, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowColor = p.color; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx, sy, r * 0.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;
        break;
    }
  }
}

function renderParticlesWorld() {
  const { ctx } = R;
  const game = R.game;
  for (const p of game.particles) {
    const alpha = p.life / (p.maxLife || 0.8);
    ctx.globalAlpha = Math.max(0, alpha);
    if (p.type === 'bolt') {
      const points = p.points || [{ x:p.x, y:p.y }, { x:p.tx, y:p.ty }];
      ctx.lineCap = 'round';
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      points.forEach((pt: any, index: number) => {
        const { sx, sy } = w2s(pt.x, pt.y, 10);
        if (index === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      points.forEach((pt: any, index: number) => {
        const { sx, sy } = w2s(pt.x, pt.y, 10);
        if (index === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });
      ctx.stroke();
    } else if (p.type === 'spark') {
      const { sx, sy } = w2s(p.x, p.y, 8);
      const tailX = sx - p.vx * 0.025 * ISO_SCALE;
      const tailY = sy - p.vy * 0.025 * ISO_SCALE * 0.5;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.width || 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(sx, sy);
      ctx.stroke();
    } else if (p.type === 'smoke') {
      const { sx, sy } = w2s(p.x, p.y, 6);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI * 2); ctx.fill();
    } else if (p.type === 'ring') {
      const { sx, sy } = w2s(p.x, p.y, 10);
      const radius = p.maxRadius * (1 - alpha);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.lineWidth || 2;
      ctx.beginPath(); ctx.arc(sx, sy, radius * ISO_SCALE * 0.9, 0, Math.PI * 2); ctx.stroke();
    } else {
      const { sx, sy } = w2s(p.x, p.y, 5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(sx, sy, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function renderDmgNums() {
  const { ctx } = R;
  for (const d of R.game.dmgNumbers) {
    const { sx, sy } = w2s(d.x, d.y, 30);
    ctx.globalAlpha = Math.min(1, d.life);
    ctx.fillStyle = d.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d.val, sx, sy);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

function renderHUD() {
  const { ctx, W, H, meta, ui } = R;
  const game = R.game;
  const p = game.player, t = game.tower;
  const autoConstructUnlocked = (meta.upgrades['autoConstruct'] || 0) > 0;
  const tBarW = 260;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W / 2 - tBarW / 2 - 10, 8, tBarW + 20, 52, 8); ctx.fill();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('🏰 BASE', W / 2, 24);
  drawHpBar(W / 2 - tBarW / 2, 28, tBarW, 16, t.hp, t.maxHp, '#c0392b', '#e74c3c');
  ctx.fillStyle = '#ddd'; ctx.font = 'bold 11px monospace';
  ctx.fillText(`${Math.ceil(t.hp)} / ${t.maxHp}`, W / 2, 56);

  const pBarW = 220;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(10, H - 72, pBarW + 20, 62, 8); ctx.fill();
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillText('❤️ PLAYER', 18, H - 56);
  drawHpBar(18, H - 48, pBarW, 16, p.hp, p.maxHp, '#c0392b', '#27ae60');
  ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
  ctx.fillText(`${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`, 18, H - 22);
  for (let i = 0; i < p.maxDashes; i++) {
    ctx.fillStyle = i < p.dashes ? '#3498db' : '#1a2a3a';
    ctx.beginPath(); ctx.arc(18 + i * 20, H - 10, 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#556'; ctx.font = '10px monospace';
  ctx.fillText('SPACE: dash', 18 + p.maxDashes * 20 + 6, H - 6);

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W - 50, 8, 42, 42, 8); ctx.fill();
  ctx.fillStyle = '#bdc3c7'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
  ctx.fillText('⏸', W - 29, 36);

  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(W - 220, 8, 162, 42, 8); ctx.fill();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`⬡ ${game.gold}`, W - 60, 37);

  const waveBoxH = game.waveActive ? 84 : 132;
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  rrect(10, 8, 230, waveBoxH, 8); ctx.fill();
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${game.wave}`, 20, 32);
  if (game.waveActive) {
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 15px monospace';
    ctx.fillText(`👾 ${game.monsters.length} enemies`, 20, 56);
    ui.waveStartBtn = null;
  } else {
    ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 15px monospace';
    ctx.fillText(`⏱ Next in ${Math.ceil(game.waveTimer)}s`, 20, 56);
    const earlyGold = Math.max(2, Math.round(7 * (game.waveTimer / (WAVE_INTERVAL + (game.waveDelayBonus || 0))) * (game.earlyBonusMult || 1) * (1 + game.wave * 0.12)));
    ui.waveStartBtn = btn(125, 112, `▶ START  (+${earlyGold}g)`, '#e67e22', 220, 36);
  }
  ctx.fillStyle = '#556'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(game.player.weapons.map((w: any) => `${WEAPONS[w.id].icon}${w.level}`).join('  '), 20, game.waveActive ? 78 : 82);

  const controlsBoxH = 112;
  const controlsBoxY = H - 322;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rrect(W - 230, controlsBoxY, 220, controlsBoxH, 6); ctx.fill();
  ctx.fillStyle = '#666'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText('WASD move · SPACE dash', W - 14, controlsBoxY + 20);
  ctx.fillText('E: tower · U: upgrades · P: pause', W - 14, controlsBoxY + 36);
  ctx.fillStyle = '#a855f7'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W - 14, controlsBoxY + 56);
  ctx.fillStyle = autoConstructUnlocked ? '#7f8c8d' : '#4f5b66'; ctx.font = '11px monospace';
  ctx.fillText(autoConstructUnlocked ? 'SHIFT cycles auto spacing' : 'Meta unlock: Auto-Construct', W - 14, controlsBoxY + 74);
  const autoMode = AUTO_CONSTRUCT_MODES[game.autoConstructMode || 0] || AUTO_CONSTRUCT_MODES[0];
  ctx.fillStyle = autoConstructUnlocked
    ? (autoMode.spacing > 0 ? '#27ae60' : '#95a5a6')
    : '#6b7280';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(autoConstructUnlocked ? `Auto: ${autoMode.label}` : 'Auto: LOCKED', W - 14, controlsBoxY + 90);
  if (!autoConstructUnlocked) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.fillText('Unlock it in Meta Upgrades', W - 14, controlsBoxY + 104);
  } else {
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '10px monospace';
    ctx.fillText('Walk to chain towers automatically', W - 14, controlsBoxY + 104);
  }
  renderMinimap();
}

function renderMinimap() {
  const { ctx, W, H } = R;
  const game = R.game;
  const MM_SIZE = 180;
  const MM_PAD = 12;
  const MM_SCALE = 0.039;
  const mx = W - MM_SIZE - MM_PAD;
  const my = H - MM_SIZE - MM_PAD;
  const cx = mx + MM_SIZE / 2;
  const cy = my + MM_SIZE / 2;
  ctx.fillStyle = 'rgba(5,10,20,0.82)';
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1.5;
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.stroke();
  ctx.save();
  rrect(mx, my, MM_SIZE, MM_SIZE, 8); ctx.clip();
  function mm(wx: number, wy: number) {
    return { x: cx + (wx - wy) * MM_SCALE, y: cy + (wx + wy) * MM_SCALE * 0.5 };
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx, my + 10);
  ctx.lineTo(mx + MM_SIZE - 10, cy);
  ctx.lineTo(cx, my + MM_SIZE - 10);
  ctx.lineTo(mx + 10, cy);
  ctx.closePath();
  ctx.stroke();
  for (const a of getAnchors()) {
    const { x, y } = mm(a.x, a.y);
    const rx = a.range * MM_SCALE * 2;
    const ry = rx * 0.5;
    ctx.strokeStyle = 'rgba(39,174,96,0.35)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(39,174,96,0.06)';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
  }
  const tp = mm(game.tower.x, game.tower.y);
  ctx.fillStyle = '#f39c12';
  ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 1.5;
  ctx.strokeRect(tp.x - 4, tp.y - 4, 8, 8);
  for (const op of game.outposts) {
    const p2 = mm(op.x, op.y);
    ctx.fillStyle = '#3498db';
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 3, 0, Math.PI * 2); ctx.fill();
  }
  for (const m of game.monsters) {
    const p2 = mm(m.x, m.y);
    ctx.fillStyle = m.color;
    ctx.beginPath(); ctx.arc(p2.x, p2.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  const pp = mm(game.player.x, game.player.y);
  ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 6;
  ctx.fillStyle = '#00ffcc';
  ctx.beginPath(); ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = '9px monospace'; ctx.textAlign = 'center';
  ctx.fillText('MINIMAP', cx, my + MM_SIZE - 4);
}

function renderUpgradeMenu() {
  const { ctx, W, H } = R;
  const game = R.game;
  const mX = W / 2 - 165, mY = H / 2 - 145;
  ctx.fillStyle = 'rgba(0,0,0,0.88)'; rrect(mX - 12, mY - 12, 354, 300, 10); ctx.fill();
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2; rrect(mX - 12, mY - 12, 354, 300, 10); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('BASE UPGRADES  (press U to close)', W / 2, mY + 14);
  TOWER_UPGRADES.forEach((upg, i) => {
    const lvl = game.tower.upgrades[upg.id] || 0;
    const maxed = lvl >= upg.max;
    const cost = maxed ? 0 : upg.cost[lvl];
    const canAfford = !maxed && game.gold >= cost;
    const by = mY + 36 + i * 76;
    ctx.fillStyle = maxed ? '#1a3a1a' : canAfford ? '#1a2a3a' : '#2a1a1a';
    rrect(mX, by, 330, 58, 6); ctx.fill();
    ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? '#3498db' : '#444';
    ctx.lineWidth = 1.5; rrect(mX, by, 330, 58, 6); ctx.stroke();
    ctx.fillStyle = maxed ? '#27ae60' : '#ecf0f1'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(upg.label, mX + 10, by + 22);
    ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
    ctx.fillText('●'.repeat(lvl) + '○'.repeat(upg.max - lvl), mX + 10, by + 42);
    if (!maxed) {
      ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`⬡ ${cost}`, mX + 325, by + 22);
    } else {
      ctx.fillStyle = '#27ae60'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText('MAXED', mX + 325, by + 22);
    }
  });
  ctx.fillStyle = '#666'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Press U or ESC to close', W / 2, mY + 280);
}

function drawCard(card: any, bx: number, by: number, cW: number, cH: number, opts: any = {}) {
  const { ctx } = R;
  const game = R.game;
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
  ctx.fillStyle = opts.picked ? '#27ae60' : rarityColor;
  rrect(bx, by, cW, 5, 4); ctx.fill();
  ctx.font = '38px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(isWeapon ? def.icon : stat.icon, bx + cW / 2, by + 50);
  ctx.fillStyle = opts.dimmed ? '#666' : '#ecf0f1';
  ctx.font = 'bold 13px monospace'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(isWeapon ? def.name : stat.name, bx + cW / 2, by + 92);
  if (isWeapon) {
    ctx.fillStyle = rarityColor;
    rrect(bx + cW / 2 - 36, by + 98, 72, 18, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 10px monospace';
    const existing = game.player.weapons.find((w: any) => w.id === card.weaponId);
    ctx.fillText(existing ? `LVL ${card.newLevel - 1}→${card.newLevel}` : 'NEW', bx + cW / 2, by + 111);
  }
  ctx.fillStyle = opts.dimmed ? '#444' : '#aaa';
  ctx.font = '10px monospace';
  const desc = isWeapon ? def.desc : stat.desc;
  const words = desc.split(' ');
  let line = '', lineY = by + (isWeapon ? 132 : 112);
  for (const word of words) {
    const test = line + (line ? ' ' : '') + word;
    if (ctx.measureText(test).width > cW - 16) { ctx.fillText(line, bx + cW / 2, lineY); lineY += 14; line = word; }
    else line = test;
  }
  if (line) ctx.fillText(line, bx + cW / 2, lineY);
  if (isWeapon && def.levelBonus[card.newLevel - 1]) {
    ctx.fillStyle = opts.dimmed ? '#555' : '#f1c40f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(def.levelBonus[card.newLevel - 1], bx + cW / 2, by + cH - 30);
  }
  if (opts.needsSlot) {
    ctx.fillStyle = '#e67e22';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('SELL A SLOT FIRST', bx + cW / 2, by + cH - 44);
  }
  if (opts.costLabel) {
    const canAfford = game.gold >= card.cost;
    ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(opts.costLabel, bx + cW / 2, by + cH - 12);
  } else if (opts.dropChance != null) {
    ctx.fillStyle = '#555'; ctx.font = '10px monospace';
    ctx.fillText(`~${opts.dropChance}% chance`, bx + cW / 2, by + cH - 12);
  } else if (!opts.dimmed) {
    ctx.fillStyle = accentColor; ctx.font = 'bold 11px monospace';
    ctx.fillText('CLICK TO CHOOSE', bx + cW / 2, by + cH - 12);
  }
  ctx.textBaseline = 'alphabetic';
}

function renderLevelUpCards() {
  const { ctx, W, H, ui } = R;
  const game = R.game;
  const cards = game.levelUpCards;
  if (!cards) return;
  ui.levelupWeaponBtns = [];
  ctx.fillStyle = 'rgba(4,8,20,0.93)'; ctx.fillRect(0, 0, W, H);
  const { w: cW, h: cH, gap } = luCardDims();
  const { freeTop, shopTop } = luPositions();
  const panelW = Math.max(160, Math.min(230, W * 0.17));
  const panelX = W - panelW - 12;
  ctx.fillStyle = '#0b1220';
  rrect(panelX, 0, panelW + 12, H, 0); ctx.fill();
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(panelX, 0); ctx.lineTo(panelX, H); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('LOADOUT', panelX + panelW / 2, 28);

  let sideY = 46;
  if (game._cardActionHint) {
    const hintLines = wrapTextLines(game._cardActionHint, panelW - 20);
    ctx.fillStyle = '#f39c12';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    hintLines.forEach((line, index) => ctx.fillText(line, panelX + 10, sideY + index * 12));
    sideY += hintLines.length * 12 + 8;
  }
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`WEAPON SLOTS ${game.player.weapons.length}/${MAX_WEAPON_SLOTS}`, panelX + 10, sideY); sideY += 14;
  if (game.player.weapons.length >= MAX_WEAPON_SLOTS) {
    ctx.fillStyle = '#e67e22';
    ctx.font = '10px monospace';
    ctx.fillText('Full loadout: sell one to take a new weapon.', panelX + 10, sideY);
    sideY += 14;
  }
  for (let slot = 0; slot < MAX_WEAPON_SLOTS; slot++) {
    const rowY = sideY;
    const weapon = game.player.weapons[slot];
    const rowH = 22;
    ctx.fillStyle = weapon ? '#101a29' : '#0c1522';
    rrect(panelX + 8, rowY - 12, panelW - 16, rowH, 6); ctx.fill();
    ctx.strokeStyle = weapon ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    rrect(panelX + 8, rowY - 12, panelW - 16, rowH, 6); ctx.stroke();
    if (weapon) {
      const def = WEAPONS[weapon.id];
      const sellX = panelX + panelW - 52;
      const sellY = rowY - 10;
      const sellW = 40;
      const sellH = 16;
      ctx.fillStyle = def.color;
      ctx.font = '11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`${def.icon} ${def.name}`, panelX + 14, rowY + 1);
      const pipW = 14;
      const pipGap = 2;
      const barX = panelX + 14;
      const barY = rowY + 6;
      for (let lv = 0; lv < 4; lv++) {
        ctx.fillStyle = lv < weapon.level ? def.color : '#1e2a38';
        ctx.fillRect(barX + lv * (pipW + pipGap), barY, pipW, 4);
      }
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`L${weapon.level}`, sellX - 8, rowY + 1);
      ctx.fillStyle = '#5b1f1f';
      rrect(sellX, sellY, sellW, sellH, 4); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      rrect(sellX, sellY, sellW, sellH, 4); ctx.stroke();
      ctx.fillStyle = '#f8d7da';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SELL', sellX + sellW / 2, sellY + 11);
      ui.levelupWeaponBtns.push({ x: sellX, y: sellY, w: sellW, h: sellH, slotIndex: slot });
    } else {
      ctx.fillStyle = '#566573';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SLOT ${slot + 1}  EMPTY`, panelX + 14, rowY + 1);
    }
    sideY += 24;
  }
  sideY += 4;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace';
  ctx.fillText('CURRENT STATS', panelX + 10, sideY); sideY += 14;
  getLoadoutStats().forEach(stat => {
    ctx.fillStyle = '#cbd5e1'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${stat.icon} ${stat.name}`, panelX + 10, sideY);
    ctx.fillStyle = '#8bd3ff'; ctx.textAlign = 'right';
    ctx.fillText(stat.value, panelX + panelW - 4, sideY);
    sideY += 16;
  });
  const runCards = getRunCardEntries();
  if (runCards.length > 0) {
    sideY += 8;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace';
    ctx.fillText('CARDS THIS RUN', panelX + 10, sideY); sideY += 14;
    const maxRunCardRows = Math.max(4, Math.floor((H - sideY - 18) / 18));
    runCards.slice(-maxRunCardRows).forEach(entry => {
      const rowY = sideY;
      const suffix = entry.count > 1 ? ` x${entry.count}` : '';
      const maxNameW = panelW - 26 - ctx.measureText(suffix).width;
      let label = `${entry.icon} ${entry.name}`;
      while (ctx.measureText(label).width > maxNameW && label.length > 4) label = label.slice(0, -2).trimEnd() + '…';
      ctx.textAlign = 'left';
      ctx.fillStyle = entry.color; ctx.font = '11px monospace';
      ctx.fillText(label, panelX + 10, rowY);
      if (suffix) {
        ctx.fillStyle = '#dfe6e9'; ctx.textAlign = 'right';
        ctx.fillText(suffix, panelX + panelW - 4, rowY);
        ctx.textAlign = 'left';
      }
      registerHoverRegion(panelX + 8, rowY - 12, panelW - 12, 16, { entry });
      sideY += 18;
    });
  }

  const centerX = panelX / 2;
  ctx.fillStyle = '#1a2540';
  ctx.fillRect(0, 0, panelX, 66);
  ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 66); ctx.lineTo(panelX, 66); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
  ctx.fillText(`⚡ WAVE ${game.wave} COMPLETE`, centerX, 32);
  ctx.fillStyle = '#aaa'; ctx.font = '13px monospace';
  ctx.fillText(`Gold: ${game.gold} 🪙`, centerX - 80, 54);
  const freePicked = !cards || cards.length === 0;
  ctx.fillStyle = freePicked ? '#2ecc71' : '#e74c3c';
  ctx.font = '12px monospace';
  ctx.fillText(freePicked ? '✓ Free pick chosen' : '⬤ Choose a free card below', centerX + 60, 54);

  ctx.fillStyle = freePicked ? '#1e3a1e' : '#0e1e2e';
  const freeCards = cards || [];
  const fTotalW = Math.max(1, freeCards.length) * cW + (Math.max(1, freeCards.length) - 1) * gap;
  const fStartX = centerX - fTotalW / 2;
  rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.fill();
  ctx.strokeStyle = freePicked ? '#27ae60' : '#2a4a6a'; ctx.lineWidth = 1.5;
  rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.stroke();
  ctx.fillStyle = freePicked ? '#27ae60' : '#5dade2';
  ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('✨  FREE PICK', fStartX - 10, freeTop - 12);
  if (freePicked) {
    ctx.fillStyle = '#27ae60'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
    ctx.fillText('✓ PICKED', fStartX + fTotalW + 10, freeTop - 12);
  }
  if (freePicked && game._pickedFreeCard) {
    drawCard(game._pickedFreeCard, centerX - cW / 2, freeTop, cW, cH, { picked: true, needsSlot: weaponCardNeedsSlot(game._pickedFreeCard, game) });
  } else if (!freePicked) {
    freeCards.forEach((card: any, i: number) => drawCard(card, fStartX + i * (cW + gap), freeTop, cW, cH, { needsSlot: weaponCardNeedsSlot(card, game) }));
  }

  const sCards = game.shopCards || [];
  const sTotalW = Math.max(1, sCards.length) * cW + (Math.max(1, sCards.length) - 1) * gap;
  const sStartX = centerX - sTotalW / 2;
  ctx.fillStyle = '#120e04';
  rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.fill();
  ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1.5;
  rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('🛒  SHOP', sStartX - 10, shopTop - 12);
  ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`Gold: ${game.gold} 🪙`, sStartX + sTotalW + 10, shopTop - 12);
  sCards.forEach((card: any, i: number) => {
    const bx = sStartX + i * (cW + gap);
    const needsSlot = weaponCardNeedsSlot(card, game);
    if (card._bought) drawCard(card, bx, shopTop, cW, cH, { picked: true, costLabel: '✓ BOUGHT', needsSlot });
    else drawCard(card, bx, shopTop, cW, cH, { shopCard: true, dimmed: game.gold < card.cost, costLabel: `${card.cost}🪙`, needsSlot });
  });

  const botY = H - 52;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, botY, panelX, 52);
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, botY); ctx.lineTo(panelX, botY); ctx.stroke();
  const canReroll = game.rerollsLeft > 0 && !game._anyBought;
  const refreshLabel = game._anyBought ? '🔒 Refresh locked' : game.rerollsLeft > 0 ? `🔀 Refresh All  (${game.rerollsLeft} free)` : '🔀 No rerolls left';
  ui.refreshAllBtn = btn(120, botY + 26, refreshLabel, canReroll ? '#5b2d8e' : '#252535', 220, 36);
  ui.continueBtn = btn(panelX - 110, botY + 26, '▶  DONE', '#27ae60', 180, 36);
}

function renderMenu() {
  const { ctx, W, H, meta, ui } = R;
  const autoConstructUnlocked = (meta.upgrades['autoConstruct'] || 0) > 0;
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 100; i++) ctx.fillRect(i * 137.5 % W, i * 73.3 % H, 1.5, 1.5);
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 56px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER SURVIVAL', W / 2, H / 2 - 130);
  ctx.fillStyle = '#7f8c8d'; ctx.font = '16px monospace';
  ctx.fillText('3D — Defend · Expand · Survive', W / 2, H / 2 - 88);
  ctx.fillStyle = '#f1c40f'; ctx.font = '14px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W / 2, H / 2 - 56);
  ctx.fillStyle = autoConstructUnlocked ? '#2ecc71' : '#7f8c8d';
  ctx.font = '12px monospace';
  ctx.fillText(autoConstructUnlocked ? 'Unlocked: SHIFT cycles tower auto-build spacing in-run.' : 'Meta unlock: Auto-Construct lets SHIFT auto-chain towers in-run.', W / 2, H / 2 - 28);
  ctx.fillStyle = '#566573';
  ctx.font = '11px monospace';
  ctx.fillText(autoConstructUnlocked ? 'Walk to place towers automatically at your chosen spacing.' : 'You can buy it in Meta Upgrades even before you ever use it.', W / 2, H / 2 - 8);
  ui.menuBtns = [
    btn(W / 2, H / 2 + 28, 'PLAY', '#27ae60'),
    btn(W / 2, H / 2 + 92, 'META UPGRADES 💎', '#8e44ad'),
    btn(W / 2, H / 2 + 156, 'CARD BOOK 📖', '#2980b9'),
  ];
}

export function handleMenuClick(mx: number, my: number) {
  const ui = R.ui;
  R.dev.menuHoldStart = 0;
  if (ui.menuBtns[0] && inBtn(mx, my, ui.menuBtns[0])) { newGame(); R.state = 'playing'; }
  if (ui.menuBtns[1] && inBtn(mx, my, ui.menuBtns[1])) { R.prevState = 'menu'; ui.metaScroll = 0; R.state = 'metascreen'; }
  if (ui.menuBtns[2] && inBtn(mx, my, ui.menuBtns[2])) { ui.cardBookScroll = 0; R.state = 'cardbook'; }
}

function drawDevMenuButton(x: number, y: number, w: number, h: number, label: string, color: string, data: any, font = 'bold 11px monospace') {
  const { ctx, ui } = R;
  ctx.fillStyle = color;
  rrect(x, y, w, h, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  rrect(x, y, w, h, 6); ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.textBaseline = 'alphabetic';
  ui.devMenuBtns.push({ x, y, w, h, ...data });
}

function renderDevSlotPips(x: number, y: number, total: number, active: number, color: string) {
  const { ctx } = R;
  const pipW = total <= 4 ? 16 : 12;
  const pipH = 8;
  const pipGap = 4;
  const totalW = total * pipW + (total - 1) * pipGap;
  const startX = x - totalW;
  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i < active ? color : '#1d2b3a';
    rrect(startX + i * (pipW + pipGap), y - pipH / 2, pipW, pipH, 3); ctx.fill();
    ctx.strokeStyle = i < active ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    rrect(startX + i * (pipW + pipGap), y - pipH / 2, pipW, pipH, 3); ctx.stroke();
  }
}

function renderDevStepperRow(x: number, y: number, w: number, label: string, value: string, color: string, minusData: any, plusData: any, opts: any = {}) {
  const { ctx } = R;
  const rowH = 22;
  const minusX = x + w - 58;
  const plusX = x + w - 30;
  const valueRight = minusX - 10;
  const tagX = x + w - 212;
  ctx.fillStyle = 'rgba(8,14,24,0.9)';
  rrect(x, y, w, rowH, 6); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  rrect(x, y, w, rowH, 6); ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 8, y + 15);
  drawDevMenuButton(minusX, y + 1, 24, 20, '−', '#223047', minusData, 'bold 13px monospace');
  drawDevMenuButton(plusX, y + 1, 24, 20, '+', '#223047', plusData, 'bold 13px monospace');
  if (opts.tag) {
    ctx.fillStyle = (opts.tagColor || '#34495e') + '55';
    rrect(tagX, y + 3, 72, 16, 5); ctx.fill();
    ctx.strokeStyle = (opts.tagColor || '#34495e') + 'aa';
    ctx.lineWidth = 1;
    rrect(tagX, y + 3, 72, 16, 5); ctx.stroke();
    ctx.fillStyle = opts.tagColor || '#7f8c8d';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(opts.tag, tagX + 36, y + 14);
  }
  if (opts.slots && opts.slots.total > 0 && opts.slots.total <= 6) {
    renderDevSlotPips(valueRight, y + 11, opts.slots.total, opts.slots.active, color);
    if (opts.slotText) {
      ctx.fillStyle = '#95a5a6';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(opts.slotText, tagX - 8, y + 15);
    }
  } else {
    ctx.fillStyle = '#dfe6e9';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(value, valueRight, y + 15);
  }
  if (opts.extraLabel) {
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(opts.extraLabel, tagX - 8, y + 15);
  }
}

function renderDevMenu() {
  const { ctx, W, H, ui, dev } = R;
  const panelW = Math.min(1040, W - 40);
  const panelX = Math.round(W / 2 - panelW / 2);
  const panelY = 24;
  const panelH = H - 48;
  const rowH = 24;
  const leftX = panelX + 24;
  const rightX = panelX + panelW / 2 + 10;
  const colW = panelW / 2 - 34;
  const topBoxY = panelY + 88;
  const topBoxH = 76;
  const baseY = panelY + 196;
  ui.devMenuBtns = [];
  ctx.fillStyle = '#07101c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  for (let i = 0; i < 70; i++) ctx.fillRect((i * 173) % W, (i * 61) % H, 2, 2);
  ctx.fillStyle = 'rgba(4,8,18,0.94)';
  rrect(panelX, panelY, panelW, panelH, 16); ctx.fill();
  ctx.strokeStyle = '#1f3a52';
  ctx.lineWidth = 2;
  rrect(panelX, panelY, panelW, panelH, 16); ctx.stroke();
  ctx.fillStyle = '#1a2a3e';
  ctx.fillRect(panelX, panelY + 76, panelW, 1);
  ctx.fillStyle = '#00d2ff';
  ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText('DEV SANDBOX', W / 2, panelY + 34);
  ctx.fillStyle = '#8aa6bf'; ctx.font = '12px monospace';
  ctx.fillText('Preset weapons, money, cards, and the exact wave to test.', W / 2, panelY + 56);
  ctx.fillStyle = '#f1c40f'; ctx.font = '11px monospace';
  ctx.fillText(dev.menuStatus, W / 2, panelY + 70);
  ctx.fillStyle = 'rgba(8,14,24,0.9)';
  rrect(leftX, topBoxY, colW, topBoxH, 10); ctx.fill();
  rrect(rightX, topBoxY, colW, topBoxH, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  rrect(leftX, topBoxY, colW, topBoxH, 10); ctx.stroke();
  rrect(rightX, topBoxY, colW, topBoxH, 10); ctx.stroke();
  ctx.fillStyle = '#95a5a6'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('STARTING GOLD', leftX + 12, topBoxY + 18);
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 28px monospace';
  ctx.fillText(`${Math.round(dev.config.gold)}`, leftX + 12, topBoxY + 52);
  drawDevMenuButton(leftX + colW - 178, topBoxY + 20, 42, 24, '-100', '#2c3e50', { action:'gold', delta:-100 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 130, topBoxY + 20, 34, 24, '-10', '#2c3e50', { action:'gold', delta:-10 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 90, topBoxY + 20, 34, 24, '+10', '#2c3e50', { action:'gold', delta:10 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 50, topBoxY + 20, 42, 24, '+100', '#2c3e50', { action:'gold', delta:100 }, 'bold 10px monospace');
  ctx.fillStyle = '#95a5a6'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('TARGET WAVE', rightX + 12, topBoxY + 18);
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 28px monospace';
  ctx.fillText(`${Math.round(dev.config.wave)}`, rightX + 12, topBoxY + 52);
  drawDevMenuButton(rightX + colW - 170, topBoxY + 20, 34, 24, '-5', '#2c3e50', { action:'wave', delta:-5 }, 'bold 10px monospace');
  drawDevMenuButton(rightX + colW - 130, topBoxY + 20, 34, 24, '-1', '#2c3e50', { action:'wave', delta:-1 }, 'bold 10px monospace');
  drawDevMenuButton(rightX + colW - 90, topBoxY + 20, 34, 24, '+1', '#2c3e50', { action:'wave', delta:1 }, 'bold 10px monospace');
  drawDevMenuButton(rightX + colW - 50, topBoxY + 20, 34, 24, '+5', '#2c3e50', { action:'wave', delta:5 }, 'bold 10px monospace');
  ctx.fillStyle = '#e67e22'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('WEAPONS', leftX, baseY - 12);
  Object.keys(WEAPONS).forEach((id, index) => {
    const def = WEAPONS[id];
    const value = dev.config.weaponLevels[id] > 0 ? `LV ${dev.config.weaponLevels[id]}` : 'OFF';
    renderDevStepperRow(leftX, baseY + index * rowH, colW, `${def.icon} ${def.name}`, value, def.color, { action:'weapon', id, delta:-1 }, { action:'weapon', id, delta:1 }, {
      tag: def.rarity.toUpperCase(),
      tagColor: def.color,
      slots: { total: 4, active: dev.config.weaponLevels[id] || 0 },
      slotText: dev.config.weaponLevels[id] > 0 ? `L${dev.config.weaponLevels[id]}` : 'OFF',
    });
  });
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('CARDS', rightX, baseY - 12);
  STAT_UPGRADES.forEach((stat, index) => {
    renderDevStepperRow(rightX, baseY + index * rowH, colW, `${stat.icon} ${stat.name}`, `x${dev.config.cardCounts[stat.id] || 0}`, devCardColor(stat), { action:'card', id:stat.id, delta:-1 }, { action:'card', id:stat.id, delta:1 }, stat.max && stat.max <= 6 ? {
      tag: `MAX ${stat.max}`,
      tagColor: devCardColor(stat),
      slots: { total: stat.max, active: Math.min(dev.config.cardCounts[stat.id] || 0, stat.max) },
      slotText: (dev.config.cardCounts[stat.id] || 0) === 0 ? 'OFF' : `x${dev.config.cardCounts[stat.id] || 0}`,
    } : {
      tag: stat.max ? `MAX ${stat.max}` : 'CUSTOM',
      tagColor: devCardColor(stat),
      extraLabel: `x${dev.config.cardCounts[stat.id] || 0}`,
    });
  });
  const footY = panelY + panelH - 48;
  drawDevMenuButton(panelX + 28, footY, 190, 30, '← MAIN MENU', '#34495e', { action:'menu' }, 'bold 12px monospace');
  drawDevMenuButton(panelX + panelW / 2 - 95, footY, 190, 30, '↺ RESET PRESET', '#7f8c8d', { action:'reset' }, 'bold 12px monospace');
  drawDevMenuButton(panelX + panelW - 228, footY, 200, 30, '▶ START TEST WAVE', '#16a085', { action:'start' }, 'bold 12px monospace');
}

export function handleDevMenuClick(mx: number, my: number) {
  const hit = R.ui.devMenuBtns.find((btnMeta: any) => mx >= btnMeta.x && mx <= btnMeta.x + btnMeta.w && my >= btnMeta.y && my <= btnMeta.y + btnMeta.h);
  if (!hit) return;
  if (hit.action === 'menu') { R.state = 'menu'; return; }
  if (hit.action === 'reset') { resetDevConfig(); R.dev.menuStatus = 'Preset reset to the current default run baseline.'; return; }
  if (hit.action === 'start') { startDevWave(); return; }
  if (hit.action === 'gold') { R.dev.config.gold = clamp(Math.round(R.dev.config.gold + hit.delta), 0, 999999); return; }
  if (hit.action === 'wave') { R.dev.config.wave = clamp(Math.round(R.dev.config.wave + hit.delta), 1, 999); return; }
  if (hit.action === 'weapon') { R.dev.config.weaponLevels[hit.id] = clamp((R.dev.config.weaponLevels[hit.id] || 0) + hit.delta, 0, 4); return; }
  if (hit.action === 'card') {
    const stat = STAT_UPGRADES.find(entry => entry.id === hit.id);
    if (!stat) return;
    R.dev.config.cardCounts[hit.id] = clamp((R.dev.config.cardCounts[hit.id] || 0) + hit.delta, 0, devCardLimit(stat));
  }
}

function renderGameover() {
  const { ctx, W, H, ui } = R;
  const game = R.game;
  ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 52px monospace'; ctx.textAlign = 'center';
  ctx.fillText(game.player.dead ? 'YOU DIED' : 'BASE DESTROYED', W / 2, H / 2 - 140);
  ctx.fillStyle = '#ecf0f1'; ctx.font = '22px monospace';
  ctx.fillText(`Waves survived: ${game.wave}`, W / 2, H / 2 - 80);
  ctx.fillStyle = '#f1c40f'; ctx.font = '20px monospace';
  ctx.fillText(`+${game.crystalsEarned} crystals earned`, W / 2, H / 2 - 50);
  ctx.fillStyle = '#bdc3c7'; ctx.font = '15px monospace';
  ctx.fillText(`Weapons used: ${game.player.weapons.map((w: any) => WEAPONS[w.id].name + ' Lv' + w.level).join(', ')}`, W / 2, H / 2 - 18);
  ui.gameoverBtns = [
    btn(W / 2 - 115, H / 2 + 44, 'PLAY AGAIN', '#27ae60'),
    btn(W / 2 + 115, H / 2 + 44, 'UPGRADES 💎', '#8e44ad'),
  ];
}

export function handleGameoverClick(mx: number, my: number) {
  const ui = R.ui;
  if (ui.gameoverBtns[0] && inBtn(mx, my, ui.gameoverBtns[0])) { newGame(); R.state = 'playing'; }
  if (ui.gameoverBtns[1] && inBtn(mx, my, ui.gameoverBtns[1])) { R.prevState = 'gameover'; ui.metaScroll = 0; R.state = 'metascreen'; }
}

function renderPauseScreen() {
  const { ctx, W, H, ui } = R;
  const game = R.game;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W / 2, H / 2 - 80);
  ctx.fillStyle = '#aaa'; ctx.font = '14px monospace';
  ctx.fillText('Press P or Escape to resume', W / 2, H / 2 - 44);
  const quitLabel = game?.devSession ? '🛠 RETURN TO DEV MENU' : '🏠 QUIT TO MENU';
  ui.pauseBtns = [
    btn(W / 2, H / 2 + 10, '▶ RESUME', '#27ae60', 220, 44),
    btn(W / 2, H / 2 + 70, quitLabel, '#c0392b', 220, 44),
  ];
}

export function handlePauseClick(mx: number, my: number) {
  const ui = R.ui;
  if (ui.pauseBtns[0] && inBtn(mx, my, ui.pauseBtns[0])) R.state = 'playing';
  if (ui.pauseBtns[1] && inBtn(mx, my, ui.pauseBtns[1])) {
    if (R.game?.devSession) finishDevSession(`Returned from wave ${R.game.wave} without finishing it.`);
    else R.state = 'menu';
  }
}

function makeCardBookPreviewGame(card: any) {
  const preview: any = {
    gold: 999,
    outpostDiscount: 0,
    tower: { hp: 850, maxHp: 1000, atkDmg: 40, atkRange: 280, atkSpeed: 1 },
    outposts: [{ hp: 150, maxHp: 200, atkDmg: 18, atkRange: 190 }],
    player: { weapons: [] },
  };
  if (card.type === 'weapon' && card.newLevel > 1) preview.player.weapons.push({ id: card.weaponId, level: card.newLevel - 1 });
  return preview;
}

function renderCardBook() {
  const { ctx, W, H, ui } = R;
  ctx.fillStyle = '#070d1a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#2980b9'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center';
  ctx.fillText('📖 CARD BOOK', W / 2, 36);
  const sections = CB_SECTIONS.map(section => ({ ...section, entries: section.cards() }));
  const totalCards = sections.reduce((sum, section) => sum + section.entries.length, 0);
  ctx.fillStyle = '#95a5a6'; ctx.font = '12px monospace';
  ctx.fillText(`${totalCards} possible run cards and weapon upgrades`, W / 2, 56);
  const luckPreview = 0;
  const t = buildDropChanceTable(luckPreview);
  const items = [
    { label:'Common', color:'#3498db', pct:t.common },
    { label:'Uncommon', color:'#e67e22', pct:t.uncommon },
    { label:'Rare', color:'#9b59b6', pct:t.rare },
  ];
  let lx = W / 2 - 210;
  ctx.font = '11px monospace'; ctx.textAlign = 'left';
  for (const it of items) {
    ctx.fillStyle = it.color + '33'; rrect(lx, 66, 132, 18, 4); ctx.fill();
    ctx.strokeStyle = it.color + '99'; ctx.lineWidth = 1; rrect(lx, 66, 132, 18, 4); ctx.stroke();
    ctx.fillStyle = it.color; ctx.font = 'bold 11px monospace'; ctx.fillText(`${it.label}`, lx + 6, 78);
    ctx.fillStyle = '#ddd'; ctx.font = '11px monospace'; ctx.fillText(`${it.pct}% / card`, lx + 70, 78);
    lx += 142;
  }
  ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Base odds before Lucky bonuses. Context cards only appear in runs when they can do something.', W / 2, 98);
  const clipTop = 114, clipBot = H - 48;
  const cols = Math.max(1, Math.floor((W - 72) / (CB_W + CB_GAP)));
  const gridW = cols * (CB_W + CB_GAP) - CB_GAP;
  const startX = Math.round(W / 2 - gridW / 2);
  function drawBookCard(card: any, bx: number, by: number) {
    const savedGame = R.game;
    R.game = makeCardBookPreviewGame(card);
    drawCard(card, bx, by, CB_W, CB_H, { dropChance: rarityDropChance(card.rarity, luckPreview) });
    R.game = savedGame;
  }
  function layout(draw: boolean) {
    let y = clipTop - ui.cardBookScroll;
    for (const section of sections) {
      const rows = Math.ceil(section.entries.length / cols);
      const cardsH = rows > 0 ? rows * (CB_H + CB_GAP) - CB_GAP : 0;
      const secH = 46 + 12 + cardsH + 18;
      if (draw && y + secH >= clipTop && y < clipBot) {
        ctx.fillStyle = section.color + '18'; rrect(startX - 8, y, gridW + 16, 46, 8); ctx.fill();
        ctx.strokeStyle = section.color + '66'; ctx.lineWidth = 1.5; rrect(startX - 8, y, gridW + 16, 46, 8); ctx.stroke();
        ctx.fillStyle = section.color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(section.label, startX + 8, y + 18);
        ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace'; ctx.fillText(section.note, startX + 8, y + 34);
        ctx.fillStyle = '#dfe6e9'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${section.entries.length} entries`, startX + gridW + 6, y + 28);
        const cardsY = y + 58;
        section.entries.forEach((card: any, idx: number) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const bx = startX + col * (CB_W + CB_GAP);
          const by = cardsY + row * (CB_H + CB_GAP);
          if (by + CB_H < clipTop || by > clipBot) return;
          drawBookCard(card, bx, by);
        });
      }
      y += secH;
    }
    return y + ui.cardBookScroll;
  }
  const totalH = layout(false);
  const maxScroll = Math.max(0, totalH - clipBot + 18);
  ui.cardBookScroll = clamp(ui.cardBookScroll, 0, maxScroll);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();
  layout(true);
  ctx.restore();
  ctx.fillStyle = 'rgba(7,13,26,0.9)'; ctx.fillRect(0, clipBot, W, H - clipBot);
  ctx.fillStyle = '#444'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('↕ scroll with mouse wheel', W / 2, clipBot + 16);
  ui.cardBookBackBtn = btn(W / 2, H - 18, '← BACK TO MENU', '#555', 220, 28);
}

function renderMetaScreen() {
  const { ctx, W, H, meta, ui } = R;
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText('META UPGRADES', W / 2, 42);
  ctx.fillStyle = '#f1c40f'; ctx.font = '16px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals available`, W / 2, 66);
  ui.metaBtns = [];
  const cols = 3, cardW = 245, cardH = 106, gX = 18, gY = 12;
  const totalW = cols * cardW + (cols - 1) * gX;
  const sX = W / 2 - totalW / 2;
  const clipTop = 78, clipBot = H - 52;
  let layoutRow = 0, layoutCol = 0, layoutLastCat = null, contentBottom = clipTop;
  META_UPGRADES.forEach((upg: any) => {
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
  ui.maxMetaScroll = Math.max(0, contentBottom - clipBot + 12);
  ui.metaScroll = clamp(ui.metaScroll, 0, ui.maxMetaScroll);
  ctx.save();
  ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();
  let row = 0, col = 0, lastCat = null;
  META_UPGRADES.forEach((upg: any) => {
    if (upg.cat !== lastCat) {
      if (col !== 0) { row++; col = 0; }
      const ly = clipTop + row * (cardH + gY) - ui.metaScroll;
      if (ly > clipTop - 20 && ly < clipBot) {
        ctx.fillStyle = CAT_COLORS[upg.cat] || '#aaa';
        ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(CAT_LABELS[upg.cat] || upg.cat.toUpperCase(), sX, ly + 14);
      }
      row += 0.22;
      lastCat = upg.cat;
    }
    const bx = sX + col * (cardW + gX);
    const by = clipTop + row * (cardH + gY) - ui.metaScroll;
    if (by + cardH >= clipTop && by <= clipBot) {
      const lvl = meta.upgrades[upg.id] || 0;
      const maxed = lvl >= upg.max;
      const canAfford = !maxed && meta.crystals >= upg.cost;
      const catColor = CAT_COLORS[upg.cat] || '#8e44ad';
      ctx.fillStyle = maxed ? '#1a3a1a' : canAfford ? '#0f1a2e' : '#111';
      rrect(bx, by, cardW, cardH, 7); ctx.fill();
      ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? catColor : '#2a2a2a';
      ctx.lineWidth = maxed || canAfford ? 2 : 1;
      rrect(bx, by, cardW, cardH, 7); ctx.stroke();
      ctx.fillStyle = catColor + '33'; rrect(bx, by, cardW, 5, 3); ctx.fill();
      ctx.fillStyle = maxed ? '#2ecc71' : '#dfe6e9'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
      ctx.fillText(upg.label, bx + 10, by + 22);
      ctx.fillStyle = '#95a5a6'; ctx.font = '10px monospace';
      const descBottom = wrapText(upg.desc, bx + 10, by + 38, cardW - 20, 12, 2);
      const dotsY = descBottom + 15;
      ctx.fillStyle = catColor;
      ctx.fillText('●'.repeat(lvl) + '○'.repeat(upg.max - lvl), bx + 10, dotsY);
      if (!maxed) {
        ctx.fillStyle = canAfford ? '#f1c40f' : '#555'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
        ctx.fillText(`${upg.cost}💎`, bx + cardW - 8, by + 22);
        if (canAfford) ui.metaBtns.push({ ...btn(bx + cardW / 2, by + cardH - 18, 'UNLOCK', catColor, cardW - 30, 26), id:upg.id, cost:upg.cost, max:upg.max });
      } else {
        ctx.fillStyle = '#27ae60'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('✓ MAXED', bx + cardW / 2, by + cardH - 10);
      }
    }
    col++;
    if (col >= cols) { col = 0; row++; }
  });
  ctx.restore();
  ctx.fillStyle = 'rgba(10,15,30,0.95)'; ctx.fillRect(0, clipBot, W, H - clipBot);
  ctx.fillStyle = '#333'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('↕ scroll with mouse wheel', W / 2, clipBot + 16);
  ui.metaBackBtn = btn(W / 2, H - 22, '← BACK', '#555', 160, 32);
}

export function handleMetaClick(mx: number, my: number) {
  const { meta, ui } = R;
  for (const b of ui.metaBtns) {
    if (inBtn(mx, my, b)) {
      const lvl = meta.upgrades[b.id] || 0;
      if (lvl < b.max && meta.crystals >= b.cost) {
        meta.crystals -= b.cost;
        meta.upgrades[b.id] = lvl + 1;
        saveMeta(meta);
      }
      return;
    }
  }
  if (ui.metaBackBtn && inBtn(mx, my, ui.metaBackBtn)) R.state = R.prevState === 'gameover' ? 'gameover' : 'menu';
}

function wrapText(text: string, x: number, y: number, maxW: number, lineH: number, maxLines = Infinity) {
  const { ctx } = R;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else line = test;
  }
  if (lines.length < maxLines && line) lines.push(line);
  const wasTruncated = lines.length >= maxLines && words.join(' ') !== lines.join(' ');
  if (wasTruncated) {
    let lastLine = lines[maxLines - 1];
    while (lastLine && ctx.measureText(lastLine + '…').width > maxW) lastLine = lastLine.slice(0, -1);
    lines[maxLines - 1] = (lastLine || '').trimEnd() + '…';
  }
  lines.forEach((wrappedLine, index) => ctx.fillText(wrappedLine, x, y + index * lineH));
  return y + Math.max(0, lines.length - 1) * lineH;
}

function btn(cx: number, cy: number, label: string, color: string, bw = 200, bh = 46): BtnRect {
  const { ctx } = R;
  const bx = cx - bw / 2, by = cy - bh / 2;
  ctx.fillStyle = color; rrect(bx, by, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; rrect(bx, by, bw, bh, 8); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy); ctx.textBaseline = 'alphabetic';
  return { cx, cy, bw, bh };
}

function drawHpBar(x: number, y: number, w: number, h: number, hp: number, maxHp: number, bg: string, fg: string) {
  const { ctx } = R;
  ctx.fillStyle = bg + '44'; rrect(x, y, w, h, h / 2); ctx.fill();
  const pct = clamp(hp / maxHp, 0, 1);
  if (pct > 0) { ctx.fillStyle = fg; rrect(x, y, w * pct, h, h / 2); ctx.fill(); }
}

function rrect(x: number, y: number, w: number, h: number, r: number) {
  const { ctx } = R;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function registerHoverRegion(x: number, y: number, w: number, h: number, data: any) {
  R.hoverRegions.push({ x, y, w, h, data });
}

function wrapTextLines(text: string, maxW: number) {
  const { ctx } = R;
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function getRunCardTooltipLines(entry: any) {
  const lines = [`${entry.icon} ${entry.name}`];
  lines.push(...wrapTextLines(entry.desc, 220));
  if (entry.count > 1) lines.push(`Taken ${entry.count}x this run`);
  if (entry.type === 'weapon') {
    const weapon = R.game.player.weapons.find((w: any) => w.id === entry.weaponId);
    if (weapon) {
      lines.push(`Current level ${weapon.level}/4`);
      const bonuses = (entry.levelBonus || []).slice(1, weapon.level).filter(Boolean);
      bonuses.forEach((bonus: string) => lines.push(...wrapTextLines(`+ ${bonus}`, 220)));
    }
  } else {
    const stat = STAT_UPGRADES.find(s => s.id === entry.statId);
    if (stat?.count) {
      const cur = stat.count(R.game.player);
      lines.push(stat.max ? `Stacks ${cur}/${stat.max}` : `Stacks ${cur}`);
    }
    if (entry.statId === 'outpostCheap') {
      const towerDiscount = R.game.outpostDiscount || 0;
      lines.push(`Tower cost now ${getOutpostCost()}g`);
      if (towerDiscount > 0) lines.push(`Discount applied: -${towerDiscount}g`);
    }
  }
  return lines;
}

function renderRunCardTooltip() {
  const { ctx, mouseInside, mouseX, mouseY, hoverRegions, W, H } = R;
  if (!mouseInside || hoverRegions.length === 0) return;
  let hovered: any = null;
  for (let i = hoverRegions.length - 1; i >= 0; i--) {
    const region = hoverRegions[i];
    if (mouseX >= region.x && mouseX <= region.x + region.w && mouseY >= region.y && mouseY <= region.y + region.h) { hovered = region; break; }
  }
  if (!hovered?.data?.entry) return;
  ctx.save();
  ctx.font = '11px monospace';
  const lines = getRunCardTooltipLines(hovered.data.entry);
  const pad = 10, lineH = 14;
  const boxW = Math.min(260, Math.max(160, Math.max(...lines.map(line => ctx.measureText(line).width)) + pad * 2));
  const boxH = lines.length * lineH + pad * 2;
  const boxX = clamp(mouseX - boxW / 2, 10, W - boxW - 10);
  const boxY = mouseY > H * 0.55 ? mouseY - boxH - 14 : mouseY + 14;
  ctx.fillStyle = 'rgba(8,12,22,0.95)';
  rrect(boxX, boxY, boxW, boxH, 8); ctx.fill();
  ctx.strokeStyle = hovered.data.entry.color || '#2ecc71';
  ctx.lineWidth = 1.5;
  rrect(boxX, boxY, boxW, boxH, 8); ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.textAlign = 'left';
  lines.forEach((line, index) => {
    ctx.fillStyle = index === 0 ? (hovered.data.entry.color || '#ecf0f1') : '#d0d7de';
    ctx.fillText(line, boxX + pad, boxY + pad + 11 + index * lineH);
  });
  ctx.restore();
}
