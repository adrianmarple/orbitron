# Basic setup

- In terminal `cd` to this (`creation`) folder
- Install node dependencies `npm install`
- Run `node pixelserver.js`
- Visit url `http://localhost:8080/` (use `?local` for local only version)

# Admin console

Note: if in Creation mode, hit the "LUMATRON CREATION" button to switch to admin mode

## Orb list

The right side features a list of all orbs connected to the relay (or local relay if using `?local`). This list gets checked every 10 seconds.

## Functions

### Editing local files

There are 3 files that can be edited directly by clicking on the corresponding button and either typing ctrl-s or hitting the corresponding "Save [[X]]" button (which will restart the corresponding orb).
- config: this is the most important one. It lets you change the fundamentals of the orb. Check `config.js.template` in the repo root for examples.
  - When in this view there are "Generate ORB_ID" and "Set ORB_KEY" buttons visible.
    These edit the scratch `config.js` in the center, but you still need to save for them to take any effect.
- prefs: the `prefs.json` that controls the idle patterns, same as is manipulated by a controller.
- timing: the `timingprefs.json` that saves all other pref values, including dim state.

### Other commands

- Issue commands: a cheap ssh-like capability I added to be able to handle edge cases
  - Unlock Orb: resets the pi's password to "lumatron"
- All Backups: allows you to restore any orb from backup (saved by each orb at midnight), or force a manual save now with a custom name.
- Power Calibration: used to figure out the max power of an orb; used when in sight of the orb being calibrated
- Restart: self-explanatory
- Controller: opens the controller for this orb in a new tab (even if not connected to the same wifi)


# Creation

Here be dragons. Contact adrian@marplebot.com for more details.
