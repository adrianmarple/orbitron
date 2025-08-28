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
  // startOrb({
  //   ORB_ID: 'test',
  //   DEV_MODE: config.DEV_MODE,
  //   PYTHON_EXECUTABLE: config.PYTHON_EXECUTABLE,
  //   HAS_EMULATION: true,
  // })
}

if(isOrb){
  console.log("Including Access Point")
  require('./accesspoint/accesspoint')
}

if(config.IS_RELAY){
  console.log("Starting Relay")
  require('./relay')
}
