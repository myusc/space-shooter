import Phaser from 'phaser';
import { CONFIG } from '../config.js';

// Scrolling stage background plus parallax planets and asteroids. Shared by Title and Game.
export class Starfield {
  constructor(scene) {
    const { width, height, props } = CONFIG;
    this.scene = scene;
    // Mirrored 512x640 tile built in BootScene from stage-back: seamless both ways, centred horizontally.
    this.bg = scene.add.tileSprite(0, 0, width, height, 'stage-back-tile').setOrigin(0).setDepth(0);
    this.bg.tilePositionX = (512 - width) / 2;

    this.props = [];
    for (let i = 0; i < props.far.count; i++) {
      this.props.push(this.resetProp(scene.add.image(0, 0, props.far.keys[0]).setDepth(1), 'far', true));
    }
    for (let i = 0; i < props.near.count; i++) {
      this.props.push(this.resetProp(scene.add.image(0, 0, props.near.keys[0]).setDepth(2), 'near', true));
    }
  }

  resetProp(prop, layer, initial) {
    const { width, height, props } = CONFIG;
    const L = props[layer];
    prop.layer = layer;
    prop.setTexture(Phaser.Utils.Array.GetRandom(L.keys));
    prop.speed = layer === 'far' ? L.speed : Phaser.Math.Between(L.minSpeed, L.maxSpeed);
    prop.setFlipX(Math.random() < 0.5);
    prop.x = Phaser.Math.Between(16, width - 16);
    prop.y = initial
      ? Phaser.Math.Between(-height, height - 40)
      : -prop.height / 2 - Phaser.Math.Between(0, layer === 'far' ? 240 : 120);
    return prop;
  }

  update(dt) {
    const h = CONFIG.height;
    // Track the exact scroll, draw it on whole pixels so the pixel art doesn't shimmer.
    this.scrollY = (this.scrollY || 0) - CONFIG.bgScrollSpeed * dt;
    this.bg.tilePositionY = Math.round(this.scrollY);
    for (const prop of this.props) {
      prop.y += prop.speed * dt;
      if (prop.y - prop.height / 2 > h) this.resetProp(prop, prop.layer, false);
    }
  }
}
