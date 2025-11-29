#!/usr/bin/env node
console.log("Main Script Executed")
const { config } = require('./lib')
const { checkForUpdates } = require('./gitupdate')

let isOrb = !config.IS_RELAY && !config.DEV_MODE && !config.HAS_EMULATION

if (!config.DEV_MODE && !config.CONTINUOUS_INTEGRATION) {
  console.log("Checking for updates")
  checkForUpdates()
}

if(isOrb || config.HAS_EMULATION){
  console.log("Starting Orb")
  const { startOrb } = require('./orb')
  startOrb(config)
}

if(isOrb){
  console.log("Including Access Point")
  require('./accesspoint/accesspoint')
}

if(config.IS_RELAY){
  console.log("Starting Relay")
  require('./relay')
}
