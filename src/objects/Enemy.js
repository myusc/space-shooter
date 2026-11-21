import Phaser from 'phaser';
import { CONFIG } from '../config.js';

// One pooled enemy. spawn() turns it into a grunt, weaver or gunship; preUpdate runs its behaviour.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy-01');
  }

  // type: key of CONFIG.enemies; overrides: per-group values from waves.json; speedMul: loop difficulty
  spawn(type, x, y, overrides, speedMul) {
    const def = { ...CONFIG.enemies[type], ...overrides };
    this.type = type;
    this.def = def;
    this.speedMul = speedMul;
    this.hp = def.hp;
    this.age = 0;
    this.flashUntil = 0;
    this.x0 = x;

    this.enableBody(true, x, y, true, true);
    this.setTexture(def.key).setDepth(6).clearTint();
    this.body.setSize(def.body[0], def.body[1], false).setOffset(def.body[2], def.body[3]);
    this.play(def.anim, true);
    this.setVelocity((def.vx || 0) * speedMul, def.speed * speedMul);

    if (type === 'weaver') {
      this.fireY = Phaser.Math.Between(def.fireYMin, def.fireYMax);
      this.fired = false;
    }
    if (type === 'gunship') {
      this.state = 'enter';
      this.burstsLeft = def.bursts;
      this.nextBurst = 0;
      this.shotsLeft = 0;
      this.nextShot = 0;
    }
    return this;
  }

  // Returns true if this hit destroyed the enemy.
  hit(time, damage = 1) {
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.flashUntil = time + CONFIG.fx.flashMs;
    return this.hp <= 0;
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.active || this.scene.frozen) return; // hold still during the death freeze-frame
    if (this.flashUntil && time >= this.flashUntil) {
      this.clearTint();
      this.flashUntil = 0;
    }
    this.age += delta;
    if (this.type === 'weaver') this.updateWeaver();
    else if (this.type === 'gunship') this.updateGunship(delta);
  }

  updateWeaver() {
    const d = this.def;
    const phase = (d.phase || 0) * Math.PI * 2;
    this.x = this.x0 + d.amp * Math.sin((this.age / 1000) * d.freq * Math.PI * 2 + phase);
    if (!this.fired && this.y >= this.fireY) {
      this.fired = true;
      this.scene.fireEnemyBullet(this.x, this.y + 12, this.speedMul, this.type);
    }
  }

  updateGunship(delta) {
    const d = this.def;
    if (this.state === 'enter') {
      if (this.y >= d.stopY) {
        this.setVelocity(0, 0);
        this.state = 'hold';
        this.nextBurst = 400; // short pause before the first burst
      }
      return;
    }
    if (this.state === 'hold') {
      if (this.shotsLeft > 0) {
        this.nextShot -= delta;
        if (this.nextShot <= 0) {
          this.scene.fireEnemyBullet(this.x, this.y + 16, this.speedMul, this.type);
          this.shotsLeft -= 1;
          this.nextShot = d.shotGap;
        }
        return;
      }
      this.nextBurst -= delta;
      if (this.nextBurst <= 0) {
        if (this.burstsLeft <= 0) {
          this.state = 'leave';
          this.setVelocity(0, d.leaveSpeed * this.speedMul);
          return;
        }
        this.burstsLeft -= 1;
        this.shotsLeft = d.burstShots;
        this.nextShot = 0;
        this.nextBurst = d.burstInterval / this.speedMul;
      }
    }
  }
}
