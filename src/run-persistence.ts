import { R } from './state';

const RUN_SAVE_KEY = 'towerRun3d';
const RUN_SAVE_VERSION = 1;

let lastSavedPayload = '';

function cloneForStorage<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildRunSnapshot() {
  const game = R.game;
  if (!game || game.devSession) return null;
  if (!['playing', 'paused', 'levelup'].includes(R.state)) return null;
  if (game.waveActive) return null;

  const safeGame = cloneForStorage({
    ...game,
    keys: {},
    touchMove: { x: 0, y: 0 },
  });

  return {
    version: RUN_SAVE_VERSION,
    state: R.state,
    game: safeGame,
  };
}

export function clearSavedRun() {
  lastSavedPayload = '';
  localStorage.removeItem(RUN_SAVE_KEY);
}

export function syncSavedRun() {
  const snapshot = buildRunSnapshot();
  if (!snapshot) {
    if (localStorage.getItem(RUN_SAVE_KEY)) clearSavedRun();
    return;
  }
  const payload = JSON.stringify(snapshot);
  if (payload === lastSavedPayload) return;
  lastSavedPayload = payload;
  localStorage.setItem(RUN_SAVE_KEY, payload);
}

export function restoreSavedRun() {
  try {
    const raw = localStorage.getItem(RUN_SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== RUN_SAVE_VERSION || !parsed.game || !parsed.state) return false;
    R.game = parsed.game;
    R.state = parsed.state;
    R.prevState = 'menu';
    if (!R.game.keys) R.game.keys = {};
    if (!R.game.touchMove) R.game.touchMove = { x: 0, y: 0 };
    lastSavedPayload = raw;
    return true;
  } catch {
    clearSavedRun();
    return false;
  }
}
