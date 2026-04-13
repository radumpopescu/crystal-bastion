import type { MetaState } from '../meta';
import { META_UPGRADES } from '../constants';
import { roundRect, drawButton, inButton, type ButtonRect } from '../utils';

export type ScreenState = 'menu' | 'playing' | 'gameover' | 'metascreen';

// ─── MENU ────────────────────────────────────────────────────────────────────
export let menuButtons: ButtonRect[] = [];

export function renderMenu(ctx: CanvasRenderingContext2D, W: number, H: number, meta: MetaState) {
  ctx.fillStyle = '#0d0d1a';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  for (let i = 0; i < 80; i++) {
    ctx.beginPath(); ctx.arc(i * 137.5 % W, i * 73.3 % H, 1, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#f39c12'; ctx.font = 'bold 52px monospace'; ctx.textAlign = 'center';
  ctx.fillText('TOWER SURVIVAL', W / 2, H / 2 - 120);
  ctx.fillStyle = '#7f8c8d'; ctx.font = '16px monospace';
  ctx.fillText('Defend the tower. Expand your reach. Survive the waves.', W / 2, H / 2 - 78);
  ctx.fillStyle = '#bdc3c7'; ctx.font = '14px monospace';
  ctx.fillText(`Crystals: ${meta.crystals} 💎`, W / 2, H / 2 - 48);
  menuButtons = [
    drawButton(ctx, W / 2, H / 2 + 0, 'PLAY', '#27ae60'),
    drawButton(ctx, W / 2, H / 2 + 70, 'META UPGRADES 💎', '#8e44ad'),
  ];
}

export function handleMenuClick(mx: number, my: number, buttons: ButtonRect[]): 'play' | 'meta' | null {
  if (buttons[0] && inButton(mx, my, buttons[0])) return 'play';
  if (buttons[1] && inButton(mx, my, buttons[1])) return 'meta';
  return null;
}

// ─── GAME OVER ───────────────────────────────────────────────────────────────
export let gameoverButtons: ButtonRect[] = [];

export function renderGameover(
  ctx: CanvasRenderingContext2D, W: number, H: number,
  wave: number, crystalsEarned: number, totalCrystals: number, playerDead: boolean
) {
  ctx.fillStyle = 'rgba(0,0,0,0.92)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e74c3c'; ctx.font = 'bold 48px monospace'; ctx.textAlign = 'center';
  ctx.fillText(playerDead ? 'YOU DIED' : 'TOWER DESTROYED', W / 2, H / 2 - 130);
  ctx.fillStyle = '#ecf0f1'; ctx.font = '22px monospace';
  ctx.fillText(`Waves survived: ${wave}`, W / 2, H / 2 - 70);
  ctx.fillStyle = '#f1c40f'; ctx.font = '20px monospace';
  ctx.fillText(`+${crystalsEarned} crystals earned`, W / 2, H / 2 - 38);
  ctx.fillStyle = '#bdc3c7'; ctx.font = '16px monospace';
  ctx.fillText(`Total crystals: ${totalCrystals}`, W / 2, H / 2 - 8);
  gameoverButtons = [
    drawButton(ctx, W / 2 - 110, H / 2 + 40, 'PLAY AGAIN', '#27ae60'),
    drawButton(ctx, W / 2 + 110, H / 2 + 40, 'UPGRADES 💎', '#8e44ad'),
  ];
}

export function handleGameoverClick(mx: number, my: number, buttons: ButtonRect[]): 'play' | 'meta' | null {
  if (buttons[0] && inButton(mx, my, buttons[0])) return 'play';
  if (buttons[1] && inButton(mx, my, buttons[1])) return 'meta';
  return null;
}

// ─── META SCREEN ─────────────────────────────────────────────────────────────
export let metaButtons: Array<ButtonRect & { upgId: string }> = [];
export let metaBackBtn: ButtonRect | null = null;

export function renderMetaScreen(
  ctx: CanvasRenderingContext2D, W: number, H: number, meta: MetaState
) {
  ctx.fillStyle = '#0d0d1a'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#8e44ad'; ctx.font = 'bold 32px monospace'; ctx.textAlign = 'center';
  ctx.fillText('META UPGRADES', W / 2, 60);
  ctx.fillStyle = '#f1c40f'; ctx.font = '18px monospace';
  ctx.fillText(`Crystals: ${meta.crystals} 💎`, W / 2, 96);

  metaButtons = [];
  const cols = 2, cardW = 280, cardH = 110, gapX = 40, gapY = 20;
  const totalW = cols * cardW + (cols - 1) * gapX;
  const startX = W / 2 - totalW / 2;
  const startY = 130;

  META_UPGRADES.forEach((upg, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const bx = startX + col * (cardW + gapX);
    const by = startY + row * (cardH + gapY);
    const lvl = meta.upgrades[upg.id] ?? 0;
    const maxed = lvl >= upg.max;
    const canAfford = !maxed && meta.crystals >= upg.cost;

    ctx.fillStyle = maxed ? '#1a3a1a' : (canAfford ? '#16213e' : '#1a1a1a');
    roundRect(ctx, bx, by, cardW, cardH, 8); ctx.fill();
    ctx.strokeStyle = maxed ? '#27ae60' : (canAfford ? '#8e44ad' : '#333');
    ctx.lineWidth = 2;
    roundRect(ctx, bx, by, cardW, cardH, 8); ctx.stroke();

    ctx.fillStyle = '#ecf0f1'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left';
    ctx.fillText(upg.label, bx + 12, by + 26);
    ctx.fillStyle = '#aaa'; ctx.font = '11px monospace';
    ctx.fillText(upg.desc, bx + 12, by + 46);
    ctx.fillStyle = '#f39c12';
    ctx.fillText('●'.repeat(lvl) + '○'.repeat(upg.max - lvl), bx + 12, by + 65);

    if (!maxed) {
      ctx.fillStyle = canAfford ? '#f1c40f' : '#666';
      ctx.font = '12px monospace'; ctx.textAlign = 'right';
      ctx.fillText(`Cost: ${upg.cost} 💎`, bx + cardW - 10, by + 46);
      if (canAfford) {
        const btn = drawButton(ctx, bx + cardW / 2, by + cardH - 22, 'UNLOCK', '#8e44ad', cardW - 40, 30);
        metaButtons.push({ ...btn, upgId: upg.id });
      }
    } else {
      ctx.fillStyle = '#27ae60'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center';
      ctx.fillText('MAXED OUT', bx + cardW / 2, by + cardH - 14);
    }
  });

  metaBackBtn = drawButton(ctx, W / 2, H - 50, '← BACK', '#555');
}

export function handleMetaClick(
  mx: number, my: number,
  buttons: Array<ButtonRect & { upgId: string }>,
  backBtn: ButtonRect | null,
  meta: MetaState,
  fromState: ScreenState
): { action: 'upgrade'; id: string } | { action: 'back'; to: ScreenState } | null {
  for (const btn of buttons) {
    if (inButton(mx, my, btn)) return { action: 'upgrade', id: btn.upgId };
  }
  if (backBtn && inButton(mx, my, backBtn)) return { action: 'back', to: fromState === 'metascreen' ? 'menu' : 'gameover' };
  return null;
}
