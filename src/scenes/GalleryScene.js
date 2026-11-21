import Phaser from 'phaser';
import { CONFIG, SHEETS, REQUIRED_ASSETS, GEMS, FONT } from '../config.js';

// Art gallery (G or the ART button): every asset from the spec, animated, so each sheet is
// verified to load with the right frame size. Scroll with arrows, mouse wheel, or drag.
export class GalleryScene extends Phaser.Scene {
  constructor() {
    super('Gallery');
  }

  // returnTo: the sleeping scenes to wake when the gallery closes.
  init(data) {
    this.returnTo = (data && data.returnTo) || ['Title'];
  }

  create() {
    const { width, height } = CONFIG;
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0e1a');

    const label = (x, y, text) => this.add.text(x, y, text, { ...FONT, color: '#8fb8d0' });
    const pad = 6;
    let x = pad;
    let y = 26;
    let rowH = 0;

    const place = (w, h, draw) => {
      if (x + w > width - pad && x > pad) {
        x = pad;
        y += rowH + 14;
        rowH = 0;
      }
      // Anything wider than the screen gets its own centred row.
      const left = w >= width - 2 * pad ? Math.round((width - w) / 2) : x;
      draw(left, y);
      x = left + w + pad;
      rowH = Math.max(rowH, h);
    };

    REQUIRED_ASSETS.forEach((key) => {
      if (key === 'gems') return;
      const frame = this.textures.getFrame(key, SHEETS[key] ? 0 : undefined);
      const name = key.replace(/^(prop|boss|ship)-/, '');
      const txt = label(0, 0, name);
      const w = Math.max(frame.width, Math.ceil(txt.width));
      place(w, frame.height, (lx, ly) => {
        const spr = this.add.sprite(lx + w / 2, ly + frame.height / 2, key, SHEETS[key] ? 0 : undefined);
        if (SHEETS[key]) spr.play(key + ':all');
        txt.setPosition(lx, ly + frame.height + 1);
      });
    });

    // Gems: one animated gem per colour (power-up candidates for M3).
    const gemsTxt = label(0, 0, 'gems');
    place(GEMS.length * 18, 16, (lx, ly) => {
      GEMS.forEach((gem, i) => this.add.sprite(lx + 8 + i * 18, ly + 8, 'gems').play('gem-' + gem.name));
      gemsTxt.setPosition(lx, ly + 17);
    });

    this.contentHeight = y + rowH + 24;

    // Fixed header
    this.add.rectangle(0, 0, width, 20, 0x0b1630, 0.95).setOrigin(0).setScrollFactor(0).setDepth(10);
    this.add
      .text(4, 6, `ART GALLERY  ${REQUIRED_ASSETS.length}/${REQUIRED_ASSETS.length} ASSETS`, FONT)
      .setScrollFactor(0)
      .setDepth(11);
    const back = this.add
      .rectangle(width - 22, 10, 38, 14, 0x0b1630)
      .setStrokeStyle(1, 0x5fd3ff)
      .setScrollFactor(0)
      .setDepth(11)
      .setInteractive({ useHandCursor: true });
    this.add.text(width - 22, 10, 'BACK', FONT).setOrigin(0.5).setScrollFactor(0).setDepth(12);
    back.on('pointerup', () => this.close());

    this.maxScroll = Math.max(0, this.contentHeight - height);
    this.keys = this.input.keyboard.addKeys('UP,DOWN,W,S,G,ESC');
    this.input.keyboard.once('keydown-G', () => this.close());
    this.input.keyboard.once('keydown-ESC', () => this.close());
    this.input.on('wheel', (p, over, dx, dy) => this.scrollBy(dy * 0.5));
    this.input.on('pointermove', (p) => {
      if (p.isDown) this.scrollBy(-(p.y - p.prevPosition.y));
    });
  }

  scrollBy(dy) {
    const cam = this.cameras.main;
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, this.maxScroll);
  }

  update(time, delta) {
    const K = this.keys;
    const dir = (K.DOWN.isDown || K.S.isDown ? 1 : 0) - (K.UP.isDown || K.W.isDown ? 1 : 0);
    if (dir) this.scrollBy(dir * 200 * (delta / 1000));
  }

  close() {
    this.scene.stop();
    this.returnTo.forEach((key) => this.scene.wake(key));
  }
}
