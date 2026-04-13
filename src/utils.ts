export function dist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export function drawHpBar(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  hp: number, maxHp: number,
  bgColor: string, fgColor: string
) {
  ctx.fillStyle = bgColor + '55';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  const pct = clamp(hp / maxHp, 0, 1);
  if (pct > 0) {
    ctx.fillStyle = fgColor;
    roundRect(ctx, x, y, w * pct, h, h / 2);
    ctx.fill();
  }
}

export interface ButtonRect { cx: number; cy: number; bw: number; bh: number }

export function drawButton(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  label: string, color: string,
  bw = 200, bh = 46
): ButtonRect {
  const bx = cx - bw / 2, by = cy - bh / 2;
  ctx.fillStyle = color;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.textBaseline = 'alphabetic';
  return { cx, cy, bw, bh };
}

export function inButton(mx: number, my: number, btn: ButtonRect): boolean {
  return mx >= btn.cx - btn.bw / 2 && mx <= btn.cx + btn.bw / 2 &&
         my >= btn.cy - btn.bh / 2 && my <= btn.cy + btn.bh / 2;
}
