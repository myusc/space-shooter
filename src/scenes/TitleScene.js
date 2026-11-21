import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';
import { Starfield } from '../systems/Starfield.js';
import { loadHighScore } from '../systems/highScore.js';
import { sound } from '../systems/Sound.js';

// Title screen: scrolling background, enemy score table, high score. Space, Enter or a tap starts.
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('Title');
  }

  create() {
    const { width, height } = CONFIG;
    const cx = width / 2;
    this.starfield = new Starfield(this);

    this.add.text(cx, 64, "KOALA'S RETRO\nSPACE SHOOTER", { ...FONT, fontSize: '24px', align: 'center' })
      .setOrigin(0.5)
      .setStroke('#0b1630', 5)
      .setDepth(10);

    const ship = this.add.sprite(cx, 148, 'player-ship', 0).setDepth(10);
    this.add.sprite(cx - 4, 168, 'player-thrust').setOrigin(0.5, 0).setDepth(9).play('player-thrust');
    this.add.sprite(cx + 4, 168, 'player-thrust').setOrigin(0.5, 0).setDepth(9).play({ key: 'player-thrust', startFrame: 2 });
    this.tweens.add({ targets: ship, y: 144, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Score table
    const rows = ['grunt', 'weaver', 'gunship'].map((type) => CONFIG.enemies[type]);
    rows.forEach(({ key, anim, name, points }, i) => {
      const y = 226 + i * 46;
      this.add.sprite(cx - 76, y, key).play(anim).setDepth(10);
      this.add.text(cx - 44, y, `${name.padEnd(11)} ${String(points).padStart(4)} PTS`, FONT).setOrigin(0, 0.5).setDepth(10);
    });

    // Power-up legend: the gem colours and what they do.
    const kinds = CONFIG.powerups.kinds;
    ['weapon', 'shield', 'life'].forEach((k, i) => {
      const x = 52 + i * 96;
      this.add.sprite(x, 352, 'gems').play('gem-' + kinds[k].gem).setDepth(10);
      this.add.text(x + 12, 352, kinds[k].label, FONT).setOrigin(0, 0.5).setDepth(10);
    });

    this.add.text(cx, 380, 'HI-SCORE ' + loadHighScore(), { ...FONT, color: '#ffd166' }).setOrigin(0.5).setDepth(10);

    const prompt = this.add.text(cx, 402, 'PRESS SPACE OR TAP TO START', FONT).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    this.add.text(cx, height - 36, 'MOVE ARROWS/WASD   FIRE SPACE/Z/J\nOR HOLD MOUSE TO FIRE, DRAG TO MOVE\nPAUSE P   MUTE M   ART GALLERY G', {
      ...FONT, color: '#8fb8d0', align: 'center',
    }).setOrigin(0.5).setDepth(10);

    const button = (x, w, label, onClick) => {
      const bg = this.add.rectangle(x, 9, w, 14, 0x0b1630, 0.75).setStrokeStyle(1, 0x5fd3ff).setDepth(10);
      const text = this.add.text(x, 9, label, FONT).setOrigin(0.5).setDepth(11);
      bg.setInteractive({ useHandCursor: true }).on('pointerup', (p, lx, ly, e) => {
        e.stopPropagation();
        onClick();
      });
      return text;
    };
    button(width - 17, 26, 'ART', () => this.openGallery());
    this.muteLabel = button(width - 48, 26, sound.muted ? 'OFF' : 'SND', () => this.toggleMute());

    const start = () => this.scene.start('Game');
    this.input.keyboard.on('keydown-SPACE', start);
    this.input.keyboard.on('keydown-ENTER', start);
    this.input.keyboard.on('keydown-G', () => this.openGallery());
    this.input.keyboard.on('keydown-M', () => this.toggleMute());
    sound.stopMusic();
    this.input.on('pointerup', (p, over) => {
      if (!over.length) start();
    });

    const reset = () => this.input.keyboard.resetKeys();
    this.events.on('wake', reset);
    this.events.once('shutdown', () => this.events.off('wake', reset));
  }

  toggleMute() {
    this.muteLabel.setText(sound.toggleMute() ? 'OFF' : 'SND');
  }

  openGallery() {
    this.scene.sleep();
    this.scene.launch('Gallery', { returnTo: ['Title'] });
  }

  update(time, delta) {
    this.starfield.update(delta / 1000);
  }
}
