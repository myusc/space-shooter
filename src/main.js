import Phaser from 'phaser';
import { CONFIG, computeZoom } from './config.js';
import { sound } from './systems/Sound.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { GameScene } from './scenes/GameScene.js';
import { HudScene } from './scenes/HudScene.js';
import { PauseScene } from './scenes/PauseScene.js';
import { GameOverScene } from './scenes/GameOverScene.js';
import { VictoryScene } from './scenes/VictoryScene.js';
import { SlotScene } from './scenes/SlotScene.js';
import { GalleryScene } from './scenes/GalleryScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width,
  height: CONFIG.height,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  physics: { default: 'arcade', arcade: { debug: false } },
  input: {
    activePointers: 3,
    // Listen for the mouse on the whole page, not just the canvas, so a drag keeps working when the
    // cursor crosses into the black bars beside the game. #game fills the window, so it also sees
    // every button release; Phaser's extra window listeners would double-report clicks, so they're off.
    mouse: { target: document.getElementById('game') },
    windowEvents: false,
  },
  scale: { mode: Phaser.Scale.NONE, zoom: computeZoom() },
  // Order here is draw order: overlays (Hud, Slot, Pause, GameOver, Victory) come after Game.
  scene: [BootScene, TitleScene, GameScene, HudScene, SlotScene, PauseScene, GameOverScene, VictoryScene, GalleryScene],
});

window.addEventListener('resize', () => game.scale.setZoom(computeZoom()));

// Handy for debugging in the browser console during development.
if (import.meta.env.DEV) {
  window.__GAME__ = game;
  window.__SOUND__ = sound;
}
