# MAZER

MAZER is a complete first-person PS1-style browser maze game built with Vite, TypeScript, and Three.js.

The player starts at the outer edge of a random maze. A tall tower stands at the exact center. Reach the tower, enter the base door, climb the spiral stairs, collect the glowing orb at the top, then return to the spawn pedestal to win.

## Running Locally

```sh
npm install
npm run dev
```

Then open the Vite URL shown in the terminal. The game runs at `/`.

## Controls

- `W`, `A`, `S`, `D` - move
- Mouse - look
- `Space` - jump
- `Tab` - toggle crouch
- `F` - toggle fly/noclip mode
- `Escape` - pause or resume
- `E` or left click - interact

Pointer lock starts when gameplay begins. If the browser releases the pointer lock, the game pauses.

## Scripts

```sh
npm run check
npm test
npm run build
```

`npm run build` typechecks, runs the unit tests, and writes the deployable static build into `public/`.

## Project Structure

- `index.html` - root game shell
- `src/main.ts` - application entry point
- `src/runtime/MazerGame.ts` - Three.js scene, controls, collision response, UI state, and gameplay loop
- `src/game/maze.ts` - random maze generation and pathfinding
- `src/game/world.ts` - grid/world coordinate mapping, tower geometry constants, stair collision, and walkability checks
- `src/game/progression.ts` - objective, orb, pedestal, and win-state progression
- `src/render/textures.ts` - procedural low-resolution pixel textures
- `tests/` - unit tests for maze generation, progression, and world collision helpers
- `ASSET_CREDITS.md` - texture and asset credit notes

## Deployment

Build the static app and deploy it with Wrangler static assets:

```sh
npm run build
npx wrangler deploy
```

Cloudflare should use `/` as the project path. Wrangler reads `./dist` from `wrangler.jsonc`.
