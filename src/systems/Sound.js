import { CONFIG } from '../config.js';

// All sound is synthesized at runtime with Web Audio (sfxr-style blips, noise bursts and a small
// chiptune sequencer), so the game ships no audio files and needs no extra licences (spec: CC0 or ours).
// It shares Phaser's AudioContext, which Phaser unlocks on the first click, tap or key press.
//
// Usage: sound.init(game) once in Boot, then sound.sfx('shoot'), sound.playMusic('stage'), ...

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// ---- music: 8th-note steps, 4 bars of 8 steps; null = rest ----
const TRACKS = {
  stage: {
    bpm: 150,
    // Am - F - C - G arpeggios
    lead: [
      69, 72, 76, 72, 69, 72, 76, 79,
      65, 69, 72, 69, 65, 69, 72, 77,
      67, 72, 76, 72, 67, 72, 76, 79,
      67, 71, 74, 71, 67, 71, 74, 79,
    ],
    // second pass: a simple tune on top instead of arpeggios
    lead2: [
      81, null, 79, 76, 77, null, 76, 72,
      77, null, 76, 72, 74, null, 72, 69,
      76, null, 74, 72, 79, null, 76, 72,
      74, null, 72, 71, 74, 76, 79, null,
    ],
    bass: [45, 57, 45, 57, 41, 53, 41, 53, 48, 60, 48, 60, 43, 55, 43, 55],
    drums: 'k.h.s.h.k.h.s.hh', // per 8th: k kick, s snare, h hat, . rest (16 steps = 2 bars, repeated)
  },
  boss: {
    bpm: 172,
    // Em - C - D - B
    lead: [
      76, 79, 83, 79, 76, 79, 83, 86,
      72, 76, 79, 76, 72, 76, 79, 84,
      74, 78, 81, 78, 74, 78, 81, 86,
      71, 75, 78, 75, 71, 75, 78, 83,
    ],
    lead2: [
      88, 86, 83, 86, 88, null, 91, 88,
      84, 83, 79, 83, 84, null, 88, 84,
      86, 84, 81, 84, 86, null, 90, 86,
      83, 81, 78, 81, 83, 87, 90, 95,
    ],
    bass: [40, 40, 52, 40, 36, 36, 48, 36, 38, 38, 50, 38, 35, 35, 47, 35],
    drums: 'khshkhshkhshkhss',
  },
};

class SoundSystem {
  init(game) {
    this.ctx = game.sound && game.sound.context ? game.sound.context : null;
    this.muted = loadMuted();
    this.last = {};
    if (!this.ctx) return; // no Web Audio: every call becomes a no-op

    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.muted ? 0 : CONFIG.sound.master;
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.sfxBus.gain.value = CONFIG.sound.sfx;
    this.sfxBus.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = CONFIG.sound.music;
    this.musicBus.connect(this.master);

    const len = c.sampleRate; // 1 s of white noise, reused by every noise sound
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  // ---------- mute / pause ----------

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  setMuted(m) {
    this.muted = m;
    saveMuted(m);
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : CONFIG.sound.master, this.ctx.currentTime, 0.02);
  }

  // Pausing the game silences music and holds its place. (Not ctx.suspend(): Phaser itself resumes the
  // context when the window regains focus, which would restart music on a paused game.)
  setPaused(paused) {
    this.paused = paused;
    if (this.musicBus) {
      this.musicBus.gain.setTargetAtTime(paused ? 0 : CONFIG.sound.music, this.ctx.currentTime, 0.02);
    }
  }

  // ---------- building blocks ----------

  tone({ type = 'square', freq, to = null, dur = 0.1, vol = 0.2, when = null, attack = 0.004, bus = this.sfxBus }) {
    const c = this.ctx;
    const t = when ?? c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise({ dur = 0.2, vol = 0.2, freq = 3000, to = null, filter = 'lowpass', when = null, bus = this.sfxBus }) {
    const c = this.ctx;
    const t = when ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = dur > 0.9;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  notes(list, { type = 'square', step = 0.07, vol = 0.12, dur = null } = {}) {
    const t0 = this.ctx.currentTime;
    list.forEach((n, i) => {
      if (n !== null) this.tone({ type, freq: midi(n), dur: dur ?? step * 0.95, vol, when: t0 + i * step });
    });
  }

  // Limits how often one sound can start (rapid fire, many hits in one frame).
  throttle(name, ms) {
    const now = this.ctx.currentTime * 1000;
    if (this.last[name] && now - this.last[name] < ms) return false;
    this.last[name] = now;
    return true;
  }

  // ---------- sound effects ----------

  sfx(name, arg) {
    if (!this.running) return;
    const fn = SFX[name];
    if (fn) fn.call(this, arg);
  }

  // ---------- music ----------

  playMusic(name) {
    if (!this.ctx || this.trackName === name) return;
    this.stopMusic();
    this.trackName = name;
    this.track = TRACKS[name];
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.trackName = null;
  }

  schedule() {
    if (!this.running || this.paused) {
      // game paused, or context suspended / not unlocked yet: restart the clock when it runs again
      this.nextTime = this.ctx.currentTime + 0.05;
      return;
    }
    const tr = this.track;
    const stepLen = 60 / tr.bpm / 2; // 8th notes
    // Catch up after a stall instead of playing a burst of missed notes.
    if (this.nextTime < this.ctx.currentTime - 0.2) this.nextTime = this.ctx.currentTime + 0.05;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      this.playStep(tr, this.step, this.nextTime, stepLen);
      this.step += 1;
      this.nextTime += stepLen;
    }
  }

  playStep(tr, step, t, len) {
    const bus = this.musicBus;
    const leadLine = Math.floor(step / tr.lead.length) % 2 === 0 ? tr.lead : tr.lead2;
    const n = leadLine[step % leadLine.length];
    if (n !== null) this.tone({ type: 'square', freq: midi(n), dur: len * 0.9, vol: 0.09, when: t, bus });
    if (step % 2 === 0) {
      const b = tr.bass[(step / 2) % tr.bass.length];
      this.tone({ type: 'triangle', freq: midi(b), dur: len * 1.8, vol: 0.32, when: t, bus });
    }
    const d = tr.drums[step % tr.drums.length];
    if (d === 'k') this.tone({ type: 'sine', freq: 150, to: 40, dur: 0.14, vol: 0.5, when: t, bus });
    if (d === 's') this.noise({ dur: 0.12, vol: 0.18, freq: 1800, filter: 'bandpass', when: t, bus });
    if (d === 'h' || d === 's' || d === 'k') this.noise({ dur: 0.03, vol: 0.05, freq: 7000, filter: 'highpass', when: t, bus });
  }
}

// Each effect runs with `this` = the SoundSystem.
const SFX = {
  shoot(level = 0) {
    if (!this.throttle('shoot', 60)) return;
    if (level === 0) this.tone({ freq: 1400, to: 500, dur: 0.06, vol: 0.05 });
    else if (level === 1) this.tone({ type: 'sawtooth', freq: 900, to: 300, dur: 0.07, vol: 0.05 });
    else {
      this.tone({ type: 'sawtooth', freq: 420, to: 110, dur: 0.12, vol: 0.07 });
      this.noise({ dur: 0.06, vol: 0.05, freq: 5000 });
    }
  },
  hit() {
    if (!this.throttle('hit', 30)) return;
    this.noise({ dur: 0.04, vol: 0.12, freq: 6000 });
  },
  explode() {
    if (!this.throttle('explode', 40)) return;
    this.noise({ dur: 0.35, vol: 0.3, freq: 3000, to: 150 });
    this.tone({ type: 'triangle', freq: 140, to: 40, dur: 0.3, vol: 0.25 });
  },
  bigExplode() {
    if (!this.throttle('bigExplode', 90)) return;
    this.noise({ dur: 1.0, vol: 0.45, freq: 2000, to: 60 });
    this.tone({ type: 'sine', freq: 90, to: 28, dur: 0.9, vol: 0.45 });
  },
  playerHit() {
    this.tone({ type: 'square', freq: 700, to: 70, dur: 0.5, vol: 0.14 });
  },
  powerup() {
    this.notes([72, 76, 79, 84, 88], { step: 0.055, vol: 0.12 });
  },
  shield() {
    this.tone({ type: 'triangle', freq: 300, to: 1400, dur: 0.3, vol: 0.25 });
    this.tone({ type: 'sine', freq: 600, to: 2000, dur: 0.3, vol: 0.12 });
  },
  oneUp() {
    this.notes([76, 79, 88, 84, 86, 91], { step: 0.07, vol: 0.13 });
  },
  shieldBreak() {
    this.noise({ dur: 0.3, vol: 0.25, freq: 2500, filter: 'highpass' });
    this.tone({ type: 'square', freq: 1500, to: 200, dur: 0.25, vol: 0.1 });
  },
  warning() {
    const t0 = this.ctx.currentTime;
    for (let i = 0; i < 8; i++) {
      this.tone({ type: 'square', freq: i % 2 ? 440 : 660, dur: 0.28, vol: 0.1, when: t0 + i * 0.3 });
    }
  },
  bossHit() {
    if (!this.throttle('bossHit', 50)) return;
    this.tone({ type: 'square', freq: 200, to: 120, dur: 0.05, vol: 0.06 });
  },
  armorBreak() {
    this.noise({ dur: 0.8, vol: 0.4, freq: 3000, to: 200 });
    this.tone({ type: 'sawtooth', freq: 300, to: 50, dur: 0.8, vol: 0.2 });
  },
  charge(ms = 1000) {
    this.tone({ type: 'sawtooth', freq: 120, to: 1600, dur: ms / 1000, vol: 0.08, attack: 0.2 });
  },
  beam(ms = 1500) {
    const dur = ms / 1000;
    this.tone({ type: 'sawtooth', freq: 70, to: 60, dur, vol: 0.12, attack: 0.02 });
    this.noise({ dur, vol: 0.12, freq: 900, filter: 'bandpass' });
  },
  victory() {
    this.notes([72, 72, 72, 76, null, 74, 77, 79, null, null, 84], { step: 0.12, vol: 0.14 });
  },
  gameOver() {
    this.notes([72, 71, 69, 67, 64, 60], { type: 'triangle', step: 0.18, vol: 0.25 });
  },
  pause() {
    this.notes([84, 79], { step: 0.06, vol: 0.08 });
  },
};

function loadMuted() {
  try {
    return window.localStorage.getItem(CONFIG.mutedKey) === '1';
  } catch {
    return false;
  }
}

function saveMuted(m) {
  try {
    window.localStorage.setItem(CONFIG.mutedKey, m ? '1' : '0');
  } catch {
    // ignore
  }
}

export const sound = new SoundSystem();
