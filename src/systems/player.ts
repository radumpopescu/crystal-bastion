import type { GameState } from '../types';
import { LEASH_DMG, LEASH_WARN, PLAYER_RADIUS } from '../constants';
import { dist } from '../utils';
import { distToNearestAnchor } from './anchors';
import { fireProjectile } from './combat';

export function updatePlayer(game: GameState, dt: number) {
  const p = game.player;
  if (p.dead) return;

  // Movement
  let dx = 0, dy = 0;
  if (game.keys['KeyW'] || game.keys['ArrowUp'])    dy -= 1;
  if (game.keys['KeyS'] || game.keys['ArrowDown'])  dy += 1;
  if (game.keys['KeyA'] || game.keys['ArrowLeft'])  dx -= 1;
  if (game.keys['KeyD'] || game.keys['ArrowRight']) dx += 1;
  if (dx !== 0 && dy !== 0) { dx *= 0.707; dy *= 0.707; }

  const newX = p.x + dx * p.speed * dt;
  const newY = p.y + dy * p.speed * dt;

  const { dist: nearestDist, range: hardCap, anchor } = distToNearestAnchor(game, newX, newY);
  const warnCap = hardCap * LEASH_WARN;

  if (nearestDist <= hardCap) {
    p.x = newX; p.y = newY;
  } else {
    const ang = Math.atan2(newY - anchor.y, newX - anchor.x);
    p.x = anchor.x + Math.cos(ang) * hardCap;
    p.y = anchor.y + Math.sin(ang) * hardCap;
  }

  // Leash damage
  const { dist: curDist } = distToNearestAnchor(game, p.x, p.y);
  if (curDist > warnCap && p.invincible <= 0) {
    p.hp -= LEASH_DMG * dt;
    p.flashTimer = 0.1;
  }

  if (p.flashTimer > 0) p.flashTimer -= dt;
  if (p.invincible > 0) p.invincible -= dt;
  if (p.hp <= 0) p.dead = true;

  // Auto-attack nearest monster
  if (p.atkCooldown > 0) { p.atkCooldown -= dt; return; }
  let closest = null, closestD = p.atkRange;
  for (const m of game.monsters) {
    const d = dist(p.x, p.y, m.x, m.y);
    if (d < closestD) { closestD = d; closest = m; }
  }
  if (closest) {
    fireProjectile(game, p.x, p.y, closest.x, closest.y, p.atkDmg, 'player');
    p.atkCooldown = 1 / p.atkSpeed;
  }
}
