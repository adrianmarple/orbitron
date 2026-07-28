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
| `GET` | `/api/v1/orbs/:orb/state` | The orb's full state broadcast |

Everything the controller receives: `prefs`, `prefNames`, `currentPrefName`, `currentText`, and
`gameInfo` (`null` when idle).

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

- **Pattern** — `idlePattern` (`default`, `static`, `fireflies`, `lightning`, `pulses`, `sin`,
  `lightfield`, `hourglass`, `linesine`, `weather`), `idleFrameRate`, `idleBlend`, `idleDensity`,
  `staticRotation`, `staticRotationTime`, `staticDirection`, `patternBias`, `useBias`,
  `rippleWidth`, `sinDirection`, `sinMin`, `sinRadial`, `sinRadialReverse`, `sinWaveCycles`,
  `disableBeatMode`, `hourglassStart`, `hourglassEnd`
- **Color** — `idleColor` (`rainbow`, `fixed`, `gradient`, `tricolor`), `brightness`, `fixedColor`,
  `gradientStartColor`, `gradientEndColor`, `gradientThreshold`, `fadeToBlack`, `rainbowDuration`,
  `rainbowFade`, `tricolor1`, `tricolor2`, `tricolor3`, `tricolorThreshold1`, `tricolorThreshold2`

Colors are `#rrggbb` strings; directions are `"x,y,z"` strings.

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
