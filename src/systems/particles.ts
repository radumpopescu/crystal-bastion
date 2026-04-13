import type { GameState } from '../types';

export function spawnParticles(game: GameState, x: number, y: number, color: string, count: number, speed: number) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
      color, r: 2 + Math.random() * 3,
    });
  }
}

export function spawnDmgNumber(game: GameState, x: number, y: number, val: number, color = '#fff') {
  game.dmgNumbers.push({ x, y: y - 10, val: Math.round(val), life: 1.2, color });
}

export function updateParticles(game: GameState, dt: number) {
  for (let i = game.particles.length - 1; i >= 0; i--) {
    const p = game.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
    p.life -= dt;
    if (p.life <= 0) game.particles.splice(i, 1);
  }
}

export function updateDmgNumbers(game: GameState, dt: number) {
  for (let i = game.dmgNumbers.length - 1; i >= 0; i--) {
    const d = game.dmgNumbers[i];
    d.y -= 30 * dt;
    d.life -= dt;
    if (d.life <= 0) game.dmgNumbers.splice(i, 1);
  }
}
