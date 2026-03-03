# Idle Patterns

Idle patterns are the LED animations displayed when no game is active. Each pattern is a Python file that subclasses `Idle` (from `idlepatterns/__init__.py`), which itself subclasses `Game`.

## How It Works

`__init__.py` defines the `Idle` base class and the `set_idle()` function. When the active pattern changes (via controller prefs), `set_idle()` dynamically imports the new pattern module and calls `engine.start()` on it.

Each pattern overrides `render()` (or uses the base class rendering pipeline) to write values into `engine.raw_pixels` each frame. The base `Idle.render()` provides:
- **Frame pacing** — waits until the next frame is due
- **Fade** — applies `prefs.fade()` decay to `render_values`
- **Blending** — smooth interpolation between frames via `blend_pixels()`
- **Color** — applies color mode (fixed, rainbow, gradient, tricolor) via `apply_color()`
- **Brightness** — scales output by brightness pref (quadratic) and beat factor

## Adding a New Pattern

- Create `idlepatterns/mypattern.py`
- Subclass `Idle` and set `name = "mypattern"`
- Override `update()` for per-frame logic and/or `render()` for full custom rendering
- Add the pattern to `patternOptions()` in either the `options` list or the `includableOptions` list
  - If in `includableOptions` you'll need to add `INCLUDE: {mypattern: true},` to an orb's config for it to appear in that orb's controller
- If you want any additional parameters visible in the controller
  - Add them to the `default_prefs` dict in `prefs.py`
  - Access them via `prefs.get_pref('mypref')` in `mypattern.py`
  - Add new UI elements in `controller.html` to the `<!-- PATTERN MENU -->` section, imitating existing examples. Make sure to condition on that pattern being selected

## Existing Patterns

| Pattern | Description |
|---|---|
| `default` | Fluid fire that spreads via neighbor graph, squared brightness. Defined in `__init__.py`. |
| `fireflies` | Like default without branching and with directional propagation bias (`patternBias`). |
| `static` | Directional gradient — dot product of pixel coords with a direction vector. Optionally rotates over time. |
| `sin` | Traveling or radial sine wave along a configurable direction. `sinMin` sets brightness floor. |
| `linesine` | Sine wave along a 1D line/ring topology. Only valid when no pixel has more than 2 neighbors. |
| `pulses` | Expanding spherical ring pulses spawned from random points. Width controlled by `rippleWidth`. |
| `lightfield` | Each pixel oscillates independently at a random frequency and phase. |
| `lightning` | BFS spanning tree from a random sink; traces paths from random sources with exponential distance falloff. |
| `hourglass` | Fills pixels top-to-bottom over a configurable daily time window (`hourglassStart`/`hourglassEnd`). |
| `weather` | Sine wave modulated by live weather data (wind direction, temperature, UV, rain) via OpenWeatherMap. Requires `LAT`, `LON`, and `WEATHER_API_KEY` in `config.js`. |


## Key Prefs

Most patterns read from `prefs.py` via `get_pref()`. Common ones:

| Pref | Used by |
|---|---|
| `idleDensity` | default, fireflies, lightning, pulses, sin |
| `idleFrameRate` | all (speed, only related to frameRate for default and fireflies) |
| `idleBlend` | all (blend smoothing) |
| `idleColor` | all (color mode) |
| `brightness` | all |
| `patternBias` | fireflies |
| `staticDirection`, `staticRotation`, `staticRotationTime` | static |
| `sinDirection`, `sinMin`, `sinRadial` | sin, weather |
| `rippleWidth` | pulses |
| `hourglassStart`, `hourglassEnd` | hourglass |
