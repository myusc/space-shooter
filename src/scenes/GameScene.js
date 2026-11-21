import Phaser from 'phaser';
import { CONFIG, FONT, SHOT_SPRITES } from '../config.js';
import { Enemy } from '../objects/Enemy.js';
import { Boss } from '../objects/Boss.js';
import { Starfield } from '../systems/Starfield.js';
import { WaveDirector } from '../systems/WaveDirector.js';
import { loadHighScore, saveHighScore } from '../systems/highScore.js';
import { sound } from '../systems/Sound.js';
import waveScript from '../data/waves.json';

// The stage: 10 scripted waves, then the Koala King. Weapons, power-ups, lives, score.
// Score, lives, weapon, shield, wave and boss health are shared with the HUD through the game registry.
export class GameScene extends Phaser.Scene {
  constructor() {
    super('Game');
  }

  create() {
    this.score = 0;
    this.lives = CONFIG.lives;
    this.weaponLevel = 0;
    this.shield = false;
    this.highScore = loadHighScore();
    this.nextFire = 0;
    this.bank = { dir: 0, time: 0 };
    this.drag = null;
    this.dragTarget = null;
    this.alive = true;
    this.invulnerable = false;
    this.over = false;
    this.won = false;
    this.frozen = false; // death freeze-frame or boss hit-stop: nothing moves
    this.dying = false; // inside the death freeze-frame
    this.lastDeath = '';
    this.boss = null;
    this.lastHitStop = 0;
    this.startTime = this.time.now;

    this.registry.set({
      score: 0, lives: this.lives, highScore: this.highScore, wave: 0,
      weapon: 0, shield: false, bossHp: null, muted: sound.muted,
    });

    this.starfield = new Starfield(this);
    this.createPlayer();
    this.createPools();
    this.createInput();
    this.debugText = this.add.text(4, 24, '', { ...FONT, color: '#9be7a8' }).setDepth(100).setVisible(false);

    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerHitsEnemy, null, this);
    this.physics.add.overlap(this.player, this.enemyBullets, this.onPlayerShot, null, this);
    this.physics.add.overlap(this.player, this.powerups, this.onCollect, null, this);

    this.director = new WaveDirector(this, waveScript);

    // Scene events survive restarts, so remove these when the scene shuts down.
    const onResume = () => {
      this.input.keyboard.resetKeys();
      this.endDrag();
      sound.setPaused(false);
    };
    this.events.on('resume', onResume);
    this.events.on('wake', onResume);
    this.events.once('shutdown', () => {
      this.events.off('resume', onResume);
      this.events.off('wake', onResume);
    });

    sound.setPaused(false);
    sound.playMusic('stage');
    this.scene.launch('Hud');
  }

  // ---------- setup ----------

  createPlayer() {
    const C = CONFIG;
    this.player = this.physics.add.sprite(C.width / 2, C.player.startY, 'player-ship', 0).setDepth(10);
    // Small hitbox around the cockpit and hull, so near misses on the wings don't count.
    this.player.body.setSize(10, 14, false).setOffset(19, 22);

    this.thrusters = [-4, 4].map((dx) => {
      const t = this.add.sprite(0, 0, 'player-thrust').setOrigin(0.5, 0).setDepth(9);
      t.dx = dx;
      t.play({ key: 'player-thrust', startFrame: dx < 0 ? 0 : 2 });
      return t;
    });

    this.shieldGfx = this.add.graphics().setDepth(11);

    // Death feedback: a red ring around whatever killed the player, with its name.
    this.killRing = this.add.graphics().setDepth(30).setVisible(false);
    this.killLabel = this.add.text(0, 0, '', { ...FONT, color: '#ff4d6d' })
      .setOrigin(0.5)
      .setStroke('#000000', 3)
      .setDepth(31)
      .setVisible(false);
  }

  createPools() {
    const C = CONFIG;
    this.bullets = this.physics.add.group({ defaultKey: 'shot-bolt', maxSize: C.bolt.poolSize });
    this.enemies = this.physics.add.group({ classType: Enemy, maxSize: C.enemyPool });
    this.enemyBullets = this.physics.add.group({ defaultKey: 'boss-bolt', maxSize: C.enemyBullet.poolSize });
    this.powerups = this.physics.add.group({ defaultKey: 'gems', maxSize: 12 });
    this.hits = this.add.group({ defaultKey: 'hit', maxSize: C.fx.hitPool });
    this.explosions = this.add.group({ defaultKey: 'enemy-explosion', maxSize: C.fx.explosionPool });
    this.bigBooms = this.add.group({ defaultKey: 'explosion-big', maxSize: 12 });
  }

  createInput() {
    // Fire: Space, or Z / J - away from the arrow keys, for keyboards that can't register
    // Space together with two arrows at once (key ghosting).
    this.keys = this.input.keyboard.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,SPACE,Z,J,P,ESC,G,I,M,B');
    this.input.keyboard.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');

    // Touch / mouse: drag anywhere moves the ship relative to the finger, holding fires.
    this.input.on('pointerdown', (p) => {
      if (!this.drag && p.y >= 20) this.startDrag(p); // top strip belongs to the HUD buttons
    });
    this.input.on('pointermove', (p) => {
      if (!this.drag || p.id !== this.drag.id) return;
      // Mouse button let go somewhere we didn't hear about (outside the browser window).
      if (p.wasTouch === false && p.buttons === 0) return this.endDrag();
      // Apply each movement step to the clamped position, so pushing into a wall never builds up
      // slack: reversing direction moves the ship straight away.
      const b = CONFIG.player.bounds;
      this.dragTarget.x = Phaser.Math.Clamp(this.dragTarget.x + (p.x - this.drag.lastX), b.left, b.right);
      this.dragTarget.y = Phaser.Math.Clamp(this.dragTarget.y + (p.y - this.drag.lastY), b.top, b.bottom);
      this.drag.lastX = p.x;
      this.drag.lastY = p.y;
    });
    const release = (p) => {
      if (this.drag && p.id === this.drag.id) this.endDrag();
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);

    const onBlur = () => this.endDrag();
    window.addEventListener('blur', onBlur);
    this.events.once('shutdown', () => window.removeEventListener('blur', onBlur));
  }

  startDrag(p) {
    if (!this.alive) return;
    this.drag = { id: p.id, lastX: p.x, lastY: p.y };
    this.dragTarget = { x: this.player.x, y: this.player.y };
  }

  endDrag() {
    this.drag = null;
    this.dragTarget = null;
  }

  // A button or finger still held after a respawn or resume picks the ship back up
  // (its pointerdown happened while the ship was dead or the game was paused).
  resumeHeldPointer() {
    if (this.drag || !this.alive) return;
    const held = this.input.manager.pointers.find((p) => p.isDown && p.downY >= 20);
    if (held) this.startDrag(held);
  }

  // ---------- loop ----------

  update(time, delta) {
    const dt = delta / 1000;
    const K = this.keys;
    const JD = Phaser.Input.Keyboard.JustDown;

    if (JD(K.P) || JD(K.ESC)) return this.pauseGame();
    if (JD(K.G)) return this.openGallery();
    if (JD(K.I)) this.debugText.setVisible(!this.debugText.visible);
    if (JD(K.M)) this.toggleMute();
    if (import.meta.env.DEV && JD(K.B)) this.skipToBoss(); // dev shortcut for testing the boss

    if (this.frozen) return; // death freeze-frame / hit-stop: nothing moves

    this.starfield.update(dt);
    if (!this.over) this.director.update(delta);

    if (this.alive) {
      this.resumeHeldPointer();
      this.updatePlayer(dt);
      const firing = K.SPACE.isDown || K.Z.isDown || K.J.isDown || this.drag !== null;
      if (firing && time >= this.nextFire) {
        this.fire();
        this.nextFire = time + 1000 / CONFIG.weapons[this.weaponLevel].fireRate;
      }
      if (this.boss && this.boss.beamHits(this.player.x, this.player.y, 5)) {
        this.hurtPlayer({
          target: { x: this.boss.mouthX, y: this.player.y - 6, active: false },
          kind: 'beam',
          label: `HIT BY ${CONFIG.boss.name}'S BEAM`,
        });
      }
    }

    this.drawShield(time);
    this.recycleOffscreen();
    if (this.debugText.visible) this.updateDebug();
  }

  updatePlayer(dt) {
    const C = CONFIG.player;
    const K = this.keys;
    const p = this.player;
    const startX = p.x;

    // Keyboard movement always applies - also while the mouse button is held to fire.
    let vx = (K.RIGHT.isDown || K.D.isDown ? 1 : 0) - (K.LEFT.isDown || K.A.isDown ? 1 : 0);
    let vy = (K.DOWN.isDown || K.S.isDown ? 1 : 0) - (K.UP.isDown || K.W.isDown ? 1 : 0);
    if (vx && vy) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    const kx = vx * C.speed * dt;
    const ky = vy * C.speed * dt;

    if (this.dragTarget) {
      // Mouse/finger drag and keys combine: keys nudge the drag position, mouse moves add to it.
      this.dragTarget.x = Phaser.Math.Clamp(this.dragTarget.x + kx, C.bounds.left, C.bounds.right);
      this.dragTarget.y = Phaser.Math.Clamp(this.dragTarget.y + ky, C.bounds.top, C.bounds.bottom);
      p.x = this.dragTarget.x;
      p.y = this.dragTarget.y;
    } else {
      p.x = Phaser.Math.Clamp(p.x + kx, C.bounds.left, C.bounds.right);
      p.y = Phaser.Math.Clamp(p.y + ky, C.bounds.top, C.bounds.bottom);
    }
    p.body.reset(p.x, p.y);

    // Bank frames: 0 level, 1->2 rolling left, 3->4 rolling right.
    const moved = p.x - startX;
    const dir = Math.abs(moved) < 0.05 ? 0 : Math.sign(moved);
    if (dir !== this.bank.dir) this.bank = { dir, time: 0 };
    else this.bank.time += dt;
    const full = this.bank.time > C.bankDelay;
    p.setFrame(dir === 0 ? 0 : dir < 0 ? (full ? 2 : 1) : full ? 4 : 3);

    for (const t of this.thrusters) t.setPosition(Math.round(p.x + t.dx), Math.round(p.y + 20));
  }

  drawShield(time) {
    const g = this.shieldGfx.clear();
    if (!this.shield || !this.player.visible) return;
    const a = 0.45 + 0.25 * Math.sin(time / 120);
    g.lineStyle(2, 0x5fd3ff, a).strokeCircle(this.player.x, this.player.y + 4, 19);
    g.lineStyle(1, 0xe6f7ff, a * 0.6).strokeCircle(this.player.x, this.player.y + 4, 16);
  }

  // ---------- shooting ----------

  fire() {
    const weapon = CONFIG.weapons[this.weaponLevel];
    const x0 = this.player.x;
    const y0 = this.player.y - 22; // just above the nose
    for (const shot of weapon.shots) {
      const x = x0 + shot.dx;
      const b = this.bullets.get(x, y0);
      if (!b) return;
      const spr = SHOT_SPRITES[shot.sprite];
      b.enableBody(true, x, y0, true, true);
      b.setTexture(shot.sprite).setOrigin(spr.origin[0], spr.origin[1]).setAngle(spr.rotate + shot.angle).setDepth(8);
      b.body.setSize(spr.body[0], spr.body[1], false).setOffset(spr.body[2], spr.body[3]);
      b.body.reset(x, y0);
      const rad = Phaser.Math.DegToRad(shot.angle);
      b.setVelocity(Math.sin(rad) * CONFIG.bolt.speed, -Math.cos(rad) * CONFIG.bolt.speed);
      b.damage = shot.damage;
      b.play(spr.anim, true);
    }
    sound.sfx('shoot', this.weaponLevel);
  }

  // Called by the WaveDirector.
  spawnEnemy(type, x, y, overrides, speedMul) {
    const e = this.enemies.get(x, y);
    if (e) e.spawn(type, x, y, overrides, speedMul);
  }

  // Called by enemies and the boss. angle (radians) omitted = aimed at the player.
  // shooterType is remembered so a death can say who fired the shot.
  fireEnemyBullet(x, y, speedMul, shooterType, angle) {
    if (this.over || this.won || y < 0) return;
    const b = this.enemyBullets.get(x, y);
    if (!b) return;
    b.enableBody(true, x, y, true, true);
    b.shooter = shooterType;
    b.setDepth(7);
    b.body.setCircle(3, 1, 1);
    b.play('enemy-bolt', true);
    const a = angle ?? (this.alive ? Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y) : Math.PI / 2);
    const speed = CONFIG.enemyBullet.speed * speedMul;
    b.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
  }

  shooterName(type) {
    if (type === 'boss') return CONFIG.boss.name;
    return CONFIG.enemies[type] ? CONFIG.enemies[type].name : 'ENEMY';
  }

  onWaveStart(number, name, total) {
    this.registry.set('wave', number);
    this.events.emit('wave-start', { number, name, total });
  }

  // ---------- collisions ----------

  onBulletHitsEnemy(bullet, enemy) {
    if (!bullet.active || !enemy.active) return;
    bullet.disableBody(true, true);
    this.playFx(this.hits, bullet.x, bullet.y, 'hit', 12);
    sound.sfx('hit');
    if (enemy.hit(this.time.now, bullet.damage || 1)) {
      this.destroyEnemy(enemy);
      this.addScore(enemy.def.points);
      this.maybeDropPowerup(enemy);
    }
  }

  onPlayerHitsEnemy(player, enemy) {
    if (!enemy.active) return;
    this.hurtPlayer({ target: enemy, kind: 'enemy', label: 'CRASHED INTO ' + enemy.def.name });
  }

  onPlayerShot(player, bullet) {
    if (!bullet.active) return;
    this.hurtPlayer({ target: bullet, kind: 'bullet', label: 'SHOT BY ' + this.shooterName(bullet.shooter) });
  }

  onBulletHitsBoss(boss, bullet) {
    if (!bullet.active || !boss.active) return;
    bullet.disableBody(true, true);
    this.playFx(this.hits, bullet.x, bullet.y, 'hit', 12);
    if (!boss.vulnerable) return; // armour is closed (entering / opening): shots just spark
    sound.sfx('bossHit');
    this.addScore(CONFIG.boss.hitPoints);
    boss.damage(bullet.damage || 1, this.time.now);
    this.registry.set('bossHp', boss.hp / boss.maxHp);
    const B = CONFIG.boss;
    if (this.time.now - this.lastHitStop > B.hitStopEvery) this.bossHitStop(B.hitStopMs);
  }

  onPlayerHitsBoss(boss) {
    if (!boss.active || this.won) return;
    this.hurtPlayer({
      target: { x: this.player.x, y: this.player.y - 6, active: false },
      kind: 'boss',
      label: 'CRASHED INTO ' + CONFIG.boss.name,
    });
  }

  destroyEnemy(enemy) {
    this.playFx(this.explosions, enemy.x, enemy.y, 'enemy-explosion', 7);
    sound.sfx('explode');
    enemy.disableBody(true, true);
  }

  addScore(points) {
    this.score += points;
    this.registry.set('score', this.score);
    if (this.score > this.highScore) this.registry.set('highScore', this.score);
  }

  // A tiny freeze on boss hits (and bigger moments) so they feel heavy.
  bossHitStop(ms) {
    if (this.frozen) return;
    this.frozen = true;
    this.lastHitStop = this.time.now;
    this.physics.pause();
    this.time.delayedCall(ms, () => {
      if (this.dying) return; // a death freeze took over; it resumes physics itself
      this.frozen = false;
      this.physics.resume();
    });
  }

  // ---------- power-ups ----------

  maybeDropPowerup(enemy) {
    const chance = CONFIG.powerups.dropChance[enemy.type] || 0;
    if (Math.random() < chance) this.spawnPowerup(enemy.x, enemy.y);
  }

  spawnPowerup(x, y, kind) {
    const kinds = CONFIG.powerups.kinds;
    if (!kind) {
      const total = Object.values(kinds).reduce((s, k) => s + k.weight, 0);
      let r = Math.random() * total;
      kind = Object.keys(kinds).find((k) => (r -= kinds[k].weight) < 0) || 'weapon';
    }
    const p = this.powerups.get(x, y);
    if (!p) return;
    p.enableBody(true, x, y, true, true);
    p.kind = kind;
    p.setDepth(8).play('gem-' + kinds[kind].gem, true);
    p.body.setSize(16, 16, false).setOffset(0, 0);
    p.setVelocity(0, CONFIG.powerups.fallSpeed);
  }

  onCollect(player, p) {
    if (!p.active || !this.alive) return;
    p.disableBody(true, true);
    const P = CONFIG.powerups;
    let text = P.kinds[p.kind].label;
    let maxed = false;
    if (p.kind === 'weapon') {
      if (this.weaponLevel < CONFIG.weapons.length - 1) {
        this.weaponLevel += 1;
        text = CONFIG.weapons[this.weaponLevel].name;
        this.registry.set('weapon', this.weaponLevel);
        sound.sfx('powerup');
      } else maxed = true;
    } else if (p.kind === 'shield') {
      if (!this.shield) {
        this.shield = true;
        this.registry.set('shield', true);
        sound.sfx('shield');
      } else maxed = true;
    } else if (p.kind === 'life') {
      if (this.lives < P.maxLives) {
        this.lives += 1;
        this.registry.set('lives', this.lives);
        sound.sfx('oneUp');
      } else maxed = true;
    }
    if (maxed) {
      this.addScore(P.maxedBonus);
      text = '+' + P.maxedBonus;
      sound.sfx('powerup');
    }
    this.floatText(p.x, p.y - 10, text, '#ffd166');
  }

  floatText(x, y, text, color) {
    const t = this.add.text(x, y, text, { ...FONT, color }).setOrigin(0.5).setStroke('#000000', 3).setDepth(40);
    t.x = Phaser.Math.Clamp(x, t.width / 2 + 2, CONFIG.width - t.width / 2 - 2);
    this.tweens.add({ targets: t, y: y - 24, alpha: 0, duration: 900, ease: 'Quad.easeOut', onComplete: () => t.destroy() });
  }

  // ---------- getting hit ----------

  // cause = { target: what hit (enemy, bullet, or a point for the boss/beam), kind, label }
  hurtPlayer(cause) {
    if (!this.alive || this.invulnerable || this.won) return;
    if (this.shield) this.breakShield(cause);
    else this.killPlayer(cause);
  }

  breakShield(cause) {
    this.shield = false;
    this.registry.set('shield', false);
    sound.sfx('shieldBreak');
    if (cause.kind === 'bullet' && cause.target.active) cause.target.disableBody(true, true);
    if (cause.kind === 'enemy' && cause.target.active) this.destroyEnemy(cause.target);
    this.playFx(this.hits, this.player.x, this.player.y, 'hit', 12);
    const ring = this.add.circle(this.player.x, this.player.y + 4, 19).setStrokeStyle(2, 0x5fd3ff).setDepth(11);
    this.tweens.add({ targets: ring, scale: 2.2, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    this.floatText(this.player.x, this.player.y - 24, 'SHIELD LOST', '#5fd3ff');
    this.startInvulnerable(CONFIG.shieldInvulnerableMs);
  }

  killPlayer(cause) {
    this.alive = false;
    this.dying = true;
    this.lives -= 1;
    this.lastDeath = cause.label;
    this.weaponLevel = Math.max(0, this.weaponLevel - 1); // dying costs one weapon level
    this.registry.set({ lives: this.lives, weapon: this.weaponLevel });
    this.endDrag();

    // 1) Freeze-frame: stop everything, flash the ship, circle and name the killer.
    const p = this.player;
    p.body.enable = false;
    p.setTintFill(0xffffff);
    this.frozen = true;
    this.physics.pause();
    this.showKiller(cause);
    sound.sfx('playerHit');

    // 2) Then resume: remove the killer, explode the ship, respawn or end the game.
    this.time.delayedCall(CONFIG.deathFreezeMs, () => {
      this.dying = false;
      this.frozen = false;
      this.physics.resume();
      this.hideKiller();
      if (cause.target.active) {
        if (cause.kind === 'enemy') this.destroyEnemy(cause.target);
        else if (cause.kind === 'bullet') cause.target.disableBody(true, true);
      }

      p.clearTint();
      this.playFx(this.bigBooms, p.x, p.y, 'explosion-big', 20, 0.78);
      sound.sfx('bigExplode');
      p.disableBody(true, true);
      this.thrusters.forEach((t) => t.setVisible(false));
      this.cameras.main.shake(250, 0.012);

      if (this.lives > 0) this.time.delayedCall(CONFIG.respawnDelay, () => this.respawn());
      else this.time.delayedCall(CONFIG.gameOverDelay, () => this.gameOver());
    });
  }

  showKiller({ target, kind, label }) {
    const { width } = CONFIG;
    const r = kind === 'enemy' ? 22 : kind === 'boss' ? 16 : 8;
    this.killRing.clear().lineStyle(2, 0xff4d6d, 1).strokeCircle(target.x, target.y, r).setVisible(true).setAlpha(1);
    // Label above the ring, or below it when the killer is near the top edge.
    const above = target.y - r - 30 > 0;
    const halfW = this.killLabel.setText(label).width / 2;
    this.killLabel
      .setPosition(Phaser.Math.Clamp(target.x, halfW + 2, width - halfW - 2), above ? target.y - r - 8 : target.y + r + 8)
      .setVisible(true);
    this.killBlink = this.tweens.add({ targets: this.killRing, alpha: 0.25, duration: 90, yoyo: true, repeat: -1 });
  }

  hideKiller() {
    if (this.killBlink) this.killBlink.stop();
    this.killRing.setVisible(false);
    this.killLabel.setVisible(false);
  }

  respawn() {
    // Clear enemy shots so the player never respawns into a bullet.
    this.enemyBullets.getMatching('active', true).forEach((b) => b.disableBody(true, true));

    const C = CONFIG;
    const p = this.player;
    p.enableBody(true, C.width / 2, C.player.startY, true, true);
    p.setFrame(0).setAlpha(1);
    this.bank = { dir: 0, time: 0 };
    this.thrusters.forEach((t) => t.setVisible(true));
    this.alive = true;
    this.startInvulnerable(C.invulnerableMs);
  }

  startInvulnerable(ms) {
    const p = this.player;
    this.invulnerable = true;
    if (this.blink) this.blink.stop();
    this.blink = this.tweens.add({ targets: [p, ...this.thrusters], alpha: 0.2, duration: 100, yoyo: true, repeat: -1 });
    if (this.invulnerableTimer) this.invulnerableTimer.remove();
    this.invulnerableTimer = this.time.delayedCall(ms, () => {
      this.blink.stop();
      p.setAlpha(1);
      this.thrusters.forEach((t) => t.setAlpha(1));
      this.invulnerable = false;
    });
  }

  // ---------- boss ----------

  onWavesComplete() {
    this.time.delayedCall(CONFIG.waves.bossDelay, () => {
      if (this.over) return;
      this.events.emit('boss-warning');
      sound.stopMusic();
      sound.sfx('warning');
      this.time.delayedCall(CONFIG.boss.warningMs, () => this.spawnBoss());
    });
  }

  spawnBoss() {
    if (this.over || this.boss) return;
    this.boss = new Boss(this);
    // sprite-vs-group overlap: the callback gets (boss, bullet) in that order
    this.physics.add.overlap(this.boss, this.bullets, this.onBulletHitsBoss, null, this);
    this.physics.add.overlap(this.boss, this.player, this.onPlayerHitsBoss, null, this);
    this.registry.set('bossHp', 1);
    this.events.emit('boss-start');
    sound.playMusic('boss');
  }

  skipToBoss() {
    if (this.boss || this.director.state === 'done') return;
    this.enemies.getMatching('active', true).forEach((e) => e.disableBody(true, true));
    this.director.skipToEnd();
  }

  // Called by the boss when its health reaches 0.
  onBossDefeated(boss) {
    this.won = true; // nothing can hurt the player any more
    this.addScore(CONFIG.boss.points);
    this.registry.set('bossHp', 0);
    this.enemyBullets.getMatching('active', true).forEach((b) => b.disableBody(true, true));
    sound.stopMusic();
    this.events.emit('boss-defeated');

    // Chain of explosions over the hull, then one big blast.
    for (let i = 0; i < 10; i++) {
      this.time.delayedCall(i * 210, () => {
        const x = boss.x + Phaser.Math.Between(-70, 70);
        const y = boss.y + Phaser.Math.Between(-40, 50);
        this.playFx(i % 2 ? this.bigBooms : this.explosions, x, y, i % 2 ? 'explosion-big' : 'enemy-explosion', 20, i % 2 ? 0.78 : 0.5);
        sound.sfx(i % 2 ? 'bigExplode' : 'explode');
        this.cameras.main.shake(180, 0.008);
      });
    }
    this.time.delayedCall(2200, () => {
      const { x, y } = boss;
      boss.destroyBoss();
      this.boss = null;
      [[0, 30], [-50, 10], [50, 10]].forEach(([dx, dy]) => this.playFx(this.bigBooms, x + dx, y + dy, 'explosion-big', 20, 0.78));
      sound.sfx('bigExplode');
      this.cameras.main.shake(700, 0.02);
      this.cameras.main.flash(250, 255, 255, 255);
      this.time.delayedCall(2200, () => this.victory());
    });
  }

  // ---------- endings ----------

  gameOver() {
    this.over = true;
    sound.stopMusic();
    sound.sfx('gameOver');
    const isNewBest = this.score > this.highScore;
    if (isNewBest) saveHighScore(this.score);
    this.scene.pause();
    this.scene.launch('GameOver', {
      score: this.score,
      highScore: Math.max(this.score, this.highScore),
      isNewBest,
      wave: this.director.number,
      killedBy: this.lastDeath,
    });
  }

  victory() {
    this.over = true;
    const bonus = this.lives * CONFIG.boss.clearBonusPerLife;
    const before = this.score;
    this.addScore(bonus);
    const isNewBest = this.score > this.highScore;
    if (isNewBest) saveHighScore(this.score);
    sound.sfx('victory');
    this.scene.pause();
    this.scene.launch('Victory', {
      score: this.score,
      baseScore: before,
      lives: this.lives,
      bonus,
      highScore: Math.max(this.score, this.highScore),
      isNewBest,
      timeMs: this.time.now - this.startTime,
    });
  }

  // ---------- pools & misc ----------

  // Plays a one-shot effect from a pool; it returns itself to the pool when the animation ends.
  playFx(pool, x, y, anim, depth, originY = 0.5) {
    const fx = pool.get(x, y);
    if (!fx) return;
    fx.setActive(true).setVisible(true).setDepth(depth).setOrigin(0.5, originY);
    fx.play(anim);
    fx.once('animationcomplete', () => fx.setActive(false).setVisible(false));
  }

  recycleOffscreen() {
    const { width, height } = CONFIG;
    this.bullets.getMatching('active', true).forEach((b) => {
      if (b.y < -40 || b.x < -40 || b.x > width + 40) b.disableBody(true, true);
    });
    this.enemies.getMatching('active', true).forEach((e) => {
      if (e.y > height + 40 || e.x < -60 || e.x > width + 60) e.disableBody(true, true);
    });
    this.enemyBullets.getMatching('active', true).forEach((b) => {
      if (b.y > height + 10 || b.y < -10 || b.x < -10 || b.x > width + 10) b.disableBody(true, true);
    });
    this.powerups.getMatching('active', true).forEach((p) => {
      if (p.y > height + 16) p.disableBody(true, true);
    });
  }

  updateDebug() {
    const pool = (g) => `${g.countActive(true)}/${g.getLength()}`;
    this.debugText.setText([
      `FPS ${Math.round(this.game.loop.actualFps)}`,
      `WAVE ${this.director.number}/${this.director.total}`,
      `WEAPON ${this.weaponLevel + 1} SHIELD ${this.shield ? 'ON' : 'OFF'}`,
      this.boss ? `BOSS ${this.boss.hp}/${this.boss.maxHp} ${this.boss.state}` : 'BOSS -',
      `BOLTS ${pool(this.bullets)}`,
      `ENEMIES ${pool(this.enemies)}`,
      `E-SHOTS ${pool(this.enemyBullets)}`,
      `PICKUPS ${pool(this.powerups)}`,
    ]);
  }

  toggleMute() {
    this.registry.set('muted', sound.toggleMute());
  }

  pauseGame() {
    if (this.over) return;
    sound.sfx('pause');
    sound.setPaused(true);
    this.scene.pause();
    this.scene.launch('Pause');
  }

  openGallery() {
    if (this.over) return;
    sound.setPaused(true);
    this.scene.sleep();
    this.scene.sleep('Hud');
    this.scene.launch('Gallery', { returnTo: ['Game', 'Hud'] });
  }
}
