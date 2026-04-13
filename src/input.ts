import { R, metaVal } from './state';
import { handleCardClick, handlePlayingClick, handleUpgradeMenuClick, toggleUpgradeMenu, tryDash, tryPlaceOutpost } from './systems';
import { handleDevMenuClick, handleGameoverClick, handleMenuClick, handleMetaClick, handlePauseClick } from './render';
import { clamp } from './utils';

window.addEventListener('keydown', e => {
  if (R.state === 'menu' && e.code === 'KeyG' && !e.repeat) {
    R.dev.menuHoldStart = performance.now();
  }
  if (R.game) R.game.keys[e.code] = true;
  if (!R.game) return;
  if (R.state === 'playing' || R.state === 'paused') {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (R.state === 'playing') { R.state = 'paused'; R.game.showUpgradeMenu = false; }
      else R.state = 'playing';
      return;
    }
  }
  if (R.state === 'playing') {
    if (e.code === 'KeyE') tryPlaceOutpost();
    if (e.code === 'KeyU') toggleUpgradeMenu();
    if (e.code === 'Space') tryDash();
  }
});

window.addEventListener('keyup', e => {
  if (R.game) R.game.keys[e.code] = false;
  if (e.code === 'KeyG') R.dev.menuHoldStart = 0;
});

R.canvas.addEventListener('mousemove', e => {
  const rect = R.canvas.getBoundingClientRect();
  R.mouseX = e.clientX - rect.left;
  R.mouseY = e.clientY - rect.top;
  R.mouseInside = true;
});

R.canvas.addEventListener('mouseleave', () => {
  R.mouseInside = false;
});

R.canvas.addEventListener('wheel', e => {
  const step = Math.abs(e.deltaY) > 50 ? Math.sign(e.deltaY) * 60 : e.deltaY * 0.8;
  if (R.state === 'cardbook') R.ui.cardBookScroll = Math.max(0, R.ui.cardBookScroll + step);
  if (R.state === 'metascreen') R.ui.metaScroll = clamp(R.ui.metaScroll + step, 0, R.ui.maxMetaScroll);
}, { passive:true });

R.canvas.addEventListener('click', e => {
  const rect = R.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (R.state === 'menu') handleMenuClick(mx, my);
  else if (R.state === 'devmenu') handleDevMenuClick(mx, my);
  else if (R.state === 'gameover') handleGameoverClick(mx, my);
  else if (R.state === 'metascreen') handleMetaClick(mx, my);
  else if (R.state === 'cardbook') { if (R.ui.cardBookBackBtn && mx >= R.ui.cardBookBackBtn.cx - R.ui.cardBookBackBtn.bw / 2 && mx <= R.ui.cardBookBackBtn.cx + R.ui.cardBookBackBtn.bw / 2 && my >= R.ui.cardBookBackBtn.cy - R.ui.cardBookBackBtn.bh / 2 && my <= R.ui.cardBookBackBtn.cy + R.ui.cardBookBackBtn.bh / 2) R.state = 'menu'; }
  else if (R.state === 'levelup') handleCardClick(mx, my);
  else if (R.state === 'paused') handlePauseClick(mx, my);
  else if (R.state === 'playing') {
    if (R.game.showUpgradeMenu) handleUpgradeMenuClick(mx, my);
    else handlePlayingClick(mx, my);
  }
});
