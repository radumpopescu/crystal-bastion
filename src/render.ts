import { ENTITY_H, ISO_SCALE, MAX_WEAPON_SLOTS, OUTPOST_HP_BASE, PLAYER_RADIUS, SHADOW_SCALE, STAT_UPGRADES, TH, TILE_SIZE, TW, TOWER_UPGRADES, WAVE_INTERVAL, WEAPONS, META_UPGRADES } from './constants';
import { R, devCardColor, devCardLimit, finishDevSession, newGame, resetDevConfig, w2s } from './state';
import { buildDropChanceTable, getAnchors, getBaseStats, getLoadoutStats, getMobileLevelupLayout, getOutpostCost, getRunCardEntries, luCardDims, luPositions, rarityDropChance, startDevWave, weaponCardNeedsSlot } from './systems';
import { clamp, dist, inBtn } from './utils';
import { saveMeta } from './meta';
import { GAME_VERSION } from './version';
import type { BtnRect } from './types';

const CB_W = 148, CB_H = 215, CB_GAP = 10;

// ── Offscreen sprite cache ─────────────────────────────────
const _spriteCache: Map<string, { canvas: HTMLCanvasElement; w: number; h: number }> = new Map();
function getSprite(key: string, w: number, h: number, drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) {
  let entry = _spriteCache.get(key);
  if (!entry) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const sctx = c.getContext('2d')!;
    drawFn(sctx, w, h);
    entry = { canvas: c, w, h };
    _spriteCache.set(key, entry);
  }
  return entry;
}
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


function resetMobileUiFrame() {
  R.ui.mobileDrawerToggleBtn = null;
  R.ui.mobileDrawerTabBtns = [];
  R.ui.mobileScrollArea = null;
  R.ui.mobileScrollMax = 0;
}

function isMobileUI() {
  return !!R.ui.isMobileLandscape;
}

function getMobileDrawerRect() {
  const pad = 10;
  const w = Math.min(236, Math.max(172, R.W * 0.34));
  const y = 58;
  const h = Math.max(150, R.H - y - 10);
  const x = R.W - w - pad;
  return { x, y, w, h, pad };
}

function setMobileScrollArea(x: number, y: number, w: number, h: number, maxScroll: number) {
  R.ui.mobileScrollArea = { x, y, w, h };
  R.ui.mobileScrollMax = Math.max(0, maxScroll);
  R.ui.mobileScrollY = clamp(R.ui.mobileScrollY, 0, R.ui.mobileScrollMax);
}

function drawCompactMetricRow(label: string, value: string, x: number, y: number, w: number, valueColor = '#8bd3ff') {
  const { ctx } = R;
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y);
  ctx.fillStyle = valueColor;
  ctx.textAlign = 'right';
  ctx.fillText(value, x + w, y);
}

function estimateMobileDrawerHeight(tab: string, includeUpgrades = false) {
  const game = R.game;
  if (tab === 'base') return 28 + getBaseStats().length * 16 + 18 + (includeUpgrades ? TOWER_UPGRADES.length * 48 + 12 : 0) + 70;
  const hintLines = game?._cardActionHint ? wrapTextLines(game._cardActionHint, 150).length : 0;
  const weaponRows = game?.maxWeaponSlots || MAX_WEAPON_SLOTS;
  const runCards = getRunCardEntries().length;
  return 40 + hintLines * 12 + weaponRows * 24 + getLoadoutStats().length * 16 + 60 + runCards * 18;
}

function drawMobileDrawerShell(title: string, activeTab: string, tabs: string[]) {
  const { ctx, ui } = R;
  const rect = getMobileDrawerRect();
  ctx.fillStyle = 'rgba(8,14,24,0.94)';
  rrect(rect.x, rect.y, rect.w, rect.h, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(125,146,175,0.24)';
  ctx.lineWidth = 1.2;
  rrect(rect.x, rect.y, rect.w, rect.h, 16); ctx.stroke();
  ctx.fillStyle = '#dfe6e9';
  ctx.font = 'bold 12px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(title, rect.x + 12, rect.y + 20);
  ui.mobileDrawerTabBtns = [];
  let tx = rect.x + 12;
  for (const tab of tabs) {
    const bw = 68, bh = 22, ty = rect.y + 28;
    ctx.fillStyle = activeTab === tab ? '#1f3551' : '#111a28';
    rrect(tx, ty, bw, bh, 8); ctx.fill();
    ctx.strokeStyle = activeTab === tab ? '#5dade2' : 'rgba(255,255,255,0.08)';
    rrect(tx, ty, bw, bh, 8); ctx.stroke();
    ctx.fillStyle = activeTab === tab ? '#ecf0f1' : '#7f8c9a';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(tab.toUpperCase(), tx + bw / 2, ty + 14);
    ui.mobileDrawerTabBtns.push({ x: tx, y: ty, w: bw, h: bh, tab });
    tx += bw + 8;
  }
  return { rect, contentX: rect.x + 10, contentY: rect.y + 62, contentW: rect.w - 20, contentH: rect.h - 72 };
}

function renderMobileBaseDrawerContent(shell: any, allowBuy = false) {
  const { ctx } = R;
  const game = R.game;
  const startY = shell.contentY;
  const visibleH = shell.contentH;
  const contentH = estimateMobileDrawerHeight('base', allowBuy);
  setMobileScrollArea(shell.contentX, startY, shell.contentW, visibleH, contentH - visibleH + 10);
  ctx.save();
  ctx.beginPath(); ctx.rect(shell.contentX, startY, shell.contentW, visibleH); ctx.clip();
  ctx.translate(0, -R.ui.mobileScrollY);
  let y = startY + 4;
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('BASE STATS', shell.contentX, y); y += 14;
  getBaseStats().forEach(stat => {
    drawCompactMetricRow(`${stat.icon} ${stat.name}`, stat.value, shell.contentX, y, shell.contentW, '#f5c26b');
    y += 16;
  });
  y += 6;
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('UPGRADES', shell.contentX, y); y += 14;
  if (allowBuy) {
    TOWER_UPGRADES.forEach(upg => {
      const lvl = game.tower.upgrades[upg.id] || 0;
      const maxed = lvl >= upg.max;
      const cost = maxed ? 0 : upg.cost[lvl];
      const canAfford = !maxed && game.gold >= cost;
      const rowY = y;
      ctx.fillStyle = maxed ? '#163020' : canAfford ? '#101a29' : '#0d1522';
      rrect(shell.contentX, rowY - 11, shell.contentW, 38, 6); ctx.fill();
      ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? '#f39c12' : '#2a3a4a';
      rrect(shell.contentX, rowY - 11, shell.contentW, 38, 6); ctx.stroke();
      ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(upg.label, shell.contentX + 8, rowY + 2);
      ctx.fillStyle = '#8c9aa8'; ctx.font = '10px monospace';
      ctx.fillText('●'.repeat(lvl) + '○'.repeat(Math.max(0, upg.max - lvl)), shell.contentX + 8, rowY + 16);
      ctx.fillStyle = maxed ? '#27ae60' : canAfford ? '#f1c40f' : '#e74c3c';
      ctx.textAlign = 'right';
      ctx.fillText(maxed ? 'MAX' : `${cost}⬡`, shell.contentX + shell.contentW - 8, rowY + 2);
      R.ui.levelupBaseUpgradeBtns.push({ x: shell.contentX, y: rowY - 11 - R.ui.mobileScrollY, w: shell.contentW, h: 38, upgradeId: upg.id });
      y += 46;
    });
  } else {
    ctx.fillStyle = '#7f8c9a'; ctx.font = '10px monospace';
    ctx.fillText('Open after waves to buy upgrades.', shell.contentX, y); y += 18;
  }
  const ks = game.killStats || { player: 0, base: 0, tower: 0 };
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 10px monospace';
  ctx.fillText('KILLS', shell.contentX, y); y += 14;
  drawCompactMetricRow('⚔️ Player', `${ks.player}`, shell.contentX, y, shell.contentW); y += 14;
  drawCompactMetricRow('🏰 Base', `${ks.base}`, shell.contentX, y, shell.contentW, '#f5c26b'); y += 14;
  drawCompactMetricRow('🔵 Towers', `${ks.tower}`, shell.contentX, y, shell.contentW); y += 14;
  ctx.restore();
}

function renderMobileLoadoutDrawerContent(shell: any, allowSell = false) {
  const { ctx } = R;
  const game = R.game;
  const startY = shell.contentY;
  const visibleH = shell.contentH;
  const contentH = estimateMobileDrawerHeight('loadout');
  setMobileScrollArea(shell.contentX, startY, shell.contentW, visibleH, contentH - visibleH + 10);
  ctx.save();
  ctx.beginPath(); ctx.rect(shell.contentX, startY, shell.contentW, visibleH); ctx.clip();
  ctx.translate(0, -R.ui.mobileScrollY);
  let y = startY + 4;
  if (game._cardActionHint) {
    const lines = wrapTextLines(game._cardActionHint, shell.contentW - 6);
    ctx.fillStyle = '#f39c12'; ctx.font = '10px monospace';
    lines.forEach((line, index) => ctx.fillText(line, shell.contentX, y + index * 12));
    y += lines.length * 12 + 8;
  }
  ctx.fillStyle = '#5dade2'; ctx.font = 'bold 10px monospace';
  ctx.fillText('WEAPON SLOTS', shell.contentX, y); y += 14;
  const maxSlots = game.maxWeaponSlots || MAX_WEAPON_SLOTS;
  for (let slot = 0; slot < maxSlots; slot++) {
    const weapon = game.player.weapons[slot];
    const rowY = y;
    ctx.fillStyle = weapon ? '#101a29' : '#0c1522';
    rrect(shell.contentX, rowY - 11, shell.contentW, 20, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; rrect(shell.contentX, rowY - 11, shell.contentW, 20, 6); ctx.stroke();
    if (weapon) {
      const def = WEAPONS[weapon.id];
      ctx.fillStyle = def.color; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${def.icon} ${def.name} L${weapon.level}`, shell.contentX + 6, rowY + 2);
      if (allowSell) {
        const sellW = 34;
        const sellX = shell.contentX + shell.contentW - sellW - 4;
        ctx.fillStyle = '#5b1f1f'; rrect(sellX, rowY - 9, sellW, 16, 4); ctx.fill();
        ctx.fillStyle = '#f8d7da'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
        ctx.fillText('SELL', sellX + sellW / 2, rowY + 2);
        R.ui.levelupWeaponBtns.push({ x: sellX, y: rowY - 9 - R.ui.mobileScrollY, w: sellW, h: 16, slotIndex: slot });
      }
    } else {
      ctx.fillStyle = '#6b7280'; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`SLOT ${slot + 1} EMPTY`, shell.contentX + 6, rowY + 2);
    }
    y += 24;
  }
  y += 4;
  ctx.fillStyle = '#5dade2'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left';
  ctx.fillText('CURRENT STATS', shell.contentX, y); y += 14;
  getLoadoutStats().forEach(stat => {
    drawCompactMetricRow(`${stat.icon} ${stat.name}`, stat.value, shell.contentX, y, shell.contentW);
    y += 16;
  });
  y += 6;
  const outposts = game.outposts || [];
  ctx.fillStyle = '#5dade2'; ctx.font = 'bold 10px monospace'; ctx.fillText('TOWERS', shell.contentX, y); y += 14;
  drawCompactMetricRow('Built', `${outposts.length}`, shell.contentX, y, shell.contentW); y += 14;
  drawCompactMetricRow('Global level', `Lv${game.outpostLevel || 1}`, shell.contentX, y, shell.contentW, '#f5c26b'); y += 14;
  y += 6;
  const runCards = getRunCardEntries();
  ctx.fillStyle = '#5dade2'; ctx.font = 'bold 10px monospace'; ctx.fillText('RUN CARDS', shell.contentX, y); y += 14;
  if (!runCards.length) {
    ctx.fillStyle = '#6b7280'; ctx.font = '10px monospace'; ctx.fillText('No cards yet this run.', shell.contentX, y); y += 14;
  } else {
    runCards.forEach(entry => {
      ctx.fillStyle = entry.color; ctx.font = '10px monospace'; ctx.textAlign = 'left';
      ctx.fillText(`${entry.icon} ${entry.name}${entry.count > 1 ? ` x${entry.count}` : ''}`, shell.contentX, y);
      y += 18;
    });
  }
  ctx.restore();
}

function renderMobileDrawer(mode: 'playing' | 'levelup' | 'paused') {
  const forceOpen = mode !== 'playing';
  if (!forceOpen && !R.ui.mobileDrawerOpen) return;
  const shell = drawMobileDrawerShell(mode === 'levelup' ? 'RUN PANEL' : mode === 'paused' ? 'PAUSE PANEL' : 'SIDE PANEL', R.ui.mobileDrawerTab || 'loadout', ['base', 'loadout']);
  if ((R.ui.mobileDrawerTab || 'loadout') === 'base') renderMobileBaseDrawerContent(shell, mode === 'levelup');
  else renderMobileLoadoutDrawerContent(shell, mode === 'levelup');
}

function renderMobileDrawerToggle() {
  const { ctx, ui, H } = R;
  const rect = getMobileDrawerRect();
  const cx = rect.x - 22;
  const cy = H / 2;
  ui.mobileDrawerToggleBtn = { cx, cy, bw: 28, bh: 96 };
  ctx.fillStyle = 'rgba(8,14,24,0.88)';
  rrect(cx - 14, cy - 48, 28, 96, 12); ctx.fill();
  ctx.strokeStyle = 'rgba(125,146,175,0.24)';
  rrect(cx - 14, cy - 48, 28, 96, 12); ctx.stroke();
  ctx.fillStyle = '#ecf0f1';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(ui.mobileDrawerOpen ? '›' : '‹', cx, cy + 6);
}

export function render() {
  const { ctx, W, H } = R;
  R.hoverRegions = [];
  resetMobileUiFrame();
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

function buildTowerSprite() {
  const bw = 32, bh = 56;
  const w = bw * 2 + 20, h = bh + 40 + 20;
  return getSprite('tower_base', w, h, (ctx) => {
    const cx = w / 2, baseY = h - 20;
    // Left face (darker)
    ctx.fillStyle = '#1a2540';
    ctx.beginPath();
    ctx.moveTo(cx - bw, baseY);
    ctx.lineTo(cx, baseY + TH * 0.8);
    ctx.lineTo(cx, baseY + TH * 0.8 - bh);
    ctx.lineTo(cx - bw, baseY - bh);
    ctx.closePath(); ctx.fill();
    // Brick lines on left face
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y1 = baseY - i * (bh / 6);
      const y2 = baseY + TH * 0.8 - i * (bh / 6);
      ctx.beginPath(); ctx.moveTo(cx - bw, y1); ctx.lineTo(cx, y2); ctx.stroke();
    }
    // Right face (lighter)
    ctx.fillStyle = '#253555';
    ctx.beginPath();
    ctx.moveTo(cx + bw, baseY);
    ctx.lineTo(cx, baseY + TH * 0.8);
    ctx.lineTo(cx, baseY + TH * 0.8 - bh);
    ctx.lineTo(cx + bw, baseY - bh);
    ctx.closePath(); ctx.fill();
    // Brick lines on right face
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 0.5;
    for (let i = 1; i <= 5; i++) {
      const y1 = baseY - i * (bh / 6);
      const y2 = baseY + TH * 0.8 - i * (bh / 6);
      ctx.beginPath(); ctx.moveTo(cx + bw, y1); ctx.lineTo(cx, y2); ctx.stroke();
    }
    // Top face
    ctx.fillStyle = '#2c4070';
    ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - bh - TH * 0.8);
    ctx.lineTo(cx + bw, baseY - bh);
    ctx.lineTo(cx, baseY - bh + TH * 0.8);
    ctx.lineTo(cx - bw, baseY - bh);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Crenellations — small raised blocks on top edges
    ctx.fillStyle = '#1e3358';
    const crenH = 5, crenW = 6;
    // Left edge crenellations
    for (let i = 0; i < 3; i++) {
      const t2 = (i + 0.5) / 3;
      const mx = cx + (cx - bw - cx) * (1 - t2);
      const my = baseY - bh + (baseY - bh - TH * 0.8 - (baseY - bh)) * t2;
      ctx.fillRect(mx - crenW / 2, my - crenH, crenW, crenH);
    }
    // Right edge crenellations
    for (let i = 0; i < 3; i++) {
      const t2 = (i + 0.5) / 3;
      const mx = cx + (cx + bw - cx) * (1 - t2);
      const my = baseY - bh + (baseY - bh - TH * 0.8 - (baseY - bh)) * t2;
      ctx.fillRect(mx - crenW / 2, my - crenH, crenW, crenH);
    }
    // Center turret base (cylinder)
    ctx.fillStyle = '#354a72';
    ctx.beginPath(); ctx.ellipse(cx, baseY - bh - 2, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a3d60';
    ctx.fillRect(cx - 10, baseY - bh - 14, 20, 12);
    ctx.fillStyle = '#354a72';
    ctx.beginPath(); ctx.ellipse(cx, baseY - bh - 14, 10, 5, 0, 0, Math.PI * 2); ctx.fill();
  });
}

function renderTower() {
  const { ctx } = R;
  const t = R.game.tower;
  const { sx, sy } = w2s(t.x, t.y, 0);
  const bw = 32, bh = 56;
  const tick = R.game.tick || 0;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(sx, sy, bw * 1.2, bw * 0.5, 0, 0, Math.PI * 2); ctx.fill();

  // Draw cached tower body
  const sprite = buildTowerSprite();
  ctx.drawImage(sprite.canvas, sx - sprite.w / 2, sy - sprite.h + 20);

  // Turret barrel — rotates toward nearest monster
  const barrelLen = 14;
  const turretX = sx, turretY = sy - bh - 14;
  let barrelAng = -Math.PI / 4; // default aim
  if (R.game.monsters.length > 0) {
    let nearest: any = null, nd = Infinity;
    for (const m of R.game.monsters) {
      const d = Math.hypot(m.x - t.x, m.y - t.y);
      if (d < nd) { nd = d; nearest = m; }
    }
    if (nearest) {
      const dx = nearest.x - t.x, dy = nearest.y - t.y;
      barrelAng = Math.atan2((dx + dy) * 0.5, (dx - dy)) ; // iso-projected angle
    }
  }
  ctx.strokeStyle = '#5a6f8f'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(turretX, turretY);
  ctx.lineTo(turretX + Math.cos(barrelAng) * barrelLen, turretY + Math.sin(barrelAng) * barrelLen);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // Aura glow pulse
  const auraPulse = 0.6 + Math.sin(tick * 1.4) * 0.15;
  ctx.fillStyle = `rgba(243,156,18,${auraPulse * 0.12})`;
  ctx.beginPath(); ctx.ellipse(sx, sy, t.auraR * ISO_SCALE * 2, t.auraR * ISO_SCALE, 0, 0, Math.PI * 2); ctx.fill();

  // HP bar
  drawHpBar(sx - 36, sy - bh - 34, 72, 7, t.hp, t.maxHp, '#c0392b', '#27ae60');
}

function buildOutpostSprite(level: number) {
  const bw = 14, bh = 28;
  const w = bw * 2 + 20, h = bh + 40;
  // Color tint by level: L1 blue → L3 cyan → L5 gold
  const lvColors = ['#3498db', '#2eadd4', '#1abc9c', '#e67e22', '#f1c40f'];
  const accent = lvColors[Math.min(level - 1, 4)];
  return getSprite(`outpost_lv${level}`, w, h, (ctx) => {
    const cx = w / 2, baseY = h - 12;
    // Base platform
    ctx.fillStyle = '#0c1a2e';
    ctx.beginPath();
    ctx.moveTo(cx, baseY + 4); ctx.lineTo(cx + bw + 4, baseY); ctx.lineTo(cx, baseY - 4); ctx.lineTo(cx - bw - 4, baseY);
    ctx.closePath(); ctx.fill();
    // Pillar — left face
    ctx.fillStyle = '#0e2040';
    ctx.beginPath();
    ctx.moveTo(cx - bw, baseY);
    ctx.lineTo(cx, baseY + TH * 0.5);
    ctx.lineTo(cx, baseY + TH * 0.5 - bh);
    ctx.lineTo(cx - bw, baseY - bh);
    ctx.closePath(); ctx.fill();
    // Right face
    ctx.fillStyle = '#163060';
    ctx.beginPath();
    ctx.moveTo(cx + bw, baseY);
    ctx.lineTo(cx, baseY + TH * 0.5);
    ctx.lineTo(cx, baseY + TH * 0.5 - bh);
    ctx.lineTo(cx + bw, baseY - bh);
    ctx.closePath(); ctx.fill();
    // Top face
    ctx.fillStyle = '#1e4080';
    ctx.strokeStyle = accent; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, baseY - bh - TH * 0.5);
    ctx.lineTo(cx + bw, baseY - bh);
    ctx.lineTo(cx, baseY - bh + TH * 0.5);
    ctx.lineTo(cx - bw, baseY - bh);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Vertical accent lines on faces
    ctx.strokeStyle = accent; ctx.globalAlpha = 0.2; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - bw / 2, baseY - bh + 2); ctx.lineTo(cx - bw / 2, baseY - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + bw / 2, baseY - bh + 2); ctx.lineTo(cx + bw / 2, baseY - 2); ctx.stroke();
    ctx.globalAlpha = 1;
    // Orb on top
    const orbY = baseY - bh - 8;
    const orbR = 5 + level * 0.5;
    ctx.fillStyle = accent;
    ctx.shadowColor = accent; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(cx, orbY, orbR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // Orb highlight
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(cx - orbR * 0.25, orbY - orbR * 0.25, orbR * 0.35, 0, Math.PI * 2); ctx.fill();
  });
}

function renderOutpost(op: any) {
  if (!op) return;
  const { ctx } = R;
  const { sx, sy } = w2s(op.x, op.y, 0);
  const tick = R.game.tick || 0;
  const lv = R.game.outpostLevel || 1;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(sx, sy, 14, 14 * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  // Draw cached sprite
  const sprite = buildOutpostSprite(lv);
  ctx.drawImage(sprite.canvas, sx - sprite.w / 2, sy - sprite.h + 12);

  // Orb pulse glow (per-frame animation)
  const lvColors = ['#3498db', '#2eadd4', '#1abc9c', '#e67e22', '#f1c40f'];
  const accent = lvColors[Math.min(lv - 1, 4)];
  const pulse = 0.08 + Math.sin(tick * 1.8 + op.x * 3 + op.y * 7) * 0.05;
  ctx.fillStyle = accent;
  ctx.globalAlpha = pulse;
  ctx.beginPath(); ctx.arc(sx, sy - 36 - 8, 10 + lv, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // Range ring
  const rsx = op.atkRange * ISO_SCALE * 2;
  const rsy = rsx * 0.5;
  ctx.strokeStyle = `rgba(52,152,219,0.18)`;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 6]);
  ctx.beginPath(); ctx.ellipse(sx, sy, rsx, rsy, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);

  // HP bar
  drawHpBar(sx - 20, sy - 44, 40, 5, op.hp, op.maxHp, '#e74c3c', '#3498db');

  // Level label
  ctx.fillStyle = lv >= 5 ? '#f1c40f' : '#8bd3ff';
  ctx.font = `bold ${lv >= 5 ? 11 : 10}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(`Lv${lv}`, sx, sy - 48);
}

function buildMonsterSprite(type: string, r: number, color: string) {
  const pad = 8;
  const w = (r + pad) * 2;
  const h = (r + pad) * 2 + r;
  return getSprite(`monster_${type}`, w, h, (ctx, w, h) => {
    const cx = w / 2, cy = r + pad;
    const darker = darkenColor(color, 0.3);
    const lighter = lightenColor(color, 0.2);
    switch (type) {
      case 'grunt': {
        // Blob body — teardrop shape
        ctx.fillStyle = color;
        ctx.strokeStyle = darker; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, Math.PI, 0); // top half circle
        ctx.quadraticCurveTo(cx + r * 0.6, cy + r * 1.2, cx, cy + r * 1.5);
        ctx.quadraticCurveTo(cx - r * 0.6, cy + r * 1.2, cx - r, cy);
        ctx.fill(); ctx.stroke();
        // Highlight
        ctx.fillStyle = lighter;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.arc(cx - r * 0.25, cy - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        // Angry eyebrow
        ctx.strokeStyle = darker; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + r * 0.05, cy - r * 0.55); ctx.lineTo(cx + r * 0.55, cy - r * 0.45); ctx.stroke();
        break;
      }
      case 'rusher': {
        // Spike — diamond/kite shape
        ctx.fillStyle = color;
        ctx.strokeStyle = darker; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy - r * 1.1);
        ctx.lineTo(cx + r * 0.7, cy);
        ctx.lineTo(cx + r * 0.3, cy + r * 1.0);
        ctx.lineTo(cx - r * 0.3, cy + r * 1.0);
        ctx.lineTo(cx - r * 0.7, cy);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Speed stripes
        ctx.strokeStyle = lighter; ctx.lineWidth = 1; ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.moveTo(cx - r * 0.3, cy - r * 0.4); ctx.lineTo(cx - r * 0.3, cy + r * 0.4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r * 0.3, cy - r * 0.4); ctx.lineTo(cx + r * 0.3, cy + r * 0.4); ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'brute': {
        // Chunk — wide rounded body with horns
        ctx.fillStyle = color;
        ctx.strokeStyle = darker; ctx.lineWidth = 2;
        // Wide body
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.15, r, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        // Horns
        ctx.fillStyle = darker;
        ctx.beginPath();
        ctx.moveTo(cx - r * 0.5, cy - r * 0.6);
        ctx.lineTo(cx - r * 0.8, cy - r * 1.2);
        ctx.lineTo(cx - r * 0.15, cy - r * 0.65);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.5, cy - r * 0.6);
        ctx.lineTo(cx + r * 0.8, cy - r * 1.2);
        ctx.lineTo(cx + r * 0.15, cy - r * 0.65);
        ctx.fill();
        // Arms (stumpy rectangles)
        ctx.fillStyle = color; ctx.strokeStyle = darker; ctx.lineWidth = 1.5;
        ctx.fillRect(cx - r * 1.15, cy - r * 0.1, r * 0.3, r * 0.6);
        ctx.strokeRect(cx - r * 1.15, cy - r * 0.1, r * 0.3, r * 0.6);
        ctx.fillRect(cx + r * 0.85, cy - r * 0.1, r * 0.3, r * 0.6);
        ctx.strokeRect(cx + r * 0.85, cy - r * 0.1, r * 0.3, r * 0.6);
        break;
      }
      case 'tank': {
        // Shell — hexagonal armored body
        ctx.fillStyle = color;
        ctx.strokeStyle = '#4a6070'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI * 2 / 6);
          const px = cx + Math.cos(a) * r;
          const py = cy + Math.sin(a) * r * 0.85;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Inner armor plate
        ctx.fillStyle = lightenColor(color, 0.12);
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i * Math.PI * 2 / 6);
          const px = cx + Math.cos(a) * r * 0.6;
          const py = cy + Math.sin(a) * r * 0.85 * 0.6;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        // Visor slits
        ctx.strokeStyle = '#1a2a3a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cx + r * 0.15, cy - r * 0.3); ctx.lineTo(cx + r * 0.15, cy + r * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + r * 0.35, cy - r * 0.25); ctx.lineTo(cx + r * 0.35, cy + r * 0.05); ctx.stroke();
        break;
      }
    }
  });
}

function darkenColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) * (1 - amt)) | 0;
  const g = Math.max(0, ((n >> 8) & 0xff) * (1 - amt)) | 0;
  const b = Math.max(0, (n & 0xff) * (1 - amt)) | 0;
  return `rgb(${r},${g},${b})`;
}
function lightenColor(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xff) + 255 * amt) | 0;
  const g = Math.min(255, ((n >> 8) & 0xff) + 255 * amt) | 0;
  const b = Math.min(255, (n & 0xff) + 255 * amt) | 0;
  return `rgb(${r},${g},${b})`;
}

function renderMonster(m: any) {
  if (!m) return;
  const { ctx } = R;
  const { sx, sy } = w2s(m.x, m.y, 0);
  const r = m.radius;
  const tick = R.game.tick || 0;
  const idOff = m.x * 7 + m.y * 13; // per-monster phase offset

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r * 0.9, r * SHADOW_SCALE, 0, 0, Math.PI * 2); ctx.fill();

  // Walk bob
  const bobSpeed = m.type === 'rusher' ? 6 : m.type === 'tank' ? 1.8 : 3.5;
  const bobAmt = m.type === 'tank' ? 1 : m.type === 'brute' ? 2.5 : 3;
  const bob = Math.sin(tick * bobSpeed + idOff) * bobAmt;

  // Draw cached sprite
  const sprite = buildMonsterSprite(m.type, r, m.color);
  const drawY = sy - ENTITY_H - r - 8 + bob;
  ctx.drawImage(sprite.canvas, sx - sprite.w / 2, drawY);

  // Grunt feet animation
  if (m.type === 'grunt') {
    const footOff = Math.sin(tick * 4.5 + idOff) * 3;
    ctx.fillStyle = darkenColor(m.color, 0.2);
    ctx.beginPath(); ctx.arc(sx - 4 - footOff, sy - 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(sx + 4 + footOff, sy - 2, 3, 0, Math.PI * 2); ctx.fill();
  }

  // Rusher motion lines
  if (m.type === 'rusher') {
    const spd = Math.hypot(m.speed, 0);
    if (spd > 0) {
      ctx.strokeStyle = m.color; ctx.lineWidth = 1; ctx.globalAlpha = 0.25;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - r * 0.5, sy - ENTITY_H + bob - i * 6);
        ctx.lineTo(sx - r * 1.4, sy - ENTITY_H + bob - i * 6 + 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  // Googly eye (per-frame: pupil tracks player)
  const eyeX = sx + r * 0.25;
  const eyeY = sy - ENTITY_H - r * 0.15 + bob;
  const eyeR = m.type === 'brute' ? r * 0.3 : r * 0.28;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.5;
  ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeR, 0, Math.PI * 2); ctx.stroke();
  // Pupil tracks player
  const pa = Math.atan2(R.game.player.y - m.y, R.game.player.x - m.x);
  const pupilOff = eyeR * 0.4;
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(eyeX + Math.cos(pa) * pupilOff, eyeY + Math.sin(pa) * pupilOff * 0.5, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();

  // HP bar
  if (m.hp < m.maxHp) drawHpBar(sx - r, sy - ENTITY_H - r - 10 + bob, r * 2, 4, m.hp, m.maxHp, '#e74c3c', '#e74c3c');
}

function renderPlayer() {
  const { ctx } = R;
  const p = R.game.player;
  const { sx, sy } = w2s(p.x, p.y, 0);
  const r = PLAYER_RADIUS;
  const flash = p.flashTimer > 0;
  const tick = R.game.tick || 0;
  const fa = Math.atan2(p.facing.y, p.facing.x);

  // Dash afterimages
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

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  ctx.beginPath(); ctx.ellipse(sx, sy, r * 1.1, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();

  // Leg/stem
  ctx.strokeStyle = 'rgba(52,152,219,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H + r); ctx.lineTo(sx, sy); ctx.stroke();

  // Animated feet
  const walkSpeed = Math.hypot(p.facing.x, p.facing.y) > 0.1 ? 1 : 0;
  const footSwing = Math.sin(tick * 5) * 3 * walkSpeed;
  ctx.fillStyle = '#636e72';
  ctx.beginPath(); ctx.arc(sx - 4 - footSwing, sy - 1, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(sx + 4 + footSwing, sy - 1, 2.5, 0, Math.PI * 2); ctx.fill();

  // Outer glow ring
  ctx.shadowColor = p.dashing ? '#3498db' : '#00ffcc';
  ctx.shadowBlur = 18;
  ctx.strokeStyle = p.dashing ? '#3498db' : '#00ffcc';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r + 3, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;

  // Body
  ctx.fillStyle = flash ? '#ff6b6b' : '#dfe6e9';
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(sx, sy - ENTITY_H, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Inner body detail — subtle cross pattern
  ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx - r * 0.5, sy - ENTITY_H); ctx.lineTo(sx + r * 0.5, sy - ENTITY_H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx, sy - ENTITY_H - r * 0.5); ctx.lineTo(sx, sy - ENTITY_H + r * 0.5); ctx.stroke();

  // Facing chevron indicator
  const chevDist = r - 2;
  const chevX = sx + Math.cos(fa) * chevDist;
  const chevY = sy - ENTITY_H + Math.sin(fa) * chevDist;
  const chevSize = 4;
  ctx.fillStyle = '#00ffcc';
  ctx.beginPath();
  ctx.moveTo(chevX + Math.cos(fa) * chevSize, chevY + Math.sin(fa) * chevSize);
  ctx.lineTo(chevX + Math.cos(fa + 2.3) * chevSize, chevY + Math.sin(fa + 2.3) * chevSize);
  ctx.lineTo(chevX + Math.cos(fa - 2.3) * chevSize, chevY + Math.sin(fa - 2.3) * chevSize);
  ctx.closePath(); ctx.fill();

  // Weapon icons
  for (let i = 0; i < p.weapons.length; i++) {
    const w = p.weapons[i];
    const def = WEAPONS[w.id];
    ctx.font = '13px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.icon, sx + (i - (p.weapons.length - 1) / 2) * 16, sy - ENTITY_H - r - 14);
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
    const { sx, sy: sy0 } = w2s(p.x, p.y, 8);
    // Arc from turret height down to ground as projectile travels
    let sy = sy0;
    if (p.startZ) {
      const t = Math.min(1, (p.age || 0) / Math.max(0.1, (p.life || 1) + (p.age || 0)) * 2);
      sy = sy0 - p.startZ * (1 - t);
    }
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
  if (isMobileUI()) {
    const topH = 38;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(8, 8, 126, topH, 8); ctx.fill();
    ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`W${game.wave}`, 16, 24);
    ctx.fillStyle = '#cbd5e1'; ctx.font = '10px monospace';
    ctx.fillText(game.waveActive ? `${game.monsters.length} foes` : `${Math.ceil(game.waveTimer)}s`, 16, 38);

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(W / 2 - 74, 8, 148, topH, 8); ctx.fill();
    ctx.fillStyle = '#f39c12'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('BASE', W / 2, 20);
    drawHpBar(W / 2 - 62, 24, 124, 10, t.hp, t.maxHp, '#c0392b', '#e74c3c');
    ctx.fillStyle = '#ddd'; ctx.font = '10px monospace';
    ctx.fillText(`${Math.ceil(t.hp)}/${t.maxHp}`, W / 2, 44);

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(W - 126, 8, 70, topH, 8); ctx.fill();
    ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillText(`⬡${game.gold}`, W - 91, 31);

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(W - 48, 8, 40, 40, 8); ctx.fill();
    ctx.fillStyle = '#bdc3c7'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
    ctx.fillText('⏸', W - 28, 34);

    const pBoxW = 168;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    rrect(8, H - 58, pBoxW, 50, 8); ctx.fill();
    ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
    ctx.fillText('PLAYER', 16, H - 40);
    drawHpBar(16, H - 34, pBoxW - 16, 10, p.hp, p.maxHp, '#c0392b', '#27ae60');
    ctx.fillStyle = '#aaa'; ctx.font = '10px monospace';
    ctx.fillText(`${Math.ceil(Math.max(0, p.hp))}/${p.maxHp}`, 16, H - 16);
    const dashStartX = 90;
    for (let i = 0; i < p.maxDashes; i++) {
      ctx.fillStyle = i < p.dashes ? '#3498db' : '#1a2a3a';
      ctx.beginPath(); ctx.arc(dashStartX + i * 16, H - 17, 5, 0, Math.PI * 2); ctx.fill();
    }

    if (game.waveActive) ui.waveStartBtn = null;
    else {
      const earlyGold = Math.max(2, Math.round(7 * (game.waveTimer / (WAVE_INTERVAL + (game.waveDelayBonus || 0))) * (game.earlyBonusMult || 1) * (1 + game.wave * 0.12)));
      ctx.fillStyle = '#f5c26b';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`Start early for +${earlyGold} gold`, W / 2, H - 42);
      ui.waveStartBtn = btn(W / 2, H - 20, `START WAVE NOW`, '#e67e22', 164, 28);
    }
    renderMinimap();
    return;
  }
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
    ctx.fillStyle = '#f5c26b'; ctx.font = '11px monospace';
    ctx.fillText(`Start early for +${earlyGold} gold`, 20, 78);
    ui.waveStartBtn = btn(125, 112, `START WAVE NOW`, '#e67e22', 220, 36);
  }
  ctx.fillStyle = '#556'; ctx.font = '11px monospace'; ctx.textAlign = 'left';
  ctx.fillText(game.player.weapons.map((w: any) => `${WEAPONS[w.id].icon}${w.level}`).join('  '), 20, game.waveActive ? 78 : 98);

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
  ctx.fillStyle = autoConstructUnlocked ? (shiftHeld ? '#27ae60' : '#95a5a6') : '#6b7280';
  ctx.font = 'bold 12px monospace';
  ctx.fillText(autoConstructUnlocked ? `Auto: ${shiftHeld ? 'HOLD SHIFT' : 'READY'}` : 'Auto: LOCKED', W - 14, controlsBoxY + 90);
  if (!autoConstructUnlocked) {
    ctx.fillStyle = '#6b7280'; ctx.font = '10px monospace'; ctx.fillText('Unlock it in Meta Upgrades', W - 14, controlsBoxY + 104);
  } else {
    ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace'; ctx.fillText('Builds every 1m while you walk', W - 14, controlsBoxY + 104);
  }
  renderMinimap();
}

function renderMinimap() {
  const { ctx, W, H } = R;
  const game = R.game;
  const MM_SIZE = isMobileUI() ? 112 : 180;
  const MM_PAD = isMobileUI() ? 8 : 12;
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
  const compact = cW <= 110 || cH <= 150;
  const iconSize = compact ? 24 : 38;
  const titleSize = compact ? 10 : 13;
  const descSize = compact ? 8 : 10;
  const badgeFont = compact ? 8 : 10;
  const actionFont = compact ? 9 : 11;
  const lineH = compact ? 10 : 14;

  ctx.fillStyle = bgColor;
  rrect(bx, by, cW, cH, 10); ctx.fill();
  ctx.strokeStyle = borderColor; ctx.lineWidth = opts.picked ? 2.5 : 2;
  rrect(bx, by, cW, cH, 10); ctx.stroke();
  ctx.fillStyle = opts.picked ? '#27ae60' : rarityColor;
  rrect(bx, by, cW, 5, 4); ctx.fill();

  ctx.font = `${iconSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isWeapon ? def.icon : stat.icon, bx + cW / 2, by + (compact ? 30 : 50));

  ctx.fillStyle = opts.dimmed ? '#666' : '#ecf0f1';
  ctx.font = `bold ${titleSize}px monospace`;
  ctx.textBaseline = 'alphabetic';
  const titleLines = wrapTextLines(isWeapon ? def.name : stat.name, cW - 12).slice(0, compact ? 2 : 2);
  let titleY = by + (compact ? 52 : 82);
  titleLines.forEach((line, index) => ctx.fillText(line, bx + cW / 2, titleY + index * (compact ? 11 : 13)));
  let contentY = titleY + titleLines.length * (compact ? 11 : 13) + 4;

  if (isWeapon) {
    const badgeW = compact ? 60 : 72;
    const badgeH = compact ? 15 : 18;
    ctx.fillStyle = rarityColor;
    rrect(bx + cW / 2 - badgeW / 2, contentY, badgeW, badgeH, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = `bold ${badgeFont}px monospace`;
    const existing = game.player.weapons.find((w: any) => w.id === card.weaponId);
    ctx.fillText(existing ? `LVL ${card.newLevel - 1}→${card.newLevel}` : 'NEW', bx + cW / 2, contentY + badgeH - 4);
    contentY += badgeH + 8;
  } else {
    contentY += 2;
  }

  ctx.fillStyle = opts.dimmed ? '#444' : '#aaa';
  ctx.font = `${descSize}px monospace`;
  const descLines = wrapTextLines(isWeapon ? def.desc : stat.desc, cW - 14).slice(0, compact ? 4 : 5);
  descLines.forEach((line, index) => ctx.fillText(line, bx + cW / 2, contentY + index * lineH));

  if (isWeapon && def.levelBonus[card.newLevel - 1]) {
    ctx.fillStyle = opts.dimmed ? '#555' : '#f1c40f';
    ctx.font = `bold ${compact ? 8 : 10}px monospace`;
    ctx.fillText(def.levelBonus[card.newLevel - 1], bx + cW / 2, by + cH - (compact ? 36 : 30));
  }
  if (opts.needsSlot) {
    ctx.fillStyle = '#e67e22';
    ctx.font = `bold ${compact ? 8 : 10}px monospace`;
    ctx.fillText('SELL A SLOT FIRST', bx + cW / 2, by + cH - (compact ? 48 : 44));
  }
  if (opts.locked) {
    ctx.fillStyle = '#f1c40f';
    ctx.font = `bold ${compact ? 8 : 10}px monospace`;
    ctx.fillText('HELD FOR NEXT SHOP', bx + cW / 2, by + cH - (compact ? 60 : 58));
  }
  if (opts.costLabel) {
    const canAfford = game.gold >= card.cost;
    ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c';
    ctx.font = `bold ${compact ? 10 : 12}px monospace`;
    ctx.fillText(opts.costLabel, bx + cW / 2, by + cH - 12);
  } else if (opts.dropChance != null) {
    ctx.fillStyle = '#555'; ctx.font = `${compact ? 8 : 10}px monospace`;
    ctx.fillText(`~${opts.dropChance}% chance`, bx + cW / 2, by + cH - 12);
  } else if (!opts.dimmed) {
    ctx.fillStyle = accentColor; ctx.font = `bold ${actionFont}px monospace`;
    ctx.fillText(compact ? 'CHOOSE' : 'CLICK TO CHOOSE', bx + cW / 2, by + cH - 12);
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
  if (isMobileUI()) {
    const layout = getMobileLevelupLayout(game);
    const botY = H - layout.botBarH;

    ctx.fillStyle = '#f1c40f';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`WAVE ${game.wave} COMPLETE`, layout.contentLeft + layout.contentW / 2, 22);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px monospace';
    ctx.fillText(`Gold ${game.gold}⬡`, layout.contentLeft + layout.contentW / 2, 40);

    ctx.fillStyle = !layout.freePicked ? '#0e1e2e' : '#120e04';
    rrect(layout.contentLeft, layout.panelY, layout.contentW, layout.panelH, 10); ctx.fill();
    ctx.strokeStyle = !layout.freePicked ? '#2a4a6a' : '#4a3410';
    ctx.lineWidth = 1.2;
    rrect(layout.contentLeft, layout.panelY, layout.contentW, layout.panelH, 10); ctx.stroke();

    if (!layout.freePicked && layout.freeGridY != null) {
      ctx.fillStyle = '#5dade2';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('FREE PICK', layout.contentLeft + 10, layout.panelY + 18);
      ctx.fillStyle = '#e74c3c';
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.fillText('pick one card to continue', layout.contentRight - 10, layout.panelY + 18);
      layout.freeCards.forEach((card: any, i: number) => {
        const rect = layout.getCardRect(layout.freeCards.length, i, layout.freeGridY!);
        drawCard(card, rect.x, rect.y, rect.w, rect.h, { needsSlot: weaponCardNeedsSlot(card, game) });
      });
    } else {
      ctx.fillStyle = '#f39c12';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SHOP', layout.contentLeft + 10, layout.panelY + 18);
      if (game._pickedFreeCard) {
        ctx.fillStyle = '#27ae60';
        ctx.font = 'bold 9px monospace';
        ctx.fillText('FREE PICKED', layout.pickedSummaryX, layout.pickedSummaryY - 2);
        drawCard(game._pickedFreeCard, layout.pickedSummaryX, layout.pickedSummaryY + 4, layout.summaryW, layout.summaryH, { picked: true, needsSlot: weaponCardNeedsSlot(game._pickedFreeCard, game) });
      }
      layout.shopCards.forEach((card: any, i: number) => {
        const rect = layout.getCardRect(layout.shopCards.length, i, layout.shopGridY!);
        const needsSlot = weaponCardNeedsSlot(card, game);
        if (card._bought) drawCard(card, rect.x, rect.y, rect.w, rect.h, { picked: true, costLabel: 'BOUGHT', needsSlot, locked: card._locked });
        else drawCard(card, rect.x, rect.y, rect.w, rect.h, { shopCard: true, dimmed: game.gold < card.cost, costLabel: `${card.cost}⬡`, needsSlot, locked: card._locked });
        if (!card._bought) {
          const lockW = 44, lockH = 16, lockX = rect.x + rect.w - lockW - 6, lockY = rect.y + 6;
          ctx.fillStyle = card._locked ? '#6b5200' : '#223047'; rrect(lockX, lockY, lockW, lockH, 4); ctx.fill();
          ctx.strokeStyle = card._locked ? '#f1c40f' : '#7f8c8d'; rrect(lockX, lockY, lockW, lockH, 4); ctx.stroke();
          ctx.fillStyle = card._locked ? '#f8e27a' : '#cbd5e1'; ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.fillText(card._locked ? 'HELD' : 'LOCK', lockX + lockW / 2, lockY + 11);
          ui.levelupShopLockBtns.push({ x: lockX, y: lockY, w: lockW, h: lockH, cardIndex: i });
        }
      });
    }

    renderMobileDrawer('levelup');

    const rerollCost = game._rerollCost ?? 2;
    const canReroll = game.gold >= rerollCost;
    ctx.fillStyle = '#0b1220'; ctx.fillRect(0, botY, layout.contentRight, layout.botBarH);
    ui.refreshAllBtn = btn(layout.contentLeft + 66, botY + layout.botBarH / 2, `REROLL ${rerollCost}⬡`, canReroll ? '#5b2d8e' : '#252535', 132, 28);
    ui.continueBtn = btn(layout.contentRight - 58, botY + layout.botBarH / 2, 'DONE', '#27ae60', 112, 28);
    return;
  }
  const { w: cW, h: cH, gap } = luCardDims();
  const { freeTop, shopTop, leftPanelX, leftPanelW, rightPanelX, rightPanelW, centerX } = luPositions();
  const panelW = rightPanelW, panelX = rightPanelX;
  renderBaseSidebar(leftPanelX, leftPanelW);
  renderLoadoutSidebar(panelX, panelW, { hint: game._cardActionHint });
  const centerStartX = leftPanelX + leftPanelW + 12;
  ctx.fillStyle = '#1a2540'; ctx.fillRect(centerStartX, 0, panelX - centerStartX, 66);
  ctx.strokeStyle = '#2a3a5a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(centerStartX, 66); ctx.lineTo(panelX, 66); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.fillText(`⚡ WAVE ${game.wave} COMPLETE`, centerX, 32);
  ctx.fillStyle = '#aaa'; ctx.font = '13px monospace'; ctx.fillText(`Gold: ${game.gold} 🪙`, centerX - 80, 54);
  const freePicked = !cards || cards.length === 0;
  ctx.fillStyle = freePicked ? '#2ecc71' : '#e74c3c'; ctx.font = '12px monospace'; ctx.fillText(freePicked ? '✓ Free pick chosen' : '⬤ Choose a free card below', centerX + 60, 54);
  ctx.fillStyle = freePicked ? '#1e3a1e' : '#0e1e2e';
  const freeCards = cards || []; const fTotalW = Math.max(1, freeCards.length) * cW + (Math.max(1, freeCards.length) - 1) * gap; const fStartX = centerX - fTotalW / 2;
  rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.fill(); ctx.strokeStyle = freePicked ? '#27ae60' : '#2a4a6a'; ctx.lineWidth = 1.5; rrect(fStartX - 14, freeTop - 28, fTotalW + 28, cH + 36, 8); ctx.stroke();
  ctx.fillStyle = freePicked ? '#27ae60' : '#5dade2'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText('✨  FREE PICK', fStartX - 10, freeTop - 12);
  if (freePicked) { ctx.fillStyle = '#27ae60'; ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.fillText('✓ PICKED', fStartX + fTotalW + 10, freeTop - 12); }
  if (freePicked && game._pickedFreeCard) drawCard(game._pickedFreeCard, centerX - cW / 2, freeTop, cW, cH, { picked: true, needsSlot: weaponCardNeedsSlot(game._pickedFreeCard, game) });
  else if (!freePicked) freeCards.forEach((card: any, i: number) => drawCard(card, fStartX + i * (cW + gap), freeTop, cW, cH, { needsSlot: weaponCardNeedsSlot(card, game) }));
  const sCards = game.shopCards || []; const sTotalW = Math.max(1, sCards.length) * cW + (Math.max(1, sCards.length) - 1) * gap; const sStartX = centerX - sTotalW / 2;
  ctx.fillStyle = '#120e04'; rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.fill(); ctx.strokeStyle = '#4a3410'; ctx.lineWidth = 1.5; rrect(sStartX - 14, shopTop - 28, sTotalW + 28, cH + 36, 8); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText('🛒  SHOP', sStartX - 10, shopTop - 12);
  ctx.fillStyle = '#95a5a6'; ctx.font = '10px monospace'; ctx.fillText('Use LOCK NEXT to keep a card for the next shop.', sStartX - 10, shopTop + cH + 18);
  ctx.fillStyle = '#888'; ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.fillText(`Gold: ${game.gold} 🪙`, sStartX + sTotalW + 10, shopTop - 12);
  sCards.forEach((card: any, i: number) => {
    const bx = sStartX + i * (cW + gap); const needsSlot = weaponCardNeedsSlot(card, game);
    if (card._bought) drawCard(card, bx, shopTop, cW, cH, { picked: true, costLabel: '✓ BOUGHT', needsSlot, locked: card._locked });
    else drawCard(card, bx, shopTop, cW, cH, { shopCard: true, dimmed: game.gold < card.cost, costLabel: `${card.cost}🪙`, needsSlot, locked: card._locked });
    if (!card._bought) {
      const lockW = 62, lockH = 18, lockX = bx + cW - lockW - 8, lockY = shopTop + 10;
      ctx.fillStyle = card._locked ? '#6b5200' : '#223047'; rrect(lockX, lockY, lockW, lockH, 4); ctx.fill();
      ctx.strokeStyle = card._locked ? '#f1c40f' : '#7f8c8d'; ctx.lineWidth = 1; rrect(lockX, lockY, lockW, lockH, 4); ctx.stroke();
      ctx.fillStyle = card._locked ? '#f8e27a' : '#cbd5e1'; ctx.font = 'bold 9px monospace'; ctx.textAlign = 'center'; ctx.fillText(card._locked ? 'HELD' : 'LOCK', lockX + lockW / 2, lockY + 12);
      ui.levelupShopLockBtns.push({ x: lockX, y: lockY, w: lockW, h: lockH, cardIndex: i });
    }
  });
  const botY = H - 52;
  ctx.fillStyle = '#0b1220'; ctx.fillRect(0, botY, panelX, 52);
  ctx.strokeStyle = '#1e2d44'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, botY); ctx.lineTo(panelX, botY); ctx.stroke();
  const rerollCost = game._rerollCost ?? 2; const canReroll = game.gold >= rerollCost;
  ui.refreshAllBtn = btn(120, botY + 26, `🔀 Refresh All  ${rerollCost}🪙`, canReroll ? '#5b2d8e' : '#252535', 220, 36);
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
  const mobile = isMobileUI();
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#08111f'); bg.addColorStop(0.45, '#0a1630'); bg.addColorStop(1, '#050914');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  const glowLeft = ctx.createRadialGradient(W * 0.24, H * 0.32, 0, W * 0.24, H * 0.32, W * 0.42);
  glowLeft.addColorStop(0, 'rgba(38, 208, 206, 0.20)'); glowLeft.addColorStop(1, 'rgba(38, 208, 206, 0)');
  ctx.fillStyle = glowLeft; ctx.fillRect(0, 0, W, H);
  const glowRight = ctx.createRadialGradient(W * 0.82, H * 0.26, 0, W * 0.82, H * 0.26, W * 0.28);
  glowRight.addColorStop(0, 'rgba(241, 196, 15, 0.18)'); glowRight.addColorStop(1, 'rgba(241, 196, 15, 0)');
  ctx.fillStyle = glowRight; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(105, 146, 186, 0.08)'; ctx.lineWidth = 1;
  const gridStep = mobile ? 58 : 72;
  for (let x = -gridStep; x < W + gridStep; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H * 0.9, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + H * 0.9, 0); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 130; i++) { const sx = (i * 137.5 + Math.sin(t + i) * 18) % W; const sy = (i * 73.3 + Math.cos(t * 0.7 + i) * 12) % H; ctx.fillRect(sx, sy, 1.5, 1.5); }
  const heroX = mobile ? 16 : 44;
  const actionW = mobile ? Math.min(228, Math.max(194, W * 0.34)) : Math.min(310, Math.max(250, W * 0.25));
  const actionX = W - actionW - (mobile ? 16 : 42);
  const heroW = Math.max(mobile ? 250 : 320, actionX - heroX - (mobile ? 10 : 26));
  const heroH = mobile ? Math.max(230, H - 32) : Math.min(430, Math.max(340, H - 140));
  const heroY = mobile ? 16 : Math.max(42, H / 2 - heroH / 2);
  ctx.fillStyle = 'rgba(8,16,30,0.74)'; rrect(heroX, heroY, heroW, heroH, 24); ctx.fill();
  ctx.strokeStyle = 'rgba(90, 172, 214, 0.16)'; ctx.lineWidth = 1.5; rrect(heroX, heroY, heroW, heroH, 24); ctx.stroke();
  const artCx = heroX + heroW * (mobile ? 0.76 : 0.73), artCy = heroY + heroH * 0.43, pulse = 1 + Math.sin(t * 2.2) * 0.05;
  ctx.save(); ctx.translate(artCx, artCy); ctx.strokeStyle = 'rgba(69, 211, 198, 0.18)'; ctx.lineWidth = mobile ? 1.5 : 2;
  for (let i = 0; i < 3; i++) { const ex = (mobile ? 86 : 120 + i * 50) * pulse; const ey = (mobile ? 44 : 60 + i * 24) * pulse; ctx.beginPath(); ctx.ellipse(0, 0, ex, ey, 0, 0, Math.PI * 2); ctx.stroke(); }
  const nodes = [{ x: 0, y: 0, color:'#f39c12', size: mobile ? 14 : 18 }, { x: -90, y: 44, color:'#2ecc71', size: mobile ? 10 : 12 }, { x: 84, y: 40, color:'#3498db', size: mobile ? 10 : 12 }, { x: 20, y: -72, color:'#9b59b6', size: mobile ? 10 : 12 }];
  ctx.strokeStyle = 'rgba(121, 220, 214, 0.26)'; ctx.lineWidth = 2; for (let i = 1; i < nodes.length; i++) { ctx.beginPath(); ctx.moveTo(nodes[0].x, nodes[0].y); ctx.lineTo(nodes[i].x, nodes[i].y); ctx.stroke(); }
  for (const node of nodes) { ctx.save(); ctx.translate(node.x, node.y); ctx.rotate(Math.PI / 4); ctx.fillStyle = node.color + '33'; ctx.fillRect(-node.size * 1.8, -node.size * 1.8, node.size * 3.6, node.size * 3.6); ctx.fillStyle = node.color; ctx.fillRect(-node.size, -node.size, node.size * 2, node.size * 2); ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.strokeRect(-node.size, -node.size, node.size * 2, node.size * 2); ctx.restore(); }
  ctx.restore();
  ctx.fillStyle = '#f39c12'; ctx.font = mobile ? 'bold 16px monospace' : 'bold 20px monospace'; ctx.textAlign = 'left'; ctx.fillText('CRYSTAL', heroX + 24, heroY + (mobile ? 46 : 78));
  ctx.font = mobile ? 'bold 34px monospace' : 'bold 56px monospace'; ctx.fillText('BASTION', heroX + 20, heroY + (mobile ? 92 : 138));
  ctx.fillStyle = '#9fb3c8'; ctx.font = mobile ? '12px monospace' : '15px monospace'; ctx.fillText('Defend the crystal core. Expand a living tower network.', heroX + 24, heroY + (mobile ? 122 : 176)); ctx.fillText('Draft cards, stack relics, and survive the siege.', heroX + 24, heroY + (mobile ? 142 : 198));
  ctx.font = 'bold 10px monospace';
  const chipDefs = [{ label: 'ROGUELITE SURVIVAL', fill: 'rgba(46, 204, 113, 0.18)' }, { label: 'CARD DRAFTING', fill: 'rgba(52, 152, 219, 0.18)' }, { label: 'TOWER WEB', fill: 'rgba(241, 196, 15, 0.18)' }];
  let chipX = heroX + 24, chipY = heroY + (mobile ? 158 : 228), chipRight = heroX + heroW - 24;
  for (const chip of chipDefs) { const chipW = ctx.measureText(chip.label).width + 22; if (chipX + chipW > chipRight) { chipX = heroX + 24; chipY += 28; } drawMenuChip(chipX, chipY, chip.label, chip.fill); chipX += chipW + 8; }
  const infoY = heroY + heroH - (mobile ? 88 : 122);
  ctx.fillStyle = 'rgba(4,10,20,0.66)'; rrect(heroX + 20, infoY, heroW - 40, mobile ? 60 : 82, 16); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; rrect(heroX + 20, infoY, heroW - 40, mobile ? 60 : 82, 16); ctx.stroke();
  ctx.fillStyle = '#f1c40f'; ctx.font = mobile ? 'bold 13px monospace' : 'bold 16px monospace'; ctx.textAlign = 'left'; ctx.fillText(`💎 ${meta.crystals} relic shards`, heroX + 34, infoY + 22);
  ctx.fillStyle = '#8fd3ff'; ctx.font = mobile ? '10px monospace' : '12px monospace'; ctx.fillText('Spend shards on permanent upgrades between runs.', heroX + 34, infoY + 40);
  if (!mobile) { ctx.fillStyle = '#5f7287'; ctx.font = '11px monospace'; ctx.fillText('Build stronger starts, faster waves, and a tougher crystal core.', heroX + 52, infoY + 62); }
  const actionPanelY = heroY + (mobile ? 14 : 26), actionPanelH = heroH - (mobile ? 28 : 52);
  ctx.fillStyle = 'rgba(8,14,24,0.82)'; rrect(actionX, actionPanelY, actionW, actionPanelH, 22); ctx.fill();
  ctx.strokeStyle = 'rgba(125, 146, 175, 0.14)'; ctx.lineWidth = 1.2; rrect(actionX, actionPanelY, actionW, actionPanelH, 22); ctx.stroke();
  ctx.fillStyle = '#7f92a8'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.fillText('ENTER THE SIEGE', actionX + 18, actionPanelY + 22);
  const menuDefs = [{ label:'PLAY', subtitle:'Fresh defense run', color:'#27ae60' }, { label:'RELICS', subtitle:'Permanent upgrades', color:'#8e44ad' }, { label:'CARD BOOK', subtitle:'Browse cards & tiers', color:'#2980b9' }];
  const cardGap = mobile ? 10 : 14, actionCardTop = actionPanelY + (mobile ? 40 : 74), actionCardBottomPad = mobile ? 18 : 30;
  const actionCardH = Math.min(mobile ? 66 : 76, Math.max(mobile ? 56 : 62, (actionPanelH - (actionCardTop - actionPanelY) - actionCardBottomPad - cardGap * (menuDefs.length - 1)) / menuDefs.length));
  ui.menuBtns = menuDefs.map((def, index) => ({ cx: actionX + actionW / 2, cy: actionCardTop + actionCardH / 2 + index * (actionCardH + cardGap), bw: actionW - (mobile ? 22 : 34), bh: actionCardH }));
  menuDefs.forEach((def, index) => drawMenuActionCard(ui.menuBtns[index], def.label, def.subtitle, def.color, inBtn(mouseX, mouseY, ui.menuBtns[index])));
  ctx.fillStyle = '#4f637a'; ctx.font = '10px monospace'; ctx.textAlign = 'left'; ctx.fillText(`v${GAME_VERSION}`, actionX + 18, actionPanelY + actionPanelH - 12);
  ctx.textAlign = 'right'; ctx.fillStyle = '#63758a'; ctx.fillText(mobile ? 'landscape phone mode active' : 'WASD move  ·  SPACE dash  ·  ENTER starts waves early', W - (mobile ? 16 : 32), H - (mobile ? 12 : 28));
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
  const mobile = isMobileUI();
  ctx.fillStyle = 'rgba(0,0,0,0.95)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e74c3c'; ctx.font = mobile ? 'bold 28px monospace' : 'bold 52px monospace'; ctx.textAlign = 'center';
  ctx.fillText(game.player.dead ? 'YOU DIED' : 'BASE DESTROYED', W / 2, H / 2 - (mobile ? 92 : 140));
  ctx.fillStyle = '#ecf0f1'; ctx.font = mobile ? '16px monospace' : '22px monospace'; ctx.fillText(`Waves survived: ${game.wave}`, W / 2, H / 2 - (mobile ? 50 : 80));
  ctx.fillStyle = '#f1c40f'; ctx.font = mobile ? '14px monospace' : '20px monospace'; ctx.fillText(`+${game.crystalsEarned} crystals earned`, W / 2, H / 2 - (mobile ? 24 : 50));
  ctx.fillStyle = '#bdc3c7'; ctx.font = mobile ? '10px monospace' : '15px monospace'; ctx.fillText(`Weapons used: ${game.player.weapons.map((w: any) => WEAPONS[w.id].name + ' Lv' + w.level).join(', ')}`, W / 2, H / 2 + (mobile ? 0 : -18));
  ui.gameoverBtns = mobile ? [btn(W / 2, H / 2 + 46, 'PLAY AGAIN', '#27ae60', 180, 34), btn(W / 2, H / 2 + 88, 'RELICS 💎', '#8e44ad', 180, 34)] : [btn(W / 2 - 115, H / 2 + 44, 'PLAY AGAIN', '#27ae60'), btn(W / 2 + 115, H / 2 + 44, 'RELICS 💎', '#8e44ad')];
}

export function handleGameoverClick(mx: number, my: number) {
  const ui = R.ui;
  if (ui.gameoverBtns[0] && inBtn(mx, my, ui.gameoverBtns[0])) { newGame(); R.state = 'playing'; }
  if (ui.gameoverBtns[1] && inBtn(mx, my, ui.gameoverBtns[1])) { R.prevState = 'gameover'; ui.metaScroll = 0; R.state = 'metascreen'; }
}

function renderPauseScreen() {
  const { ctx, W, H, ui } = R;
  const game = R.game;
  const mobile = isMobileUI();
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
  ui.levelupBaseUpgradeBtns = [];
  if (mobile) {
    renderMobileDrawer('paused');
    const leftW = getMobileDrawerRect().x - 20;
    ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 26px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', leftW / 2, H / 2 - 70);
    ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText('Tap resume or quit', leftW / 2, H / 2 - 40);
    const quitLabel = game?.devSession ? 'DEV MENU' : 'QUIT TO MENU';
    ui.pauseBtns = [btn(leftW / 2, H / 2 + 4, '▶ RESUME', '#27ae60', 160, 34), btn(leftW / 2, H / 2 + 46, quitLabel, '#c0392b', 160, 34)];
    return;
  }
  const { leftPanelX, leftPanelW, rightPanelX, rightPanelW } = luPositions();
  renderBaseSidebar(leftPanelX, leftPanelW, { allowBuy: false });
  renderLoadoutSidebar(rightPanelX, rightPanelW, { title: 'RUN STATUS', allowSell: false });
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 40px monospace'; ctx.textAlign = 'center'; ctx.fillText('PAUSED', W / 2, H / 2 - 80);
  ctx.fillStyle = '#aaa'; ctx.font = '14px monospace'; ctx.fillText('Press P or Escape to resume', W / 2, H / 2 - 44);
  const quitLabel = game?.devSession ? '🛠 RETURN TO DEV MENU' : '🏠 QUIT TO MENU';
  ui.pauseBtns = [btn(W / 2, H / 2 + 10, '▶ RESUME', '#27ae60', 220, 44), btn(W / 2, H / 2 + 70, quitLabel, '#c0392b', 220, 44)];
}

export function handlePauseClick(mx: number, my: number) {
  const ui = R.ui;
  if (ui.isMobileLandscape) {
    for (const tabBtn of ui.mobileDrawerTabBtns || []) {
      if (mx >= tabBtn.x && mx <= tabBtn.x + tabBtn.w && my >= tabBtn.y && my <= tabBtn.y + tabBtn.h) {
        ui.mobileDrawerTab = tabBtn.tab;
        ui.mobileScrollY = 0;
        return;
      }
    }
  }
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
  const mobile = isMobileUI();
  const CARD_W = mobile ? 110 : 140, CARD_H = mobile ? 164 : 200, CARD_GAP = 10;
  const SIDE = mobile ? 0 : 200;
  const CONTENT_X = mobile ? 12 : SIDE + 16;
  const CONTENT_W = W - CONTENT_X - 16;
  const HEADER_H = mobile ? 72 : 52;
  const clipTop = HEADER_H + 2;
  const clipBot = H - (mobile ? 38 : 4);
  ctx.fillStyle = '#060c18'; ctx.fillRect(0, 0, W, H);
  if (!mobile) { ctx.fillStyle = '#0b1525'; ctx.fillRect(0, 0, SIDE, H); ctx.fillStyle = '#1a2a3e'; ctx.fillRect(SIDE, 0, 1, H); }
  ctx.fillStyle = '#1a2a3e'; ctx.fillRect(0, 0, W, HEADER_H); ctx.fillStyle = '#2980b9'; ctx.fillRect(0, HEADER_H, W, 1);
  ctx.fillStyle = '#5dade2'; ctx.font = mobile ? 'bold 18px monospace' : 'bold 22px monospace'; ctx.textAlign = 'left'; ctx.fillText('📖  CARD BOOK', 16, mobile ? 26 : 34);
  const luckPreview = 0;
  const t = buildDropChanceTable(luckPreview);
  const rarityItems = [{ label:'Common', color:'#3498db', pct: t.common }, { label:'Uncommon', color:'#e67e22', pct: t.uncommon }, { label:'Rare', color:'#9b59b6', pct: t.rare }];
  let rx = W - 16;
  for (let i = rarityItems.length - 1; i >= 0; i--) {
    const it = rarityItems[i]; const bw = mobile ? 92 : 118; const bx = rx - bw;
    ctx.fillStyle = it.color + '30'; rrect(bx, mobile ? 36 : 14, bw, 22, 4); ctx.fill();
    ctx.strokeStyle = it.color + '88'; ctx.lineWidth = 1; rrect(bx, mobile ? 36 : 14, bw, 22, 4); ctx.stroke();
    ctx.fillStyle = it.color; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.fillText(it.label, bx + 6, mobile ? 50 : 28);
    if (!mobile) { ctx.fillStyle = '#bbb'; ctx.font = '10px monospace'; ctx.fillText(`${it.pct}% / card`, bx + 52, 28); }
    rx -= bw + 8;
  }
  function drawBookCard(card: any, bx: number, by: number) {
    const savedGame = R.game; R.game = makeCardBookPreviewGame(card); drawCard(card, bx, by, CARD_W, CARD_H, { dropChance: rarityDropChance(card.rarity, luckPreview) }); R.game = savedGame;
  }
  function drawSectionHeader(y: number, icon: string, label: string, color: string, note: string, count: number) {
    ctx.fillStyle = color + '18'; rrect(CONTENT_X, y, CONTENT_W, mobile ? 30 : 38, 6); ctx.fill();
    ctx.strokeStyle = color; ctx.lineWidth = 2; rrect(CONTENT_X, y, CONTENT_W, mobile ? 30 : 38, 6); ctx.stroke();
    ctx.fillStyle = color; ctx.font = mobile ? 'bold 12px monospace' : 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${icon}  ${label}`, CONTENT_X + 12, y + (mobile ? 20 : 24));
    if (!mobile) { ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace'; ctx.fillText(note, CONTENT_X + 12, y + 36); }
    ctx.fillStyle = color + 'cc'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${count} cards`, CONTENT_X + CONTENT_W - 12, y + (mobile ? 20 : 24));
  }
  function layout(draw: boolean) {
    let y = clipTop - ui.cardBookScroll;
    const cols = Math.max(1, Math.floor((CONTENT_W + CARD_GAP) / (CARD_W + CARD_GAP)));
    const weaponIds = Object.keys(WEAPONS);
    const weaponHeaderH = mobile ? 36 : 48;
    const weaponRowsPerWeapon = Math.max(1, Math.ceil(4 / cols));
    const wpnSecH = weaponHeaderH + weaponIds.length * (weaponRowsPerWeapon * (CARD_H + CARD_GAP) + 24);
    if (draw && y + wpnSecH >= clipTop && y < clipBot) drawSectionHeader(y, '⚔️', 'WEAPONS', '#e74c3c', 'Each weapon has 4 upgrade levels.', weaponIds.length * 4);
    y += weaponHeaderH;
    for (const id of weaponIds) {
      const def = WEAPONS[id] as any;
      const rowCards = [1,2,3,4].map(lv => ({ type:'weapon', weaponId:id, newLevel:lv, rarity:def.rarity }));
      const rowH = weaponRowsPerWeapon * (CARD_H + CARD_GAP) + 24;
      if (draw && y + rowH >= clipTop && y < clipBot) {
        ctx.fillStyle = def.color + '22'; ctx.fillRect(CONTENT_X, y, CONTENT_W, 20); ctx.fillStyle = def.color; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left'; ctx.fillText(`${def.icon}  ${def.name}`, CONTENT_X + 8, y + 14);
        rowCards.forEach((card: any, i: number) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const bx = CONTENT_X + col * (CARD_W + CARD_GAP);
          const by = y + 22 + row * (CARD_H + CARD_GAP);
          if (bx + CARD_W > CONTENT_X + CONTENT_W) return;
          if (by + CARD_H < clipTop || by > clipBot) return;
          drawBookCard(card, bx, by);
        });
      }
      y += rowH + CARD_GAP;
    }
    y += 12;
    for (const sec of CB_SECTIONS) {
      const cards = STAT_UPGRADES.filter(sec.filter).map(s => ({ type:'stat', statId:s.id, rarity:s.rarity || 'common' }));
      if (!cards.length) continue;
      const secHeaderH = mobile ? 36 : 48; const gridRows = Math.ceil(cards.length / cols); const secH = secHeaderH + gridRows * (CARD_H + CARD_GAP);
      if (draw && y + secH >= clipTop && y < clipBot) {
        drawSectionHeader(y, sec.icon, sec.label, sec.color, sec.note, cards.length);
        const cardsY = y + secHeaderH;
        cards.forEach((card: any, idx: number) => { const col = idx % cols; const row = Math.floor(idx / cols); const bx = CONTENT_X + col * (CARD_W + CARD_GAP); const by = cardsY + row * (CARD_H + CARD_GAP); if (by + CARD_H < clipTop || by > clipBot) return; drawBookCard(card, bx, by); });
      }
      y += secH + 16;
    }
    return y + ui.cardBookScroll;
  }
  const totalH = layout(false); const maxScroll = Math.max(0, totalH - clipBot + 24); ui.cardBookScroll = clamp(ui.cardBookScroll, 0, maxScroll);
  ctx.save(); ctx.beginPath(); ctx.rect(CONTENT_X, clipTop, W - CONTENT_X, clipBot - clipTop); ctx.clip(); layout(true); ctx.restore();
  if (maxScroll > 0) { const sbX = W - 8, sbTop = clipTop + 4, sbH = clipBot - clipTop - 8; const thumbH = Math.max(30, sbH * (clipBot - clipTop) / totalH); const thumbY = sbTop + (ui.cardBookScroll / maxScroll) * (sbH - thumbH); ctx.fillStyle = '#1e2d44'; ctx.fillRect(sbX - 4, sbTop, 4, sbH); ctx.fillStyle = '#3a5a7a'; rrect(sbX - 4, thumbY, 4, thumbH, 2); ctx.fill(); }
  ui.cardBookBackBtn = mobile ? btn(W - 32, 22, '←', '#2c3e50', 40, 24) : btn(SIDE / 2, H - 28, '← BACK', '#2c3e50', 160, 32);
}

function renderMetaScreen() {
  const { ctx, W, H, meta, ui } = R;
  const mobile = isMobileUI();
  ctx.fillStyle = '#0a0f1e'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8e44ad'; ctx.font = mobile ? 'bold 22px monospace' : 'bold 28px monospace'; ctx.textAlign = 'center'; ctx.fillText('RELICS', W / 2, mobile ? 28 : 42);
  ctx.fillStyle = '#f1c40f'; ctx.font = mobile ? '12px monospace' : '16px monospace'; ctx.fillText(`💎 ${meta.crystals} crystals`, W / 2, mobile ? 48 : 66);
  ui.metaBtns = [];
  const cols = mobile ? 2 : 3, cardW = mobile ? Math.min(206, Math.floor((W - 40) / 2)) : 245, cardH = mobile ? 96 : 106, gX = mobile ? 12 : 18, gY = 12;
  const totalW = cols * cardW + (cols - 1) * gX, sX = W / 2 - totalW / 2, clipTop = mobile ? 58 : 78, clipBot = H - 52;
  let layoutRow = 0, layoutCol = 0, layoutLastCat = null, contentBottom = clipTop;
  META_UPGRADES.forEach((upg: any) => { if (upg.cat !== layoutLastCat) { if (layoutCol !== 0) { layoutRow++; layoutCol = 0; } layoutRow += 0.22; layoutLastCat = upg.cat; } const cardTop = clipTop + layoutRow * (cardH + gY); contentBottom = Math.max(contentBottom, cardTop + cardH); layoutCol++; if (layoutCol >= cols) { layoutCol = 0; layoutRow++; } });
  ui.maxMetaScroll = Math.max(0, contentBottom - clipBot + 12); ui.metaScroll = clamp(ui.metaScroll, 0, ui.maxMetaScroll);
  ctx.save(); ctx.beginPath(); ctx.rect(0, clipTop, W, clipBot - clipTop); ctx.clip();
  let row = 0, col = 0, lastCat = null;
  META_UPGRADES.forEach((upg: any) => {
    if (upg.cat !== lastCat) { if (col !== 0) { row++; col = 0; } const ly = clipTop + row * (cardH + gY) - ui.metaScroll; if (ly > clipTop - 20 && ly < clipBot) { ctx.fillStyle = CAT_COLORS[upg.cat] || '#aaa'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.fillText(CAT_LABELS[upg.cat] || upg.cat.toUpperCase(), sX, ly + 14); } row += 0.22; lastCat = upg.cat; }
    const bx = sX + col * (cardW + gX), by = clipTop + row * (cardH + gY) - ui.metaScroll;
    if (by + cardH >= clipTop && by <= clipBot) {
      const lvl = meta.upgrades[upg.id] || 0, maxed = lvl >= upg.max, canAfford = !maxed && meta.crystals >= upg.cost, catColor = CAT_COLORS[upg.cat] || '#8e44ad';
      ctx.fillStyle = maxed ? '#1a3a1a' : canAfford ? '#0f1a2e' : '#111'; rrect(bx, by, cardW, cardH, 7); ctx.fill();
      ctx.strokeStyle = maxed ? '#27ae60' : canAfford ? catColor : '#2a2a2a'; ctx.lineWidth = maxed || canAfford ? 2 : 1; rrect(bx, by, cardW, cardH, 7); ctx.stroke();
      ctx.fillStyle = catColor + '33'; rrect(bx, by, cardW, 5, 3); ctx.fill();
      ctx.fillStyle = maxed ? '#2ecc71' : '#dfe6e9'; ctx.font = mobile ? 'bold 11px monospace' : 'bold 12px monospace'; ctx.textAlign = 'left'; ctx.fillText(upg.label, bx + 10, by + 20);
      ctx.fillStyle = '#95a5a6'; ctx.font = '10px monospace'; const descBottom = wrapText(upg.desc, bx + 10, by + 34, cardW - 20, 12, 2); const dotsY = descBottom + 15;
      ctx.fillStyle = catColor; ctx.fillText('●'.repeat(lvl) + '○'.repeat(upg.max - lvl), bx + 10, dotsY);
      if (!maxed) {
        ctx.fillStyle = canAfford ? '#f1c40f' : '#555'; ctx.font = '11px monospace'; ctx.textAlign = 'right'; ctx.fillText(`${upg.cost}💎`, bx + cardW - 8, by + 20);
        if (canAfford) ui.metaBtns.push({ ...btn(bx + cardW / 2, by + cardH - 16, mobile ? 'BUY' : 'UNLOCK', catColor, cardW - 30, 24), id:upg.id, cost:upg.cost, max:upg.max });
      } else {
        ctx.fillStyle = '#27ae60'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'center'; ctx.fillText('✓ MAXED', bx + cardW / 2, by + cardH - 10);
      }
    }
    col++; if (col >= cols) { col = 0; row++; }
  });
  ctx.restore();
  ctx.fillStyle = 'rgba(10,15,30,0.95)'; ctx.fillRect(0, clipBot, W, H - clipBot);
  ctx.fillStyle = '#333'; ctx.font = '11px monospace'; ctx.textAlign = 'center'; ctx.fillText(mobile ? 'scroll to browse relics' : '↕ scroll with mouse wheel', W / 2, clipBot + 16);
  ui.metaBackBtn = btn(W / 2, H - 22, mobile ? 'BACK' : '← BACK', '#555', 160, 32);
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
      const cur = stat.count(R.game.player, R.game);
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
