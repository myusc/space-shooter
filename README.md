# Koala's Retro Space Shooter

Vertical-scrolling shooter built with Phaser 3.80.1 + Vite and the CC0 ansimuz Legacy Collection art.
One stage of 5 waves, then the Koala King. A full run takes about 3–5 minutes.

## Run

```powershell
npm install        # first time only
npm run dev        # dev server with hot reload, prints a local URL
npm run dev -- --host   # same, reachable from a phone on your Wi-Fi
npm run build      # production build to dist/
npm run preview    # serve dist/ locally to check the build
npm run package    # build + koalas-retro-space-shooter.zip for itch.io
```

### Publishing on itch.io

1. `npm run package`
2. On itch.io: **Create new project** → Kind of project: **HTML** → upload `koalas-retro-space-shooter.zip`
   → tick **This file will be played in the browser**.
3. Embed options: viewport about **640 × 960** (or tick *Click to launch in fullscreen* / *Mobile friendly*).
   The game scales itself to whatever size it gets.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Start / retry | Space or Enter | Tap |
| Move | Arrows or WASD (also while the mouse button is held) | Drag anywhere (ship moves relative to your finger) |
| Fire | Hold Space, Z or J | Hold the mouse button / finger down |
| Pause | P or Esc | `II` button |
| Mute | M | `SND` / `OFF` button |
| Back to title (Game Over / Victory) | Esc | — |
| Art gallery | G | `ART` button |
| Debug overlay (FPS, wave, weapon, boss, pools) | I | — |
| Skip to the boss (dev server only) | B | — |

In dev mode the Phaser game instance is `window.__GAME__` and the sound system `window.__SOUND__`.

## Gameplay

- 3 lives (up to 5). Enemies, enemy shots, the boss and its beam kill; the freeze-frame names what got you.
- **Enemies** (type key used in `waves.json` / `config.js` in brackets):
  - **Green Koala** (`grunt`): flies straight down, 2 HP, 100 points
  - **Blue Koala** (`weaver`): sine-wave path, fires one aimed shot, 3 HP, 200 points
  - **Red Koala** (`gunship`): parks near the top, fires 3-shot aimed bursts, then leaves, 6 HP, 400 points
- **Bonus slot machine** after every cleared wave (5 per run): the action pauses, 3 reels of gems spin
  on their own and always pay out one random power-up (same odds as drops: 50% weapon, 30% shield,
  20% life), then play resumes. After wave 5 the boss follows.
- **Power-up drops** (gems from destroyed enemies: 3% of Green, 5% of Blue, 17.5% of Red Koalas):
  - Yellow: weapon level up — bolt → double pulse → charged shot (+ angled pulses)
  - Blue: shield, absorbs one hit
  - Red: extra life
  - A pickup that can't raise anything further gives 1000 points. Dying costs one weapon level.
- **Koala King taunt** (after the WARNING, 2 s, picked at random 1 in 3):
  - "YOUR DAYS ARE NUMBERED!" — SPEED BOOST: boss moves 10% faster (not its bullets)
  - "DO YOU MISS ME?" — no change
  - "POWER OF KOALA!" — HP BOOST: boss has 10% more HP (770)
- **Koala King** (after the last wave): WARNING, taunt, then
  - Phase 1: sways, side cannons fire bullet fans, every third fan an aimed burst
  - Phase 2 (below 50%): armour, helmet and cannons blow off; fans from the core alternate with a ray beam
    (1 s charge-up with a red line showing where it will fire, then a sweeping beam)
  - Defeat: explosion chain → Victory screen with a lives bonus (2000 per life)
- High score saved in `localStorage`; mute setting too.
- Sound: all effects and the two music tracks (stage, boss) are synthesized in code with Web Audio
  (`src/systems/Sound.js`), so there are no audio files to license.

## Editing waves

Each wave in `src/data/waves.json` is a list of spawn groups:

```json
{ "at": 4000, "type": "weaver", "formation": "column", "count": 4, "x": 176, "interval": 700, "amp": 60 }
```

`at` is ms after the wave starts; `formation` is `line`, `v`, `column` or `random`; extra keys (`speed`,
`vx`, `amp`, `freq`, `phase`, `stopY`, `bursts`, ...) override that enemy type's values in `src/config.js`.
A wave ends when everything has spawned and is gone, then `delay` ms (default 3000) pass. After the last
wave the boss arrives.

## Tuning

Everything is in `src/config.js`: player speed, weapons, drop chances, boss health and attack timings,
sound volumes. Boss fight length at the current 700 HP (measured): starting bolt ~150 s, double pulse ~79 s,
charged shot ~36 s.

## Layout

```
index.html              entry page
public/assets/          PNGs copied from the Legacy Collection (renamed), loaded by key
src/config.js           tuning values, enemy types, weapons, boss, sprite sheet frame sizes, asset list
src/data/waves.json     wave script
src/objects/            Enemy (pooled grunt / weaver / gunship), Boss (Koala King)
src/systems/            WaveDirector, Starfield (background + parallax), Sound (synth + music), highScore
src/scenes/             Boot, Title, Game, Hud, Pause, GameOver, Victory, Gallery
scripts/package.mjs     zips dist/ for itch.io
vite.config.js
```
