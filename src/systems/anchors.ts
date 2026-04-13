import type { GameState } from '../types';
import { dist } from '../utils';

export interface Anchor { x: number; y: number; range: number }

export function getAnchors(game: GameState): Anchor[] {
  const anchors: Anchor[] = [{ x: game.tower.x, y: game.tower.y, range: game.tower.range }];
  for (const op of game.outposts) anchors.push({ x: op.x, y: op.y, range: op.range });
  return anchors;
}

export function distToNearestAnchor(game: GameState, x: number, y: number) {
  let minDist = Infinity, minRange = game.tower.range, nearest: Anchor | null = null;
  for (const a of getAnchors(game)) {
    const d = dist(x, y, a.x, a.y);
    if (d < minDist) { minDist = d; minRange = a.range; nearest = a; }
  }
  return { dist: minDist, range: minRange, anchor: nearest! };
}
