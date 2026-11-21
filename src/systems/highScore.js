import { CONFIG } from '../config.js';

// localStorage can be missing or throw (private mode, blocked storage), so the game must still run.
export function loadHighScore() {
  try {
    const n = parseInt(window.localStorage.getItem(CONFIG.highScoreKey), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveHighScore(score) {
  try {
    window.localStorage.setItem(CONFIG.highScoreKey, String(score));
  } catch {
    // ignore: high score just won't persist
  }
}
