import './state';
import './systems';
import './render';
import './input';
import './mobile-controls';
import { restoreSavedRun, syncSavedRun } from './run-persistence';
import { R, DEV_MENU_HOLD_MS, finishDevSession } from './state';
import { updateAutoConstruct, updateDmgNums, updateMonsters, updateParticles, updatePlayer, updateProjectiles, updateStructures, startNextWave } from './systems';
import { render } from './render';
import { ISO_SCALE, WAVE_INTERVAL } from './constants';

function loop(ts: number) {
  const dt = Math.min((ts - R.lastTime) / 1000, 0.05);
  R.lastTime = ts;
  const instantFps = dt > 0 ? 1 / dt : 60;
  R.fps += (instantFps - R.fps) * 0.12;

  if (R.state === 'menu' && R.dev.menuHoldStart > 0 && performance.now() - R.dev.menuHoldStart >= DEV_MENU_HOLD_MS) {
    R.dev.menuHoldStart = 0;
    R.state = 'devmenu';
  }

  if (R.state === 'playing' && R.game) {
    const game = R.game;
    game.tick += dt;
    updatePlayer(dt);
    updateMonsters(dt);
    updateProjectiles(dt);
    updateStructures(dt);
    updateAutoConstruct();
    updateParticles(dt);
    updateDmgNums(dt);

    if (!game.waveActive) {
      game.waveTimer -= dt;
      if (game.waveTimer <= 0) startNextWave(false);
    }

    const targetSx = (game.player.x - game.player.y) * ISO_SCALE;
    const targetSy = (game.player.x + game.player.y) * ISO_SCALE * 0.5;
    R.cam.sx += (targetSx - R.cam.sx) * 7 * dt;
    R.cam.sy += (targetSy - R.cam.sy) * 7 * dt;

    if (game.tower.hp <= 0 || game.player.dead) {
      if (game.devSession) {
        finishDevSession(game.player.dead ? `Player died on wave ${game.wave}.` : `Base destroyed on wave ${game.wave}.`);
        render();
        requestAnimationFrame(loop);
        return;
      }
      R.state = 'gameover';
    }
  }

  syncSavedRun();
  render();
  requestAnimationFrame(loop);
}

restoreSavedRun();
requestAnimationFrame(loop);
