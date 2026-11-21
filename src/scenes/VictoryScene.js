import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';

// Shown over the frozen Game scene after the boss falls. Space/Enter/tap plays again, Esc = title.
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create({ score, baseScore, lives, bonus, highScore, isNewBest, timeMs }) {
    const { width, height } = CONFIG;
    const cx = width / 2;
    const top = Math.round(height / 2) - 110;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);

    this.add.text(cx, top, 'STAGE CLEAR!', { ...FONT, fontSize: '24px' }).setOrigin(0.5).setStroke('#0b1630', 5);
    this.add.text(cx, top + 26, `THE ${CONFIG.boss.name} IS DEFEATED`, { ...FONT, color: '#ffd166' }).setOrigin(0.5);

    // Little parade: the player ship with its flames.
    const ship = this.add.sprite(cx, top + 66, 'player-ship', 0);
    this.add.sprite(cx - 4, top + 86, 'player-thrust').setOrigin(0.5, 0).play('player-thrust');
    this.add.sprite(cx + 4, top + 86, 'player-thrust').setOrigin(0.5, 0).play({ key: 'player-thrust', startFrame: 2 });
    this.tweens.add({ targets: ship, y: top + 62, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const secs = Math.round(timeMs / 1000);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    const rows = [
      ['SCORE', baseScore],
      [`LIVES BONUS  ${lives} x ${CONFIG.boss.clearBonusPerLife}`, bonus],
      ['TOTAL', score],
      ['HI-SCORE', highScore],
      ['TIME', time],
    ];
    rows.forEach(([label, value], i) => {
      const y = top + 120 + i * 13;
      const color = label === 'TOTAL' ? '#ffffff' : label === 'HI-SCORE' ? '#ffd166' : '#8fb8d0';
      this.add.text(cx - 100, y, label, { ...FONT, color });
      this.add.text(cx + 100, y, String(value), { ...FONT, color }).setOrigin(1, 0);
    });

    if (isNewBest) {
      const best = this.add.text(cx, top + 196, 'NEW HIGH SCORE!', { ...FONT, color: '#ffd166' }).setOrigin(0.5);
      this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
    }

    const prompt = this.add.text(cx, top + 228, 'SPACE OR TAP TO PLAY AGAIN\nESC FOR TITLE', { ...FONT, align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0);

    // Short lock-out so fire held at the moment of victory doesn't skip this screen.
    this.time.delayedCall(1200, () => {
      prompt.setAlpha(1);
      this.input.keyboard.once('keydown-SPACE', () => this.again());
      this.input.keyboard.once('keydown-ENTER', () => this.again());
      this.input.keyboard.once('keydown-ESC', () => this.toTitle());
      this.input.once('pointerup', () => this.again());
    });
  }

  again() {
    this.scene.stop('Hud');
    this.scene.start('Game');
  }

  toTitle() {
    this.scene.stop('Hud');
    this.scene.stop('Game');
    this.scene.start('Title');
  }
}
