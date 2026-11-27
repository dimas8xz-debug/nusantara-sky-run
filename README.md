# Nusantara Sky Run

[![make.fun](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Rank](https://make.fun/badge/best-flight-game-20261126-0057/dimas8xz-debug/nusantara-sky-run/rank.svg)](https://make.fun/c/best-flight-game-20261126-0057)
[![Reward](https://make.fun/badge/best-flight-game-20261126-0057/dimas8xz-debug/nusantara-sky-run/reward.svg)](https://make.fun/c/best-flight-game-20261126-0057)

An original 3D flight game over the Indonesian archipelago, built for the
make.fun **best-flight-game** competition. Chase view behind a modern
twin-jet with swept wings, winglets and glowing exhausts, over sea,
islands, a smoking volcano, rice terraces and two island runways — all
low-poly, all generated in code, no model files.

## How to play

Serve the game locally, then open it in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Or hand it in like the grader does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

- **W / S** — throttle up / down
- **← → / A D** — bank left / right
- **↑ ↓** — pitch down / up
- **Mouse drag** — steer (bank + pitch)
- **E** — drop supplies (Canyon Supply mission)
- **C** — switch chase view / cockpit view (lit dashboard)
- **Space** — start / fly again
- **P / Esc** — pause
- **R** — restart mission
- **M** — mute sound

Too slow and the wing stalls — keep your speed up. Land gently on a runway
or take damage; hit terrain or water and the flight is over.

## Missions

1. **Ring Run** — fly through 8 golden rings in order over the islands.
2. **Island Landing** — take off from Bandara Merpati, cross the sea and land
   gently on the Pulau Karang runway with fuel to spare.
3. **Canyon Supply** — fly low through 3 canyon gates, drop supplies over
   the orange target, then return and land at Merpati.

Score, timer and best score (localStorage) are on the HUD, with altitude,
speed, heading, throttle, fuel, damage and an artificial horizon — plus round
speed and altitude gauges with needles and a compass strip. Press C for the
cockpit view, with its own lit dashboard.

## Tech

- Three.js 0.160.0, vendored as `game/vendor/three.module.min.js`
  (import map in `game/index.html`), no network at runtime
- Procedural terrain (seeded heightmap), aircraft built from primitives,
  procedural WebAudio engine/wind — no audio or model files
- Deterministic screenshot mode: `?shot=start|play|end&seed=N`
- `main.ts` hands the entry in with the kit's `vendor/makefun-game.ts`
