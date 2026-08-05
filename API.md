# Lumatron REST API

A JSON HTTP API for preferences, saved presets, and the timer schedule.
It is served by the **relay** under `/api/v1`.

Internally it connects to each orb as a virtual controller client, speaking the same WebSocket
message set `controller/controller.js` uses. Nothing is special-cased per device, so it works
identically for Raspberry Pi orbs and Arduino (ESP32) orbs.

```bash
curl -X PATCH https://my.lumatron.art/api/v1/orbs/myorb/prefs \
  -H 'Content-Type: application/json' \
  -d '{"brightness":40,"idlePattern":"fireflies"}'
```

## Authentication

None by default — the same exposure the WebSocket controller already has, where knowing an orb ID
is enough to control it.

To require a token, set `REST_API_KEY` in `config.js` on the relay; every request must then send
`Authorization: Bearer <that value>` or get `401`.

Orbs with `REQUIRES_LOGIN` cannot be driven through this API at all: they expect a 4-digit code
displayed on the orb itself, which a headless client can't read. Those return `403`.

## Orb IDs

The `:orb` path segment accepts either the orb ID or its alias (added to the relay's config.js).

---

## Endpoints

### Orbs

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/orbs` | Orbs on the caller's own network |

Scoped by source IP, so other orbs aren't exposed. Orbs configured with `NO_LOCAL_REGISTRATION` are omitted.

```json
[ { "id": "myorb", "alias": "kitchen", "isArduino": false, "connected": true } ]
```

### State

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/orbs/:orb/state` | The orb's lighting state in one call |

`prefs`, `prefNames`, `currentPrefName`, and `currentText`. `gameInfo` is omitted, since this API
doesn't cover games.

### Preferences

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/orbs/:orb/prefs` | — | All current preferences |
| `PATCH` | `/api/v1/orbs/:orb/prefs` | `{"<key>": value, ...}` | Set one or more preferences |
| `DELETE` | `/api/v1/orbs/:orb/prefs` | — | Reset to defaults (`clearPrefs`) |

`PATCH` is a partial update — omitted keys are untouched. Unknown keys are rejected with `400`
rather than silently dropped, so a typo is visible:

```json
{ "error": "Unknown preference(s): brightnes" }
```

The authoritative key list is whatever `GET /prefs` returns for that orb, since it varies with
firmware version. The main ones:

| Key | Type | Default | Pi only | Description |
|---|---|---|---|---|
| `idlePattern` | enum | `"default"` | | Which animation runs: `default`, `static`, `fireflies`, `lightning`, `pulses`, `sin`, `lightfield`, `hourglass`, `linesine`, `weather`. `hourglass` and `weather` are Pi only. An orb's config can override the default with `IDLE`. |
| `idleFrameRate` | number | `15` | | Animation speed, for every pattern — an actual frame rate only for `default` and `fireflies`. Controller range 5–30. |
| `idleBlend` | number | `60` | | How much of the previous frame each frame blends in (motion smear). Unused by `weather`, `static`, `sin`, `lightfield`. |
| `idleDensity` | number | `70` | | How much is lit at once — head/source count for `default`, `fireflies`, `lightning`, `pulses`, `sin`. Minimum 10. |
| `staticRotation` | bool | `false` | | `static`: sweep the direction over time instead of holding `staticDirection`. |
| `staticRotationTime` | number | `8` | | `static`: seconds per full rotation, when `staticRotation` is on. |
| `staticDirection` | vector | `"1,1,0"` | | `static` (and `hourglass`): the axis the gradient runs along. |
| `patternBias` | vector | `"0,1,0"` | | `fireflies`: the direction the fireflies tend to travel. |
| `useBias` | bool | `true` | ✓ | The controller's "Use bias" toggle beside `patternBias`. Stored only — the render pipeline always applies the bias vector. |
| `rippleWidth` | number | `9` | | `pulses`: width of each expanding ring, 1–50. |
| `sinDirection` | vector | `"1,0,0"` | | `sin`: the direction the wave travels. Ignored when `sinRadial` is on. |
| `sinMin` | number | `25` | | `sin`: the trough value; the wave always peaks at 255. Negative values (down to -255) render as black but still shape everything above the trough. |
| `sinRadial` | bool | `false` | ✓ | `sin`: waves start at the center and move outward instead of travelling along `sinDirection`. |
| `sinRadialReverse` | bool | `false` | ✓ | `sin`: with `sinRadial` on, move inward instead. |
| `sinWaveCycles` | number | `4` | | `linesine`: how many wave cycles fit around the line/ring, 1–10. |
| `disableBeatMode` | bool | `false` | ✓ | `default`: opt out of beat-reactive brightness, on orbs wired for it (`BEAT_PIN`). |
| `hourglassStart` | `"HH:MM"` | `"00:00"` | ✓ | `hourglass`: when the daily fill begins. |
| `hourglassEnd` | `"HH:MM"` | `"23:59"` | ✓ | `hourglass`: when it finishes. |
| `idleColor` | enum | `"gradient"` | ✓ | Color mode: `rainbow`, `fixed`, `gradient`. Arduino orbs render `gradient` and report it as fixed, so only a Pi has a choice. |
| `brightness` | number | `100` | | Master brightness, applied quadratically. |
| `fixedColor` | color | `"#ffffff"` | ✓ | `fixed`: the one color everything is drawn in. |
| `gradientStartColor` | color | `"#25ff59"` | | `gradient`: the color the brighter pixels take. |
| `gradientEndColor` | color | `"#00607c"` | | `gradient`: the color the dimmer pixels take. |
| `gradientThreshold` | number | `66` | | `gradient`: where the two meet — lower is more start color, higher is more end color. Minimum 1. |
| `fadeToBlack` | bool | `true` | ✓ | Controller-side flag: gates the blend-threshold sliders in the UI. The render pipeline doesn't read it. |
| `rainbowDuration` | number | `10` | ✓ | `rainbow`: seconds for one full cycle through the rainbow. |
| `rainbowFade` | number | `0` | ✓ | `rainbow`: how much of the rainbow is on the orb at once. `0` is a single solid color cycling over time. |

A ✓ in "Pi only" means the Arduino (ESP32) firmware doesn't carry that pref at all, so it never appears in that orb's `GET /prefs` and `PATCH`ing it returns `400 Unknown preference(s)`.

Colors are `#rrggbb` strings; directions are `"x,y,z"` strings.

Note `idleColor` can be set to `tricolor` with cooresponding fields `tricolor1`, `tricolor2`, `tricolor3`, `tricolorThreshold1`, `tricolorThreshold2`. These are a pi only special case (needs an explicit INCLUDE in an orbs config to appear in the controller), but you can technically still use these.

### Brightness / dimmer

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/orbs/:orb/dim` | Step through `MANUAL_FADE_STEPS` (default on/off) |

The same action as the orb's hardware button and the controller's power button.

### Presets

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/orbs/:orb/presets` | — | `{names, current, includedInCycles}` |
| `PUT` | `/api/v1/orbs/:orb/presets/:name` | — | Save current prefs as `:name` |
| `DELETE` | `/api/v1/orbs/:orb/presets/:name` | — | Delete `:name` |
| `POST` | `/api/v1/orbs/:orb/presets/:name/load` | — | Load `:name` |
| `POST` | `/api/v1/orbs/:orb/presets/:name/copy` | `{"copyName": "..."}` | Copy to a new name |
| `POST` | `/api/v1/orbs/:orb/presets/:name/rename` | `{"newName": "..."}` | Rename |
| `POST` | `/api/v1/orbs/:orb/presets/:name/reorder` | `{"targetName": "..."}` | Move before `targetName` |
| `POST` | `/api/v1/orbs/:orb/presets/cycle` | — | Advance to the next preset in the cycle |

Preset names may contain spaces, so URL-encode them: `/presets/Evening%20Glow/load`.

`POST /presets/cycle` is the cycle action. A preset that happens to be *named* `cycle` is still
reachable through the three-segment forms, e.g. `POST /presets/cycle/load`.

Which presets participate in `cycle` is controlled by `includedInCycles`, set through `PATCH /prefs`:

```bash
curl -X PATCH .../prefs -d '{"includedInCycles":{"Evening Glow":true,"Bright":false}}'
```

### Schedule

| Method | Path | Body | Description |
|---|---|---|---|
| `GET` | `/api/v1/orbs/:orb/schedule` | — | Current timer settings |
| `PUT` | `/api/v1/orbs/:orb/schedule` | see below | Update timer settings |

Accepts any subset of `useTimer`, `weeklyTimer`, `dimmer`, `schedule`, `weeklySchedule`,
`includedInCycles`.

```json
{
  "useTimer": true,
  "schedule": [
    { "prefName": "Evening Glow", "time": "18:30", "fadeIn": 10, "fadeOut": 30 },
    { "prefName": "OFF",          "time": "23:00", "fadeIn": 10, "fadeOut": 30 }
  ]
}
```

- `prefName` — an existing preset, or `"OFF"` to turn the orb off
- `time` — `"HH:MM"`, 24-hour
- `fadeIn` / `fadeOut` — seconds
- `weekday` — required in `weeklySchedule` only; `0` = Monday through `6` = Sunday

Events are validated before being sent to the orb; a bad entry returns `400` describing the problem
and nothing is applied. Setting `weeklyTimer: true` with an empty `weeklySchedule` expands the daily
schedule across all seven days.

---

## Responses

Write endpoints return the affected resource, re-read from the orb after it has applied the change.

| Code | Meaning |
|---|---|
| `200` | Applied and confirmed by the orb |
| `202` | Sent, but the orb didn't confirm in time — the returned state may be stale |
| `400` | Bad body, unknown preference key, or invalid schedule entry |
| `401` | `REST_API_KEY` is set and the bearer token was missing or wrong |
| `403` | Orb requires an on-orb login code |
| `404` | Unknown orb, unknown preset, or no such route |
| `503` | Orb is known but not currently connected |

CORS is open (`Access-Control-Allow-Origin: *`) and `OPTIONS` preflight returns `204`.

---

## Notes

- Writes are idempotent. Setting a value that's already current is accepted and changes nothing.
- Changes appear live in any connected controller, and controller changes are visible here
  immediately.

## Examples

```bash
B=https://my.lumatron.art/api/v1/orbs/myorb

# Warm dim light
curl -X PATCH $B/prefs -H 'Content-Type: application/json' \
  -d '{"idleColor":"fixed","fixedColor":"#ff8800","brightness":25}'

# Save it, then come back to it later
curl -X PUT  "$B/presets/Cozy"
curl -X POST "$B/presets/Cozy/load"

# On at sunset, off at bedtime
curl -X PUT $B/schedule -H 'Content-Type: application/json' -d '{
  "useTimer": true,
  "schedule": [
    {"prefName":"Cozy","time":"18:30","fadeIn":10,"fadeOut":30},
    {"prefName":"OFF", "time":"23:00","fadeIn":10,"fadeOut":30}
  ]
}'

# Toggle like the hardware button
curl -X POST $B/dim
```
