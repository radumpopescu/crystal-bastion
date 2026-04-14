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
    <div class="rotate-copy">Crystal Bastion is designed for landscape on mobile. Rotate your phone or tablet to continue.</div>
  </div>
`;
document.body.appendChild(rotateOverlay);

const joystickShell = root.querySelector('.mc-joystick-shell') as HTMLDivElement;
const joystickZone = root.querySelector('#mobile-joystick-zone') as HTMLDivElement;
const dashBtn = root.querySelector('[data-action="dash"]') as HTMLButtonElement;
const buildBtn = root.querySelector('[data-action="build"]') as HTMLButtonElement;

const joystick = nipplejs.create({
  zone: joystickZone,
  mode: 'dynamic',
  color: 'white',
  size: 120,
  restOpacity: 0.35,
  fadeTime: 120,
  dynamicPage: true,
});

let dragOriginX = 0;
let dragOriginY = 0;

function setTouchMove(x = 0, y = 0) {
  if (!R.game) return;
  R.game.touchMove = { x, y };
  (window as any).__CB_TOUCHMOVE = { x, y };
}

function setTouchMoveFromScreenVector(screenX = 0, screenY = 0) {
  const isoX = screenX + screenY;
  const isoY = screenY - screenX;
  const len = Math.hypot(isoX, isoY);
  if (len <= 0.0001) {
    setTouchMove(0, 0);
    return;
  }
  setTouchMove(isoX / len, isoY / len);
}

function setDragOrigin(clientX: number, clientY: number) {
  dragOriginX = clientX;
  dragOriginY = clientY;
}

function setJoystickFromPoint(clientX: number, clientY: number) {
  const dx = clientX - dragOriginX;
  const dy = clientY - dragOriginY;
  const maxR = 60;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(maxR, len);
  const magnitude = clamped / maxR;
  setTouchMoveFromScreenVector((dx / len) * magnitude, (dy / len) * magnitude);
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

joystick.on('start', (evt: any, data: any) => {
  const pos = data?.position || evt?.changedTouches?.[0] || evt;
  if (pos?.x != null && pos?.y != null) setDragOrigin(pos.x, pos.y);
  else if (pos?.clientX != null && pos?.clientY != null) setDragOrigin(pos.clientX, pos.clientY);
});

joystick.on('move', (_evt: any, data: any) => {
  const vector = data?.vector;
  if (!vector) return;
  setTouchMoveFromScreenVector(vector.x || 0, vector.y || 0);
});

joystick.on('end', () => {
  setTouchMove(0, 0);
});

let pointerActive = false;

joystickShell.addEventListener('pointerdown', e => {
  if (!visible()) return;
  pointerActive = true;
  setDragOrigin(e.clientX, e.clientY);
  setTouchMove(0, 0);
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

[dashBtn, buildBtn].forEach(btn => {
  btn.addEventListener('touchstart', e => {
    e.preventDefault();
    if (!visible()) return;
    const action = (e.currentTarget as HTMLElement).dataset.action;
    if (action === 'dash') pulseAction('Space', tryDash);
    if (action === 'build') pulseAction('KeyE', tryPlaceOutpost);
  }, { passive: false });

  btn.addEventListener('click', e => {
    e.preventDefault();
    if (!visible()) return;
    const action = (e.currentTarget as HTMLElement).dataset.action;
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
