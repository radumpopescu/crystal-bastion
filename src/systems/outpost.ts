import type { GameState } from '../types';
import { OUTPOST_COST, OUTPOST_HP_BASE, OUTPOST_RANGE } from '../constants';
import { dist } from '../utils';
import { getAnchors } from './anchors';
import { spawnParticles } from './particles';

export function tryPlaceOutpost(game: GameState) {
  if (game.gold < OUTPOST_COST) return;
  const { x: px, y: py } = game.player;
  const anchors = getAnchors(game);

  // Must be connectable: within anchor.range + outpostRange*0.6 of some anchor
  let canConnect = false;
  const outpostRange = OUTPOST_RANGE + game.outpostRangeBonus;
  for (const a of anchors) {
    if (dist(px, py, a.x, a.y) <= a.range + outpostRange * 0.6) { canConnect = true; break; }
  }
  if (!canConnect) return;

  // Don't stack too close
  for (const a of anchors) {
    if (dist(px, py, a.x, a.y) < 60) return;
  }

  game.gold -= OUTPOST_COST;
  const maxHp = OUTPOST_HP_BASE + game.outpostHpBonus;
  game.outposts.push({
    x: px, y: py,
    hp: maxHp, maxHp,
    range: outpostRange,
    atkRange: 180, atkDmg: 15, atkSpeed: 0.8, atkCooldown: 0,
  });
  spawnParticles(game, px, py, '#27ae60', 12, 60);
}
