import Phaser from 'phaser';
import { CONFIG } from '../config.js';

// Scrolling stage background plus parallax planets and asteroids. Shared by Title and Game.
// With { hazards: true } (the Game scene) the asteroids are drawn in the play layer and start in
// the top half, away from the player's ship; GameScene checks them against the ship.
export class Starfield {
  constructor(scene, { hazards = false } = {}) {
    const { width, height, props } = CONFIG;
    this.scene = scene;
    this.hazards = hazards;
    // Mirrored 512x640 tile built in BootScene from stage-back: seamless both ways, centred horizontally.
    this.bg = scene.add.tileSprite(0, 0, width, height, 'stage-back-tile').setOrigin(0).setDepth(0);
    this.bg.tilePositionX = (512 - width) / 2;

    this.props = [];
    for (let i = 0; i < props.far.count; i++) {
      this.props.push(this.resetProp(scene.add.image(0, 0, props.far.keys[0]).setDepth(1), 'far', true));
    }
    this.rocks = [];
    for (let i = 0; i < props.near.count; i++) {
      const rock = this.resetProp(scene.add.image(0, 0, props.near.keys[0]).setDepth(hazards ? 5 : 2), 'near', true);
      this.props.push(rock);
      this.rocks.push(rock);
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
    const lowest = this.hazards && layer === 'near' ? height / 2 : height - 40;
    prop.y = initial
      ? Phaser.Math.Between(-height, lowest)
      : -prop.height / 2 - Phaser.Math.Between(0, layer === 'far' ? 240 : 120);
    prop.hitR = Math.min(prop.width, prop.height) * (L.hitScale || 0);
    if (L.hpPer) prop.hp = Math.ceil(Math.min(prop.width, prop.height) / L.hpPer);
    prop.clearTint();
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
