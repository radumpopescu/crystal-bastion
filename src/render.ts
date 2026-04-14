import { ENTITY_H, ISO_SCALE, MAX_WEAPON_SLOTS, OUTPOST_HP_BASE, PLAYER_RADIUS, SHADOW_SCALE, STAT_UPGRADES, TH, TILE_SIZE, TW, TOWER_UPGRADES, WAVE_INTERVAL, WEAPONS, META_UPGRADES } from './constants';
import { R, devCardColor, devCardLimit, finishDevSession, newGame, resetDevConfig, w2s } from './state';
import { buildDropChanceTable, getAnchors, getBaseStats, getLoadoutStats, getOutpostCost, getRunCardEntries, luCardDims, luPositions, rarityDropChance, startDevWave, weaponCardNeedsSlot } from './systems';
import { clamp, dist, inBtn } from './utils';
import { saveMeta } from './meta';
import { GAME_VERSION } from './version';
import type { BtnRect } from './types';

const CB_W = 148, CB_H = 215, CB_GAP = 10;
const CAT_COLORS: Record<string, string> = { player:'#e74c3c', econ:'#f1c40f', tower:'#f39c12', outpost:'#3498db', unlock:'#8e44ad' };
const CAT_LABELS: Record<string, string> = { player:'⚔️ PLAYER', econ:'💰 ECONOMY', tower:'🏰 BASE', outpost:'🔵 TOWERS', unlock:'🔓 UNLOCKS' };

const CB_SECTIONS: { id: string; label: string; color: string; icon: string; note: string; filter: (s: any) => boolean }[] = [
  { id:'player', icon:'🧍', label:'PLAYER',  color:'#2ecc71', note:'Core stat boosts — survivability, damage, mobility.',
    filter: s => !s.id.startsWith('tower') && !s.id.startsWith('outpost') },
  { id:'base',   icon:'🏰', label:'BASE',    color:'#f39c12', note:'Base turret enhancements. Some only appear when useful.',
    filter: s => s.id.startsWith('tower') },
  { id:'towers', icon:'🔵', label:'TOWERS',  color:'#3498db', note:'Outpost utility. Conditional cards check your current state.',
    filter: s => s.id.startsWith('outpost') },
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
  if (R.state === 'paused')     { renderGame(); renderPauseScreen(); renderRunCardTooltip(); return; }
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
  const lv = op.level || 1;
  ctx.fillStyle = lv >= 5 ? '#f1c40f' : '#8bd3ff';
  ctx.font = `bold ${lv >= 5 ? 11 : 10}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`Lv${lv}`, sx, sy - bh - 22);
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
    ui.waveStartBtn = btn(125, 112, `▶ START [ENTER] (+${earlyGold}g)`, '#e67e22', 220, 36);
  }
  ctx.fillStyle = '#556'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(game.player.weapons.map((w: any) => `${WEAPONS[w.id].icon}${w.level}`).join('  '), 20, game.waveActive ? 78 : 82);

  const controlsBoxH = 112;
  const controlsBoxY = H - 322;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  rrect(W - 230, controlsBoxY, 220, controlsBoxH, 6); ctx.fill();
  ctx.fillStyle = '#666'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText('WASD move · SPACE dash', W - 14, controlsBoxY + 20);
  ctx.fillText('E: tower · ENTER: wave · P: pause', W - 14, controlsBoxY + 36);
  ctx.fillStyle = '#a855f7'; ctx.font = 'bold 13px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W - 14, controlsBoxY + 56);
  ctx.fillStyle = autoConstructUnlocked ? '#7f8c8d' : '#4f5b66'; ctx.font = '11px monospace';
  ctx.fillText(autoConstructUnlocked ? 'Hold SHIFT to auto-build towers' : 'Relic unlock: Arcane Masons', W - 14, controlsBoxY + 74);
  const shiftHeld = game.keys['ShiftLeft'] || game.keys['ShiftRight'];
  ctx.fillStyle = autoConstructUnlocked
    ? (shiftHeld ? '#27ae60' : '#95a5a6')
    : '#6b7280';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(autoConstructUnlocked ? `Auto: ${shiftHeld ? 'HOLD SHIFT' : 'READY'}` : 'Auto: LOCKED', W - 14, controlsBoxY + 90);
  if (!autoConstructUnlocked) {
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.fillText('Unlock it in Meta Upgrades', W - 14, controlsBoxY + 104);
  } else {
    ctx.fillStyle = '#7f8c8d';
    ctx.font = '10px monospace';
    ctx.fillText('Builds every 1m while you walk', W - 14, controlsBoxY + 104);
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

function drawCard(card: any, bx: number, by: number, cW: number, cH: number, opts: any = {}) {
  const { ctx } = R;
  const game = R.game;
  const isWeapon = card.type === 'weapon';
  const def = isWeapon ? WEAPONS[card.weaponId] : null;
  const stat = !isWeapon ? STAT_UPGRADES.find(s => s.id === card.statId) : null;
  const rarity = def?.rarity || stat?.rarity || 'common';
  const rarityColor = rarity === 'rare' ? '#9b59b6' : rarity === 'uncommon' ? '#e67e22' : '#3498db';
  const accentColor = isWeapon ? def.color : (opts.shopCard ? '#e67e22' : '#2ecc71');
  const bgColor = opts.picked ? '#0d2210' : opts.dimmed ? '#0a0a14' : opts.locked ? '#1b1620' : '#0f1a2e';
  const borderColor = opts.picked ? '#27ae60' : opts.locked ? '#f1c40f' : opts.dimmed ? '#333' : accentColor;
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
  if (opts.locked) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('HELD FOR NEXT SHOP', bx + cW / 2, by + cH - 58);
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

function getRunCardGroupMeta(entry: any) {
  if (entry.type === 'weapon') return { key:'weapons', label:'WEAPONS', color:'#e74c3c' };
  if (entry.statId?.startsWith('tower')) return { key:'base', label:'BASE', color:'#f39c12' };
  if (entry.statId?.startsWith('outpost')) return { key:'towers', label:'TOWERS', color:'#3498db' };
  return { key:'player', label:'PLAYER', color:'#2ecc71' };
}

function renderGroupedRunCards(panelX: number, panelW: number, startY: number, bottomY: number) {
  const { ctx } = R;
  const runCards = getRunCardEntries();
  if (runCards.length === 0) return startY;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#3a4a5a';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('CARDS THIS RUN', panelX + 10, startY);
  let sideY = startY + 14;

  const groups: Record<string, any[]> = { base: [], towers: [], player: [], weapons: [] };
  runCards.forEach(entry => {
    groups[getRunCardGroupMeta(entry).key].push(entry);
  });

  for (const key of ['base', 'towers', 'player', 'weapons']) {
    const entries = groups[key];
    if (!entries.length) continue;
    if (sideY + 14 > bottomY) break;
    const groupMeta = getRunCardGroupMeta(entries[0]);
    ctx.fillStyle = groupMeta.color;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(groupMeta.label, panelX + 10, sideY);
    sideY += 14;

    for (const entry of entries) {
      if (sideY + 16 > bottomY) return sideY;
      const rowY = sideY;
      const suffix = entry.count > 1 ? ` x${entry.count}` : '';
      ctx.font = '11px monospace';
      const maxNameW = panelW - 26 - ctx.measureText(suffix).width;
      let label = `${entry.icon} ${entry.name}`;
      while (ctx.measureText(label).width > maxNameW && label.length > 4) label = label.slice(0, -2).trimEnd() + '…';
      ctx.textAlign = 'left';
      ctx.fillStyle = entry.color;
      ctx.fillText(label, panelX + 10, rowY);
      if (suffix) {
        ctx.fillStyle = '#dfe6e9';
        ctx.textAlign = 'right';
        ctx.fillText(suffix, panelX + panelW - 4, rowY);
      }
      registerHoverRegion(panelX + 8, rowY - 12, panelW - 12, 16, { entry });
      sideY += 18;
    }

    sideY += 4;
  }

  return sideY;
}

function renderLoadoutSidebar(panelX: number, panelW: number, options: { title?: string; hint?: string | null; allowSell?: boolean } = {}) {
  const { ctx, H, ui } = R;
  const game = R.game;
  const allowSell = options.allowSell !== false;
  ctx.fillStyle = '#0b1220';
  rrect(panelX, 0, panelW + 12, H, 0); ctx.fill();
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(panelX, 0); ctx.lineTo(panelX, H); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText(options.title || 'LOADOUT', panelX + panelW / 2, 28);

  let sideY = 46;
  if (options.hint) {
    const hintLines = wrapTextLines(options.hint, panelW - 20);
    ctx.fillStyle = '#f39c12';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    hintLines.forEach((line, index) => ctx.fillText(line, panelX + 10, sideY + index * 12));
    sideY += hintLines.length * 12 + 8;
  }

  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  const maxSlots = game.maxWeaponSlots || MAX_WEAPON_SLOTS;
  ctx.fillText(`WEAPON SLOTS ${game.player.weapons.length}/${maxSlots}`, panelX + 10, sideY); sideY += 14;
  if (game.player.weapons.length >= maxSlots) {
    ctx.fillStyle = '#e67e22';
    ctx.font = '10px monospace';
    ctx.fillText('Full loadout: sell one to take a new weapon.', panelX + 10, sideY);
    sideY += 14;
  }

  for (let slot = 0; slot < maxSlots; slot++) {
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
      ctx.fillText(`L${weapon.level}`, allowSell ? sellX - 8 : panelX + panelW - 12, rowY + 1);
      if (allowSell) {
        ctx.fillStyle = '#5b1f1f';
        rrect(sellX, sellY, sellW, sellH, 4); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        rrect(sellX, sellY, sellW, sellH, 4); ctx.stroke();
        ctx.fillStyle = '#f8d7da';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SELL', sellX + sellW / 2, sellY + 11);
        ui.levelupWeaponBtns.push({ x: sellX, y: sellY, w: sellW, h: sellH, slotIndex: slot });
      }
    } else {
      ctx.fillStyle = '#566573';
      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SLOT ${slot + 1}  EMPTY`, panelX + 14, rowY + 1);
    }
    sideY += 24;
  }

  sideY += 4;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('CURRENT STATS', panelX + 10, sideY); sideY += 14;
  getLoadoutStats().forEach(stat => {
    ctx.fillStyle = '#cbd5e1'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${stat.icon} ${stat.name}`, panelX + 10, sideY);
    ctx.fillStyle = '#8bd3ff'; ctx.textAlign = 'right';
    ctx.fillText(stat.value, panelX + panelW - 4, sideY);
    sideY += 16;
  });

  const outposts = game.outposts || [];
  const opLv = game.outpostLevel || 1;
  const op0 = outposts[0];
  const fallbackOpHp = OUTPOST_HP_BASE + (game.opHpBonus || 0);
  const totalHp = outposts.reduce((s: number, o: any) => s + o.hp, 0);
  const totalMaxHp = outposts.reduce((s: number, o: any) => s + o.maxHp, 0);
  const hpPct = totalMaxHp > 0 ? totalHp / totalMaxHp : 0;
  const towerDmg = Math.round(op0?.atkDmg || (20 * (game.opAtkMult || 1) * Math.pow(1.28, opLv - 1)));
  const towerRange = Math.round(op0?.atkRange || (240 + (opLv - 1) * 18));

  sideY += 4;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('TOWERS', panelX + 10, sideY);
  ctx.fillStyle = opLv >= 5 ? '#f1c40f' : '#8bd3ff'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`${outposts.length} built  Lv${opLv}/5`, panelX + panelW - 4, sideY); sideY += 14;
  const barW = panelW - 20;
  const barX = panelX + 10;
  ctx.fillStyle = '#1a2535';
  ctx.fillRect(barX, sideY, barW, 4);
  if (outposts.length > 0) {
    ctx.fillStyle = hpPct > 0.5 ? '#27ae60' : hpPct > 0.25 ? '#f39c12' : '#e74c3c';
    ctx.fillRect(barX, sideY, Math.round(barW * hpPct), 4);
  }
  sideY += 8;
  ctx.fillStyle = '#cbd5e1'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  ctx.fillText(outposts.length > 0 ? `${Math.ceil(totalHp)}/${totalMaxHp} HP total` : `0/${fallbackOpHp} HP each`, barX, sideY);
  ctx.fillStyle = '#f5c26b'; ctx.textAlign = 'right';
  ctx.fillText(`${towerDmg}dmg  ${towerRange}rng`, panelX + panelW - 4, sideY);
  sideY += 14;

  renderGroupedRunCards(panelX, panelW, sideY + 8, H - 18);
}

function renderBaseSidebar(panelX: number, panelW: number, { allowBuy = true } = {}) {
  const { ctx, H, ui } = R;
  const game = R.game;
  ctx.fillStyle = '#0b1220';
  rrect(panelX, 0, panelW + 12, H, 0); ctx.fill();
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(panelX + panelW + 12, 0); ctx.lineTo(panelX + panelW + 12, H); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
  ctx.fillText('BASE', panelX + panelW / 2 + 6, 28);

  let sideY = 46;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('BASE STATS', panelX + 10, sideY); sideY += 14;
  getBaseStats().forEach(stat => {
    ctx.fillStyle = '#cbd5e1'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${stat.icon} ${stat.name}`, panelX + 10, sideY);
    ctx.fillStyle = '#f5c26b'; ctx.textAlign = 'right';
    ctx.fillText(stat.value, panelX + panelW + 6, sideY);
    sideY += 16;
  });

  sideY += 10;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('BASE UPGRADES', panelX + 10, sideY); sideY += 16;

  TOWER_UPGRADES.forEach((upg, index) => {
    const lvl = game.tower.upgrades[upg.id] || 0;
    const maxed = lvl >= upg.max;
    const cost = maxed ? 0 : upg.cost[lvl];
    const canAfford = allowBuy && !maxed && game.gold >= cost;
    const rowY = sideY + index * 54;
    const rowX = panelX + 8;
    const rowW = panelW - 4;
    const rowH = 44;
    ctx.fillStyle = maxed ? '#16261a' : (allowBuy && canAfford) ? '#101a29' : '#0e1520';
    rrect(rowX, rowY - 12, rowW, rowH, 6); ctx.fill();
    ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? '#f39c12' : '#2a3a4a';
    ctx.lineWidth = 1;
    rrect(rowX, rowY - 12, rowW, rowH, 6); ctx.stroke();
    ctx.fillStyle = maxed ? '#27ae60' : allowBuy ? '#ecf0f1' : '#7a8a9a';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(upg.label, rowX + 8, rowY + 1);
    ctx.fillStyle = '#8c9aa8';
    ctx.font = '10px monospace';
    ctx.fillText('●'.repeat(lvl) + '○'.repeat(Math.max(0, upg.max - lvl)), rowX + 8, rowY + 17);
    if (maxed) {
      ctx.fillStyle = '#27ae60';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('MAXED', rowX + rowW - 8, rowY + 1);
    } else if (allowBuy) {
      ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${cost}⬡`, rowX + rowW - 8, rowY + 1);
      ui.levelupBaseUpgradeBtns.push({ x: rowX, y: rowY - 12, w: rowW, h: rowH, upgradeId: upg.id });
    } else {
      ctx.fillStyle = '#4a5a6a';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(`${cost}⬡`, rowX + rowW - 8, rowY + 1);
    }
  });

  const ks = game.killStats || { player: 0, base: 0, tower: 0 };
  const killsY = TOWER_UPGRADES.length * 54 + (sideY - 16) + 16;
  ctx.fillStyle = '#3a4a5a'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('KILLS THIS RUN', panelX + 10, killsY);
  const rows = [
    { icon:'⚔️', name:'Player', value: ks.player },
    { icon:'🏰', name:'Base',   value: ks.base },
    { icon:'🔵', name:'Towers', value: ks.tower },
  ];
  rows.forEach((row, i) => {
    const ry = killsY + 14 + i * 14;
    ctx.fillStyle = '#cbd5e1'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${row.icon} ${row.name}`, panelX + 10, ry);
    ctx.fillStyle = '#8bd3ff'; ctx.textAlign = 'right';
    ctx.fillText(`${row.value}`, panelX + panelW + 6, ry);
  });
}

function renderLevelUpCards() {
  const { ctx, W, H, ui } = R;
  const game = R.game;
  const cards = game.levelUpCards;
  if (!cards) return;
  ui.levelupWeaponBtns = [];
  ui.levelupShopLockBtns = [];
  ui.levelupBaseUpgradeBtns = [];
  ctx.fillStyle = 'rgba(4,8,20,0.93)'; ctx.fillRect(0, 0, W, H);
  const { w: cW, h: cH, gap } = luCardDims();
  const { freeTop, shopTop, leftPanelX, leftPanelW, rightPanelX, rightPanelW, centerX } = luPositions();
  const panelW = rightPanelW;
  const panelX = rightPanelX;
  renderBaseSidebar(leftPanelX, leftPanelW);
  renderLoadoutSidebar(panelX, panelW, { hint: game._cardActionHint });

  const centerStartX = leftPanelX + leftPanelW + 12;
  ctx.fillStyle = '#1a2540';
  ctx.fillRect(centerStartX, 0, panelX - centerStartX, 66);
  ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(centerStartX, 66); ctx.lineTo(panelX, 66); ctx.stroke();
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
  ctx.fillStyle = '#95a5a6'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('Use LOCK NEXT to keep a card for the next shop.', sStartX - 10, shopTop + cH + 18);
  ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`Gold: ${game.gold} 🪙`, sStartX + sTotalW + 10, shopTop - 12);
  sCards.forEach((card: any, i: number) => {
    const bx = sStartX + i * (cW + gap);
    const needsSlot = weaponCardNeedsSlot(card, game);
    if (card._bought) drawCard(card, bx, shopTop, cW, cH, { picked: true, costLabel: '✓ BOUGHT', needsSlot, locked: card._locked });
    else drawCard(card, bx, shopTop, cW, cH, { shopCard: true, dimmed: game.gold < card.cost, costLabel: `${card.cost}🪙`, needsSlot, locked: card._locked });
    if (!card._bought) {
      const lockW = 62;
      const lockH = 18;
      const lockX = bx + cW - lockW - 8;
      const lockY = shopTop + 10;
      ctx.fillStyle = card._locked ? '#6b5200' : '#223047';
      rrect(lockX, lockY, lockW, lockH, 4); ctx.fill();
      ctx.strokeStyle = card._locked ? '#f1c40f' : '#7f8c8d';
      ctx.lineWidth = 1;
      rrect(lockX, lockY, lockW, lockH, 4); ctx.stroke();
      ctx.fillStyle = card._locked ? '#f8e27a' : '#cbd5e1';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(card._locked ? 'HELD' : 'LOCK', lockX + lockW / 2, lockY + 12);
      ui.levelupShopLockBtns.push({ x: lockX, y: lockY, w: lockW, h: lockH, cardIndex: i });
    }
  });

  const botY = H - 52;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, botY, panelX, 52);
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, botY); ctx.lineTo(panelX, botY); ctx.stroke();
  const rerollCost = game._rerollCost ?? 2;
  const canReroll = game.gold >= rerollCost;
  const refreshLabel = `🔀 Refresh All  ${rerollCost}🪙`;
  ui.refreshAllBtn = btn(120, botY + 26, refreshLabel, canReroll ? '#5b2d8e' : '#252535', 220, 36);
  ui.continueBtn = btn(panelX - 110, botY + 26, '▶  DONE', '#27ae60', 180, 36);
}

function drawMenuChip(x: number, y: number, label: string, fill: string, stroke = 'rgba(255,255,255,0.12)') {
  const { ctx } = R;
  ctx.fillStyle = fill;
  rrect(x, y, ctx.measureText(label).width + 22, 24, 12); ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  rrect(x, y, ctx.measureText(label).width + 22, 24, 12); ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 11, y + 16);
}

function drawMenuActionCard(rect: BtnRect, title: string, subtitle: string, color: string, hovered: boolean) {
  const { ctx } = R;
  const bx = rect.cx - rect.bw / 2;
  const by = rect.cy - rect.bh / 2;
  const bg = ctx.createLinearGradient(bx, by, bx + rect.bw, by + rect.bh);
  bg.addColorStop(0, hovered ? '#15243b' : '#101a2b');
  bg.addColorStop(1, hovered ? '#0f1b31' : '#0b1321');
  ctx.fillStyle = bg;
  ctx.shadowColor = hovered ? color + '88' : 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = hovered ? 18 : 10;
  rrect(bx, by, rect.bw, rect.bh, 14); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = hovered ? color : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = hovered ? 2 : 1.2;
  rrect(bx, by, rect.bw, rect.bh, 14); ctx.stroke();

  ctx.fillStyle = color;
  rrect(bx, by, 8, rect.bh, 10); ctx.fill();
  ctx.fillStyle = hovered ? '#ffffff' : '#ecf0f1';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(title, bx + 22, by + 32);
  ctx.fillStyle = hovered ? '#c7d4e3' : '#7f8c9a';
  ctx.font = '11px monospace';
  ctx.fillText(subtitle, bx + 22, by + 53);
  ctx.fillStyle = hovered ? color : '#54657b';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'right';
  ctx.fillText('›', bx + rect.bw - 18, by + 38);
}

function renderMenu() {
  const { ctx, W, H, meta, ui, mouseX, mouseY } = R;
  const t = performance.now() * 0.001;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#08111f');
  bg.addColorStop(0.45, '#0a1630');
  bg.addColorStop(1, '#050914');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glowLeft = ctx.createRadialGradient(W * 0.24, H * 0.32, 0, W * 0.24, H * 0.32, W * 0.42);
  glowLeft.addColorStop(0, 'rgba(38, 208, 206, 0.20)');
  glowLeft.addColorStop(1, 'rgba(38, 208, 206, 0)');
  ctx.fillStyle = glowLeft;
  ctx.fillRect(0, 0, W, H);

  const glowRight = ctx.createRadialGradient(W * 0.82, H * 0.26, 0, W * 0.82, H * 0.26, W * 0.28);
  glowRight.addColorStop(0, 'rgba(241, 196, 15, 0.18)');
  glowRight.addColorStop(1, 'rgba(241, 196, 15, 0)');
  ctx.fillStyle = glowRight;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = 'rgba(105, 146, 186, 0.08)';
  ctx.lineWidth = 1;
  const gridStep = 72;
  for (let x = -gridStep; x < W + gridStep; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H * 0.9, H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, H);
    ctx.lineTo(x + H * 0.9, 0);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 130; i++) {
    const sx = (i * 137.5 + Math.sin(t + i) * 18) % W;
    const sy = (i * 73.3 + Math.cos(t * 0.7 + i) * 12) % H;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  const heroX = 44;
  const actionW = Math.min(310, Math.max(250, W * 0.25));
  const actionX = W - actionW - 42;
  const heroW = Math.max(320, actionX - heroX - 26);
  const heroH = Math.min(430, Math.max(340, H - 140));
  const heroY = Math.max(42, H / 2 - heroH / 2);

  ctx.fillStyle = 'rgba(8,16,30,0.74)';
  rrect(heroX, heroY, heroW, heroH, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(90, 172, 214, 0.16)';
  ctx.lineWidth = 1.5;
  rrect(heroX, heroY, heroW, heroH, 24); ctx.stroke();

  const artCx = heroX + heroW * 0.73;
  const artCy = heroY + heroH * 0.43;
  const pulse = 1 + Math.sin(t * 2.2) * 0.05;
  ctx.save();
  ctx.translate(artCx, artCy);
  ctx.strokeStyle = 'rgba(69, 211, 198, 0.18)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, (120 + i * 50) * pulse, (60 + i * 24) * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  const nodes = [
    { x: 0, y: 0, color:'#f39c12', size: 18 },
    { x: -112, y: 54, color:'#2ecc71', size: 12 },
    { x: 106, y: 46, color:'#3498db', size: 12 },
    { x: 26, y: -88, color:'#9b59b6', size: 12 },
  ];
  ctx.strokeStyle = 'rgba(121, 220, 214, 0.26)';
  ctx.lineWidth = 2;
  for (let i = 1; i < nodes.length; i++) {
    ctx.beginPath();
    ctx.moveTo(nodes[0].x, nodes[0].y);
    ctx.lineTo(nodes[i].x, nodes[i].y);
    ctx.stroke();
  }
  for (const node of nodes) {
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = node.color + '33';
    ctx.fillRect(-node.size * 1.8, -node.size * 1.8, node.size * 3.6, node.size * 3.6);
    ctx.fillStyle = node.color;
    ctx.fillRect(-node.size, -node.size, node.size * 2, node.size * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(-node.size, -node.size, node.size * 2, node.size * 2);
    ctx.restore();
  }
  ctx.restore();

  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('CRYSTAL', heroX + 34, heroY + 78);
  ctx.font = 'bold 56px monospace';
  ctx.fillText('BASTION', heroX + 30, heroY + 138);

  ctx.fillStyle = '#9fb3c8';
  ctx.font = '15px monospace';
  ctx.fillText('Defend the crystal core. Expand a living tower network.', heroX + 34, heroY + 176);
  ctx.fillText('Draft cards, stack relics, and survive the siege.', heroX + 34, heroY + 198);

  ctx.font = 'bold 11px monospace';
  const chipDefs = [
    { label: 'ROGUELITE SURVIVAL', fill: 'rgba(46, 204, 113, 0.18)' },
    { label: 'CARD DRAFTING', fill: 'rgba(52, 152, 219, 0.18)' },
    { label: 'TOWER WEB', fill: 'rgba(241, 196, 15, 0.18)' },
  ];
  let chipX = heroX + 34;
  let chipY = heroY + 228;
  const chipRight = heroX + heroW - 34;
  for (const chip of chipDefs) {
    const chipW = ctx.measureText(chip.label).width + 22;
    if (chipX + chipW > chipRight) {
      chipX = heroX + 34;
      chipY += 30;
    }
    drawMenuChip(chipX, chipY, chip.label, chip.fill);
    chipX += chipW + 10;
  }

  ctx.fillStyle = 'rgba(4,10,20,0.66)';
  rrect(heroX + 34, heroY + heroH - 122, heroW - 68, 82, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  rrect(heroX + 34, heroY + heroH - 122, heroW - 68, 82, 16); ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`💎 ${meta.crystals} relic shards`, heroX + 52, heroY + heroH - 88);
  ctx.fillStyle = '#8fd3ff';
  ctx.font = '12px monospace';
  ctx.fillText('Spend relic shards on permanent upgrades between runs.', heroX + 52, heroY + heroH - 60);
  ctx.fillStyle = '#5f7287';
  ctx.font = '11px monospace';
  ctx.fillText('Build stronger starts, faster waves, and a tougher crystal core.', heroX + 52, heroY + heroH - 38);

  const actionPanelY = heroY + 26;
  const actionPanelH = heroH - 52;
  ctx.fillStyle = 'rgba(8,14,24,0.82)';
  rrect(actionX, actionPanelY, actionW, actionPanelH, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(125, 146, 175, 0.14)';
  ctx.lineWidth = 1.2;
  rrect(actionX, actionPanelY, actionW, actionPanelH, 22); ctx.stroke();
  ctx.fillStyle = '#7f92a8';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('ENTER THE SIEGE', actionX + 22, actionPanelY + 28);

  const menuDefs = [
    { label:'PLAY', subtitle:'Start a fresh defense run', color:'#27ae60' },
    { label:'RELICS', subtitle:'Spend shards on permanent upgrades', color:'#8e44ad' },
    { label:'CARD BOOK', subtitle:'Browse every card and weapon tier', color:'#2980b9' },
  ];
  const cardGap = 14;
  const actionCardTop = actionPanelY + 74;
  const actionCardBottomPad = 30;
  const actionCardH = Math.min(76, Math.max(62, (actionPanelH - (actionCardTop - actionPanelY) - actionCardBottomPad - cardGap * (menuDefs.length - 1)) / menuDefs.length));
  ui.menuBtns = menuDefs.map((def, index) => ({
    cx: actionX + actionW / 2,
    cy: actionCardTop + actionCardH / 2 + index * (actionCardH + cardGap),
    bw: actionW - 34,
    bh: actionCardH,
  }));
  menuDefs.forEach((def, index) => {
    const rect = ui.menuBtns[index];
    drawMenuActionCard(rect, def.label, def.subtitle, def.color, inBtn(mouseX, mouseY, rect));
  });

  ctx.fillStyle = '#4f637a';
  ctx.font = '11px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`v${GAME_VERSION}`, actionX + 22, actionPanelY + actionPanelH - 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#63758a';
  ctx.fillText('WASD move  ·  SPACE dash  ·  ENTER starts waves early', W - 32, H - 28);
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
  const panelW = Math.min(1440, W - 40);
  const panelX = Math.round(W / 2 - panelW / 2);
  const panelY = 24;
  const panelH = H - 48;
  const rowH = 24;
  const col3W = Math.floor((panelW - 72) / 3);
  const leftX = panelX + 24;
  const midX = leftX + col3W + 12;
  const rightX = midX + col3W + 12;
  const colW = col3W;
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
  ctx.fillText('Preset weapons, cards, relics, and the exact wave to test. Relic changes are saved permanently.', W / 2, panelY + 56);
  ctx.fillStyle = '#f1c40f'; ctx.font = '11px monospace';
  ctx.fillText(dev.menuStatus, W / 2, panelY + 70);
  ctx.fillStyle = 'rgba(8,14,24,0.9)';
  rrect(leftX, topBoxY, colW, topBoxH, 10); ctx.fill();
  rrect(midX, topBoxY, colW, topBoxH, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
  rrect(leftX, topBoxY, colW, topBoxH, 10); ctx.stroke();
  rrect(midX, topBoxY, colW, topBoxH, 10); ctx.stroke();
  ctx.fillStyle = '#95a5a6'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('STARTING GOLD', leftX + 12, topBoxY + 18);
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 28px monospace';
  ctx.fillText(`${Math.round(dev.config.gold)}`, leftX + 12, topBoxY + 52);
  drawDevMenuButton(leftX + colW - 178, topBoxY + 20, 42, 24, '-100', '#2c3e50', { action:'gold', delta:-100 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 130, topBoxY + 20, 34, 24, '-10', '#2c3e50', { action:'gold', delta:-10 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 90, topBoxY + 20, 34, 24, '+10', '#2c3e50', { action:'gold', delta:10 }, 'bold 10px monospace');
  drawDevMenuButton(leftX + colW - 50, topBoxY + 20, 42, 24, '+100', '#2c3e50', { action:'gold', delta:100 }, 'bold 10px monospace');
  ctx.fillStyle = '#95a5a6'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('TARGET WAVE', midX + 12, topBoxY + 18);
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 28px monospace';
  ctx.fillText(`${Math.round(dev.config.wave)}`, midX + 12, topBoxY + 52);
  drawDevMenuButton(midX + colW - 170, topBoxY + 20, 34, 24, '-5', '#2c3e50', { action:'wave', delta:-5 }, 'bold 10px monospace');
  drawDevMenuButton(midX + colW - 130, topBoxY + 20, 34, 24, '-1', '#2c3e50', { action:'wave', delta:-1 }, 'bold 10px monospace');
  drawDevMenuButton(midX + colW - 90, topBoxY + 20, 34, 24, '+1', '#2c3e50', { action:'wave', delta:1 }, 'bold 10px monospace');
  drawDevMenuButton(midX + colW - 50, topBoxY + 20, 34, 24, '+5', '#2c3e50', { action:'wave', delta:5 }, 'bold 10px monospace');
  ctx.fillStyle = '#e67e22'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('WEAPONS', leftX, baseY - 12);
  Object.keys(WEAPONS).forEach((id, index) => {
    const def = WEAPONS[id];
    renderDevStepperRow(leftX, baseY + index * rowH, colW, `${def.icon} ${def.name}`, '', def.color, { action:'weapon', id, delta:-1 }, { action:'weapon', id, delta:1 }, {
      tag: def.rarity.toUpperCase(),
      tagColor: def.color,
      slots: { total: 4, active: dev.config.weaponLevels[id] || 0 },
      slotText: dev.config.weaponLevels[id] > 0 ? `L${dev.config.weaponLevels[id]}` : 'OFF',
    });
  });
  ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('CARDS', midX, baseY - 12);
  STAT_UPGRADES.forEach((stat, index) => {
    renderDevStepperRow(midX, baseY + index * rowH, colW, `${stat.icon} ${stat.name}`, `x${dev.config.cardCounts[stat.id] || 0}`, devCardColor(stat), { action:'card', id:stat.id, delta:-1 }, { action:'card', id:stat.id, delta:1 }, stat.max && stat.max <= 6 ? {
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
  ctx.fillStyle = '#a855f7'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
  ctx.fillText('RELICS  💎 (saved permanently)', rightX, baseY - 12);
  const CAT_COLORS_DEV: Record<string, string> = { player:'#e74c3c', econ:'#f1c40f', tower:'#f39c12', outpost:'#3498db', unlock:'#8e44ad' };
  META_UPGRADES.forEach((upg, index) => {
    const lvl = R.meta.upgrades[upg.id] || 0;
    const color = CAT_COLORS_DEV[upg.cat] || '#8e44ad';
    renderDevStepperRow(rightX, baseY + index * rowH, colW, upg.label, `${lvl}/${upg.max}`, color, { action:'relic', id:upg.id, delta:-1 }, { action:'relic', id:upg.id, delta:1 }, {
      tag: upg.cat.toUpperCase(),
      tagColor: color,
      slots: { total: upg.max <= 6 ? upg.max : 0, active: Math.min(lvl, upg.max) },
      slotText: lvl === 0 ? 'OFF' : `${lvl}/${upg.max}`,
      extraLabel: upg.max > 6 ? `${lvl}/${upg.max}` : undefined,
    });
  });
  const footY = panelY + panelH - 48;
  drawDevMenuButton(panelX + 28, footY, 190, 30, '← MAIN MENU', '#34495e', { action:'menu' }, 'bold 12px monospace');
  drawDevMenuButton(panelX + panelW / 2 - 95, footY, 190, 30, '↺ RESET PRESET', '#7f8c8d', { action:'reset' }, 'bold 12px monospace');
  drawDevMenuButton(panelX + panelW / 2 + 5, footY, 140, 30, '⓪ ZERO RELICS', '#6b2fa0', { action:'relicZero' }, 'bold 11px monospace');
  drawDevMenuButton(panelX + panelW / 2 + 153, footY, 140, 30, '★ MAX RELICS', '#7c3aed', { action:'relicMax' }, 'bold 11px monospace');
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
    return;
  }
  if (hit.action === 'relic') {
    const upg = META_UPGRADES.find((entry: any) => entry.id === hit.id);
    if (!upg) return;
    R.meta.upgrades[hit.id] = clamp((R.meta.upgrades[hit.id] || 0) + hit.delta, 0, upg.max);
    saveMeta(R.meta);
    R.dev.menuStatus = `${upg.label} → ${R.meta.upgrades[hit.id]}/${upg.max}`;
    return;
  }
  if (hit.action === 'relicZero') {
    META_UPGRADES.forEach((upg: any) => { R.meta.upgrades[upg.id] = 0; });
    saveMeta(R.meta);
    R.dev.menuStatus = 'All relics zeroed.';
    return;
  }
  if (hit.action === 'relicMax') {
    META_UPGRADES.forEach((upg: any) => { R.meta.upgrades[upg.id] = upg.max; });
    saveMeta(R.meta);
    R.dev.menuStatus = 'All relics maxed.';
    return;
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
    btn(W / 2 + 115, H / 2 + 44, 'RELICS 💎', '#8e44ad'),
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
  const { leftPanelX, leftPanelW, rightPanelX, rightPanelW } = luPositions();
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ui.levelupBaseUpgradeBtns = [];
  renderBaseSidebar(leftPanelX, leftPanelW, { allowBuy: false });
  renderLoadoutSidebar(rightPanelX, rightPanelW, { title: 'RUN STATUS', allowSell: false });
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
  const CARD_W = 140, CARD_H = 200, CARD_GAP = 10;
  const SIDE = 200;
  const CONTENT_X = SIDE + 16;
  const CONTENT_W = W - CONTENT_X - 16;
  const HEADER_H = 52;
  const clipTop = HEADER_H + 2;
  const clipBot = H - 4;

  // Background
  ctx.fillStyle = '#060c18'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0b1525'; ctx.fillRect(0, 0, SIDE, H);
  ctx.fillStyle = '#1a2a3e'; ctx.fillRect(SIDE, 0, 1, H);

  // Header
  ctx.fillStyle = '#1a2a3e'; ctx.fillRect(0, 0, W, HEADER_H);
  ctx.fillStyle = '#2980b9'; ctx.fillRect(0, HEADER_H, W, 1);
  ctx.fillStyle = '#5dade2'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'left';
  ctx.fillText('📖  CARD BOOK', 16, 34);
  const luckPreview = 0;
  const t = buildDropChanceTable(luckPreview);
  const rarityItems = [
    { label:'Common',   color:'#3498db', pct: t.common },
    { label:'Uncommon', color:'#e67e22', pct: t.uncommon },
    { label:'Rare',     color:'#9b59b6', pct: t.rare },
  ];
  let rx = W - 16;
  ctx.textAlign = 'right';
  for (let i = rarityItems.length - 1; i >= 0; i--) {
    const it = rarityItems[i];
    ctx.fillStyle = it.color + '30'; rrect(rx - 118, 14, 118, 22, 4); ctx.fill();
    ctx.strokeStyle = it.color + '88'; ctx.lineWidth = 1; rrect(rx - 118, 14, 118, 22, 4); ctx.stroke();
    ctx.fillStyle = it.color; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
    ctx.fillText(it.label, rx - 112, 28);
    ctx.fillStyle = '#bbb'; ctx.font = '10px monospace';
    ctx.fillText(`${it.pct}% / card`, rx - 60, 28);
    rx -= 128;
  }

  // Sidebar nav
  const NAV_ITEMS = [
    { id:'weapons', icon:'⚔️',  label:'WEAPONS',  color:'#e74c3c', count: Object.keys(WEAPONS).length },
    ...CB_SECTIONS.map(s => ({ id:s.id, icon:s.icon, label:s.label, color:s.color,
      count: STAT_UPGRADES.filter(s.filter).length })),
  ];
  let navY = clipTop + 12;
  for (const nav of NAV_ITEMS) {
    ctx.fillStyle = nav.color + '22'; rrect(8, navY, SIDE - 16, 42, 6); ctx.fill();
    ctx.strokeStyle = nav.color + '66'; ctx.lineWidth = 1; rrect(8, navY, SIDE - 16, 42, 6); ctx.stroke();
    ctx.fillStyle = nav.color; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${nav.icon}  ${nav.label}`, 18, navY + 17);
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace';
    ctx.fillText(`${nav.count} cards`, 18, navY + 32);
    navY += 52;
  }

  function drawBookCard(card: any, bx: number, by: number) {
    const savedGame = R.game;
    R.game = makeCardBookPreviewGame(card);
    drawCard(card, bx, by, CARD_W, CARD_H, { dropChance: rarityDropChance(card.rarity, luckPreview) });
    R.game = savedGame;
  }

  function drawSectionHeader(y: number, icon: string, label: string, color: string, note: string, count: number) {
    ctx.fillStyle = color + '18'; rrect(CONTENT_X, y, CONTENT_W, 38, 6); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; rrect(CONTENT_X, y, CONTENT_W, 38, 6); ctx.stroke();
    ctx.fillStyle = color; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`${icon}  ${label}`, CONTENT_X + 12, y + 24);
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace';
    ctx.fillText(note, CONTENT_X + 12, y + 36);
    ctx.fillStyle = color + 'cc'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
    ctx.fillText(`${count} cards`, CONTENT_X + CONTENT_W - 12, y + 24);
  }

  function layout(draw: boolean) {
    let y = clipTop - ui.cardBookScroll;
    const cols = Math.max(1, Math.floor((CONTENT_W + CARD_GAP) / (CARD_W + CARD_GAP)));

    // ── WEAPONS ──────────────────────────────────────────────
    const weaponIds = Object.keys(WEAPONS);
    const wpnSecH = 48 + weaponIds.length * (CARD_H + CARD_GAP + 24);
    if (draw && y + wpnSecH >= clipTop && y < clipBot) {
      drawSectionHeader(y, '⚔️', 'WEAPONS', '#e74c3c', 'Each weapon has 4 upgrade levels. Level 1 = unlock, 2-4 = power upgrades.', weaponIds.length * 4);
    }
    y += 48;
    for (const id of weaponIds) {
      const def = WEAPONS[id] as any;
      const rowCards = [1,2,3,4].map(lv => ({ type:'weapon', weaponId:id, newLevel:lv, rarity:def.rarity }));
      const rowH = CARD_H + 24;
      if (draw && y + rowH >= clipTop && y < clipBot) {
        // weapon label
        ctx.fillStyle = def.color + '22';
        ctx.fillRect(CONTENT_X, y, CONTENT_W, 20);
        ctx.fillStyle = def.color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
        ctx.fillText(`${def.icon}  ${def.name}`, CONTENT_X + 8, y + 14);
        ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace';
        ctx.fillText(def.rarity.toUpperCase(), CONTENT_X + CONTENT_W - 60, y + 14);
        for (let i = 0; i < 4; i++) {
          const bx = CONTENT_X + i * (CARD_W + CARD_GAP);
          const by = y + 22;
          if (bx + CARD_W > CONTENT_X + CONTENT_W) continue;
          if (by + CARD_H < clipTop || by > clipBot) continue;
          drawBookCard(rowCards[i], bx, by);
        }
      }
      y += rowH + CARD_GAP;
    }
    y += 16;

    // ── STAT CARD SECTIONS ────────────────────────────────────
    for (const sec of CB_SECTIONS) {
      const cards = STAT_UPGRADES.filter(sec.filter).map(s => ({ type:'stat', statId:s.id, rarity:s.rarity || 'common' }));
      if (cards.length === 0) continue;
      const gridRows = Math.ceil(cards.length / cols);
      const secH = 48 + gridRows * (CARD_H + CARD_GAP);
      if (draw && y + secH >= clipTop && y < clipBot) {
        drawSectionHeader(y, sec.icon, sec.label, sec.color, sec.note, cards.length);
        const cardsY = y + 48;
        cards.forEach((card: any, idx: number) => {
          const col = idx % cols;
          const row = Math.floor(idx / cols);
          const bx = CONTENT_X + col * (CARD_W + CARD_GAP);
          const by = cardsY + row * (CARD_H + CARD_GAP);
          if (by + CARD_H < clipTop || by > clipBot) return;
          drawBookCard(card, bx, by);
        });
      }
      y += secH + 16;
    }

    return y + ui.cardBookScroll;
  }

  const totalH = layout(false);
  const maxScroll = Math.max(0, totalH - clipBot + 24);
  ui.cardBookScroll = clamp(ui.cardBookScroll, 0, maxScroll);

  ctx.save();
  ctx.beginPath(); ctx.rect(CONTENT_X, clipTop, W - CONTENT_X, clipBot - clipTop); ctx.clip();
  layout(true);
  ctx.restore();

  // Scrollbar
  if (maxScroll > 0) {
    const sbX = W - 8, sbTop = clipTop + 4, sbH = clipBot - clipTop - 8;
    const thumbH = Math.max(30, sbH * (clipBot - clipTop) / (totalH));
    const thumbY = sbTop + (ui.cardBookScroll / maxScroll) * (sbH - thumbH);
    ctx.fillStyle = '#1e2d44'; ctx.fillRect(sbX - 4, sbTop, 4, sbH);
    ctx.fillStyle = '#3a5a7a'; rrect(sbX - 4, thumbY, 4, thumbH, 2); ctx.fill();
  }

  ui.cardBookBackBtn = btn(SIDE / 2, H - 28, '← BACK', '#2c3e50', 160, 32);
}

function renderMetaScreen() {
  const { ctx, W, H, meta, ui } = R;
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
  ctx.fillText('RELICS', W / 2, 42);
  ctx.fillStyle = '#f1c40f'; ctx.font = '16px monospace';
  ctx.fillText(`💎 ${meta.crystals} crystals`, W / 2, 66);
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
