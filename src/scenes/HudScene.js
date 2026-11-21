import Phaser from 'phaser';
import { CONFIG, FONT } from '../config.js';
import { sound } from '../systems/Sound.js';

// Score, high score, lives, weapon level, shield, wave banners, boss health bar and the touch buttons.
// Runs on top of the Game scene and reads everything from the game registry, which GameScene writes to.
export class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    const { width, height } = CONFIG;
    const reg = this.registry;

    this.scoreText = this.add.text(4, 3, '', FONT);
    this.highText = this.add.text(4, 12, '', { ...FONT, color: '#8fb8d0' });

    // Lives: small copies of the player ship (frame 0) in the bottom-left corner.
    this.lifeIcons = [];
    for (let i = 0; i < CONFIG.powerups.maxLives; i++) {
      this.lifeIcons.push(this.add.image(10 + i * 14, height - 8, 'player-ship', 0).setScale(0.5).setVisible(false));
    }

    // Weapon level pips + shield gem, bottom-right.
    this.add.text(width - 52, height - 12, 'PWR', { ...FONT, color: '#8fb8d0' });
    this.weaponPips = CONFIG.weapons.map((w, i) => this.add.rectangle(width - 32 + i * 9, height - 8, 6, 6, 0xffd166));
    this.shieldIcon = this.add.sprite(width - 64, height - 8, 'gems').play('gem-blue').setScale(0.75).setVisible(false);

    // Banners (wave start, boss warning)
    this.banner = this.add.text(width / 2, height / 2 - 40, '', { ...FONT, fontSize: '16px', align: 'center' })
      .setOrigin(0.5)
      .setStroke('#0b1630', 4)
      .setAlpha(0);
    this.bannerSub = this.add.text(width / 2, height / 2 - 20, '', { ...FONT, color: '#ffd166', align: 'center' })
      .setOrigin(0.5)
      .setAlpha(0);

    // Boss health bar, top centre (hidden until the boss arrives).
    const bw = 180;
    this.bossBar = this.add.container(width / 2, 30).setVisible(false);
    this.bossBar.add([
      this.add.text(0, -6, CONFIG.boss.name, { ...FONT, color: '#ff8fa3' }).setOrigin(0.5, 1),
      this.add.rectangle(0, 0, bw + 4, 8, 0x0b1630).setStrokeStyle(1, 0xff4d6d),
    ]);
    this.bossFill = this.add.rectangle(-bw / 2, 0, bw, 4, 0xff4d6d).setOrigin(0, 0.5);
    this.bossBar.add(this.bossFill);
    this.bossBarWidth = bw;

    this.makeButton(width - 13, 9, 18, () => 'II', () => this.scene.get('Game').pauseGame());
    this.makeButton(width - 40, 9, 26, () => 'ART', () => this.scene.get('Game').openGallery());
    this.muteButton = this.makeButton(width - 71, 9, 26, () => (sound.muted ? 'OFF' : 'SND'), () => {
      this.scene.get('Game').toggleMute();
    });

    const refresh = () => this.refresh();
    reg.events.on('changedata', refresh);
    const game = this.scene.get('Game');
    const handlers = {
      'wave-start': (w) => this.showWave(w),
      'boss-warning': () => this.showWarning(),
      'boss-phase2': () => this.flashBanner('ARMOR BROKEN!', 'WATCH THE BEAM', '#ff8fa3'),
      'boss-defeated': () => this.flashBanner(CONFIG.boss.name, 'DEFEATED!', '#ffd166'),
    };
    Object.entries(handlers).forEach(([e, fn]) => game.events.on(e, fn));
    // The registry and the Game scene outlive this scene, so unhook on shutdown.
    this.events.once('shutdown', () => {
      reg.events.off('changedata', refresh);
      Object.entries(handlers).forEach(([e, fn]) => game.events.off(e, fn));
    });

    this.refresh();
  }

  refresh() {
    const reg = this.registry;
    const score = reg.get('score') || 0;
    this.scoreText.setText('SCORE ' + score);
    this.highText.setText('HI ' + Math.max(score, reg.get('highScore') || 0));
    const lives = reg.get('lives') || 0;
    this.lifeIcons.forEach((icon, i) => icon.setVisible(i < lives));
    const weapon = reg.get('weapon') || 0;
    this.weaponPips.forEach((pip, i) => pip.setFillStyle(i <= weapon ? 0xffd166 : 0x2a3550));
    this.shieldIcon.setVisible(!!reg.get('shield'));
    this.muteButton.label.setText(this.muteButton.getLabel());

    const hp = reg.get('bossHp');
    this.bossBar.setVisible(hp !== null && hp !== undefined && hp > 0);
    if (hp) this.bossFill.width = Math.max(0, this.bossBarWidth * hp);
  }

  showWave({ number, name, total }) {
    this.flashBanner(`WAVE ${number}/${total}`, name.toUpperCase(), '#ffd166');
  }

  flashBanner(title, sub, subColor) {
    this.banner.setText(title).setColor('#e6f7ff');
    this.bannerSub.setText(sub).setColor(subColor);
    this.tweens.killTweensOf([this.banner, this.bannerSub]);
    this.banner.setAlpha(1);
    this.bannerSub.setAlpha(1);
    this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, delay: 1400, duration: 400 });
  }

  showWarning() {
    this.tweens.killTweensOf([this.banner, this.bannerSub]);
    this.banner.setText('WARNING').setColor('#ff4d6d').setAlpha(1);
    this.bannerSub.setText(`${CONFIG.boss.name} APPROACHING`).setColor('#ff8fa3').setAlpha(1);
    this.tweens.add({
      targets: this.banner, alpha: 0.15, duration: 160, yoyo: true, repeat: 7,
      onComplete: () => this.tweens.add({ targets: [this.banner, this.bannerSub], alpha: 0, duration: 300 }),
    });
  }

  makeButton(x, y, w, getLabel, onClick) {
    const bg = this.add.rectangle(x, y, w, 14, 0x0b1630, 0.75).setStrokeStyle(1, 0x5fd3ff);
    bg.label = this.add.text(x, y, getLabel(), FONT).setOrigin(0.5);
    bg.getLabel = getLabel;
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.scene.isActive('Game')) onClick(); // ignore while paused or game over
    });
    return bg;
  }
}
