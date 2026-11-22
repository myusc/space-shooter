import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';
import { Starfield } from '../systems/Starfield.js';
import { loadLeaderboard } from '../systems/highScore.js';
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

    this.createLogo(cx);

    const ship = this.add.sprite(cx, 148, 'player-ship', 0).setDepth(10);
    this.add.sprite(cx - 4, 168, 'player-thrust').setOrigin(0.5, 0).setDepth(9).play('player-thrust');
    this.add.sprite(cx + 4, 168, 'player-thrust').setOrigin(0.5, 0).setDepth(9).play({ key: 'player-thrust', startFrame: 2 });
    this.tweens.add({ targets: ship, y: 144, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Score table
    const rows = ['grunt', 'weaver', 'gunship'].map((type) => CONFIG.enemies[type]);
    // 12 px bold (the rest of the small print is 8 px); sprite + text block is ~188 px wide, centred.
    // Bold keeps thin strokes (the middle bar of E) at least one full pixel at this low resolution,
    // and each row is placed on a whole pixel so it isn't blurred across two.
    rows.forEach(({ key, anim, name, points }, i) => {
      const y = 200 + i * 35;
      this.add.sprite(cx - 70, y, key).play(anim).setDepth(10);
      const label = this.add.text(cx - 38, 0, `${name.padEnd(11)} ${String(points).padStart(4)} PTS`, {
        ...FONT, fontSize: '12px', fontStyle: 'bold',
      }).setDepth(10);
      label.y = Math.round(y - label.height / 2);
    });

    // Power-up legend: the gem colours and what they do.
    const kinds = CONFIG.powerups.kinds;
    ['weapon', 'shield', 'life', 'rapid', 'wingmen', 'bomb'].forEach((k, i) => {
      const x = 52 + (i % 3) * 96;
      const y = 308 + Math.floor(i / 3) * 15;
      this.add.sprite(x, y, 'gems').play('gem-' + kinds[k].gem).setDepth(10);
      this.add.text(x + 12, y, kinds[k].label, FONT).setOrigin(0, 0.5).setDepth(10);
    });

    // Top 3 pilots (name + score), 12 px bold on whole pixels like the score table.
    // The list starts over on the 1st of each month, so the heading names the month.
    const month = new Date().toLocaleString('en-US', { month: 'long' }).toUpperCase();
    this.add.text(cx, 338, `TOP 3 PILOTS OF ${month}`, { ...FONT, color: '#8fb8d0' }).setOrigin(0.5).setDepth(10);
    const top = loadLeaderboard();
    const medal = ['#ffd166', '#e6f7ff', '#f4a261'];
    for (let i = 0; i < CONFIG.leaderboardSize; i++) {
      const e = top[i];
      const style = { ...FONT, fontSize: '12px', fontStyle: 'bold', color: e ? medal[i] : '#4a5a78' };
      const y = 354 + i * 15;
      const left = this.add.text(cx - 104, 0, `${i + 1}. ${e ? e.name : '---'}`, style).setDepth(10);
      const right = this.add.text(0, 0, e ? String(e.score) : '', style).setDepth(10);
      left.y = Math.round(y - left.height / 2);
      right.setPosition(Math.round(cx + 104 - right.width), Math.round(y - right.height / 2));
    }

    const prompt = this.add.text(cx, 408, 'PRESS SPACE OR TAP TO START', FONT).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    this.add.text(cx, height - 36, 'MOVE ARROWS/WASD   FIRE SPACE/Z/J   BOMB X\nOR HOLD MOUSE TO FIRE, DRAG TO MOVE\nPAUSE P   MUTE M   ART GALLERY G', {
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

  // Title logo: a gold "KOALA'S" banner over a big "RETRO / SPACE SHOOTER" in a cyan-to-pink
  // gradient with a hard drop shadow, floating gently, with stars twinkling around it.
  createLogo(cx) {
    const logo = this.add.container(cx, 0).setDepth(10);

    // Vertical gradient fill for a text object (drawn on the text's own canvas).
    const gradient = (t, stops) => {
      const g = t.context.createLinearGradient(0, 0, 0, t.height);
      stops.forEach(([at, color]) => g.addColorStop(at, color));
      t.setFill(g);
      return t;
    };
    const big = (str, y, size) => {
      const t = this.add.text(0, y, str, { ...FONT, fontSize: size, fontStyle: 'bold' })
        .setOrigin(0.5)
        .setStroke('#1a0b3a', 6)
        .setShadow(3, 3, '#ff2e88', 0, true, false);
      return gradient(t, [[0, '#ffffff'], [0.35, '#7fe8ff'], [0.7, '#4aa8ff'], [1, '#b46bff']]);
    };

    const koala = this.add.text(0, 30, "KOALA'S", { ...FONT, fontSize: '18px', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#3a1a00', 5)
      .setShadow(2, 2, '#000000', 0, true, false);
    gradient(koala, [[0, '#fff3b0'], [0.5, '#ffd166'], [1, '#ff8c42']]);
    // Gold rules either side of "KOALA'S".
    const ruleW = 46;
    const rules = [-1, 1].map((side) => {
      const x = side * (koala.width / 2 + 8 + ruleW / 2);
      return [
        this.add.rectangle(x, 29, ruleW, 2, 0xffd166),
        this.add.rectangle(x, 33, ruleW - 12, 1, 0xff8c42),
      ];
    }).flat();

    const retro = big('RETRO', 62, '34px');
    const shooter = big('SPACE SHOOTER', 96, '24px');
    logo.add([...rules, koala, retro, shooter]);

    // Gentle float (whole pixels: roundPixels keeps the text crisp).
    this.tweens.add({ targets: logo, y: -3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Twinkling stars around the logo.
    const twinkle = () => {
      const x = cx + Phaser.Math.Between(-130, 130);
      const y = Phaser.Math.Between(18, 112);
      const star = this.add.star(x, y, 4, 1, 5, Phaser.Utils.Array.GetRandom([0xffffff, 0x7fe8ff, 0xffd166])).setDepth(11).setScale(0);
      this.tweens.add({
        targets: star, scale: 1, angle: 45, duration: 260, yoyo: true, hold: 120, ease: 'Sine.easeOut',
        onComplete: () => star.destroy(),
      });
    };
    this.time.addEvent({ delay: 280, loop: true, callback: twinkle });
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
