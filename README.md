# Kestrel Isles — a bush-flying game

[![Competition](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/sastra-wev/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/sastra-wev/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057)

An original chase-view flight game that runs from static files in a desktop
browser — no build step, no network requests, no dependencies. You fly the
Kestrel K-1, a single-engine bush plane, around a hand-built archipelago of
five islands at golden hour: a pseudo-3D world rendered on a 2D canvas from an
analytic heightfield, with a working instrument panel, synthesized engine and
wind audio, and landings that are judged, not just detected.

## The sorties

1. **Kestrel Ring Run** — take off from Kestrel Field, thread seven golden
   rings over the bay in order, and land back home to bank the score.
2. **Gull Rock Mail Run** — cross the water and put the mail down on the short
   strip at Gull Rock, with the lighthouse sweeping the point.
3. **Storm Survey** — five wide survey gates in a gusting crosswind; the
   weather is part of the aeroplane now, so fly the gusts, not just the gates.

Every sortie is scored on gates, the quality of the landing (greased, firm,
hard, rough, belly or worse), the fuel you bring home, and the clock — graded
S to D, with your best kept per sortie.

## Flying

- **Arrow keys** — stick (↓ pulls the nose up, as a stick does); **mouse**
  works as a stick too, with the wheel for throttle notches
- **A / D** or **← / →** — bank and turn
- **W / S** (or **R / F**) — throttle up / down
- **G** — landing gear (mind the overspeed), **B** — brakes, **P** / **Esc** —
  pause, **M** — mute, **1 / 2 / 3** — pick a sortie on the title screen

Stall speed is real, the gear has a speed limit, the wind gusts, and a landing
is only gentle if the sink rate, the speed and the strip all agree. The panel
tells you everything: airspeed, attitude, altimeter with a digital window,
vertical speed, fuel, throttle quadrant, and lamps for gear, stall, low fuel
and the engine — plus a HUD with ALT / SPD / HDG, a compass ribbon and a
bearing arrow to the next objective.

## Running it

Open `game/index.html` in a desktop browser, or serve the folder statically:

```sh
node serve.ts --port 8080   # then visit http://localhost:8080
```

`main.ts` is the competition hand-in: it copies `game/` and `screenshots/`
into the output directory and writes the `dossier.json` the judges read, via
the vendored make.fun library (kept byte-unchanged, as the kit requires).

## Layout

- `game/src/flight.js` — the flight model and touchdown judging
- `game/src/terrain.js` — the island heightfield, runways and landmarks
- `game/src/render.js` — the world painter and the chase camera
- `game/src/cockpit.js` — the instrument panel, HUD and screens
- `game/src/missions.js` — the three sorties, their rings, wind and scoring
- `game/src/input.js`, `game/src/audio.js` — keyboard/mouse, synthesized sound
- `game/src/shots.js` — the staged scenes behind the screenshots

Everything — names, art, aeroplane, islands and sound — is original to this
entry. MIT licensed.
