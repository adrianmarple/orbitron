#!/usr/bin/env node
const { config } = require('./lib')
const { checkForUpdates } = require('./gitupdate')

let isOrb = !config.IS_RELAY && !config.DEV_MODE && !config.HAS_EMULATION

if (!config.DEV_MODE && !config.CONTINUOUS_INTEGRATION) {
  checkForUpdates()
}

if(isOrb || config.HAS_EMULATION || config.DEV_MODE){
  require('./orb')
}

if(isOrb){
  require('./accesspoint/accesspoint')
}

if(config.IS_RELAY){
  require('./relay')
}