#!/usr/bin/env node
// REST API mirroring the lighting capabilities of the controller.
//
// Rather than inventing a new protocol, this connects to each orb as a virtual
// controller client (an "observer" — see bindObserver in orb.js) and speaks the
// exact message set controller.js sends. That means it works identically for Pi
// orbs and Arduino orbs, and needs no device side changes.
const { config, delay } = require('./lib')
const { addListener } = require('./server')

const API_PREFIX = "/api/v1"
const CLIENT_ID = "restapi"
const STATE_TIMEOUT = 3000  // waiting for the first state after connecting
const RESYNC_TIMEOUT = 1000 // waiting for state to reflect a write
const SETTLE_TIME = 150     // giving the orb time to consume a write before reading it back
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]

// Timing preferences, which are set through the same "prefs" message as the rest
const SCHEDULE_KEYS = ["useTimer", "weeklyTimer", "dimmer", "schedule", "weeklySchedule", "includedInCycles"]
const SCHEDULE_EVENT_KEYS = ["prefName", "time", "fadeIn", "fadeOut", "weekday"]
const TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
const OFF_PREF_NAME = "OFF"

// Injected by relay.js so this module doesn't need to reach back into it
let connectedOrbs
let connectedClients
let orbInfoCache
let orbToIP
let ipFromRequest

// Matches preciseTime in orb.js. ClientConnection.processMessage drops any
// message whose timestamp isn't strictly greater than the previous one, so two
// requests landing in the same millisecond would otherwise lose the second.
let lastMessageTimestamp = 0
let lastMessageTimestampCount = 0
function preciseTime() {
  let t = Date.now()
  if(t != lastMessageTimestamp){
    lastMessageTimestamp = t
    lastMessageTimestampCount = 0
  }
  t = t + lastMessageTimestampCount * .001
  lastMessageTimestampCount += 1
  return t
}


// One observer connection per orb, created on demand and kept for as long as the
// orb stays connected. Registering in connectedClients is what makes the relay
// route the orb's broadcasts back to us (see bindOrb in relay.js).
const clients = {}
class OrbClient {
  constructor(orbID) {
    this.orbID = orbID
    this.id = CLIENT_ID
    this.isObserver = true
    this.state = null
    this.stateWaiters = []
    this.mustLogin = false
    // relay.js drains this before forwarding anything from the orb, so an entry
    // in connectedClients has to look enough like a client socket to survive it
    this.messageCache = []
  }

  // Called by relay.js whenever the orb sends this client a message
  send(message) {
    if (message == "ECHO") return
    if (message.startsWith("STATE_HASH:")) return
    let content
    try {
      content = JSON.parse(message)
    } catch(e) {
      return
    }
    if (content.mustLogin) {
      this.mustLogin = true
      return
    }
    if (!content.prefs) return // Not a state broadcast
    this.mustLogin = false
    this.state = content
    let waiters = this.stateWaiters
    this.stateWaiters = []
    for (let resolve of waiters) {
      resolve(content)
    }
  }

  close() {
    if (connectedClients[this.orbID]) {
      delete connectedClients[this.orbID][this.id]
    }
    delete clients[this.orbID]
  }

  sendRaw(message) {
    let orb = connectedOrbs[this.orbID]
    if (!orb) return false
    orb.send(JSON.stringify({
      clientID: this.id,
      message,
      observer: true,
    }))
    return true
  }

  sendToOrb(content) {
    content.timestamp = preciseTime()
    return this.sendRaw(JSON.stringify(content))
  }

  waitForState(timeout) {
    return new Promise(resolve => {
      this.stateWaiters.push(resolve)
      setTimeout(() => {
        this.stateWaiters.remove(resolve)
        resolve(null)
      }, timeout)
    })
  }

  async ensureConnected() {
    if (!connectedOrbs[this.orbID]) {
      this.state = null
      return false
    }
    if (!connectedClients[this.orbID]) {
      connectedClients[this.orbID] = {}
    }
    if (connectedClients[this.orbID][this.id] !== this) {
      connectedClients[this.orbID][this.id] = this
      this.sendRaw("{}") // Creates the observer connection on the orb
    }
    if (!this.state) {
      await this.waitForState(STATE_TIMEOUT)
    }
    return !!this.state
  }

  // Read back what was just written. A Pi orb answers RESYNC from the state
  // orb.js has cached, which is only as fresh as the last engine broadcast, so
  // settle first or the reply can predate the write. An Arduino orb replies
  // with current state directly, so it needs the RESYNC either way.
  async resync() {
    await delay(SETTLE_TIME)
    this.sendRaw("RESYNC")
    return await this.waitForState(RESYNC_TIMEOUT)
  }
}

function getClient(orbID) {
  if (!clients[orbID]) {
    clients[orbID] = new OrbClient(orbID)
  }
  return clients[orbID]
}


// --- Helpers ---

function respondJSON(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': "*",
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    "Access-Control-Allow-Headers": "x-requested-with, Content-Type, origin, authorization, accept, client-security-token",
  })
  response.end(JSON.stringify(body, null, 2))
}

function resolveOrbID(orbID) {
  orbID = orbID.toLowerCase()
  return config.reverseAliases[orbID] ?? orbID
}

function parseBody(body) {
  if (!body || !body.length) return {}
  return JSON.parse(body.toString())
}

function prefsSummary(state) {
  return { prefs: state.prefs }
}
function presetsSummary(state) {
  return {
    names: state.prefNames,
    current: state.currentPrefName,
    includedInCycles: state.prefs.includedInCycles,
  }
}
function scheduleSummary(state) {
  let schedule = {}
  for (let key of SCHEDULE_KEYS) {
    schedule[key] = state.prefs[key]
  }
  return schedule
}

// Only orbs on the caller's own network, matching /localorbs. Without this an
// unauthenticated caller could enumerate the whole fleet.
function listOrbs(request) {
  let clientIP = ipFromRequest(request)
  let orbs = []
  for (let orbID in orbToIP) {
    let orbInfo = orbInfoCache[orbID]
    if (!orbInfo) continue
    if (orbInfo.config.NO_LOCAL_REGISTRATION) continue
    if (orbToIP[orbID] != clientIP) continue
    orbs.push({
      id: orbID,
      alias: config.ALIASES[orbID],
      isArduino: !!orbInfo.config.ARDUINO,
      connected: !!connectedOrbs[orbID],
    })
  }
  return orbs
}

// prefs.update drops unknown keys, but reject them here so a typo is reported
// rather than silently ignored.
function unknownPrefKeys(state, update) {
  return Object.keys(update).filter(key => !(key in state.prefs))
}

function scheduleError(events, name, requireWeekday, prefNames) {
  if (!Array.isArray(events)) return `"${name}" must be an array`
  for (let event of events) {
    if (!event || typeof event != "object") return `"${name}" entries must be objects`
    for (let key in event) {
      if (!SCHEDULE_EVENT_KEYS.includes(key)) return `Unknown "${name}" field "${key}"`
    }
    if (!TIME_PATTERN.test(event.time)) {
      return `"${name}" entry has invalid time "${event.time}", expected HH:MM`
    }
    if (event.prefName != OFF_PREF_NAME && !prefNames.includes(event.prefName)) {
      return `"${name}" entry references unknown preset "${event.prefName}"`
    }
    if (typeof event.fadeIn != "number" || typeof event.fadeOut != "number") {
      return `"${name}" entry needs numeric fadeIn and fadeOut`
    }
    if (requireWeekday && !(Number.isInteger(event.weekday) && event.weekday >= 0 && event.weekday <= 6)) {
      return `"${name}" entry needs an integer weekday from 0 to 6`
    }
  }
  return null
}

// Write, then wait for the orb to confirm. 202 means it was sent but the orb
// didn't broadcast in time, so the returned state may be stale.
async function respondAfterWrite(response, client, summarize) {
  let fresh = await client.resync()
  respondJSON(response, fresh ? 200 : 202, summarize(client.state))
}


// --- Routing ---

async function handlePrefs(context, client) {
  let { response, method, body } = context
  if (method == "GET") {
    respondJSON(response, 200, prefsSummary(client.state))
    return true
  }
  if (method == "DELETE") {
    client.sendToOrb({ type: "clearPrefs" })
    await respondAfterWrite(response, client, prefsSummary)
    return true
  }
  if (method != "PATCH") return false

  let update = parseBody(body)
  if (!Object.keys(update).length) {
    respondJSON(response, 400, { error: "Body must be a JSON object of preferences to set" })
    return true
  }
  let unknown = unknownPrefKeys(client.state, update)
  if (unknown.length) {
    respondJSON(response, 400, { error: `Unknown preference(s): ${unknown.join(", ")}` })
    return true
  }
  client.sendToOrb({ type: "prefs", update })
  await respondAfterWrite(response, client, prefsSummary)
  return true
}

async function handleSchedule(context, client) {
  let { response, method, body } = context
  if (method == "GET") {
    respondJSON(response, 200, scheduleSummary(client.state))
    return true
  }
  if (method != "PUT") return false

  let update = parseBody(body)
  let unknown = Object.keys(update).filter(key => !SCHEDULE_KEYS.includes(key))
  if (unknown.length) {
    respondJSON(response, 400, { error: `Unknown schedule field(s): ${unknown.join(", ")}. Valid: ${SCHEDULE_KEYS.join(", ")}` })
    return true
  }
  for (let [name, requireWeekday] of [["schedule", false], ["weeklySchedule", true]]) {
    if (update[name] === undefined) continue
    let error = scheduleError(update[name], name, requireWeekday, client.state.prefNames)
    if (error) {
      respondJSON(response, 400, { error })
      return true
    }
  }
  client.sendToOrb({ type: "prefs", update })
  await respondAfterWrite(response, client, scheduleSummary)
  return true
}

async function handlePresets(context, client, rest) {
  let { response, method, body } = context

  if (rest.length == 1) {
    if (method != "GET") return false
    respondJSON(response, 200, presetsSummary(client.state))
    return true
  }

  // Matched only at this exact shape, so a preset named "cycle" stays reachable
  // through the /presets/<name>/<action> forms
  if (rest.length == 2 && rest[1] == "cycle" && method == "POST") {
    client.sendToOrb({ type: "advanceCycle" })
    await respondAfterWrite(response, client, presetsSummary)
    return true
  }

  let name = rest[1]
  let exists = client.state.prefNames.includes(name)

  if (rest.length == 2) {
    if (method == "PUT") {
      client.sendToOrb({ type: "savePrefs", name })
      await respondAfterWrite(response, client, presetsSummary)
      return true
    }
    if (method == "DELETE") {
      if (!exists) {
        respondJSON(response, 404, { error: `No preset named "${name}"` })
        return true
      }
      client.sendToOrb({ type: "deletePrefs", name })
      await respondAfterWrite(response, client, presetsSummary)
      return true
    }
    return false
  }

  if (rest.length != 3 || method != "POST") return false
  if (!exists) {
    respondJSON(response, 404, { error: `No preset named "${name}"` })
    return true
  }

  let content = parseBody(body)
  switch (rest[2]) {
    case "load":
      client.sendToOrb({ type: "loadPrefs", name })
      break
    case "copy":
      if (!content.copyName) {
        respondJSON(response, 400, { error: 'Body must include "copyName"' })
        return true
      }
      client.sendToOrb({ type: "copyPrefs", name, copyName: content.copyName })
      break
    case "rename":
      if (!content.newName) {
        respondJSON(response, 400, { error: 'Body must include "newName"' })
        return true
      }
      client.sendToOrb({ type: "renamePref", originalName: name, newName: content.newName })
      break
    case "reorder":
      if (!client.state.prefNames.includes(content.targetName)) {
        respondJSON(response, 400, { error: 'Body must include "targetName" naming an existing preset' })
        return true
      }
      client.sendToOrb({ type: "reorderPrefs", name, targetName: content.targetName })
      break
    default:
      return false
  }
  await respondAfterWrite(response, client, presetsSummary)
  return true
}

async function handleOrb(context, orbID, rest) {
  let { response, method } = context

  // An orb the relay has never heard of is a different problem from one that is
  // merely offline right now
  if (!connectedOrbs[orbID] && !orbInfoCache[orbID]) {
    respondJSON(response, 404, { error: `Unknown orb "${orbID}"` })
    return true
  }

  let client = getClient(orbID)
  let connected = await client.ensureConnected()
  if (client.mustLogin) {
    respondJSON(response, 403, {
      error: "This orb requires a login code shown on the orb itself, which the REST API cannot supply.",
    })
    return true
  }
  if (!connected) {
    respondJSON(response, 503, { error: `Orb "${orbID}" is not connected or did not respond` })
    return true
  }

  let handled = false
  switch (rest[0]) {
    case "state":
      if (rest.length == 1 && method == "GET") {
        respondJSON(response, 200, client.state)
        handled = true
      }
      break
    case "prefs":
      if (rest.length == 1) handled = await handlePrefs(context, client)
      break
    case "schedule":
      if (rest.length == 1) handled = await handleSchedule(context, client)
      break
    case "presets":
      handled = await handlePresets(context, client, rest)
      break
    case "dim":
      if (rest.length == 1 && method == "POST") {
        client.sendToOrb({ type: "advanceManualFade" })
        await respondAfterWrite(response, client, prefsSummary)
        handled = true
      }
      break
  }
  return handled
}

async function handleRequest(context) {
  let { response, request, method, filePath, queryParams } = context
  if (filePath != API_PREFIX && !filePath.startsWith(API_PREFIX + "/")) return false

  // Off by default. Set REST_API_KEY in config.js to require a bearer token.
  if (config.REST_API_KEY && request.headers.authorization != "Bearer " + config.REST_API_KEY) {
    respondJSON(response, 401, { error: "Unauthorized" })
    return true
  }
  if (method == "OPTIONS") {
    respondJSON(response, 204, {})
    return true
  }

  let parts = filePath.slice(API_PREFIX.length).split("/").filter(part => part.length)
  try {
    parts = parts.map(decodeURIComponent)
  } catch(e) {
    respondJSON(response, 400, { error: "Malformed URL encoding in path" })
    return true
  }

  let handled = false
  try {
    if (parts[0] != "orbs") {
      handled = false
    } else if (parts.length == 1) {
      if (method == "GET") {
        respondJSON(response, 200, listOrbs(request))
        handled = true
      }
    } else {
      handled = await handleOrb(context, resolveOrbID(parts[1]), parts.slice(2))
    }
  } catch(e) {
    if (e instanceof SyntaxError) {
      respondJSON(response, 400, { error: "Body is not valid JSON" })
      return true
    }
    console.log("REST API error", method, filePath, e)
    respondJSON(response, 500, { error: "Internal error" })
    return true
  }

  if (!handled) {
    respondJSON(response, 404, { error: `No route for ${method} ${filePath}` })
  }
  return true
}

function initRestApi(dependencies) {
  connectedOrbs = dependencies.connectedOrbs
  connectedClients = dependencies.connectedClients
  orbInfoCache = dependencies.orbInfoCache
  orbToIP = dependencies.orbToIP
  ipFromRequest = dependencies.ipFromRequest
  for (let method of METHODS) {
    addListener(method, handleRequest)
  }
  console.log("REST API listening on " + API_PREFIX)
}

module.exports = { initRestApi }
