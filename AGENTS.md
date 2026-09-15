# Repository Guidelines

## Run and Verify

- This is a dependency-free vanilla HTML/CSS/JavaScript app; there is no package manager, build, lint, or test configuration.
- Serve `src/` as the web root instead of opening the HTML from an arbitrary directory: `python -m http.server 8000 --directory src`, then open `http://localhost:8000/`.
- For JavaScript-only changes, run `node --check src/js/maze.js`, `node --check src/js/game.js`, `node --check src/js/render.js`, and `node --check src/js/main.js`; syntax checks do not replace browser playtesting.
- Manually verify the start overlay, arrow-key movement, dot collection, tunnel wrapping, ghost collisions/lives, win, and loss flows in a browser.

## Structure and Runtime

- `src/index.html` is the sole entrypoint and loads classic scripts in dependency order: `maze.js`, `game.js`, `render.js`, then `main.js`. Keep this order unless converting the code to modules.
- The JavaScript intentionally communicates through globals on `window`: `maze.js` publishes maze constants, `game.js` publishes `createGame`, `update`, and `DIRS`, and `render.js` publishes `draw`.
- `maze.js` owns the pristine 28x31 maze and start coordinates; `game.js` copies the maze into per-game state and owns movement, collisions, scoring, lives, and win/loss state; `render.js` owns canvas drawing; `main.js` owns input, overlays, and the animation loop.
- The canvas is 560x620 pixels with 20-pixel tiles. If maze dimensions or tile sizing change, update the corresponding canvas and layout dimensions in `src/index.html` and `src/css/style.css`.
