import Phaser from 'phaser';
import { CONFIG, SHEETS, REQUIRED_ASSETS, GEMS, FONT } from '../config.js';
import { sound } from '../systems/Sound.js';

// Loads every asset from public/assets, builds animations, then starts the game.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const { width, height } = CONFIG;
    this.status = this.add.text(width / 2, height / 2, 'LOADING', FONT).setOrigin(0.5);
    this.failed = [];

    this.load.setPath('assets/');
    REQUIRED_ASSETS.forEach((key) => {
      const sheet = SHEETS[key];
      if (sheet) this.load.spritesheet(key, `${key}.png`, { frameWidth: sheet[0], frameHeight: sheet[1] });
      else this.load.image(key, `${key}.png`);
    });

    this.load.on('progress', (p) => this.status.setText(`LOADING ${Math.round(p * 100)}%`));
    this.load.on('loaderror', (file) => this.failed.push(file.key));
  }

  create() {
    // A file can 404 (loaderror) or download but fail to decode (no texture), so check both.
    const missing = REQUIRED_ASSETS.filter((key) => this.failed.includes(key) || !this.textures.exists(key));
    if (missing.length) {
      const message = 'Missing assets:\n' + missing.join('\n');
      console.error(message);
      this.status.setText('ASSET ERROR\n' + message).setColor('#ff6b6b').setAlign('center');
      return;
    }
    this.createAnimations();
    this.createBackgroundTile();
    sound.init(this.game);
    this.scene.start('Title');
  }

  // stage-back is 256x320, smaller than the screen. Four copies mirrored across both axes make a
  // 512x640 tile whose edges all match, so it repeats seamlessly in any direction.
  createBackgroundTile() {
    const src = this.textures.get('stage-back').getSourceImage();
    const w = src.width;
    const h = src.height;
    const tex = this.textures.createCanvas('stage-back-tile', w * 2, h * 2);
    const ctx = tex.getContext();
    ctx.imageSmoothingEnabled = false;
    [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([fx, fy]) => {
      ctx.save();
      ctx.translate(fx < 0 ? w * 2 : 0, fy < 0 ? h * 2 : 0);
      ctx.scale(fx, fy);
      ctx.drawImage(src, 0, 0);
      ctx.restore();
    });
    tex.refresh();
  }

  createAnimations() {
    const a = this.anims;
    const frames = (key, cfg) => a.generateFrameNumbers(key, cfg);

    // Gameplay animations
    a.create({ key: 'player-thrust', frames: frames('player-thrust'), frameRate: 14, repeat: -1 });
    a.create({ key: 'shot-bolt', frames: frames('shot-bolt'), frameRate: 14, repeat: -1 });
    a.create({ key: 'hit', frames: frames('hit'), frameRate: 20, repeat: 0 });
    a.create({ key: 'enemy-01-fly', frames: frames('enemy-01'), frameRate: 10, repeat: -1 });
    a.create({ key: 'enemy-02-fly', frames: frames('enemy-02'), frameRate: 8, repeat: -1 });
    a.create({ key: 'enemy-03-fly', frames: frames('enemy-03'), frameRate: 8, repeat: -1 });
    a.create({ key: 'enemy-bolt', frames: frames('boss-bolt'), frameRate: 10, repeat: -1 });
    a.create({ key: 'enemy-explosion', frames: frames('enemy-explosion'), frameRate: 16, repeat: 0 });
    a.create({ key: 'explosion-big', frames: frames('explosion-big'), frameRate: 18, repeat: 0 });
    a.create({ key: 'shot-pulse', frames: frames('shot-pulse'), frameRate: 14, repeat: -1 });
    a.create({ key: 'shot-charged', frames: frames('shot-charged'), frameRate: 14, repeat: -1 });
    // Boss: armour opening (closed -> core exposed), engine flames, ray charge-up then beam.
    a.create({ key: 'boss-open', frames: frames('boss'), frameRate: 5, repeat: 0 });
    a.create({ key: 'boss-thrust', frames: frames('boss-thrust'), frameRate: 10, repeat: -1 });
    a.create({ key: 'boss-ray-charge', frames: frames('boss-rays', { start: 0, end: 7 }), frameRate: 8, repeat: -1 });
    a.create({ key: 'boss-ray-beam', frames: frames('boss-rays', { start: 8, end: 10 }), frameRate: 14, repeat: -1 });

    // "<sheet>:all" loops every frame of every sheet - used by the art gallery.
    const slow = { 'player-ship': 4, 'ship-yellow-01': 4, 'ship-yellow-02': 4, 'ship-yellow-03': 4, 'ship-yellow-04': 4, 'boss': 4, 'boss-rays': 10 };
    Object.keys(SHEETS).forEach((key) => {
      if (key === 'gems') return;
      a.create({
        key: key + ':all',
        frames: frames(key),
        frameRate: slow[key] || 12,
        repeat: -1,
        repeatDelay: key.includes('explosion') || key === 'hit' ? 300 : 0,
        yoyo: key === 'boss',
      });
    });

    GEMS.forEach((gem) => {
      a.create({ key: 'gem-' + gem.name, frames: frames('gems', { frames: gem.frames }), frameRate: 10, repeat: -1 });
    });
  }
}
