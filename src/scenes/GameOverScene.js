import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';

// Shown over the frozen Game scene. Space/Enter/tap retries, Esc goes back to the title.
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score, highScore, isNewBest, wave, killedBy }) {
    const { width, height } = CONFIG;
    const cx = width / 2;
    const top = Math.round(height / 2) - 80; // block is ~180 px tall, centred
    this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0);

    this.add.text(cx, top, 'GAME OVER', { ...FONT, fontSize: '24px' }).setOrigin(0.5).setStroke('#3a0b16', 5);
    if (killedBy) this.add.text(cx, top + 24, killedBy, { ...FONT, color: '#ff4d6d' }).setOrigin(0.5);
    this.add.text(cx, top + 46, 'SCORE ' + score, FONT).setOrigin(0.5);
    this.add.text(cx, top + 58, 'HI-SCORE ' + highScore, { ...FONT, color: '#ffd166' }).setOrigin(0.5);
    this.add.text(cx, top + 70, 'REACHED WAVE ' + wave, { ...FONT, color: '#8fb8d0' }).setOrigin(0.5);

    if (isNewBest) {
      const best = this.add.text(cx, top + 92, 'NEW HIGH SCORE!', { ...FONT, color: '#ffd166' }).setOrigin(0.5);
      this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    }

    const prompt = this.add.text(cx, top + 132, 'SPACE OR TAP TO RETRY\nESC FOR TITLE', { ...FONT, align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0);

    // Short lock-out so fire held at the moment of death doesn't skip this screen.
    this.time.delayedCall(800, () => {
      prompt.setAlpha(1);
      this.input.keyboard.once('keydown-SPACE', () => this.retry());
      this.input.keyboard.once('keydown-ENTER', () => this.retry());
      this.input.keyboard.once('keydown-ESC', () => this.toTitle());
      this.input.once('pointerup', () => this.retry());
    });
  }

  retry() {
    this.scene.stop('Hud');
    this.scene.start('Game'); // restarts the paused Game scene and stops this one
  }

  toTitle() {
    this.scene.stop('Hud');
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
