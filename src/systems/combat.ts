import type { GameState, Projectile } from '../types';
import { dist } from '../utils';
import { spawnParticles, spawnDmgNumber } from './particles';

export function fireProjectile(
  game: GameState,
  fx: number, fy: number,
  tx: number, ty: number,
  dmg: number,
  owner: Projectile['owner']
) {
  const d = dist(fx, fy, tx, ty);
  if (d === 0) return;
  const speed = 420;
  game.projectiles.push({
    x: fx, y: fy,
    vx: ((tx - fx) / d) * speed,
    vy: ((ty - fy) / d) * speed,
    dmg, owner, life: 2,
  });
}

export function killMonster(game: GameState, i: number) {
  const m = game.monsters[i];
  game.gold += m.gold;
  spawnParticles(game, m.x, m.y, m.color, 10, 50);
  spawnDmgNumber(game, m.x, m.y, m.gold, '#f1c40f');
  game.monsters.splice(i, 1);
  game.monstersLeft = Math.max(0, game.monstersLeft - 1);
  if (game.monstersLeft === 0 && game.waveActive) {
    game.waveActive = false;
    game.waveTimer = 30;
  }
}

export function updateProjectiles(game: GameState, dt: number) {
  for (let i = game.projectiles.length - 1; i >= 0; i--) {
    const p = game.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) { game.projectiles.splice(i, 1); continue; }

    for (let j = game.monsters.length - 1; j >= 0; j--) {
      const m = game.monsters[j];
      if (dist(p.x, p.y, m.x, m.y) < m.radius + 6) {
        m.hp -= p.dmg;
        spawnDmgNumber(game, m.x, m.y - m.radius, p.dmg, '#fff');
        spawnParticles(game, p.x, p.y, m.color, 4, 40);
        game.projectiles.splice(i, 1);
        if (m.hp <= 0) killMonster(game, j);
        break;
      }
    }
  }
}
