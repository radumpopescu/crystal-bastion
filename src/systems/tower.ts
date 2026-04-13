import type { GameState } from '../types';
import { dist } from '../utils';
import { fireProjectile, killMonster } from './combat';

export function updateTowerAndOutposts(game: GameState, dt: number) {
  const t = game.tower;

  // Aura damage
  for (const m of game.monsters) {
    if (dist(m.x, m.y, t.x, t.y) <= t.auraRadius) {
      m.hp -= t.auraDmg * dt;
    }
  }

  // Tower shooting
  if (t.atkCooldown > 0) {
    t.atkCooldown -= dt;
  } else {
    let closest = null, closestD = t.atkRange;
    for (const m of game.monsters) {
      const d = dist(t.x, t.y, m.x, m.y);
      if (d < closestD) { closestD = d; closest = m; }
    }
    if (closest) {
      fireProjectile(game, t.x, t.y, closest.x, closest.y, t.atkDmg, 'tower');
      t.atkCooldown = 1 / t.atkSpeed;
    }
  }

  // Outpost shooting
  for (const op of game.outposts) {
    if (op.atkCooldown > 0) { op.atkCooldown -= dt; continue; }
    let closest = null, closestD = op.atkRange;
    for (const m of game.monsters) {
      const d = dist(op.x, op.y, m.x, m.y);
      if (d < closestD) { closestD = d; closest = m; }
    }
    if (closest) {
      fireProjectile(game, op.x, op.y, closest.x, closest.y, op.atkDmg, 'outpost');
      op.atkCooldown = 1 / op.atkSpeed;
    }
  }

  // Remove dead monsters
  for (let i = game.monsters.length - 1; i >= 0; i--) {
    if (game.monsters[i].hp <= 0) killMonster(game, i);
  }
}

export function applyTowerUpgrade(game: GameState, id: string) {
  const t = game.tower;
  if (id === 'hp')    { t.maxHp += 100; t.hp = Math.min(t.hp + 100, t.maxHp); }
  if (id === 'range') { t.range += 50; }
  if (id === 'aura')  { t.auraDmg += 10; }
}
