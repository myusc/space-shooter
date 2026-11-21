import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { sound } from '../systems/Sound.js';

// The Koala King. States:
//   enter      flies down to homeY, can't be hurt
//   phase1     sways; side cannons fire bullet fans, every few fans an aimed burst
//   opening    armour opens (boss frames 0->4), helmet and cannons fly off as debris, can't be hurt
//   phase2     cycles spread (fans from the core) -> charge (ray charge-up + warning line) -> beam
//   dying      explosion chain, then GameScene shows Victory
export class Boss extends Phaser.Physics.Arcade.Sprite {
  constructor(scene) {
    const B = CONFIG.boss;
    super(scene, CONFIG.width / 2, -80, 'boss', 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setDepth(5);
    this.body.setSize(B.body[0], B.body[1], false).setOffset(B.body[2], B.body[3]);

    this.maxHp = B.hp;
    this.hp = B.hp;
    this.state = 'enter';
    this.vulnerable = false;
    this.t = 0; // ms in the current state
    this.swayT = 0;
    this.fanTimer = 800;
    this.fanCount = 0;
    this.burst = 0; // aimed shots left in a burst
    this.burstTimer = 0;
    this.flashUntil = 0;
    this.beamActive = false;

    // Engine flames sit behind the hull; the ray and its warning line draw above the player's shots
    // (depth 8) so they're never hidden, but below the ship itself (10).
    this.thrust = scene.add.sprite(this.x, this.y - 46, 'boss-thrust').setDepth(4).play('boss-thrust');
    this.ray = scene.add.sprite(this.x, this.y, 'boss-rays').setOrigin(0.5, 0).setDepth(9).setVisible(false);
    this.warnLine = scene.add.graphics().setDepth(9);

    this.setVelocity(0, B.enterSpeed);
  }

  get mouthX() {
    return this.x + CONFIG.boss.mouth.dx;
  }

  get mouthY() {
    return this.y + CONFIG.boss.mouth.dy;
  }

  // Returns true if this hit destroyed the boss.
  damage(amount, time) {
    if (!this.vulnerable) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.setTintFill(0xffffff);
    this.flashUntil = time + 50;
    if (this.state === 'phase1' && this.hp <= this.maxHp * CONFIG.boss.phase2.at) this.startOpening();
    if (this.hp <= 0) {
      this.startDying();
      return true;
    }
    return false;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (this.flashUntil && time >= this.flashUntil) {
      this.clearTint();
      this.flashUntil = 0;
    }
    if (!this.active || this.scene.frozen) return this.syncParts();

    this.t += delta;
    if (this.state === 'enter') this.updateEnter();
    else if (this.state === 'phase1') this.updatePhase1(delta);
    else if (this.state === 'phase2') this.updatePhase2(delta);
    this.syncParts();
  }

  syncParts() {
    this.thrust.setPosition(this.x, this.y - 46);
    this.ray.setPosition(this.mouthX, this.mouthY - 30); // charge particles centre on the core
  }

  enterState(s) {
    this.state = s;
    this.t = 0;
  }

  // ---------- states ----------

  updateEnter() {
    if (this.y >= CONFIG.boss.homeY) {
      this.setVelocity(0, 0);
      this.y = CONFIG.boss.homeY;
      this.vulnerable = true;
      this.enterState('phase1');
      this.scene.events.emit('boss-ready');
    }
  }

  sway(delta, amp, hz) {
    this.swayT += delta;
    this.x = CONFIG.width / 2 + amp * Math.sin((this.swayT / 1000) * hz * Math.PI * 2);
  }

  updatePhase1(delta) {
    const P = CONFIG.boss.phase1;
    this.sway(delta, P.swayAmp, P.swayHz);

    this.fanTimer -= delta;
    if (this.fanTimer <= 0) {
      this.fanTimer = P.fanEvery;
      this.fanCount += 1;
      const c = CONFIG.boss.cannons[this.fanCount % 2]; // alternate left / right cannon
      this.fireFan(this.x + c.dx, this.y + c.dy, P.fanShots, P.fanSpread, 90);
      if (this.fanCount % P.aimedEvery === 0) {
        this.burst = 3;
        this.burstTimer = 300;
      }
    }
    this.updateBurst(delta);
  }

  updateBurst(delta) {
    if (this.burst <= 0) return;
    this.burstTimer -= delta;
    if (this.burstTimer <= 0) {
      this.scene.fireEnemyBullet(this.mouthX, this.mouthY, 1.15, 'boss');
      this.burst -= 1;
      this.burstTimer = 130;
    }
  }

  // count bullets spread over `spread` degrees, centred on `center` degrees (90 = straight down)
  fireFan(x, y, count, spread, center, speedMul = 1) {
    for (let i = 0; i < count; i++) {
      const deg = center - spread / 2 + (spread * i) / (count - 1);
      this.scene.fireEnemyBullet(x, y, speedMul, 'boss', Phaser.Math.DegToRad(deg));
    }
  }

  startOpening() {
    this.vulnerable = false;
    this.enterState('opening');
    this.burst = 0;
    this.setVelocity(0, 0);
    this.scene.bossHitStop(160);
    this.scene.cameras.main.shake(500, 0.012);
    sound.sfx('armorBreak');
    this.play('boss-open');

    // The loose armour flies off: helmet up, cannons out to the sides.
    const B = CONFIG.boss;
    const debris = [
      ['boss-helmet', 0, -4, 0, -140, 200],
      ['boss-cannon-left', B.cannons[0].dx, B.cannons[0].dy, -150, 60, -300],
      ['boss-cannon-right', B.cannons[1].dx, B.cannons[1].dy, 150, 60, 300],
    ];
    debris.forEach(([key, dx, dy, vx, vy, spin]) => {
      const piece = this.scene.add.image(this.x + dx, this.y + dy, key).setDepth(7);
      this.scene.tweens.add({
        targets: piece, x: piece.x + vx, y: piece.y + vy, angle: spin, alpha: 0,
        duration: 1100, ease: 'Quad.easeOut', onComplete: () => piece.destroy(),
      });
    });

    this.once('animationcomplete', () => {
      this.scene.time.delayedCall(500, () => {
        if (this.state !== 'opening') return;
        this.vulnerable = true;
        this.fanTimer = 400;
        this.enterState('phase2');
        this.p2 = 'spread';
        this.scene.events.emit('boss-phase2');
      });
    });
  }

  updatePhase2(delta) {
    const P = CONFIG.boss.phase2;
    if (this.p2 === 'spread') {
      this.sway(delta, P.swayAmp, P.swayHz);
      this.fanTimer -= delta;
      if (this.fanTimer <= 0) {
        this.fanTimer = P.fanEvery;
        this.fanCount += 1;
        // alternate offset so the gaps move between fans
        const center = 90 + (this.fanCount % 2 ? 6 : -6);
        this.fireFan(this.mouthX, this.mouthY, P.fanShots, P.fanSpread, center, 1.1);
      }
      if (this.t >= P.spreadMs) {
        this.p2 = 'charge';
        this.t = 0;
        this.ray.setVisible(true).setScale(1).play('boss-ray-charge');
        sound.sfx('charge', P.chargeMs);
      }
    } else if (this.p2 === 'charge') {
      // Telegraph: the ray charges at the core and a red line shows exactly where the beam will go.
      const a = 0.25 + 0.35 * Math.abs(Math.sin(this.t / 60));
      this.warnLine.clear().fillStyle(0xff4d6d, a).fillRect(this.mouthX - 1, this.mouthY, 3, CONFIG.height);
      if (this.t >= P.chargeMs) {
        this.p2 = 'beam';
        this.t = 0;
        this.warnLine.clear();
        this.ray.setScale(1, 2).play('boss-ray-beam');
        this.beamActive = true;
        sound.sfx('beam', P.beamMs);
        this.scene.cameras.main.shake(P.beamMs, 0.003);
      }
    } else if (this.p2 === 'beam') {
      // Slowly follow the player: dodgeable, but you can't just sit still.
      const target = this.scene.alive ? this.scene.player.x : this.x;
      const step = (P.beamTrackSpeed * delta) / 1000;
      this.x = Phaser.Math.Clamp(this.x + Phaser.Math.Clamp(target - this.x, -step, step), 60, CONFIG.width - 60);
      this.swayT = Math.asin(Phaser.Math.Clamp((this.x - CONFIG.width / 2) / P.swayAmp, -1, 1)) / (P.swayHz * Math.PI * 2) * 1000;
      if (this.t >= P.beamMs) this.endBeam();
    }
  }

  endBeam() {
    this.beamActive = false;
    this.ray.setVisible(false).stop();
    this.warnLine.clear();
    this.p2 = 'spread';
    this.t = 0;
    this.fanTimer = 500;
  }

  // Beam hit test for a target centred at (x, y) that is halfWidth wide each side (the player's hitbox).
  // Uses positions, not the arcade body: the player's body is only re-synced on the next physics step.
  beamHits(x, y, halfWidth) {
    if (!this.beamActive) return false;
    return Math.abs(x - this.mouthX) < CONFIG.boss.phase2.beamHalfWidth + halfWidth && y > this.mouthY;
  }

  startDying() {
    this.vulnerable = false;
    this.beamActive = false;
    this.ray.setVisible(false);
    this.warnLine.clear();
    this.setVelocity(0, 0);
    this.enterState('dying');
    this.scene.onBossDefeated(this);
  }

  destroyBoss() {
    this.thrust.destroy();
    this.ray.destroy();
    this.warnLine.destroy();
    this.destroy();
  }
}
