// All tuning values (spec N6: no magic numbers inside scenes).
// 320x480 (2:3) scales by a whole number on phones: 3x = 960x1440 on most modern phones,
// 2x = 640x960 on small ones and on a 1080p desktop.
const WIDTH = 320;
const HEIGHT = 480;

export const CONFIG = {
  width: WIDTH,
  height: HEIGHT,
  bgScrollSpeed: 28, // px/s

  player: {
    speed: 140, // px/s (keyboard)
    fireRate: 7, // shots per second
    startY: HEIGHT - 44,
    bankDelay: 0.15, // seconds of turning before the full bank frame
    // keep the ship's visible art inside the screen
    bounds: { left: 14, right: WIDTH - 14, top: 20, bottom: HEIGHT - 20 },
  },

  lives: 3,
  deathFreezeMs: 600, // freeze-frame on death: the killer is circled and named before the explosion
  respawnDelay: 1200, // ms between the player's explosion and the respawn
  invulnerableMs: 2000, // blinking after a respawn
  gameOverDelay: 1800, // ms between the last explosion and the Game Over screen

  bolt: { speed: 320, poolSize: 48 },

  // Player weapon levels (power-ups raise it, dying lowers it by one).
  // Each shot: sprite sheet + animation, x offset from the ship, angle in degrees (0 = straight up),
  // damage. Sprite orientation (origin/rotation/hitbox) per sheet is in SHOT_SPRITES below.
  weapons: [
    { name: 'BOLT', fireRate: 7, shots: [{ sprite: 'shot-bolt', dx: 0, angle: 0, damage: 1 }] },
    {
      name: 'DOUBLE PULSE', fireRate: 7,
      shots: [
        { sprite: 'shot-pulse', dx: -7, angle: 0, damage: 1 },
        { sprite: 'shot-pulse', dx: 7, angle: 0, damage: 1 },
      ],
    },
    {
      name: 'CHARGED SHOT', fireRate: 6,
      shots: [
        { sprite: 'shot-charged', dx: 0, angle: 0, damage: 3 },
        { sprite: 'shot-pulse', dx: -12, angle: -8, damage: 1 },
        { sprite: 'shot-pulse', dx: 12, angle: 8, damage: 1 },
      ],
    },
  ],

  // Pickups dropped by destroyed enemies (gems from the Legacy Collection).
  powerups: {
    dropChance: { grunt: 0.03, weaver: 0.05, gunship: 0.175 }, // halved once the wave-clear slot machine was added
    kinds: {
      weapon: { gem: 'yellow', weight: 5, label: 'POWER UP' },
      shield: { gem: 'blue', weight: 3, label: 'SHIELD' },
      life: { gem: 'red', weight: 2, label: '1UP' },
    },
    fallSpeed: 45,
    maxLives: 5,
    maxedBonus: 1000, // points for a pickup that can't raise anything further
  },
  shieldInvulnerableMs: 1000, // grace after the shield absorbs a hit

  // Bonus slot machine after every cleared wave: spins on its own and always pays one random power-up
  // (same odds as the power-up weights above). Times in ms.
  slot: { delay: 600, spinMs: 1100, reelGap: 400, tickMs: 70, showPrizeMs: 1000 },

  // The stage boss, after the last wave of waves.json.
  boss: {
    name: 'KOALA KING',
    hp: 700, // measured fight length (bot staying under the boss): bolt 150 s, double pulse 79 s, charged 36 s
    points: 10000,
    hitPoints: 10, // per bullet that hits
    clearBonusPerLife: 2000,
    warningMs: 2600, // WARNING banner before it enters
    enterSpeed: 40,
    homeY: 104,
    body: [150, 90, 21, 24], // hitbox inside the 192x144 frame
    cannons: [{ dx: -56, dy: 42 }, { dx: 56, dy: 42 }], // phase-1 gun nozzles, from the boss centre
    mouth: { dx: 0, dy: 40 }, // phase-2 core, where the ray beam starts
    phase1: { swayAmp: 70, swayHz: 0.12, fanEvery: 1500, fanShots: 5, fanSpread: 60, aimedEvery: 3 },
    phase2: {
      at: 0.5, // fraction of hp left
      swayAmp: 80, swayHz: 0.18,
      spreadMs: 3200, fanEvery: 800, fanShots: 7, fanSpread: 90,
      chargeMs: 1100, beamMs: 1700, beamTrackSpeed: 45, beamHalfWidth: 7,
    },
    hitStopMs: 35, hitStopEvery: 300, // short freeze on hits, at most this often

    // After the WARNING, one of these is picked at random (1 in 3) and shown for tauntMs before the
    // boss flies in. speedMul scales boss movement (not bullets), hpMul scales its health.
    tauntMs: 2000,
    taunts: [
      { text: 'YOUR DAYS ARE NUMBERED!', sub: 'SPEED BOOST!', speedMul: 1.1 },
      { text: 'DO YOU MISS ME?', sub: '' },
      { text: 'POWER OF KOALA!', sub: 'HP BOOST!', hpMul: 1.1 },
    ],
  },

  // Enemy types used by src/data/waves.json. Speeds are px/s, times are ms.
  // body = [width, height, offsetX, offsetY] of the hitbox inside the 48x48 frame.
  enemies: {
    grunt: {
      name: 'GREEN KOALA', key: 'enemy-01', anim: 'enemy-01-fly', hp: 2, points: 100,
      speed: 68, body: [27, 27, 10, 7],
    },
    weaver: {
      name: 'BLUE KOALA', key: 'enemy-02', anim: 'enemy-02-fly', hp: 3, points: 200,
      speed: 56, amp: 50, freq: 0.5, // sine sway: amplitude px, cycles per second
      fireYMin: 60, fireYMax: 220, // fires one aimed shot somewhere in this band
      body: [26, 22, 11, 11],
    },
    gunship: {
      name: 'RED KOALA', key: 'enemy-03', anim: 'enemy-03-fly', hp: 6, points: 400,
      speed: 62, stopY: 64, // flies in, parks at stopY
      bursts: 3, burstInterval: 1400, burstShots: 3, shotGap: 140,
      leaveSpeed: 100, // then flies off the bottom
      body: [34, 26, 7, 11],
    },
  },
  enemyPool: 30,

  enemyBullet: { speed: 125, poolSize: 140 },

  waves: {
    firstDelay: 1500, // ms before wave 1
    defaultDelay: 3000, // ms between waves
    spawnY: -24,
    bossDelay: 1500, // ms after the last wave before the boss warning
  },

  sound: { master: 0.6, sfx: 0.9, music: 0.45 },
  mutedKey: 'space-shooter.muted',

  fx: { hitPool: 24, explosionPool: 12, flashMs: 60 },

  highScoreKey: 'space-shooter.highScore',

  props: {
    far: { keys: ['prop-planet', 'prop-eclipse-1', 'prop-eclipse-2'], count: 1, speed: 10 },
    near: {
      keys: ['prop-asteroid-01', 'prop-asteroid-02', 'prop-asteroid-03', 'prop-asteroid-04', 'prop-asteroid-05'],
      count: 4,
      minSpeed: 36,
      maxSpeed: 56,
    },
  },
};

// Sprite sheet frame sizes, measured from the Legacy Collection files.
// Keys not listed here are single images.
export const SHEETS = {
  'player-ship': [48, 48], // 0 level, 1-2 bank left, 3-4 bank right
  'player-thrust': [8, 10],
  'ship-yellow-01': [48, 48],
  'ship-yellow-02': [64, 64],
  'ship-yellow-03': [48, 48],
  'ship-yellow-04': [48, 48],
  'shot-bolt': [48, 32],
  'shot-pulse': [63, 32],
  'shot-charged': [63, 48],
  'hit': [31, 32],
  'enemy-01': [48, 48],
  'enemy-02': [48, 48],
  'enemy-03': [48, 48],
  'enemy-explosion': [80, 80],
  'explosion-big': [128, 128],
  'boss': [192, 144],
  'boss-thrust': [128, 48],
  'boss-rays': [64, 224],
  'boss-bolt': [8, 8],
  'gems': [16, 16],
};

// How each player shot sheet is drawn: the art flies sideways, so it is rotated to fly up.
// origin = the glowing head inside the frame; body = [w, h, offsetX, offsetY] around that head.
export const SHOT_SPRITES = {
  'shot-bolt': { anim: 'shot-bolt', origin: [12 / 48, 16 / 32], rotate: 90, body: [12, 12, 6, 10] }, // flies left
  'shot-pulse': { anim: 'shot-pulse', origin: [55 / 63, 16 / 32], rotate: -90, body: [10, 10, 50, 11] }, // flies right
  'shot-charged': { anim: 'shot-charged', origin: [52 / 63, 24 / 48], rotate: -90, body: [20, 20, 42, 14] }, // flies right
};

// Every asset linked in the spec, loaded from public/assets/<key>.png.
// Boot refuses to start if any of them fails to load.
export const REQUIRED_ASSETS = [
  'player-ship', 'player-thrust',
  'ship-yellow-01', 'ship-yellow-02', 'ship-yellow-03', 'ship-yellow-04',
  'stage-back',
  'prop-planet', 'prop-eclipse-1', 'prop-eclipse-2',
  'prop-asteroid-01', 'prop-asteroid-02', 'prop-asteroid-03', 'prop-asteroid-04', 'prop-asteroid-05',
  'shot-bolt', 'shot-pulse', 'shot-charged', 'hit',
  'enemy-01', 'enemy-02', 'enemy-03', 'enemy-explosion', 'explosion-big',
  'boss', 'boss-thrust', 'boss-cannon-left', 'boss-cannon-right', 'boss-helmet', 'boss-rays', 'boss-bolt',
  'gems',
];

// Gem colour runs on the 16x16 grid of gems.png (row 2, 7 frames each, 8 columns apart).
export const GEMS = ['green', 'orange', 'red', 'yellow', 'pink', 'blue'].map((name, i) => {
  const first = 2 * 53 + 4 + i * 8; // 53 columns per row
  return { name, frames: [0, 1, 2, 3, 4, 5, 6].map((n) => first + n) };
});

export const FONT = { fontFamily: 'Consolas, "Courier New", monospace', fontSize: '8px', color: '#e6f7ff' };

// Scale in *device* pixels.
// - Touch devices (phones, tablets): largest whole number, so every art pixel is a crisp square (spec N2).
// - Desktop (mouse): fill the window. A 1080p browser is ~950 px tall, so whole-number 2x (960 px) just
//   misses and would drop to a tiny 1x; filling gives ~1.98x. Whole numbers are still used when they come
//   within 10% of filling the window. Fractional scales make pixels very slightly uneven.
export const DESKTOP_WHOLE_FILL = 0.9;

export function computeZoom() {
  const dpr = window.devicePixelRatio || 1;
  const fit = Math.min(
    (window.innerWidth * dpr) / CONFIG.width,
    (window.innerHeight * dpr) / CONFIG.height,
  );
  const whole = Math.max(1, Math.floor(fit));
  const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const z = touch || whole / fit >= DESKTOP_WHOLE_FILL ? whole : fit;
  return z / dpr;
}
