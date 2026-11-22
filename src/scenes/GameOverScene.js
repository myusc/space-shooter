import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';
import { addToLeaderboard } from '../systems/highScore.js';
import { askName } from '../systems/nameEntry.js';

// Shown over the frozen Game scene. A top-3 score asks for a name first.
// Then Space/Enter/tap retries, Esc goes back to the title.
export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create({ score, highScore, isNewBest, rank, wave, killedBy }) {
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

    // Top 3: ask for a name first; the retry controls unlock once it is saved.
    const promptY = rank ? top + 206 : top + 178;
    const prompt = put(cx, promptY, 'SPACE OR TAP TO RETRY\nESC FOR TITLE', { ...BIG, align: 'center' }).setAlpha(0);
    const unlock = (delay) => this.time.delayedCall(delay, () => {
      prompt.setAlpha(1);
      this.input.keyboard.once('keydown-SPACE', () => this.retry());
      this.input.keyboard.once('keydown-ENTER', () => this.retry());
      this.input.keyboard.once('keydown-ESC', () => this.toTitle());
      this.input.once('pointerup', () => this.retry());
    });

    if (rank) {
      const msg = isNewBest ? 'NEW HIGH SCORE! ENTER NAME' : `TOP 3 SCORE (#${rank})! ENTER NAME`;
      const best = put(cx, top + 136, msg, { ...BIG, color: '#ffd166' });
      this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
      // Wait a moment so fire held at the moment of death doesn't type into the box.
      this.time.delayedCall(800, () => askName(this, cx, top + 164, (name) => {
        const place = addToLeaderboard(name, score).findIndex((e) => e.name === name && e.score === score) + 1;
        this.tweens.killTweensOf(best);
        best.destroy();
        put(cx, top + 150, `#${place || rank}  ${name}  SAVED`, { ...BIG, color: '#9be7a8' });
        unlock(400); // so the Enter that saved the name doesn't also retry
      }));
    } else {
      if (isNewBest) {
        const best = put(cx, top + 136, 'NEW HIGH SCORE!', { ...BIG, color: '#ffd166' });
        this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
      }
      // Short lock-out so fire held at the moment of death doesn't skip this screen.
      unlock(800);
    }
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
