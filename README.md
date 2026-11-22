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
| Bomb (when you have one), fires when you let go | Tap X | Tap the `BOMB n` button (top bar) |
| God mode: all 6 power-ups at once, once per game | Hold X for 5 s | Hold the `BOMB` button for 5 s |
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
  - **Green Koala** (`grunt`): flies down, stops and flashes red for 0.4 s, then dives straight at where
    your ship is, 2 HP, 100 points
  - **Blue Koala** (`weaver`): sine-wave path, fires one aimed shot. While it is far from your ship it
    blinks and turns invisible for 2 s (your shots pass through it and it can't ram you), then waits
    1.5 s before it can do it again, 3 HP, 200 points
  - **Red Koala** (`gunship`): parks near the top, fires 3-shot aimed bursts of big bullets, then leaves,
    6 HP, 400 points. It has a visible blue bubble shield that absorbs the first 4 hits (it flashes on each
    hit, dims as it weakens, then pops). While the bubble is up, the bubble is its hitbox. Bombs go
    straight through it.
- **Rocks** (the drifting asteroids) are hazards: touching one costs a life, or your shield, and the rock
  breaks apart. You can shoot them: a rock stops your shots, flashes on each hit and breaks after
  3–7 hits depending on its size (bigger rocks take more), for 50 points. The hit circle is a little smaller than the rock
  (`props.near.hitScale` in `config.js`), and at the start they are all in the top half of the screen.
- Bullet sizes: your shots are 50% of the art's size; Green and Blue Koala bullets 150%, Red Koala
  bullets 300%, Koala King bullets 100%.
- **Bonus slot machine** after every cleared wave (5 per run): the action pauses, 3 reels of gems spin
  on their own and always pay out one random power-up, then play resumes. After wave 5 the boss
  follows. This is the only way to get power-ups; enemies drop nothing.
- **Power-ups** (gem colours on the reels, odds per spin):
  - Yellow (29%): weapon level up — bolt → double pulse → charged shot (+ angled pulses)
  - Blue (21%): shield, absorbs one hit
  - Red (11%): extra life
  - Green (14%): RAPID FIRE — shoot 1.8x faster
  - Pink (14%): WINGMEN — two mini ships beside you, each adds a bolt to every shot
  - Orange (11%): BOMB — stored (up to 3; every game starts with 1 free), set off with X or the BOMB button: clears all enemy bullets,
    does 8 damage to every Koala and rock on screen and 40 to the Koala King (when its armour is open)
  - Rapid fire and wingmen last until the next bonus spin (won on the wave 5 spin: the whole boss fight).
    Dying doesn't remove them. Bombs carry over.
  - A prize that can't raise anything further gives 1000 points. Dying costs one weapon level.
- **Koala King taunt** (after the WARNING, 2 s, picked at random 1 in 3):
  - "YOUR DAYS ARE NUMBERED!" — SPEED BOOST: boss moves 25% faster (not its bullets) and opens the
    fight by dropping 4 Green Koalas that dive at you
  - "DO YOU MISS ME?" — no boost, but it opens with 2 shielded Red Koalas parked just below it
  - "POWER OF KOALA!" — HP BOOST: boss has 10% more HP (770) and opens with 3 cloaking Blue Koalas
  - The escort comes out from under the boss one by one as soon as it has flown in (`summon` on each
    taunt in `config.js`); they are normal Koalas with their usual points.
- **Koala King** (after the last wave): WARNING, taunt, then
  - Phase 1: sways, side cannons fire bullet fans, every third fan an aimed burst
  - Phase 2 (below 50%): armour, helmet and cannons blow off; fans from the core alternate with a ray beam
    (1 s charge-up with a red line showing where it will fire, then a sweeping beam)
  - Defeat: explosion chain → Victory screen with a lives bonus (2000 per life)
- **Top 3 pilots:** a score that makes the top 3 asks for a name (up to 10 letters, digits or `. - _ ! '`)
  on the Game Over or Stage Clear screen, in a real text box so phones open their keyboard. Enter or OK
  saves it (empty = `PILOT`); then the retry / play-again controls unlock. The title screen lists the top 3.
  The list is monthly ("TOP 3 PILOTS OF NOVEMBER"): it starts over empty on the 1st of each month, by the
  player's local date. The all-time HI score is kept.
- High score, top 3 and the mute setting are saved in `localStorage` (this browser only).
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

Everything is in `src/config.js`: player speed, weapons, slot prize odds, boss health and attack timings,
sound volumes. Boss fight length at 700 HP, measured before the fire rate was cut by 25% and the player's
shots were halved in size: starting bolt ~150 s, double pulse ~79 s, charged shot ~36 s. Expect about a third
longer now.

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
