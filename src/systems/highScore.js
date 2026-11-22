import { CONFIG } from '../config.js';

// High score and the top-3 leaderboard, kept in localStorage.
// localStorage can be missing or throw (private mode, blocked storage), so the game must still run.

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore: scores just won't persist
  }
}

export function loadHighScore() {
  const n = parseInt(read(CONFIG.highScoreKey), 10);
  const best = Number.isFinite(n) && n > 0 ? n : 0;
  const top = loadLeaderboard()[0];
  return Math.max(best, top ? top.score : 0);
}

export function saveHighScore(score) {
  write(CONFIG.highScoreKey, String(score));
}

// The leaderboard is monthly: it is stored as { month: 'YYYY-MM', entries: [...] } and starts over
// empty on the 1st of each month (local time). The all-time HI score is kept separately.
export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// [{ name, score }] for this month, best first, at most CONFIG.leaderboardSize entries.
export function loadLeaderboard() {
  let list = [];
  try {
    let parsed = JSON.parse(read(CONFIG.leaderboardKey) || '[]');
    // An older save was a bare list with no month: count it as this month's.
    if (!Array.isArray(parsed)) parsed = parsed && parsed.month === currentMonth() ? parsed.entries : [];
    if (Array.isArray(parsed)) {
      list = parsed
        .filter((e) => e && typeof e.name === 'string' && Number.isFinite(e.score) && e.score > 0)
        .map((e) => ({ name: cleanName(e.name) || 'PILOT', score: Math.floor(e.score) }));
    }
  } catch {
    list = [];
  }
  return list.sort((a, b) => b.score - a.score).slice(0, CONFIG.leaderboardSize);
}

// The place (1-3) this score would take on the leaderboard, or 0 if it doesn't make it.
export function leaderboardRank(score) {
  if (!(score > 0)) return 0;
  const list = loadLeaderboard();
  const i = list.findIndex((e) => score > e.score);
  if (i >= 0) return i + 1;
  return list.length < CONFIG.leaderboardSize ? list.length + 1 : 0;
}

// Adds a name to the leaderboard and returns the new list.
export function addToLeaderboard(name, score) {
  const list = loadLeaderboard();
  list.push({ name: cleanName(name) || 'PILOT', score });
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, CONFIG.leaderboardSize);
  write(CONFIG.leaderboardKey, JSON.stringify({ month: currentMonth(), entries: top }));
  return top;
}

// Upper-case letters, digits, spaces and a few symbols the pixel font draws, trimmed to the max length.
export function cleanName(name) {
  return String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9 .\-_!']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CONFIG.nameMaxLength);
}
