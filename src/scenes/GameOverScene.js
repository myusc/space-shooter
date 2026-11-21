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
    const top = Math.round(height / 2) - 100; // block is ~200 px tall, centred
    this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0);

    // Same style as the Stage Clear page: 12 px bold, placed on whole pixels so thin strokes stay crisp.
    const BIG = { ...FONT, fontSize: '12px', fontStyle: 'bold' };
    const put = (x, y, str, style, ox = 0.5, oy = 0.5) => {
      const t = this.add.text(0, 0, str, style);
      t.setPosition(Math.round(x - t.width * ox), Math.round(y - t.height * oy));
      return t;
    };

    this.add.text(cx, top, 'GAME OVER', { ...FONT, fontSize: '24px' }).setOrigin(0.5).setStroke('#3a0b16', 5);
    if (killedBy) put(cx, top + 28, killedBy, { ...BIG, color: '#ff4d6d' });

    const rows = [
      ['SCORE', score, '#ffffff'],
      ['HI-SCORE', highScore, '#ffd166'],
      ['REACHED WAVE', wave, '#8fb8d0'],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = top + 62 + i * 19;
      put(cx - 128, y, label, { ...BIG, color }, 0);
      put(cx + 128, y, String(value), { ...BIG, color }, 1);
    });

    if (isNewBest) {
      const best = put(cx, top + 136, 'NEW HIGH SCORE!', { ...BIG, color: '#ffd166' });
      this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    }

    const prompt = put(cx, top + 178, 'SPACE OR TAP TO RETRY\nESC FOR TITLE', { ...BIG, align: 'center' }).setAlpha(0);

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
