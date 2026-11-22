import Phaser from 'phaser';
import { CONFIG } from '../config.js';
import { sound } from '../systems/Sound.js';

// One pooled enemy. spawn() turns it into a grunt, weaver or gunship; preUpdate runs its behaviour.
export class Enemy extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'enemy-01');
    this.shieldGfx = scene.add.graphics().setDepth(7); // Red Koala's bubble shield
  }

  // Pooled: hide the shield bubble whenever this enemy is switched off (destroyed or recycled).
  disableBody(disableGameObject, hideGameObject) {
    super.disableBody(disableGameObject, hideGameObject);
    this.shieldGfx.clear();
    return this;
  }

  destroy(fromScene) {
    if (this.shieldGfx) this.shieldGfx.destroy();
    super.destroy(fromScene);
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
    this.setTexture(def.key).setDepth(6).clearTint().setAlpha(1).setAngle(0);
    this.body.setSize(def.body[0], def.body[1], false).setOffset(def.body[2], def.body[3]);
    this.play(def.anim, true);
    this.setVelocity((def.vx || 0) * speedMul, def.speed * speedMul);
    this.cloaked = false;
    this.shieldHp = def.shieldHp || 0;
    this.shieldFlashUntil = 0;
    this.shieldGfx.clear();
    // While shielded the hitbox is the bubble (shots stop at its edge, and touching it counts).
    if (this.shieldHp > 0) {
      const r = def.shieldRadius;
      this.body.setCircle(r, this.width / 2 - r, this.height / 2 - r);
    }

    if (type === 'grunt') {
      this.state = 'descend';
      this.diveY = Phaser.Math.Between(def.diveYMin, def.diveYMax);
    }
    if (type === 'weaver') {
      this.fireY = Phaser.Math.Between(def.fireYMin, def.fireYMax);
      this.fired = false;
      this.cloakState = 'visible';
      this.cloakTimer = 0;
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

  // Returns true if this hit destroyed the enemy. A shield takes the whole hit while it lasts;
  // pierce (bombs) skips the shield and pops it.
  hit(time, damage = 1, pierce = false) {
    if (this.shieldHp > 0) {
      if (pierce) {
        this.popShield();
      } else {
        this.shieldHp -= damage;
        this.shieldFlashUntil = time + 80;
        if (this.shieldHp <= 0) this.popShield();
        return false;
      }
    }
    this.hp -= damage;
    this.setTintFill(0xffffff);
    this.flashUntil = time + CONFIG.fx.flashMs;
    return this.hp <= 0;
  }

  popShield() {
    const d = this.def;
    this.shieldHp = 0;
    this.shieldGfx.clear();
    this.body.setSize(d.body[0], d.body[1], false).setOffset(d.body[2], d.body[3]); // back to the hull hitbox
    const s = this.scene;
    const ring = s.add.circle(this.x, this.y, d.shieldRadius).setStrokeStyle(2, d.shieldColor).setDepth(7);
    s.tweens.add({ targets: ring, scale: 1.8, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    sound.sfx('shieldBreak');
  }

  drawShield(time) {
    const g = this.shieldGfx.clear();
    if (this.shieldHp <= 0 || !this.visible) return;
    const d = this.def;
    const flash = time < this.shieldFlashUntil;
    const a = flash ? 1 : 0.75 + 0.25 * Math.sin(time / 130);
    // Fainter as it weakens: full strength at shieldHp, dimmer with each hit.
    const strength = 0.5 + 0.5 * (this.shieldHp / d.shieldHp);
    g.fillStyle(flash ? 0xffffff : d.shieldColor, (flash ? 0.4 : 0.2) * strength);
    g.fillCircle(this.x, this.y, d.shieldRadius);
    g.lineStyle(2, flash ? 0xffffff : d.shieldColor, a * strength);
    g.strokeCircle(this.x, this.y, d.shieldRadius);
    g.lineStyle(1, 0xffffff, 0.5 * a * strength); // inner highlight
    g.strokeCircle(this.x, this.y, d.shieldRadius - 3);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    if (!this.active) return;
    if (this.shieldHp > 0) this.drawShield(time);
    if (this.scene.frozen) return; // hold still during the death freeze-frame
    if (this.flashUntil && time >= this.flashUntil) {
      this.clearTint();
      if (this.state === 'windup') this.setTint(0xff6b6b); // keep the dive warning after a hit flash
      this.flashUntil = 0;
    }
    this.age += delta;
    if (this.type === 'grunt') this.updateGrunt(delta);
    else if (this.type === 'weaver') this.updateWeaver(delta);
    else if (this.type === 'gunship') this.updateGunship(delta);
  }

  // Flies down, stops and flashes red, then dives straight at the player's ship.
  updateGrunt(delta) {
    const d = this.def;
    if (this.state === 'descend') {
      if (this.y >= this.diveY) {
        this.state = 'windup';
        this.windup = d.diveWindup;
        this.x0 = this.x; // groups with sideways drift (vx) have moved since spawning
        this.setVelocity(0, 0);
        if (!this.flashUntil) this.setTint(0xff6b6b);
      }
      return;
    }
    if (this.state === 'windup') {
      this.windup -= delta;
      this.x = this.x0 + Math.sin(this.age / 25) * 1.5; // shiver while it takes aim
      if (this.windup > 0) return;
      this.x = this.x0;
      if (!this.flashUntil) this.clearTint();
      const s = this.scene;
      const target = s.alive ? s.player : { x: this.x, y: CONFIG.height };
      const a = Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
      const speed = d.diveSpeed * this.speedMul;
      this.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
      this.setRotation(a - Math.PI / 2); // the art faces down
      this.state = 'dive';
    }
  }

  updateWeaver(delta) {
    const d = this.def;
    const phase = (d.phase || 0) * Math.PI * 2;
    this.x = this.x0 + d.amp * Math.sin((this.age / 1000) * d.freq * Math.PI * 2 + phase);
    this.updateCloak(delta);
    // It holds its one shot while cloaked and fires once it is back.
    if (!this.fired && this.y >= this.fireY && !this.cloaked) {
      this.fired = true;
      this.scene.fireEnemyBullet(this.x, this.y + 12, this.speedMul, this.type);
    }
  }

  // visible → (far from the player) blink → cloaked for cloakMs → visible, then cooldown.
  updateCloak(delta) {
    const d = this.def;
    const s = this.scene;
    this.cloakTimer -= delta;
    if (this.cloakState === 'visible') {
      const far = s.alive && Phaser.Math.Distance.Between(this.x, this.y, s.player.x, s.player.y) > d.cloakDistance;
      if (this.cloakTimer <= 0 && far && this.y > 0) {
        this.cloakState = 'blink';
        this.cloakTimer = d.cloakBlinkMs;
      }
    } else if (this.cloakState === 'blink') {
      this.setAlpha(Math.floor(this.cloakTimer / 75) % 2 ? 0.2 : 1);
      if (this.cloakTimer <= 0) {
        this.cloakState = 'cloaked';
        this.cloakTimer = d.cloakMs;
        this.cloaked = true;
        this.setAlpha(0);
      }
    } else if (this.cloakState === 'cloaked' && this.cloakTimer <= 0) {
      this.cloakState = 'visible';
      this.cloakTimer = d.cloakCooldown;
      this.cloaked = false;
      this.setAlpha(1);
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
