# REALITY//SHIFT — Ghost Map
Mission 001 in an isolated repository. A static Three.js/Vite cyberpunk geographic-world prototype.

## Status and integrity of the evidence
The default experience is **synthetic demonstration data**. It is NOT LiDAR, satellite imagery, or OpenStreetMap. The HUD explicitly identifies the source kind. To use measured data, run the offline converter (documented below) on appropriately sourced DEM + OSM datasets, or supply a compliant preprocessed world.json. The application will never silently report synthetic geometry as measured data.

## Run
Requires Node.js 22.12+ and npm.
```sh
npm install
npm test
npm run dev
```
Visit the printed Vite URL including `/Real-World-Procedural-Generator/`. WASD walks, mouse looks, Shift runs, Escape releases pointer, buttons reset and reseed visual styling.
```sh
npm run build
npm run preview
```
No external network endpoints are used while exploring. There is no deployment workflow and this branch must not be merged/deployed before visual acceptance.

## Static world file format
Set `?world=data/world.json` to load a local preprocessed file from `public/data/world.json` (when provided). A world is `{schema:1,size:500,terrain:{n:101,heights:[...]},roads:[[[x,z],...]],buildings:[{id,footprint:[[x,z],...],height?}],meta:{kind:"measured",label,attribution,center}}`. Points are meter coordinates around the map center, X east, Z north. Elevations are relative local meter heights. A measured marker must be used only with actual measured datasets; simply changing the label does not make a fixture real.

## Geographic preprocessing
See `tools/README.md` for a reproducible offline import plan and the first ingestion converter. It expects a source DEM and OSM export obtained separately, with their sources and licenses recorded. The repo intentionally does not bundle fake 'real-world' geographic files.

## Architecture
- `src/geo.js`: strict world validation, terrain interpolation, geometry predicates, seeded PRNG.
- `src/demo.js`: synthetic development fixture (explicitly non-geographic).
- `src/world.js`: Three.js terrain, roads, footprint extrusions, deterministic neon dressing.
- `src/main.js`: pointer-lock camera, slope-following movement, scene state and HUD.
- `tools/`: offline conversion tooling.
The world is bounded. Ground following is heightfield-based; collision is 2D footprint-based. No jumping, interiors, character physics, actual reflections, or streamable large worlds yet.

Inspired by architectural techniques from [NEON-DRIFT](https://github.com/ReidMaxim/NEON-DRIFT), but its game was not edited. No source files were copied verbatim.

## Manual acceptance
1. At 1080p, verify mouse lock, WASD/Shift, reset/reseed, and Escape.
2. Confirm the demo HUD says SYNTHETIC and the measured loader fails visibly if missing.
3. Check roads follow terrain and buildings do not visibly float.
4. Profile in Chrome/Edge on GTX 1050 Ti and an integrated GPU; target 30 FPS on Medium (not yet measured).
5. Import a genuine 500m local site; check road/footprint alignment against geographic references and verify attribution.
6. Test fresh `npm install && npm test && npm run build` locally.
