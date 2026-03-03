# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

Lumatron is an LED light sculpture system supporting a wide variety of shapes (spheres, walls, boxes, helmets, etc.). The primary focus is idle pattern lighting — customizable animations, colors, brightness, and timer schedules controlled via a phone/browser controller over WebSockets. The system also supports multiplayer games played on the LED surface. It can run locally on a Raspberry Pi or in dev/emulation mode on any machine.

## Setup and Running

```bash
# Initial setup (admin/dev machine)
bash utility_scripts/admin_install.sh   # generates config.js, creation/.env, installs npm + Python deps

# Run
sudo node server.js      # or: npm start (runs main.js instead, which checks for updates)
# Python is run via the venv created by admin_install.sh at .venv/
```

- Emulator UI: `http://localhost:1337/dev`
- Controller UI: `http://localhost:1337` (open multiple tabs to simulate multiple players)
- Pass `-t` flag to disable controller timeouts when testing multiple controllers in one browser

## Architecture Overview

The system has two main processes that communicate via stdin/stdout:

### Node.js layer (`main.js` → `orb.js`)
- `lib.js`: Loads `config.js`, sets up utilities
- `server.js`: HTTP/HTTPS server (port 1337), serves static files, handles webhooks
- `orb.js`: Core Node.js orchestration — spawns the Python engine as a child process, manages WebSocket connections to controllers (via relay server `wss://my.lumatron.art:7777`), relays input to Python via stdin, receives pixel data and game state JSON from Python stdout, broadcasts to controllers
- `relay.js`: Cloud relay mode for remote access
- `emulation.js` + `emulator/emulator.html`: Browser-based LED sphere visualization

### Python layer (`main.py` → `engine.py`)
- `main.py`: Entry point — auto-imports all `games/*.py` modules, starts input-reading thread, then calls `engine.run_core_loop()`
- `engine.py`: The game engine — runs at 30fps, calls `game.update()`, `game.ontimeout()`, `game.render()` each frame. Defines `Game` and `Player` base classes. Outputs pixel data as hex to stdout (`raw_pixels=<hex>;`) and game state as JSON.
- `prefs.py`: Handles lighting preferences (colors, patterns, brightness, timers), persisted to `prefs.json` and `savedprefs/`
- `audio.py`: Sound and music management via pygame mixer
- `idlepatterns/`: Idle LED animation patterns (shown when no game is active)

### Communication Protocol
- Node.js → Python (stdin): JSON lines — player inputs (`move`, `tap`, `claim`, `release`, `ready`), settings updates, text display commands
- Python → Node.js (stdout): JSON lines for game state broadcasts, `raw_pixels=<hex>;` lines for LED pixel data, `touchall` to reset player activity timers

### Config
`config.js` (gitignored, copy from `config.js.template`) controls all deployment options. Key fields:
- `DEV_MODE: true` — enables emulator, uses HTTP instead of HTTPS
- `HAS_EMULATION: true` — enables browser emulator alongside real hardware
- `PIXELS` — selects pixel geometry (default: `"rhombicosidodecahedron"`)
- `DEFAULT_GAME` — game to start first

## Controller (`controller/`)

A Vue 2 SPA (loaded via CDN, no build step). Served statically by the main HTTP server on port 1337, but its WebSocket connection goes to the **relay on port 7777** (`wss://<host>:7777/<orbID>/<uuid>`), not port 1337.

It has two modes:
- **Home/idle**: Lighting controls — color style, idle pattern, brightness, saved presets, daily/weekly timer schedule
- **Game**: Virtual joystick (drag = `move`, quick tap = `tap`), rules carousel, score display, victory screen

`games/configs.js` is loaded by both the controller HTML and `orb.js`. It defines `GLOBAL_RULES` (the intro slides shown before game-specific rules) and `GAMES_INFO` (the array of game configs). This is the only file connecting the JS frontend to the Python game names.

## Making a New Game

1. Copy `games/colorwar.py` as a template
2. Subclass `Game` and optionally `Player` from `engine`
3. Override `play_update()` for game logic and `render_game()` for rendering
4. Call `game.generate_players(YourPlayerClass)` at module level
5. Add an entry to `games/configs.js` (name, label, rules, victoryCondition, statusDisplay, etc.)

The `statusDisplay` field controls what the controller shows during gameplay:
- `{ type: "rankedscore" }` — bar chart of relative scores with player's rank
- `{ type: "rankedscore", innerScore: true }` — same, with a secondary inner bar (e.g. snake length vs. max length)
- `{ type: "cooperative", showScore: true, showLives: true }` — co-op display reading `state.data.score`, `state.data.victory_score`, `state.data.lives`
- `{ type: "battleroyale" }` — shows colored dots for living players

The game state machine: `"start"` → `"countdown"` → `"play"` → `"previctory"` → `"victory"` → (next game)

Key engine globals available in game files:
- `SIZE` (420), `coords`, `neighbors`, `next_pixel` — pixel geometry
- `color_pixel(index, color)`, `add_color_to_pixel(index, color)` — rendering
- `render_pulse(...)`, `render_ring(...)` — built-in visual effects
- `weighted_random(...)`, `rotate(...)` — math utilities

Color conventions: Red (`#f00`) = bad/danger, Magenta (`#f0f`) = good/pickups, everything else grayscale.

## Pixel Geometry Files

`pixels/` directory contains JSON files describing LED geometries. Each file defines:
- `SIZE`: number of unique pixel coordinates
- `neighbors`: adjacency list
- `nextPixel`: map for continuous movement direction
- `coords`: 3D coordinates of each pixel
- `uniqueToDupe`: mapping from raw LED index to unique coordinate index

## Arduino Standalone Mode (`arduino/`)

`template.ino` is a C++ template for running idle patterns directly on an RP2040 microcontroller (no Raspberry Pi). The `creation/` tool injects geometry-specific data by replacing `{{MARKER}}` placeholders and writing the result to a `.ino` file ready to flash.

### Template markers
- `{{SIZE}}` / `{{RAW_SIZE}}` — unique pixel count / raw LED count
- `{{MAX_NEIGHBORS}}` — max neighbors per pixel
- `{{DUPES_TO_UNIQUES}}` — `uint16_t[SIZE][2]`: each entry is `[raw0, raw1]` for that unique pixel
- `{{NEIGHBORS}}` — `uint16_t[SIZE][MAX_NEIGHBORS]`: unique neighbor indices, `0xffff` sentinel
- `{{RAW_TO_UNIQUE}}` — `uint16_t[RAW_SIZE]`: maps each raw LED index to its unique pixel index
- `{{COORDS}}` — `float[SIZE][3]`: 3D coords per unique pixel

### Rendering pipeline
Each `loop()` call runs one pattern function then calls `strip.show()`. Frame rate is `idleFrameRate` for DEFAULT and FIREFLIES, 30fps for all others.

Pattern functions write pixel colors directly to the strip. Two shared helpers exist for patterns that compute per-unique-pixel values:
- `applyTargetValues(brightness_scale)` — reads `pattern_target[SIZE]` (per-unique), alpha-blends into `render_values[RAW_SIZE]`, applies gradient color
- `applyFluidValues(fv, brightness_scale)` — reads a per-raw array directly, no alpha blend

**Critical RAM constraint**: The RP2040 has limited RAM. Avoid large global arrays. Prefer:
- Inline hash functions (Knuth multiplicative: `2654435761u`, `2246822519u`, `3266489917u`) over stored per-pixel lookup tables
- `int16_t` instead of `int` for index arrays
- The shared `pattern_target[SIZE]` scratch buffer instead of stack-allocated arrays
- Computing values on the fly from a single time scalar rather than per-pixel accumulated state

### Gradient color formula
Given `target_v` (0–1 brightness), `tv = min(1, target_v * 100 / gradientThreshold)`, color = `end + (start − end) * tv`, scaled by `render_v * brightness_factor`.

### Patterns implemented
| Pattern | Key idea |
|---|---|
| DEFAULT | Fluid fire spreading via `neighbors`, squared brightness |
| FIREFLIES | Like DEFAULT but directionally biased toward `patternBias` |
| STATIC | Dot product of pixel coord with direction vector |
| SIN | Sine wave advancing along `sinDir` over time |
| PULSES | Expanding rings from random sphere points |
| LIGHTFIELD | Per-pixel sine oscillator; speed/brightness/phase from Knuth hash of index + single global time |
| LIGHTNING | BFS spanning tree from random sink; traces paths from sources |

## The `creation/` Folder — Hardware Manufacturing Toolchain

This is a separate system for physically building LED sculpture fixtures. It is not part of the game runtime.

### Running it
```bash
cd creation
npm install
node pixelserver.js   # starts on port 8000, also launches the Vue dev server
```

### What it does
- **Vue.js design tool** (`src/`, `public/`) — a browser-based CAD app for designing LED fixture layouts. Core math is in `public/topology.js` (vertex/edge/face graph), `public/data.js` (generates pixel JSON), and `public/laser.js` (generates SVG/3D print geometry).
- **`pixelserver.js`** — Node.js server that drives the full fabrication pipeline from a design: generates OpenSCAD → STL (via `openscad`) → simplified mesh (via Blender) → g-code (via Prusa slicer) → uploads directly to a networked 3D printer. Also saves pixel geometry JSON to `../pixels/` for use by the game engine.
- **`projects/`** — One `.js` file per fixture design (e.g. `archimedes/rhombicosidodecahedron.js`), each defining vertex positions and edge connections for that shape.
- **`pcb/`** — KiCad PCB projects: "pi interface" (Raspberry Pi → LED strips) and "strip start" (LED strip connector board).
- **`scad/`** — OpenSCAD source files for mounts, enclosures, and stands.
- **`*.ini`** — Prusa slicer profiles used during g-code generation.
