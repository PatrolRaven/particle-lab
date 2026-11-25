# Particle Lab

[Live demo on GitHub Pages](https://patrolraven.github.io/particle-lab/)

Particle Lab is an interactive particle sandbox built with React, TypeScript, and Canvas 2D. Explore six real-time scenes in a Russian-language interface, adjust their physics and colors, and shape the simulation with your pointer. Preferences are stored in your browser.

## Run locally

Use Node.js 22.12 or later and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Explore the simulation

Choose **Galaxy**, **Vortex**, **Waves**, **Network**, **Nebula**, or **Fire** from the preset bar. Use the settings panel to adjust particle density, size, opacity, forces, and palette. The Effects tab controls glow, motion lines, and background stars.

| Key | Action |
| --- | --- |
| `1`–`6` | Observe, move the scene, attract, swirl, repel, or sample a color |
| `Space` | Pause or resume when the canvas has focus |
| `R` | Reset the current preset |
| `F` | Toggle fullscreen |

Move the pointer over the field to apply the selected force. Press and hold to strengthen it. Drag with the move tool to reposition the scene, or click with the eyedropper to sample a particle color. The help button lists the same controls in Russian.

## Production build

```sh
npm run build
npm run preview
```

The build type-checks the source and writes the static site to `dist/`. Preview serves that output locally. For a site hosted under a subpath, pass the matching base at build time, for example `npm run build -- --base=/particle-lab/`.

The Canvas 2D engine lives in `src/simulation.ts`. It handles drawing and simulation through `requestAnimationFrame`, while React manages the controls. Particle counts range from 500 to 18,000. Drawing groups particles by style, reuses glow sprites, and caps the canvas pixel budget on high-density displays.

## License

Released under the [MIT License](./LICENSE).
