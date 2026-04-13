import type { BtnRect } from './types';

export function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function inBtn(mx: number, my: number, b: BtnRect | null) {
  if (!b) return false;
  return mx >= b.cx - b.bw / 2 && mx <= b.cx + b.bw / 2 && my >= b.cy - b.bh / 2 && my <= b.cy + b.bh / 2;
}
