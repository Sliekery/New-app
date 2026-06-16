# 🌌 WAVE RIDER

A vaporwave 3D **hoop-flying** game. Pilot a neon spaceship through an endless
synthwave sunset, threading glowing hoops to build your score. Built with
[Three.js](https://threejs.org/) — runs entirely in the browser, **playable with one finger.**

![style](https://img.shields.io/badge/style-vaporwave-ff44cc) ![3d](https://img.shields.io/badge/3D-Three.js-00e5ff)

## ▸ Play

Open `index.html` in any modern browser. No build step, no install.

```bash
# from the WaveRider/ folder, any static server works, e.g.:
python3 -m http.server 8000
# then visit http://localhost:8000
```

On a phone, just open the page — touch the screen and drag to fly.

> The game loads Three.js from a CDN, so the first load needs an internet connection.

## ▸ How to play

- **One finger / mouse:** touch and drag anywhere to steer the ship up, down,
  left and right. On desktop you can also just move the mouse.
- Fly **through** the center of each hoop for points.
- The ship continuously accelerates — the faster you go, the more hoops you clear.

## ▸ Scoring

- **+10** points per clean hoop, multiplied by your current **combo**.
- Each consecutive clean hoop raises the combo (up to **x9**). The combo decays
  if you take too long between hoops.
- **Clipping a hoop's rim** resets your combo and flashes red.
- Miss **3 hoops in a row** and the run ends.
- Your **best score** is saved locally between sessions.

## ▸ Vaporwave aesthetic

- Gradient synthwave sky with a striped retro sun.
- Scrolling neon grid horizon and wireframe mountains.
- Glowing pink / cyan hoops, magenta-and-cyan color palette, fog and bloom-y glow.

## ▸ Tech

Single self-contained `index.html`: Three.js (ES module via import map), custom
GLSL shaders for the sky and sun, no other dependencies.
