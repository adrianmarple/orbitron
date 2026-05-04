#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { config, execute, processAdminCommand, noCorsHeader } = require('./lib')
const { pullAndRestart, restartOrbitron } = require('./gitupdate')
const { addGETListener, respondWithFile, addPOSTListener } = require('./server')
const crypto = require('crypto')
function sha256(str) { return crypto.createHash('sha256').update(str).digest('hex') }
const { startOrb } = require('./orb')

const connectedOrbs = {}
const orbToIP = {}
const connectedClients = {}
const awaitingMessages = {}
let orbInfoCache = {}
let BACKUPS_DIR = "./backups/"

// --- Arduino OTA firmware ---
const FIRMWARE_DIR = path.join(__dirname, 'firmware')
const SUPPORTED_CHIPS = ['esp32c3', 'esp32c6']
const firmwareBin = chip => path.join(FIRMWARE_DIR, `${chip}.bin`)
const firmwareVersionFile = chip => path.join(FIRMWARE_DIR, `${chip}.version.txt`)
let compiledFirmwareVersions = {}  // chip -> version number

const MASTER_KEY_FILE = path.join(__dirname, 'masterkey.txt')
let masterKey = ''
try { masterKey = fs.readFileSync(MASTER_KEY_FILE, 'utf8').trim() } catch(_) {}

const GIT_BRANCH = require('child_process').execSync('git rev-parse --abbrev-ref HEAD').toString().trim()
console.log("On branch: " + GIT_BRANCH)

function sendToArduinos(message) {
  for (let id in connectedOrbs) {
    if (orbInfoCache[id]?.config?.ARDUINO) connectedOrbs[id].send(message)
  }
}
function sendToPis(message) {
  for (let id in connectedOrbs) {
    if (!orbInfoCache[id]?.config?.ARDUINO) connectedOrbs[id].send(message)
  }
}

function loadCompiledFirmwareVersion() {
  for (const chip of SUPPORTED_CHIPS) {
    try {
      compiledFirmwareVersions[chip] = parseInt(fs.readFileSync(firmwareVersionFile(chip), 'utf8').trim()) || 0
      console.log(`Loaded firmware version for ${chip}:`, compiledFirmwareVersions[chip])
    } catch(_) {
      compiledFirmwareVersions[chip] = 0
    }
  }
}

// Fields only meaningful on a Pi — omit when converting Pi config → Arduino JSON
const PI_ONLY_FIELDS = new Set([
  'DEV_MODE', 'HAS_EMULATION', 'IS_RELAY', 'CLEAR_PREFS_ON_DISCONNECT',
  'CERT_LOCATION', 'KEY_LOCATION',
  'LED_STRIP_TYPE', 'APA102_BRIGHTNESS', 'APA102_MOSI_PIN', 'APA102_SCLK_PIN',
  'BEAT_PIN', 'MANUAL_FADE_PIN', 'PIN_INPUT_TYPE',
  'EXTERNAL_WIFI', 'NO_ACCESS_POINT',
  'TEXT_DISPLAY',
])

// Convert Arduino JSON config to Pi JS module format
function arduinoConfigToPiConfig(jsonStr) {
  let cfg = {}
  try { cfg = JSON.parse(jsonStr) } catch(e) { return 'module.exports = {}' }
  let lines = ['module.exports = {']
  for (let [k, v] of Object.entries(cfg)) {
    if (k === 'ARDUINO') continue  // Arduino-only marker
    lines.push(`  ${k}: ${typeof v === 'string' ? `"${v}"` : JSON.stringify(v)},`)
  }
  lines.push('}')
  return lines.join('\n')
}

// Convert Pi JS module config to Arduino JSON format
function piConfigToArduinoConfig(jsStr) {
  let cfg = {}
  try {
    let match = jsStr.match(/module\.exports\s*=\s*(\{[\s\S]*\})\s*;?\s*$/)
    if (match) cfg = eval('(' + match[1] + ')')
  } catch(e) { return '{}' }
  let result = {}
  for (let [k, v] of Object.entries(cfg)) {
    if (!PI_ONLY_FIELDS.has(k)) result[k] = v
  }
  return JSON.stringify(result, null, 2)
}

async function listBackups(orbID = null) {
  try {
    let files = await fs.promises.readdir(BACKUPS_DIR)
    if (orbID) files = files.filter(f => f.startsWith(orbID + '_'))
    return files
  } catch(_) {
    return []
  }
}

async function performRestore(backupName, targetOrbID, skipAuth = false) {
  backupName = path.basename(backupName)
  if (!backupName.endsWith('.bak')) return { error: "Invalid backup file." }
  if (!skipAuth && !backupName.startsWith(targetOrbID + '_')) return { error: "Unauthorized." }
  let backup
  try {
    backup = JSON.parse(await fs.promises.readFile(BACKUPS_DIR + backupName))
  } catch(e) {
    return { error: "Error reading backup." }
  }
  let restoreOrb = connectedOrbs[targetOrbID]
  if (!restoreOrb) return { error: "Orb not connected." }
  if (backup.config) {
    let backupIsArduino = backup.config.trim().startsWith('{')
    let targetIsArduino = !!(orbInfoCache[targetOrbID]?.config?.ARDUINO)
    if (backupIsArduino !== targetIsArduino) {
      backup.config = backupIsArduino
        ? arduinoConfigToPiConfig(backup.config)
        : piConfigToArduinoConfig(backup.config)
    }
  }
  restoreOrb.send(JSON.stringify({ type: "restoreFromBackup", backup }))
  return { ok: true }
}


let server
if (config.DEV_MODE) {
  server = http.createServer(serverHandler)
} else {
  server = https.createServer(config.httpsOptions, serverHandler)
}
function serverHandler(request, response) {
  response.writeHead(404)
  response.end()
}

function ipFromRequest(request) {
  return request.headers['x-forwarded-for'] || request.connection.remoteAddress
}


server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})
let wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })
wsServer.on('connection', (socket, request) => {
  let url = request.url.trim()
  //console.log('WS connection request made to', request.url)
  let meta = url.split("/")
  if(meta[1] == "relay") { // socket from orb to server
    let orbID = meta[2].toLowerCase()
    orbToIP[orbID] = ipFromRequest(request)
    socket.classification = "WS orb to server"
    bindOrb(socket, orbID)
  } else { // client socket connecting to server
    let orbID = meta[1].toLowerCase()
    orbID = config.reverseAliases[orbID] ?? orbID
    let clientID = meta[2]
    socket.clientID = clientID
    socket.classification = "WS client to server"
    bindClient(socket, orbID, clientID)
  }
})

let serverPingHandler = () => {
  for (const orbID in connectedOrbs) {
    connectedOrbs[orbID].send("PING")
    connectedOrbs[orbID].lastActivityTime = Date.now()
  }
}
setInterval(serverPingHandler, 3000)  

async function loadOrbInfoCache() {
  try {
    orbInfoCache = JSON.parse(await fs.promises.readFile("./orbinfocache.json", "utf8"))
  } catch(_) {}
}

function bindOrb(socket, orbID) {
  if(connectedOrbs[orbID]){
    try {
      connectedOrbs[orbID].close()
    } catch(e) {
      console.log("Error closing existing orb socket",orbID, e)
    }
  }
  connectedOrbs[orbID] = socket
  socket.lastActivityTime = Date.now()
  socket.on('message', async (data, isBinary) => {
    socket.lastActivityTime = Date.now()
    if (data == "PING") return

    try {
      jsonData = JSON.parse(data)
      let messageID = jsonData.messageID
      if (messageID) {
        if (awaitingMessages[messageID]) {
          awaitingMessages[messageID].resolve(jsonData.data)
          delete awaitingMessages[messageID]
        }
        return
      }

      let backup = jsonData.backup
      if (backup) {
        let name = backup.nameOverride
        if (name) {
          delete(backup.nameOverride)
        }
        backup = JSON.stringify(backup)
        let id = config.ALIASES[orbID] ?? orbID
        
        if (!fs.existsSync(BACKUPS_DIR)) {
          await fs.promises.mkdir(BACKUPS_DIR)
        }
        let savedPrefFileNames = (await fs.promises.readdir(BACKUPS_DIR))
          .filter(name => name.startsWith(id + '_'))
        if (!backup.nameOverride && savedPrefFileNames.length > 0) {
          const allContents = await Promise.all(
            savedPrefFileNames.map(name => fs.promises.readFile(BACKUPS_DIR + name))
          )
          if (allContents.some(contents => backup == contents)) {
            return
          }
        }
        
        if (!name) {
          if (id.startsWith("_")) { // Only save manual backups for special lumatrons
            return
          }

          function twoDigit(num) {
            return String(num).padStart(2, '0')
          }
          let d = new Date()
          let dateString = `${d.getFullYear()}-${twoDigit(d.getMonth()+1)}-${twoDigit(d.getDate())}_${twoDigit(d.getHours())}-${twoDigit(d.getMinutes())}`
          name = id + "_" + dateString
        }
        let path = BACKUPS_DIR + name + '.bak'
        await fs.promises.writeFile(path, backup)

        for (let i = 0; i < savedPrefFileNames.length - 4; i++) {
          fs.promises.unlink(BACKUPS_DIR + savedPrefFileNames[i])
        }
        return
      }
    } catch {}

    if(!isBinary){
      data = data.toString().trim()
    }
    try {
      data = JSON.parse(data);

      if (data.config) { // info dump to cache
        if (data.config.TEMP_ORB) return
        orbInfoCache[orbID] = data
        await fs.promises.writeFile("./orbinfocache.json", JSON.stringify(orbInfoCache), "utf8")
        return
      }

      let clientID = data.clientID;
      let client = connectedClients[orbID] && connectedClients[orbID][clientID]
      if(client) {
        while(client.messageCache.length > 0) {
          let message = client.messageCache.shift()
          try {
            socket.send(message)
          } catch(e) {
            console.log("Error sending cached message to orb", orbID, clientID, e)
          }
        }
        client.send(data.message)
      }
    } catch(e) {
      console.log("Orb to Client error:", orbID, e)
    }

  })
  socket.on('close', () => {
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.log("Error in orb socket", orbID, e)
    socket.close()
  })
}

function orbUpkeep() {
  for (let socket of Object.values(connectedOrbs)) {
    if (Date.now() - socket.lastActivityTime > 10*1000) {
      socket.close()
    }
  }
}
setInterval(orbUpkeep, 1000)

function bindClient(socket, orbID, clientID) {
  orbID = orbID.toLowerCase()
  if(!connectedClients[orbID]){
    connectedClients[orbID] = {}
  }
  if(connectedClients[orbID][clientID]){
    try {
      connectedClients[orbID][clientID].close()
    } catch(e) {
      console.log("Error closing existing client", orbID, clientID, e)
    }
  }
  connectedClients[orbID][clientID] = socket
  socket.clientID = clientID
  socket.messageCache = []
  socket.on('message', async (data, isBinary) => {
    if(!isBinary){
      data = data.toString().trim()
    }
    try {
      let parsed
      try { parsed = JSON.parse(data) } catch(_) {}
      if (parsed?.type === 'listBackups') {
        socket.send(JSON.stringify({ backupList: await listBackups(orbID) }))
        return
      }
      if (parsed?.type === 'restoreBackup') {
        let result = await performRestore(parsed.fileName, orbID)
        socket.send(JSON.stringify({ backupRestoreResult: result.error || 'OK' }))
        return
      }

      data = {
        clientID: clientID,
        message: data,
      }
      data = JSON.stringify(data)
      let orb = connectedOrbs[orbID]
      if(orb){
        orb.send(data)
      }else{
        socket.messageCache.push(data)
        if(socket.messageCache.length > 16) {
          socket.messageCache.shift()
        }
      }
    } catch(e) {
      console.log("Client to orb error:", orbID, clientID, e)
    }
  })
  socket.on('close', () => {
    let orb = connectedOrbs[orbID]
    if(orb){
      orb.send(JSON.stringify({
        clientID: clientID,
        closed: true,
      }))
    }
    delete connectedClients[orbID][clientID]
    if (Object.keys(connectedClients[orbID]).length === 0) {
      delete connectedClients[orbID]
    }
  })
  socket.on('error', (e) => {
    console.log("Error on client socket", orbID, clientID, e)
    socket.close()
  })
  try {
    let orb = connectedOrbs[orbID]
    if(orb) {
      let initial_message = {
        clientID: clientID,
        message: "{}",
        closed: false,
      }  
      orb.send(JSON.stringify(initial_message))
    }
  } catch(e) {
    console.log("Error sending initial client message", e)
    socket.close()
  }
} // END web socket section


// Serve admin UI at /admin (no query params)
addGETListener(async (response, _, filePath, queryParams) => {
  if (filePath != "/admin") return false
  if (Object.keys(queryParams).length > 0) return false
  respondWithFile(response, "/admin/admin.html")
  return true
})

// Serve version info for admin UI (used to show how far behind each orb is)
addGETListener(async (response, orbID, filePath) => {
  if (filePath != "/admin/versions") return false
  let gitCount = parseInt((await execute("git rev-list --count HEAD")).trim())
  noCorsHeader(response, 'text/json')
  response.end(JSON.stringify({ gitCount, arduinoVersions: compiledFirmwareVersions }))
  return true
})

// Admin commands for this relay
addGETListener(async (response, orbID, _, queryParams) => {
  if (orbID != "admin") return false
  let command = await processAdminCommand(queryParams)
  if (!command) return false

  noCorsHeader(response, 'text/json')
  switch (command.type) {
    case "orblist":
      let orbInfo = []
      for (let id in connectedOrbs) {
        orbInfo.push({
          id,
          alias: config.ALIASES[id],
          isArduino: !!(orbInfoCache[id]?.config?.ARDUINO),
        })
      }
      response.end(JSON.stringify(orbInfo))
      return true
    case "alias":
      config.ALIASES[command.id] = command.alias
      config.reverseAliases[command.alias] = command.id
      response.end("OK")
      return true
    case "backuplist":
      response.end(JSON.stringify(await listBackups()))
      return true
    case "restoreBackup": {
      let result = await performRestore(command.fileName, command.orbID, true)
      response.end(result.error || "OK")
      return true
    }
    case "deleteBackup":
      response.end(await fs.promises.unlink(BACKUPS_DIR + command.fileName))
      return true
    default:
      return false
  }
})

// Admin commands for orbs
addGETListener(async (response, orbID, filePath, queryParams) => {
  let pathParts = filePath.split("/")
  if (pathParts.length < 3 || pathParts[2] != "admin") return false

  if(!orbID || !connectedOrbs[orbID]) {
    response.writeHead(404)
    response.end("ORB DISCONNECTED")
    return true
  }

  if (queryParams.type === "updateFirmware") {
    connectedOrbs[orbID].send("HAS_UPDATE")
    noCorsHeader(response, 'text/json')
    response.end("OK")
    return true
  }

  queryParams.type = "admin"
  let orb = connectedOrbs[orbID]
  let reply = await new Promise(resolve => {
    orb.send(JSON.stringify(queryParams))
    awaitingMessages[queryParams.hash] = {
      timestamp: Date.now(),
      resolve,
    }
    setTimeout(() => {
      if (awaitingMessages[queryParams.hash]) {
        delete awaitingMessages[queryParams.hash]
        resolve("")
      }
    }, 5000)
  })
  noCorsHeader(response, 'text/json')
  response.end(reply)
  return true
})


// Get all orbs on same IP
addGETListener(async (response, _, filePath, __, request)=>{
  if (filePath != "/localorbs") return

  const clientIP = ipFromRequest(request)
  noCorsHeader(response, 'text/json')
  let localOrbs = []
  for (let orbID in orbToIP) {
    let orbInfo = orbInfoCache[orbID]
    if (!orbInfo) continue
    if (orbInfo.config.NO_LOCAL_REGISTRATION) continue
    if (orbToIP[orbID] == clientIP) {
      localOrbs.push(orbID)
    }
  }

  response.end(JSON.stringify(localOrbs))
  return true
})

// Serve compiled Arduino firmware binary
addGETListener(async (response, _, filePath, queryParams) => {
  if (!filePath.startsWith('/firmware/') || !filePath.endsWith('.bin')) return
  const chip = path.basename(filePath, '.bin')
  if (!SUPPORTED_CHIPS.includes(chip)) {
    response.writeHead(404); response.end('Unknown chip'); return true
  }
  const binPath = firmwareBin(chip)
  if (!fs.existsSync(binPath)) {
    response.writeHead(404); response.end('No firmware available'); return true
  }
  let clientVersion = parseInt(queryParams.version || '0')
  if (clientVersion >= compiledFirmwareVersions[chip]) {
    response.writeHead(304); response.end(); return true
  }
  let bin = await fs.promises.readFile(binPath)
  response.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'Content-Length': bin.length,
  })
  response.end(bin)
  return true
})

// Accept locally-built Arduino firmware binary and notify Arduino orbs to OTA
addPOSTListener(async (response, body, filePath, queryParams) => {
  if (filePath !== '/firmware/upload') return false
  const { version, chip, key } = queryParams
  if (key !== sha256(version + masterKey)) {
    response.writeHead(403); response.end('forbidden'); return true
  }
  if (!version || !body.length) {
    response.writeHead(400); response.end('missing version or binary'); return true
  }
  if (!SUPPORTED_CHIPS.includes(chip)) {
    response.writeHead(400); response.end('unknown chip'); return true
  }
  await fs.promises.mkdir(FIRMWARE_DIR, { recursive: true })
  await fs.promises.writeFile(firmwareBin(chip), body)
  await fs.promises.writeFile(firmwareVersionFile(chip), String(version))
  compiledFirmwareVersions[chip] = parseInt(version)
  console.log(`Firmware uploaded: ${chip} version ${compiledFirmwareVersions[chip]}`)
  sendToArduinos("HAS_UPDATE")
  response.writeHead(200); response.end('OK')
  return true
})

// Get basic info on orb
addGETListener(async (response, orbID, filePath)=>{
  if (!filePath.includes("/info")) return

  noCorsHeader(response, 'text/json')
  if(!orbID || !orbInfoCache[orbID]) {
    response.end(JSON.stringify(null))
    return true
  }
  localConfig = orbInfoCache[orbID].config
  const STRIP_FIELDS = ['ORB_KEY', 'MANUAL_FADE_PIN', 'BUTTON_PIN', 'KEY_LOCATION', 'CERT_LOCATION', 'httpsOptions', 'WEBHOOK_SECRET']
  let info = { ...localConfig }
  for (const key of STRIP_FIELDS) {
    delete info[key]
  }
  info.orbID = orbID
  info.isCurrentlyConnected = !!connectedOrbs[orbID]
  info.isArduino = localConfig.ARDUINO || false
  info.name = config.ALIASES[orbID] ?? orbID
  if (config.ALIASES[orbID]) {
    info.alias = config.ALIASES[orbID]
  }
  response.end(JSON.stringify(info))
  return true
})

// Serve pixel geometry as binary for Arduino ESP32 devices
// Format: uint16 SIZE, uint16 RAW_SIZE, dupes_to_uniques, neighbors (MAX_NEIGHBORS=6, 0xffff-padded), raw_to_unique, coords
addGETListener((response, _, filePath) => {
  if (!filePath.startsWith('/pixels/') || !filePath.endsWith('.bin')) return false
  const MAX_NEIGHBORS = 6
  const pixelsName = filePath.slice('/pixels/'.length, -'.bin'.length)
  const jsonPath = `${__dirname}/pixels/${pixelsName}.json`
  if (!fs.existsSync(jsonPath)) return false
  const d = JSON.parse(fs.readFileSync(jsonPath))
  const { SIZE, RAW_SIZE, dupeToUniques, neighbors, uniqueToDupe, coords } = d
  const buf = Buffer.alloc(
    2 + 2 +
    SIZE * 2 * 2 +
    SIZE * MAX_NEIGHBORS * 2 +
    RAW_SIZE * 2 +
    SIZE * 3 * 4
  )
  let off = 0
  buf.writeUInt16LE(SIZE, off);    off += 2
  buf.writeUInt16LE(RAW_SIZE, off); off += 2
  for (let i = 0; i < SIZE; i++) {
    buf.writeUInt16LE(dupeToUniques[i][0], off); off += 2
    buf.writeUInt16LE(dupeToUniques[i][1], off); off += 2
  }
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < MAX_NEIGHBORS; j++) {
      buf.writeUInt16LE(neighbors[i][j] ?? 0xffff, off); off += 2
    }
  }
  for (let i = 0; i < RAW_SIZE; i++) {
    buf.writeUInt16LE(uniqueToDupe[i], off); off += 2
  }
  for (let i = 0; i < SIZE; i++) {
    buf.writeFloatLE(coords[i][0], off); off += 4
    buf.writeFloatLE(coords[i][1], off); off += 4
    buf.writeFloatLE(coords[i][2], off); off += 4
  }
  noCorsHeader(response, 'application/octet-stream')
  response.end(buf)
  return true
})

addGETListener((response, orbID, filePath) => {
  if(!filePath.includes('view')) return

  // Validate that the pixel file exists before spinning up a temp orb
  let pixelsPath = orbID.replace("+", "/")
  if (!pixelsPath.includes("/")) pixelsPath = pixelsPath + "/" + pixelsPath
  if (!fs.existsSync(`${__dirname}/pixels/${pixelsPath}.json`)) return

  // Spin up temp orb emulator (it will then add the get listener that will actually handle this request)
  startOrb({
    ORB_ID: orbID,
    PIXELS: pixelsPath,
    DEV_MODE: config.DEV_MODE,
    PYTHON_EXECUTABLE: config.PYTHON_EXECUTABLE,
    HAS_EMULATION: true,
    TEMP_ORB: true,
    EXCLUDE: {
      save: true,
      timing: true,
    },
    PREFS_FILE: "/savedprefs/demo.prefs.json",
  })
  
  return false
})

// Serve actual controller
// Important that this goes last
addGETListener(async (response, orbID, filePath) => {
  if(filePath.includes(".") || filePath.split("/").length > 2) return

  if (filePath == "") { // Home page is same as controller now
    respondWithFile(response, "/controller/controller.html")
    return true
  }
  if (!connectedOrbs[orbID]) {
    // Redirect to home page
    response.writeHead(302 , {
        'Location' : '/'
    })
    response.end()
    return true
  }

  let originalOrbID = filePath.split("/")[1].toLowerCase()
  if (config.ALIASES[originalOrbID]) {
    // Always redirect to use alias
    response.writeHead(302 , {
        'Location' : '/' + config.ALIASES[orbID]
    })
    response.end()
  } else {
    respondWithFile(response, "/controller/controller.html")
  }
  return true
})

// Process notification of git update
addPOSTListener(async (response, body, filePath, queryParams, headers) => {
  if (!headers['x-github-event']) return false

  if (config.WEBHOOK_SECRET) {
    const expected = 'sha256=' + crypto.createHmac('sha256', config.WEBHOOK_SECRET).update(body).digest('hex')
    if (headers['x-hub-signature-256'] !== expected) {
      console.log("Received github webhook POST with invalid signature")
      response.writeHead(403)
      response.end('invalid signature')
      return true
    }
  }

  let payload
  try {
    payload = JSON.parse(body.toString())
  } catch(_) {
    response.writeHead(400)
    response.end('invalid JSON')
    return true
  }

  response.writeHead(200)
  response.end('post received')

  if (payload.ref !== `refs/heads/${GIT_BRANCH}`) return true

  // Pull new code and notify Pi orbs (Arduinos update separately via firmware upload)
  ;(async () => {
    await execute('git fetch origin')
    await execute(`git reset --hard origin/${GIT_BRANCH}`)
    sendToPis("HAS_UPDATE")
    restartOrbitron()
  })()
  return true
})

loadOrbInfoCache()
loadCompiledFirmwareVersion()