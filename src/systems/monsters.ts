import type { GameState } from '../types';
import { MONSTER_TYPES, BASE_MONSTERS, MONSTER_SCALE, type MonsterType } from '../constants';
import { PLAYER_RADIUS } from '../constants';
import { dist } from '../utils';
import { spawnDmgNumber, spawnParticles } from './particles';
import { killMonster } from './combat';

export function spawnWave(game: GameState, waveNum: number) {
  const count = Math.floor(BASE_MONSTERS * Math.pow(MONSTER_SCALE, waveNum - 1));
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spawnR = game.tower.range + 350 + Math.random() * 200;
    const sx = game.tower.x + Math.cos(angle) * spawnR;
    const sy = game.tower.y + Math.sin(angle) * spawnR;

    let type: MonsterType = 'grunt';
    if (waveNum >= 3 && Math.random() < 0.25) type = 'rusher';
    if (waveNum >= 5 && Math.random() < 0.15) type = 'brute';

    const t = MONSTER_TYPES[type];
    const hpScale = 1 + (waveNum - 1) * 0.15;
    game.monsters.push({
      x: sx, y: sy, type,
      hp: t.hp * hpScale, maxHp: t.hp * hpScale,
      speed: t.speed, dmg: t.dmg,
      gold: t.gold,
      radius: t.radius, color: t.color,
      atkCooldown: Math.random() * 1.5,
    });
  }
  game.monstersLeft = count;
  game.waveActive = true;
}

export function updateMonsters(game: GameState, dt: number) {
  const tower = game.tower;
  for (let i = game.monsters.length - 1; i >= 0; i--) {
    const m = game.monsters[i];

    // Find nearest target
    const targets = [
      { x: tower.x, y: tower.y, isStructure: true as const, ref: tower as any },
      { x: game.player.x, y: game.player.y, isStructure: false as const, ref: game.player as any },
      ...game.outposts.map(op => ({ x: op.x, y: op.y, isStructure: true as const, ref: op as any })),
    ];
    const nearest = targets.reduce(
      (best, t) => { const d = dist(m.x, m.y, t.x, t.y); return d < best.d ? { d, t } : best; },
      { d: Infinity, t: null as typeof targets[number] | null }
    );
    const target = nearest.t;
    if (!target) continue;

    const d = nearest.d;
    const contactR = (target.isStructure ? 20 : PLAYER_RADIUS) + m.radius;

    // Move toward target
    if (d > contactR) {
      m.x += ((target.x - m.x) / d) * m.speed * dt;
      m.y += ((target.y - m.y) / d) * m.speed * dt;
    }

    // Attack
    if (m.atkCooldown > 0) { m.atkCooldown -= dt; continue; }
    if (d > contactR + 5) continue;

    m.atkCooldown = 1.5;
    if (!target.isStructure) {
      if (game.player.invincible <= 0) {
        game.player.hp -= m.dmg;
        game.player.flashTimer = 0.15;
        game.player.invincible = 0.4;
        spawnDmgNumber(game, game.player.x, game.player.y - 20, m.dmg, '#ff6b6b');
      }
    } else {
      target.ref.hp -= m.dmg;
      spawnDmgNumber(game, target.x, target.y - 20, m.dmg, '#ff6b6b');
      if (target.ref.hp <= 0 && target.ref !== tower) {
        const idx = game.outposts.indexOf(target.ref);
        if (idx !== -1) {
          spawnParticles(game, target.ref.x, target.ref.y, '#e74c3c', 20, 80);
          game.outposts.splice(idx, 1);
        }
      }
    }
  }
}
