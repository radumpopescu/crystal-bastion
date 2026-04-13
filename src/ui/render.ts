import type { GameState } from '../types';
import { WORLD, TILE, PLAYER_RADIUS, LEASH_WARN } from '../constants';
import { dist, roundRect, drawHpBar, drawButton, inButton, type ButtonRect } from '../utils';
import { getAnchors } from '../systems/anchors';
import type { MetaState } from '../meta';
import { META_UPGRADES, TOWER_UPGRADES } from '../constants';

export let nextWaveBtn: ButtonRect | null = null;

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  game: GameState,
  meta: MetaState,
  state: string
) {
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2 - game.camera.x;
  const cy = H / 2 - game.camera.y;

  ctx.save();
  ctx.translate(cx, cy);
  renderWorld(ctx);
  renderSafeZones(ctx, game);
  renderOutposts(ctx, game);
  renderTower(ctx, game);
  renderMonsters(ctx, game);
  renderProjectiles(ctx, game);
  renderPlayer(ctx, game);
  renderParticles(ctx, game);
  renderDmgNumbers(ctx, game);
  ctx.restore();

  renderHUD(ctx, W, H, game, meta);
  if (game.showUpgradeMenu) renderUpgradeMenu(ctx, W, H, game);
  renderLeashWarning(ctx, W, H, game);
}

function renderWorld(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(-WORLD / 2, -WORLD / 2, WORLD, WORLD);
  ctx.strokeStyle = '#16213e';
  ctx.lineWidth = 1;
  for (let x = -WORLD / 2; x < WORLD / 2; x += TILE) {
    ctx.beginPath(); ctx.moveTo(x, -WORLD / 2); ctx.lineTo(x, WORLD / 2); ctx.stroke();
  }
  for (let y = -WORLD / 2; y < WORLD / 2; y += TILE) {
    ctx.beginPath(); ctx.moveTo(-WORLD / 2, y); ctx.lineTo(WORLD / 2, y); ctx.stroke();
  }
}

function renderSafeZones(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const a of getAnchors(game)) {
    const grad = ctx.createRadialGradient(a.x, a.y, a.range * 0.5, a.x, a.y, a.range);
    grad.addColorStop(0, 'rgba(39,174,96,0)');
    grad.addColorStop(1, 'rgba(39,174,96,0.08)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.range, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(39,174,96,0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(a.x, a.y, a.range, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function renderTower(ctx: CanvasRenderingContext2D, game: GameState) {
  const t = game.tower;
  // Attack range ring
  ctx.strokeStyle = 'rgba(241,196,15,0.12)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.beginPath(); ctx.arc(t.x, t.y, t.atkRange, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  // Aura ring
  ctx.strokeStyle = 'rgba(241,196,15,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(t.x, t.y, t.auraRadius, 0, Math.PI * 2); ctx.stroke();
  // Base
  ctx.fillStyle = '#2c3e50';
  ctx.strokeStyle = '#f39c12';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.rect(t.x - 20, t.y - 20, 40, 40); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f39c12';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('⊕', t.x, t.y);
  ctx.textBaseline = 'alphabetic';
  drawHpBar(ctx, t.x - 40, t.y - 38, 80, 8, t.hp, t.maxHp, '#e74c3c', '#27ae60');
}

function renderOutposts(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const op of game.outposts) {
    // Attack range ring
    ctx.strokeStyle = 'rgba(39,174,96,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.beginPath(); ctx.arc(op.x, op.y, op.atkRange, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // Body
    ctx.fillStyle = '#1e3a5f';
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(op.x, op.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#3498db';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('□', op.x, op.y);
    ctx.textBaseline = 'alphabetic';
    drawHpBar(ctx, op.x - 20, op.y - 24, 40, 5, op.hp, op.maxHp, '#e74c3c', '#3498db');
  }
}

function renderPlayer(ctx: CanvasRenderingContext2D, game: GameState) {
  const p = game.player;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(p.x, p.y, p.atkRange, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = p.flashTimer > 0 ? '#ff6b6b' : '#ecf0f1';
  ctx.strokeStyle = '#bdc3c7'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3498db';
  ctx.beginPath(); ctx.arc(p.x, p.y - PLAYER_RADIUS + 4, 4, 0, Math.PI * 2); ctx.fill();
}

function renderMonsters(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const m of game.monsters) {
    ctx.fillStyle = m.color; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (m.hp < m.maxHp) {
      drawHpBar(ctx, m.x - m.radius, m.y - m.radius - 9, m.radius * 2, 4, m.hp, m.maxHp, '#e74c3c', '#e74c3c');
    }
  }
}

function renderProjectiles(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const p of game.projectiles) {
    const color = p.owner === 'player' ? '#3498db' : p.owner === 'tower' ? '#f1c40f' : '#27ae60';
    const r = p.owner === 'tower' ? 7 : 5;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill();
  }
}

function renderParticles(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const p of game.particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderDmgNumbers(ctx: CanvasRenderingContext2D, game: GameState) {
  for (const d of game.dmgNumbers) {
    ctx.globalAlpha = Math.min(1, d.life);
    ctx.fillStyle = d.color;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(d.val), d.x, d.y);
  }
  ctx.globalAlpha = 1;
  ctx.textBaseline = 'alphabetic';
}

function renderHUD(ctx: CanvasRenderingContext2D, W: number, H: number, game: GameState, meta: MetaState) {
  const p = game.player, t = game.tower;

  // Tower HP — top center
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, W / 2 - 110, 10, 220, 36, 6); ctx.fill();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER', W / 2, 24);
  drawHpBar(ctx, W / 2 - 90, 28, 180, 12, t.hp, t.maxHp, '#c0392b', '#e74c3c');
  ctx.fillStyle = '#fff'; ctx.font = '10px monospace';
  ctx.fillText(`${Math.ceil(t.hp)} / ${t.maxHp}`, W / 2, 46);

  // Player HP — bottom left
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, 10, H - 56, 180, 46, 6); ctx.fill();
  ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'left';
  ctx.fillText('PLAYER HP', 18, H - 42);
  drawHpBar(ctx, 18, H - 34, 160, 14, p.hp, p.maxHp, '#c0392b', '#27ae60');
  ctx.fillStyle = '#aaa'; ctx.font = '10px monospace';
  ctx.fillText(`${Math.ceil(Math.max(0, p.hp))} / ${p.maxHp}`, 18, H - 14);

  // Gold — top right
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, W - 130, 10, 120, 36, 6); ctx.fill();
  ctx.fillStyle = '#f1c40f'; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'right';
  ctx.fillText(`⬡ ${game.gold}`, W - 18, 34);

  // Wave info — top left
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(ctx, 10, 10, 200, 100, 6); ctx.fill();
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
  ctx.fillText(`WAVE ${game.wave}`, 18, 28);
  if (game.waveActive) {
    ctx.fillStyle = '#e74c3c'; ctx.font = '11px monospace';
    ctx.fillText(`Enemies: ${game.monsters.length}`, 18, 48);
    nextWaveBtn = null;
  } else {
    ctx.fillStyle = '#2ecc71'; ctx.font = '11px monospace';
    ctx.fillText(`Next wave in: ${Math.ceil(game.waveTimer)}s`, 18, 48);
    nextWaveBtn = drawButton(ctx, 110, 82, '▶ START WAVE', '#e67e22', 180, 34);
  }

  // Controls hint — bottom right
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, W - 210, H - 72, 200, 62, 6); ctx.fill();
  ctx.fillStyle = '#7f8c8d'; ctx.font = '10px monospace'; ctx.textAlign = 'right';
  ctx.fillText('WASD: move', W - 16, H - 56);
  ctx.fillText('E: place outpost (40g)', W - 16, H - 42);
  ctx.fillText('U: upgrade tower (near it)', W - 16, H - 28);
  ctx.fillText(`Crystals: ${meta.crystals} 💎`, W - 16, H - 12);
}

function renderLeashWarning(ctx: CanvasRenderingContext2D, W: number, H: number, game: GameState) {
  let nearestDist = Infinity, nearestRange = game.tower.range;
  for (const a of getAnchors(game)) {
    const d = dist(game.player.x, game.player.y, a.x, a.y);
    if (d < nearestDist) { nearestDist = d; nearestRange = a.range; }
  }
  const fraction = nearestDist / nearestRange;
  if (fraction > LEASH_WARN) {
    const alpha = Math.min(0.45, (fraction - LEASH_WARN) / (1 - LEASH_WARN) * 0.45);
    const grad = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.7);
    grad.addColorStop(0, 'rgba(231,76,60,0)');
    grad.addColorStop(1, `rgba(231,76,60,${alpha})`);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if (fraction >= 1) {
      ctx.fillStyle = `rgba(231,76,60,${0.3 + Math.sin(game.tick * 8) * 0.2})`;
      ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
      ctx.fillText('⚠ TOO FAR — TAKING DAMAGE', W / 2, H / 2 - 40);
    }
  }
}

export function renderUpgradeMenu(ctx: CanvasRenderingContext2D, W: number, H: number, game: GameState) {
  const mx = W / 2 - 160, my = H / 2 - 140;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  roundRect(ctx, mx - 10, my - 10, 340, 280, 10); ctx.fill();
  ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2;
  roundRect(ctx, mx - 10, my - 10, 340, 280, 10); ctx.stroke();
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER UPGRADES', W / 2, my + 16);

  TOWER_UPGRADES.forEach((upg, i) => {
    const lvl = game.tower.upgrades[upg.id as keyof typeof game.tower.upgrades] || 0;
    const maxed = lvl >= upg.max;
    const cost = maxed ? 0 : upg.cost[lvl];
    const canAfford = !maxed && game.gold >= cost;
    const bx = mx, by = my + 40 + i * 70;
    ctx.fillStyle = maxed ? '#1a3a1a' : (canAfford ? '#1a2a3a' : '#2a1a1a');
    roundRect(ctx, bx, by, 320, 54, 6); ctx.fill();
    ctx.strokeStyle = maxed ? '#27ae60' : (canAfford ? '#3498db' : '#555');
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, 320, 54, 6); ctx.stroke();
    ctx.fillStyle = maxed ? '#27ae60' : '#ecf0f1';
    ctx.font = 'bold 13px monospace'; ctx.textAlign = 'left';
    ctx.fillText(upg.label, bx + 10, by + 20);
    ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
    const dots = '●'.repeat(lvl) + '○'.repeat(upg.max - lvl);
    ctx.fillText(dots, bx + 10, by + 38);
    if (!maxed) {
      ctx.fillStyle = canAfford ? '#f1c40f' : '#e74c3c';
      ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`⬡ ${cost}`, bx + 315, by + 20);
    } else {
      ctx.fillStyle = '#27ae60'; ctx.font = 'bold 11px monospace'; ctx.textAlign = 'right';
      ctx.fillText('MAXED', bx + 315, by + 20);
    }
  });
  ctx.fillStyle = '#666'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
  ctx.fillText('Press U or ESC to close', W / 2, my + 265);
}
