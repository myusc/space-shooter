import { CONFIG } from '../config.js';
import { cleanName } from './highScore.js';

// A real HTML text box laid over the canvas, so phones open their on-screen keyboard.
// (x, y) is the box centre in game pixels. Enter or the OK button calls onDone(name) once.
// The box is removed when the scene shuts down.
export function askName(scene, x, y, onDone) {
  const kb = scene.input.keyboard;
  // Phaser blocks the default action of its game keys (Space, WASD, Z, J...), which would stop
  // those letters from being typed. Let them through while the box is open.
  kb.disableGlobalCapture();

  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:fixed;display:flex;gap:4px;align-items:stretch;z-index:10;transform:translate(-50%,-50%)';
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = CONFIG.nameMaxLength;
  input.placeholder = 'YOUR NAME';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('autocapitalize', 'characters');
  input.setAttribute('aria-label', 'Your name for the top 3');
  const ok = document.createElement('button');
  ok.type = 'button';
  ok.textContent = 'OK';
  wrap.append(input, ok);
  document.body.appendChild(wrap);

  const place = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    const k = r.width / CONFIG.width; // CSS px per game px
    wrap.style.left = `${r.left + x * k}px`;
    wrap.style.top = `${r.top + y * k}px`;
    const common = `font:bold ${Math.round(12 * k)}px Consolas,"Courier New",monospace;border:${Math.max(1, Math.round(k))}px solid #5fd3ff;` +
      `background:#0b1630;color:#ffd166;padding:${Math.round(2 * k)}px ${Math.round(4 * k)}px;border-radius:0;outline:none;`;
    input.style.cssText = common + `width:${Math.round(CONFIG.nameMaxLength * 8 * k)}px;text-transform:uppercase;letter-spacing:${Math.round(k / 2)}px`;
    ok.style.cssText = common + 'color:#e6f7ff;cursor:pointer';
  };
  place();
  window.addEventListener('resize', place);

  let finished = false;
  const cleanup = () => {
    window.removeEventListener('resize', place);
    wrap.remove();
    kb.enableGlobalCapture();
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    const name = cleanName(input.value) || 'PILOT';
    cleanup();
    onDone(name);
  };

  input.addEventListener('input', () => {
    const clean = input.value.toUpperCase().replace(/[^A-Z0-9 .\-_!']/g, '').slice(0, CONFIG.nameMaxLength);
    if (clean !== input.value) input.value = clean;
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // keep typing away from Phaser's window key listeners
    if (e.key === 'Enter') finish();
  });
  input.addEventListener('keyup', (e) => e.stopPropagation());
  ok.addEventListener('click', finish);
  scene.events.once('shutdown', () => {
    if (!finished) {
      finished = true;
      cleanup();
    }
  });

  setTimeout(() => input.focus(), 50);
}
