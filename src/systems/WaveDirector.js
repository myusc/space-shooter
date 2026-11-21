import Phaser from 'phaser';
import { CONFIG } from '../config.js';

// Plays the wave script from src/data/waves.json, one wave at a time. When the last wave has been
// cleared it calls scene.onWavesComplete() (the boss fight) and stops.
export class WaveDirector {
  constructor(scene, script) {
    this.scene = scene;
    this.waves = script.waves;
    this.index = -1;
    this.number = 0; // 1-based wave shown to the player
    this.state = 'intermission';
    this.timer = CONFIG.waves.firstDelay;
    this.queue = [];
  }

  get total() {
    return this.waves.length;
  }

  update(delta) {
    if (this.state === 'done') return;
    if (this.state === 'intermission') {
      this.timer -= delta;
      if (this.timer <= 0) this.startNextWave();
      return;
    }

    this.elapsed += delta;
    while (this.queue.length && this.queue[0].at <= this.elapsed) {
      const s = this.queue.shift();
      this.scene.spawnEnemy(s.type, s.x, s.y, s.overrides, 1);
    }

    if (!this.queue.length && this.scene.enemies.countActive(true) === 0) {
      this.scene.onWaveCleared(this.number);
      if (this.index >= this.waves.length - 1) {
        this.state = 'done';
        this.scene.onWavesComplete();
        return;
      }
      this.state = 'intermission';
      this.timer = this.wave.delay ?? CONFIG.waves.defaultDelay;
    }
  }

  startNextWave() {
    this.index += 1;
    this.number += 1;
    this.wave = this.waves[this.index];
    this.elapsed = 0;
    this.queue = this.expand(this.wave);
    this.state = 'running';
    this.scene.onWaveStart(this.number, this.wave.name, this.total);
  }

  // Debug: drop the remaining waves and go straight to the boss.
  skipToEnd() {
    this.queue = [];
    this.index = this.waves.length - 1;
    this.state = 'running';
    this.wave = this.waves[this.index];
  }

  // Turns formation groups into a time-sorted list of single spawns.
  expand(wave) {
    const { width } = CONFIG;
    const y0 = CONFIG.waves.spawnY;
    const list = [];
    for (const g of wave.groups) {
      const { at = 0, type, formation = 'line', count = 1, x = width / 2, spacing = 32, interval = 0, ...overrides } = g;
      for (let i = 0; i < count; i++) {
        const offset = i - (count - 1) / 2;
        let sx = x;
        let sy = y0;
        if (formation === 'line') sx = x + offset * spacing;
        else if (formation === 'v') {
          sx = x + offset * spacing;
          sy = y0 - Math.abs(offset) * spacing * 0.6;
        } else if (formation === 'random') sx = Phaser.Math.Between(24, width - 24);
        list.push({ at: at + i * interval, type, x: Phaser.Math.Clamp(sx, 16, width - 16), y: sy, overrides });
      }
    }
    return list.sort((a, b) => a.at - b.at);
  }
}
