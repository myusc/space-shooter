import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';
import { addToLeaderboard } from '../systems/highScore.js';
import { askName } from '../systems/nameEntry.js';

// Shown over the frozen Game scene after the boss falls. Space/Enter/tap plays again, Esc = title.
export class VictoryScene extends Phaser.Scene {
  constructor() {
    super('Victory');
  }

  create({ score, baseScore, lives, bonus, highScore, isNewBest, rank, timeMs }) {
    const { width, height } = CONFIG;
    const cx = width / 2;
    const top = Math.round(height / 2) - 130;
    this.add.rectangle(0, 0, width, height, 0x000000, 0.6).setOrigin(0);

    // 12 px bold text, placed on whole pixels (bold + whole pixels keep thin strokes crisp at 320x480).
    const BIG = { ...FONT, fontSize: '12px', fontStyle: 'bold' };
    const put = (x, y, str, style, ox = 0.5, oy = 0.5) => {
      const t = this.add.text(0, 0, str, style);
      t.setPosition(Math.round(x - t.width * ox), Math.round(y - t.height * oy));
      return t;
    };

    this.add.text(cx, top, 'STAGE CLEAR!', { ...FONT, fontSize: '24px' }).setOrigin(0.5).setStroke('#0b1630', 5);
    put(cx, top + 28, `THE ${CONFIG.boss.name} IS DEFEATED`, { ...BIG, color: '#ffd166' });

    // Little parade: the player ship with its flames.
    const ship = this.add.sprite(cx, top + 70, 'player-ship', 0);
    this.add.sprite(cx - 4, top + 90, 'player-thrust').setOrigin(0.5, 0).play('player-thrust');
    this.add.sprite(cx + 4, top + 90, 'player-thrust').setOrigin(0.5, 0).play({ key: 'player-thrust', startFrame: 2 });
    this.tweens.add({ targets: ship, y: top + 66, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

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
      const y = top + 128 + i * 19;
      const color = label === 'TOTAL' ? '#ffffff' : label === 'HI-SCORE' ? '#ffd166' : '#8fb8d0';
      put(cx - 128, y, label, { ...BIG, color }, 0);
      put(cx + 128, y, String(value), { ...BIG, color }, 1);
    });

    // Top 3: ask for a name first; the play-again controls unlock once it is saved.
    const promptY = rank ? top + 286 : top + 274;
    const prompt = put(cx, promptY, 'SPACE OR TAP TO PLAY AGAIN\nESC FOR TITLE', { ...BIG, align: 'center' }).setAlpha(0);
    const unlock = (delay) => this.time.delayedCall(delay, () => {
      prompt.setAlpha(1);
      this.input.keyboard.once('keydown-SPACE', () => this.again());
      this.input.keyboard.once('keydown-ENTER', () => this.again());
      this.input.keyboard.once('keydown-ESC', () => this.toTitle());
      this.input.once('pointerup', () => this.again());
    });

    if (rank) {
      const msg = isNewBest ? 'NEW HIGH SCORE! ENTER NAME' : `TOP 3 SCORE (#${rank})! ENTER NAME`;
      const best = put(cx, top + 228, msg, { ...BIG, color: '#ffd166' });
      this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
      // Wait a moment so fire held at the moment of victory doesn't type into the box.
      this.time.delayedCall(1200, () => askName(this, cx, top + 254, (name) => {
        const place = addToLeaderboard(name, score).findIndex((e) => e.name === name && e.score === score) + 1;
        this.tweens.killTweensOf(best);
        best.destroy();
        put(cx, top + 240, `#${place || rank}  ${name}  SAVED`, { ...BIG, color: '#9be7a8' });
        unlock(400); // so the Enter that saved the name doesn't also start a new game
      }));
    } else {
      if (isNewBest) {
        const best = put(cx, top + 232, 'NEW HIGH SCORE!', { ...BIG, color: '#ffd166' });
        this.tweens.add({ targets: best, alpha: 0.2, duration: 300, yoyo: true, repeat: -1 });
      }
      // Short lock-out so fire held at the moment of victory doesn't skip this screen.
      unlock(1200);
    }
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
