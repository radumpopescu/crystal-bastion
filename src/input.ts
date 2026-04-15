import { R, metaVal } from './state';
import { handleCardClick, handlePlayingClick, selectTowerType, startNextWave, tryDash, tryPlaceOutpost } from './systems';
import { handleChangelogClick, handleDevMenuClick, handleGameoverClick, handleMenuClick, handleMetaClick, handlePauseClick } from './render';
import { clamp } from './utils';

window.addEventListener('keydown', e => {
  if (R.state === 'menu' && e.code === 'KeyG' && !e.repeat) {
    R.dev.menuHoldStart = performance.now();
  }
  if (R.game) R.game.keys[e.code] = true;
  if (!R.game) return;
  if (R.state === 'playing' || R.state === 'paused') {
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (R.state === 'playing') { R.state = 'paused'; }
      else R.state = 'playing';
      return;
    }
  }
  if (R.state === 'playing') {
    if ((e.code === 'Enter' || e.code === 'NumpadEnter') && !e.repeat && !R.game.waveActive) {
      e.preventDefault();
      startNextWave(true);
      return;
    }
    if (/^Digit[1-4]$/.test(e.code) && !e.repeat) {
      const index = Number(e.code.slice(-1)) - 1;
      const towerTypeId = R.game.availableTowerTypes?.[index];
      if (towerTypeId) {
        e.preventDefault();
        selectTowerType(towerTypeId);
        return;
      }
    }
    if (e.code === 'KeyE') tryPlaceOutpost();
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
  if (R.state === 'changelog') R.ui.changelogScroll = clamp(R.ui.changelogScroll + step, 0, R.ui.maxChangelogScroll);
  if ((R.state === 'playing' || R.state === 'levelup' || R.state === 'paused') && R.ui.isMobileLandscape && R.ui.mobileScrollArea) {
    R.ui.mobileScrollY = clamp(R.ui.mobileScrollY + step, 0, R.ui.mobileScrollMax);
  }
}, { passive:true });

function updatePointer(clientX: number, clientY: number) {
  const rect = R.canvas.getBoundingClientRect();
  R.mouseX = clientX - rect.left;
  R.mouseY = clientY - rect.top;
  R.mouseInside = true;
}

let touchScrollStartY = 0;
let touchScrollStartOffset = 0;
let touchScrolling = false;

R.canvas.addEventListener('touchstart', e => {
  const touch = e.touches[0];
  if (!touch) return;
  updatePointer(touch.clientX, touch.clientY);
  const area = R.ui.mobileScrollArea;
  touchScrolling = R.state === 'changelog'
    ? true
    : !!(R.ui.isMobileLandscape && area && R.mouseX >= area.x && R.mouseX <= area.x + area.w && R.mouseY >= area.y && R.mouseY <= area.y + area.h);
  touchScrollStartY = touch.clientY;
  touchScrollStartOffset = R.state === 'changelog' ? R.ui.changelogScroll : R.ui.mobileScrollY;
}, { passive: true });

R.canvas.addEventListener('touchmove', e => {
  const touch = e.touches[0];
  if (!touch) return;
  updatePointer(touch.clientX, touch.clientY);
  if (touchScrolling) {
    if (R.state === 'changelog') R.ui.changelogScroll = clamp(touchScrollStartOffset + (touchScrollStartY - touch.clientY), 0, R.ui.maxChangelogScroll);
    else R.ui.mobileScrollY = clamp(touchScrollStartOffset + (touchScrollStartY - touch.clientY), 0, R.ui.mobileScrollMax);
    e.preventDefault();
  }
}, { passive: false });

R.canvas.addEventListener('touchend', () => {
  touchScrolling = false;
}, { passive: true });

R.canvas.addEventListener('click', e => {
  const rect = R.canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  if (R.state === 'menu') handleMenuClick(mx, my);
  else if (R.state === 'devmenu') handleDevMenuClick(mx, my);
  else if (R.state === 'gameover') handleGameoverClick(mx, my);
  else if (R.state === 'metascreen') handleMetaClick(mx, my);
  else if (R.state === 'changelog') handleChangelogClick(mx, my);
  else if (R.state === 'cardbook') { if (R.ui.cardBookBackBtn && mx >= R.ui.cardBookBackBtn.cx - R.ui.cardBookBackBtn.bw / 2 && mx <= R.ui.cardBookBackBtn.cx + R.ui.cardBookBackBtn.bw / 2 && my >= R.ui.cardBookBackBtn.cy - R.ui.cardBookBackBtn.bh / 2 && my <= R.ui.cardBookBackBtn.cy + R.ui.cardBookBackBtn.bh / 2) R.state = 'menu'; }
  else if (R.state === 'levelup') handleCardClick(mx, my);
  else if (R.state === 'paused') handlePauseClick(mx, my);
  else if (R.state === 'playing') handlePlayingClick(mx, my);
});
