import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';

// Overlay shown while the game scene is paused. P, Esc, or a tap resumes.
export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create() {
    const { width, height } = CONFIG;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);
    this.add.text(width / 2, height / 2 - 10, 'PAUSED', { ...FONT, fontSize: '16px' }).setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 12, 'P / ESC / TAP TO RESUME', { ...FONT, color: '#8fb8d0' })
      .setOrigin(0.5);

    const resume = () => {
      this.scene.resume('Game');
      this.scene.stop();
    };
    // Short delay so the same tap/keypress that paused doesn't instantly resume.
    this.time.delayedCall(150, () => {
      this.input.keyboard.once('keydown-P', resume);
      this.input.keyboard.once('keydown-ESC', resume);
      this.input.once('pointerup', resume);
    });
  }
}
