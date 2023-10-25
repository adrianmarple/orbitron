#!/usr/bin/env node
const { config } = require('./lib')
const { checkForUpdates } = require('./gitupdate')

if (!config.DEV_MODE && !config.CONTINUOUS_INTEGRATION) {
  checkForUpdates()
}

if(config.IS_SERVER){
  require('./relay')
}

if(!config.IS_SERVER || config.DEV_MODE){
  require('./orb')
}

if(!config.IS_SERVER && !config.DEV_MODE){
  require('./accesspoint')
}