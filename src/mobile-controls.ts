// @ts-ignore
import nipplejs from 'nipplejs';
import { R } from './state';
import { tryDash, tryPlaceOutpost } from './systems';

const root = document.createElement('div');
root.id = 'mobile-controls';
root.innerHTML = `
  <div class="mc-joystick-shell">
    <div id="mobile-joystick-zone" class="mc-joystick-zone"></div>
  </div>
  <div class="mc-actions">
    <button class="mc-btn mc-btn-secondary" data-action="fullscreen" type="button">FULL</button>
    <button class="mc-btn mc-btn-primary" data-action="dash" type="button">DASH</button>
    <button class="mc-btn" data-action="build" type="button">BUILD</button>
  </div>
`;
document.body.appendChild(root);

const rotateOverlay = document.createElement('div');
rotateOverlay.id = 'mobile-rotate-overlay';
rotateOverlay.innerHTML = `
  <div class="rotate-card">
    <div class="rotate-icon">📱↻</div>
    <div class="rotate-title">Please rotate your device</div>
    <div class="rotate-copy">Crystal Bastion is designed for landscape on mobile. Rotate your phone or tablet, then tap fullscreen for the best fit.</div>
    <div class="rotate-actions">
      <button type="button" data-rotate-action="fullscreen">FULLSCREEN</button>
    </div>
  </div>
`;
document.body.appendChild(rotateOverlay);

const joystickShell = root.querySelector('.mc-joystick-shell') as HTMLDivElement;
const joystickZone = root.querySelector('#mobile-joystick-zone') as HTMLDivElement;
const fullscreenBtn = root.querySelector('[data-action="fullscreen"]') as HTMLButtonElement;
const rotateFullscreenBtn = rotateOverlay.querySelector('[data-rotate-action="fullscreen"]') as HTMLButtonElement;
const dashBtn = root.querySelector('[data-action="dash"]') as HTMLButtonElement;
const buildBtn = root.querySelector('[data-action="build"]') as HTMLButtonElement;

const joystick = nipplejs.create({
  zone: joystickZone,
  mode: 'static',
  position: { left: '50%', top: '50%' },
  color: 'white',
  size: 120,
  restOpacity: 0.35,
  fadeTime: 120,
  lockX: false,
  lockY: false,
  dynamicPage: true,
});

function setTouchMove(x = 0, y = 0) {
  if (!R.game) return;
  R.game.touchMove = { x, y };
  (window as any).__CB_TOUCHMOVE = { x, y };
}

function setJoystickFromPoint(clientX: number, clientY: number) {
  const rect = joystickShell.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const maxR = rect.width * 0.33;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(maxR, len);
  setTouchMove(dx / len * (clamped / maxR), dy / len * (clamped / maxR));
}

function clearActionKey(code: string) {
  if (R.game?.keys) R.game.keys[code] = false;
}

function pulseAction(code: string, fn: () => void) {
  if (R.game?.keys) R.game.keys[code] = true;
  fn();
  setTimeout(() => clearActionKey(code), 80);
}

function visible() {
  return !!(R.ui.isMobileLandscape && R.state === 'playing');
}

function isTouchMobile() {
  const ua = navigator.userAgent || '';
  return navigator.maxTouchPoints > 0 || /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function shouldShowRotateOverlay() {
  return isTouchMobile() && window.innerHeight > window.innerWidth;
}

joystick.on('move', (_evt: any, data: any) => {
  const vector = data?.vector;
  if (!vector) return;
  setTouchMove(vector.x || 0, vector.y || 0);
});

joystick.on('end', () => {
  setTouchMove(0, 0);
});

let pointerActive = false;

joystickShell.addEventListener('pointerdown', e => {
  if (!visible()) return;
  pointerActive = true;
  setJoystickFromPoint(e.clientX, e.clientY);
});

joystickShell.addEventListener('pointermove', e => {
  if (!pointerActive || !visible()) return;
  setJoystickFromPoint(e.clientX, e.clientY);
});

const endPointer = () => {
  pointerActive = false;
  setTouchMove(0, 0);
};

joystickShell.addEventListener('pointerup', endPointer);
joystickShell.addEventListener('pointercancel', endPointer);
joystickShell.addEventListener('pointerleave', endPointer);

async function requestFullscreenMode() {
  const target = (document.documentElement || document.body) as any;
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen?.();
    } else if (target.requestFullscreen) {
      await target.requestFullscreen();
    } else if (target.webkitRequestFullscreen) {
      target.webkitRequestFullscreen();
    } else if (target.msRequestFullscreen) {
      target.msRequestFullscreen();
    }
  } catch {
    // Safari/iOS may reject or not support document fullscreen.
  }
  try {
    await screen.orientation?.lock?.('landscape');
  } catch {
    // Ignore unsupported orientation lock.
  }
}

rotateFullscreenBtn.addEventListener('click', () => {
  void requestFullscreenMode();
});

[fullscreenBtn, dashBtn, buildBtn].forEach(btn => {
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!visible()) return;
    const action = (e.currentTarget as HTMLElement).dataset.action;
    if (action === 'fullscreen') { void requestFullscreenMode(); return; }
    if (action === 'dash') pulseAction('Space', tryDash);
    if (action === 'build') pulseAction('KeyE', tryPlaceOutpost);
  }, { passive: false });
  btn.addEventListener('click', e => {
    e.preventDefault();
    if (!visible()) return;
    const action = (e.currentTarget as HTMLElement).dataset.action;
    if (action === 'fullscreen') { void requestFullscreenMode(); return; }
    if (action === 'dash') pulseAction('Space', tryDash);
    if (action === 'build') pulseAction('KeyE', tryPlaceOutpost);
  });
});

function syncControls() {
  const show = visible() && !shouldShowRotateOverlay();
  root.classList.toggle('is-visible', show);
  rotateOverlay.classList.toggle('is-visible', shouldShowRotateOverlay());
  if (!show) setTouchMove(0, 0);
  requestAnimationFrame(syncControls);
}

syncControls();
