#!/usr/bin/env node
const { config } = require('../lib')
const { addGETListener, noCorsHeader } = require('../server')


addGETListener(async (response, orbID) => {
  if (orbID != "masterkey") return false

  noCorsHeader(response, 'text/plain')
  response.end(config.MASTER_KEY, 'utf-8')
  return true
})
