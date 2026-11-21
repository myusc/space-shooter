import Phaser from 'phaser';
import { CONFIG, FONT, GEMS } from '../config.js';
import { sound } from '../systems/Sound.js';

// Bonus slot machine shown over the paused Game scene after every cleared wave.
// Three reels of power-up gems spin on their own, stop one by one on the prize, then the prize is
// handed to GameScene.grantPowerup() and the game resumes. It always pays out.
export class SlotScene extends Phaser.Scene {
  constructor() {
    super('Slot');
  }

  // data: { wave, kind } - kind is the prize, chosen by GameScene
  create({ wave, kind }) {
    const { width, height } = CONFIG;
    const S = CONFIG.slot;
    const kinds = CONFIG.powerups.kinds;
    const cx = width / 2;
    const cy = Math.round(height / 2) - 30;
    this.kind = kind;

    // First frame of each gem colour, for the spinning reels.
    const frameOf = (k) => GEMS.find((g) => g.name === kinds[k].gem).frames[0];
    const symbols = Object.keys(kinds).map(frameOf);

    this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0);
    this.add.rectangle(cx, cy, 228, 150, 0x0b1630, 0.95).setStrokeStyle(2, 0xffd166);
    this.add.text(cx, cy - 56, `WAVE ${wave} CLEAR!`, { ...FONT, fontSize: '16px' }).setOrigin(0.5).setStroke('#000000', 3);
    this.add.text(cx, cy - 38, 'BONUS SPIN', { ...FONT, color: '#ffd166' }).setOrigin(0.5);

    // Reels: a window each, a gem scaled 2x (whole-number scaling keeps it crisp).
    this.reels = [-60, 0, 60].map((dx, i) => {
      this.add.rectangle(cx + dx, cy + 4, 48, 48, 0x050a18).setStrokeStyle(1, 0x5fd3ff);
      const gem = this.add.sprite(cx + dx, cy + 4, 'gems', Phaser.Utils.Array.GetRandom(symbols)).setScale(2);
      return { gem, y: cy + 4, spinning: true, stopAt: S.spinMs + i * S.reelGap };
    });
    // Win line across the middle of the reels.
    this.add.rectangle(cx, cy + 4, 196, 1, 0xff4d6d, 0.5);

    this.prizeText = this.add.text(cx, cy + 50, '', { ...FONT, fontSize: '12px', fontStyle: 'bold', color: '#ffd166' })
      .setOrigin(0.5)
      .setStroke('#000000', 3);

    this.elapsed = 0;
    this.tick = 0;
    this.symbols = symbols;
    this.prizeFrame = frameOf(kind);
    this.done = false;
  }

  update(time, delta) {
    if (this.done) return;
    const S = CONFIG.slot;
    this.elapsed += delta;
    this.tick += delta;
    const step = this.tick >= S.tickMs;
    if (step) this.tick = 0;

    let spinning = 0;
    this.reels.forEach((r) => {
      if (!r.spinning) return;
      if (this.elapsed >= r.stopAt) {
        // Land on the prize with a little bounce.
        r.spinning = false;
        r.gem.setFrame(this.prizeFrame).setY(r.y - 6);
        this.tweens.add({ targets: r.gem, y: r.y, duration: 140, ease: 'Back.easeOut' });
        sound.sfx('reelStop');
        return;
      }
      spinning += 1;
      if (step) {
        r.gem.setFrame(Phaser.Utils.Array.GetRandom(this.symbols));
        r.gem.y = r.y + Phaser.Math.Between(-5, 5); // motion jitter
      }
    });
    if (spinning && step) sound.sfx('reelTick');

    if (!spinning) this.payOut();
  }

  payOut() {
    this.done = true;
    const kinds = CONFIG.powerups.kinds;
    const gem = kinds[this.kind].gem;
    this.reels.forEach((r) => r.gem.play('gem-' + gem));
    sound.sfx('jackpot');
    this.prizeText.setText(kinds[this.kind].label + '!');
    this.tweens.add({ targets: this.prizeText, alpha: 0.3, duration: 120, yoyo: true, repeat: 3 });

    this.time.delayedCall(CONFIG.slot.showPrizeMs, () => {
      const game = this.scene.get('Game');
      this.scene.stop();
      this.scene.resume('Game');
      game.grantPowerup(this.kind, true);
    });
  }
}
