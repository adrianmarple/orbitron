#!/usr/bin/env node
let { checkConnection, delay, execute, processAdminCommand, PYTHON_EXECUTABLE, restartOrbitron} = require('./lib')
let { fixExternalWifi } = require('./external_wifi.js')
const { pullAndRestart, timeUntilHour } = require('./gitupdate')
const WebSocket = require('ws')
const fs = require('fs')
const process = require('process')
const { spawn } = require('child_process')
const pako = require('./thirdparty/pako.min.js')
const os = require('os')
const { v4: uuid } = require('uuid')
const homedir = os.homedir()

fixExternalWifi()


const NO_TIMEOUT = process.argv.includes('-t')
let tempOrbIDs = []



function startOrb(config) {
if (tempOrbIDs.includes(config.ORB_ID)) {
  return
}
tempOrbIDs.push(config.ORB_ID)

let intervals = []
let setInterval = (...args) => {
  intervals.push(global.setInterval(...args))
}

config.PIXELS = config.PIXELS || "rhombicosidodecahedron"
if (config.PIXELS.startsWith("/pixels/"))
  config.PIXELS = config.PIXELS.slice(8)
if (config.PIXELS.endsWith(".json"))
  config.PIXELS = config.PIXELS.slice(0, config.PIXELS.length - 5)
if (!config.PIXELS.includes("/"))
  config.PIXELS = config.PIXELS + "/" + config.PIXELS
config.PIXELS_FILE = `/pixels/${config.PIXELS}.json`

// let orbEmulatorBroadcast = () => {}
let emulator 
if(config.HAS_EMULATION){
  let { Emulator } = require('./emulation.js')
  emulator = new Emulator(config)
  // orbEmulatorBroadcast = require('./emulator.js').orbEmulatorBroadcast
}
if (process.argv.includes('-f')) {
  config.SHOW_FRAME_INFO = true
}
// Cloud save
async function backupLoop() {
  while (true) {
    // await delay(10000)
    await delay(timeUntilHour(0))
    await saveBackup()
  }
}
backupLoop()

async function saveBackup(nameOverride) {
  let savedPrefFileNames = []
  try {
    savedPrefFileNames = await fs.promises.readdir("savedprefs")
  } catch(_) {}
  let savedPrefs = {}
  for (let fileName of savedPrefFileNames) {
    savedPrefs[fileName] = (await fs.promises.readFile("savedprefs/" + fileName)).toString()
  }
  let backup = {
    nameOverride,
    savedPrefs,
    config: (await fs.promises.readFile("config.js")).toString(),
  }
  try {
    backup.timingprefs = (await fs.promises.readFile("timingprefs.json")).toString()
  } catch(_) {}
  if (!backup.timingprefs || backup.timingprefs.match(/"useTimer"\:\s*false,/)) {
    try {
      backup.prefs = (await fs.promises.readFile("prefs.json")).toString()
    } catch(_) {}
  }
  try {
    await orbToRelaySocket.send(JSON.stringify({ backup }))
    console.log("Sent backup to server")
  } catch(e) {
    console.log("Error sending backup to server:", e)
  }
}


let orbToRelaySocket = null

function connectOrbToRelay(){
  try {
    displayText("CONNECTING")
    let relayURL
    if (config.DEV_MODE) {
      relayURL = "ws://0.0.0.0"
    } else {
      relayURL = "wss://my.lumatron.art"
    }
    relayURL += `:7777/relay/${config.ORB_ID}`
    orbToRelaySocket = new WebSocket.WebSocket(relayURL)
    orbToRelaySocket.lastPingReceived = Date.now()

    orbToRelaySocket.on("open", () => {
      // Send over config w/o secret on socket connection
      let configCopy = { ...config }
      delete configCopy.ORB_KEY
      delete configCopy.httpsOptions
      let message = {
        type: "info",
        config: configCopy
      }
      try {
        orbToRelaySocket.send(JSON.stringify(message))
      } catch(e) {
        console.log("Error sending config to relay", e, message)
      }
    })

    orbToRelaySocket.on('message', async (data, isBinary) => {
      displayText("")
      if(!isBinary){
        data = data.toString().trim()
      }      
      if(data == "PING"){
        orbToRelaySocket.lastPingReceived = Date.now()
        return
      }
      if(data == "GIT_HAS_UPDATE"){
        console.log("Received notice of git update.")
        if (config.CONTINUOUS_INTEGRATION) {
          displayText("RESTARTING")
          pullAndRestart()
        }
        return
      }
      if(data == "GET_LOGS"){
        try {
          await execute(`${__dirname}/utility_scripts/zip_logs.sh`)
          let logfile = fs.readFileSync(`${homedir}/logs.zip`)
          orbToRelaySocket.send(logfile)
        } catch(error) {
          console.log("Error sending logs", error)
        }
        return
      }

      data = JSON.parse(data)

      if (data.type == "restoreFromBackup") {
        let promises = []
        let backup = data.backup
        promises.push(fs.promises.writeFile("config.js", backup.config))
        if (backup.timingprefs) {
          promises.push(fs.promises.writeFile("timingprefs.json", backup.timingprefs))
        }
        if (backup.prefs) {
          promises.push(fs.promises.writeFile("prefs.json", backup.prefs))
        }

        await fs.promises.rm("savedprefs", { recursive: true })
        await fs.promises.mkdir("savedprefs")
        for (let name in backup.savedPrefs) {
          promises.push(fs.promises.writeFile("savedprefs/" + name, backup.savedPrefs[name]))
        }
        await Promise.all(promises)
        restartOrbitron()
        return
      }

      // Admin command
      if (data.type == "admin") {
        let messageID = data.hash
        let command = await processAdminCommand(data)
        if (!command) return

        let returnData = "OK"
        if (command.type == "python") {
          python_process.stdin.write(JSON.stringify(command.content) + "\n", "utf8")
        }
        if (command.type == "run") {
          returnData = await execute(command.command)
        }
        if (command.type == "restart") {
          restartOrbitron()
        }
        if (command.type == "getconfig") {
          returnData = (await fs.promises.readFile("config.js")).toString()
        }
        if (command.type == "getprefs") {
          try {
            returnData = (await fs.promises.readFile("prefs.json")).toString()
          } catch (_) {
            returnData = "NO pref.json FILE EXISTS"
          }
        }
        if (command.type == "gettimingprefs") {
          try {
            returnData = (await fs.promises.readFile("timingprefs.json")).toString()
          } catch (_) {
            returnData = "NO timingprefs.json FILE EXISTS"
          }
        }
        if (command.type == "geterror") {
          if (config.DEV_MODE) {
            returnData = "no pm2 running"
          } else {
            returnData = (await fs.promises.readFile("/root/.pm2/logs/startscript-error.log")).toString()
          }
        }
        if (command.type == "getlog") {
          let daysAgo = command.daysAgo || 0
          let suffix = ""
          if (daysAgo > 0) {
            let day = new Date()
            day.setDate(day.getDate() - daysAgo)
            suffix = "__" + day.toJSON().slice(0, 10) + "_00-00-00"
          }
          try {
            returnData = (await fs.promises.readFile(`/root/.pm2/logs/startscript-out${suffix}.log`)).toString()
          } catch(_) {
            returnData = "Log file does not exist"
          }
        }
        if (command.type == "ip") {
          let interfaces = require('os').networkInterfaces();
          for (var devName in interfaces) {
            var iface = interfaces[devName]
            for (var i = 0; i < iface.length; i++) {
              var alias = iface[i]
              if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                returnData = alias.address
                break
              }
            }
          }
        }
        if (command.type == "commit") {
          returnData = (await execute("git log --pretty=format:'%H' -1")).replace(/[\s]/, "")
        }
        if (command.type == "setconfig") {
          let match = command.data.match(/\s*module\.exports\s*=(.*)/s)
          if (!match) return
          let configObject = eval("(" + match[1] + ")")
          if (!configObject.ORB_ID) return
          await fs.promises.writeFile("config.js", command.data)
          if (!command.dontRestart) {
            restartOrbitron()
          }
        }
        if (command.type == "setprefs") {
          try {
            JSON.parse(command.data)
            await fs.promises.writeFile("prefs.json", command.data)
            if (!command.dontRestart) {
              restartOrbitron()
            }
          } catch(_) {
            console.log("Couldn't parse pref to save: ", command.data)
          }
        }
        if (command.type == "settimingprefs") {
          try {
            JSON.parse(command.data)
            await fs.promises.writeFile("timingprefs.json", command.data)
            if (!command.dontRestart) {
              restartOrbitron()
            }
          } catch(_) {
            console.log("Couldn't parse timingpref to save: ", command.data)
          }
        }

        if (command.type == "manualBackup") {
          await saveBackup(command.nameOverride)
        }
        orbToRelaySocket.send(JSON.stringify({
          messageID,
          data: returnData,
        }))
        return
      }

      // Actual Client message
      let clientID = data.clientID
      let clientConnection = getClientConnection(clientID)
      if(!clientConnection && !data.closed){
        clientConnection = createClientConnection(clientID, orbToRelaySocket)
      }
      if(clientConnection) {
        if(data.closed){
          clientConnection.close()
        } else {
          if (!isClientValid(clientID)) {
            generateCode()
            let success = tryValidation(clientID, data.message)
            if (!success) {
              return
            }
          }
          clientConnection.processMessage(data.message)
        }
      }
    })
    orbToRelaySocket.on('close', () => {
      orbToRelaySocket = null
    })
    orbToRelaySocket.on('error', (e) => {
      displayText("CONNECTION ERROR")
      console.log("Orb to relay socket error", e)
      orbToRelaySocket.close()
    })
  } catch(e) {
    displayText("CONNECTION ERROR")
    console.log("Error connecting to relay:", e)
    orbToRelaySocket = null
  }
}

let validClients = {}
let loginCode = ""
let loginExpiration = 0
let turnOffDisplayTimeout = null
let DURATION = 60*1000 // 1 minute
function generateCode() {
  if (Date.now() > loginExpiration) {
    loginCode = Math.floor(Math.random() * 10000)
  }
  loginExpiration = Date.now() + DURATION
  loginCodeText = loginCode.toString().padStart(4, '0')
  displayText(loginCodeText, 1)
  if (turnOffDisplayTimeout) {
    clearTimeout(turnOffDisplayTimeout)
  }
  turnOffDisplayTimeout = setTimeout(() => {
    displayText("", 1)
    turnOffDisplayTimeout = null
  }, DURATION)
}
function isClientValid(clientID) {
  if (!config.REQUIRES_LOGIN) return true
  if (!validClients[clientID]) return false
  if (Date.now() > validClients[clientID]) return false
  revalidate(clientID)
  return true
}
function tryValidation(clientID, message) {
  try {
    let content = JSON.parse(message)
    if (Date.now() < loginExpiration &&
        parseInt(content.loginCode) == loginCode) {
      revalidate(clientID)
      displayText("", 1)
      return true
    }
  } catch(_) {
    // Pass
  }
  return false
}
function revalidate(clientID) {
  validClients[clientID] = Date.now() + 60*60*1000
}

async function relayUpkeep() {
  if(orbToRelaySocket) return
  let connected = await checkConnection()
  if(connected){
    connectOrbToRelay()
  }
}
if(!config.IS_RELAY || config.HAS_EMULATION){
  setInterval(relayUpkeep, 5e3)
}

function orbPingHandler() {
  if(orbToRelaySocket && orbToRelaySocket.readyState === WebSocket.OPEN){
    orbToRelaySocket.send("PING")
    if(Date.now() - orbToRelaySocket.lastPingReceived > 30 * 1000){
      orbToRelaySocket.close()
    }
  }
}
setInterval(orbPingHandler, 3000)

// Class that handles connections between client and orb
const clientConnections = {}
function getClientConnection(clientID) {
  return clientConnections[clientID]
}
function createClientConnection(clientID, socket){
  if(!clientConnections[clientID]) {
    let clientConnection = new ClientConnection(clientID)
    clientConnection.on("close", () => {
      delete clientConnections[clientID]
    })
    clientConnection.setSocket(socket)
    bindPlayer(clientConnection)
    clientConnections[clientID] = clientConnection
  }
  return clientConnections[clientID]
}
class ClientConnection {
  constructor(id) {
    this.id = id
    this.callbacks = {}
    this.latestMessage = 0
    this.socket = null
    // used by business logic
    this.pid = null
    this.lastActivityTime = null
    this.timeout = 10 * 1000
  }

  setSocket(socket){
    this.socket = socket
  }

  processMessage(data) {
    try {
      if (data == "ECHO") {
        this.send("ECHO")
        return
      }

      let content = JSON.parse(data)
      if(content.timestamp > this.latestMessage){
        this.latestMessage = content.timestamp
        if(this.callbacks.message){
          this.callbacks.message.forEach(callback => {
            callback(content)
          });
        }
      }
    } catch(e) {
      console.log("Error processing message", e)
    }
  }

  // functions used by business logic
  on(e, callback) {
    if(!this.callbacks[e]){
      this.callbacks[e] = []
    }
    this.callbacks[e].push(callback)
  }

  send(message) {
    if (!isClientValid(this.id)) {
      message = JSON.stringify({ mustLogin: true })
    }
    message = { clientID: this.id, message }
    try {
      this.socket.send(JSON.stringify(message))
    } catch(e) {
      console.log("Error sending to client", e, this.id)
    }
  }

  close() {
    if(this.callbacks.close){
      this.callbacks.close.forEach((callback)=>callback())
    }
  }
}





// ---Game Related Code---

function bindPlayer(socket) {
  if(connectionQueue.includes(socket) || Object.values(connections).includes(socket)){
    return
  }
  connectionQueue.push(socket)
  bindDataEvents(socket)
  upkeep() // Will claim player if available
}

function bindDataEvents(peer) {
  peer.on('message', content => {
    if (typeof(peer.pid)==="number" && connections[peer.pid]) {
      content.self = peer.pid
    }
    peer.lastActivityTime = Date.now()
    if (config.LOG_INCOMING_MESSAGES) {
      let path = config.LOG_INCOMING_MESSAGES.split(".")
      let logContent = content
      for (let field of path) {
        if (logContent && logContent[field]) {
          logContent = logContent[field]
        } else {
          logContent = null
        }
      }
      if (logContent != null) {
        console.log(config.LOG_INCOMING_MESSAGES, logContent)
      }
    }
    python_process.stdin.write(JSON.stringify(content) + "\n", "utf8")
    if (["prefs", "clearPrefs", "loadPrefs", "advanceManualFade"].includes(content.type)) {
      shouldUpdateTetheree = true
    }
  })

  peer.on('close', () => {
    release = { self: peer.pid, type: "release" }
    python_process.stdin.write(JSON.stringify(release) + "\n", "utf8")
    if (typeof(peer.pid)==="number" && connections[peer.pid]) {
      delete connections[peer.pid]
    } else {
      connectionQueue = connectionQueue.filter(elem => elem !== peer)
    }
  })
}

// TETHERED ORB
let tethereeSocket = null
let tetherClientID = uuid()
let shouldUpdateTetheree = true
let previousBroadcast = {}
function tether(broadcastMessage) {
  if (!config.TETHER_ORB_ID) return

  let update = {...broadcastMessage.prefs}
  update.useTimer = false
  delete update.schedule
  delete update.weeklySchedule

  if (!previousBroadcast.prefs ||
      broadcastMessage.currentPrefName != previousBroadcast.currentPrefName ||
      broadcastMessage.prefs.dimmer != previousBroadcast.prefs.dimmer) {
    shouldUpdateTetheree = true
  }
  previousBroadcast = broadcastMessage

  tryTetherAction(() => {
    shouldUpdateTetheree = false
    tethereeSocket.send(JSON.stringify({
      type: "prefs",
      update,
      timestamp: broadcastMessage.timestamp,
    }))
    console.log("Sending tether update")
  })
}
function createTether() {
  if (!config.TETHER_ORB_ID) return

  tethereeSocket = new WebSocket(`wss://my.lumatron.art:7777/${config.TETHER_ORB_ID}/${tetherClientID}`)
  tethereeSocket.onclose = _ => {
    setTimeout(destroyTether)
  }
  tethereeSocket.onerror = event => {
    console.log("Tether socket error:",event)
    setTimeout(destroyTether)
  }
}
function destroyTether() {
  if(tethereeSocket) {
    try {
      tethereeSocket.close()
    } catch(e) {
      console.log("Error closing tether socket", e)
    }
    tethereeSocket = null
  }
}
function tryTetherAction(action) {
  if (!tethereeSocket || tethereeSocket.readyState === WebSocket.CLOSED) {
    try {
      createTether()
    } catch(e) {
      console.log(e)
    }
  } else if(shouldUpdateTetheree && tethereeSocket.readyState === WebSocket.OPEN) {
    try {
      action()
    } catch (error) {
      console.log(error)
      destroyTether()
      createTether()
    }
  }
}
if (config.TETHER_ORB_ID) {
  createTether()
  setInterval(() => {
    tryTetherAction(() => {
      tethereeSocket.send(JSON.stringify({
        type: "ping",
        timestamp: preciseTime(),
      }))
    })
  }, 10 * 1000)
  setInterval(() => {
    shouldUpdateTetheree = true
  }, 10 * 60 * 1000)
}


function upkeep() {
  if(!gameState) return
  // Check for stale players
  if (!NO_TIMEOUT) {
    for (let peer of Object.values(connections)) {
      let player = gameState.players[peer.pid]
      if (!player.isReady && !player.isPlaying &&
        Date.now() - peer.lastActivityTime > 60*1000) { // 60 seconds
        //console.log("Player timed out.",peer.pid,peer.lastActivityTime)
        peer.close()
      }
    }
  }

  let id = 0;
  for (let peer of [...connectionQueue]) {
    while (id < MAX_PLAYERS) {
      if (!connections[id]) {
        peer.pid=id
        peer.lastActivityTime = Date.now()
        connections[peer.pid] = peer
        claim = { self: peer.pid, type: "claim" }
        python_process.stdin.write(JSON.stringify(claim) + "\n", "utf8")
        connectionQueue = connectionQueue.filter(elem => elem !== peer)
        message = {...gameState}
        message.self = peer.pid
        peer.send(JSON.stringify(message))
        break;
      }
      id += 1;
    }
    if (id >= MAX_PLAYERS) {
      message = {...gameState}
      message.queuePosition = connectionQueue.indexOf(peer) + 1
      peer.send(JSON.stringify(message))
    }
  }
}

setInterval(upkeep, 1000)

let MAX_PLAYERS = 6
let connections = {}
let connectionQueue = []

// Communications with python script

gameState = null
gameStateString = ""
broadcastCounter = 0
const counterThreshold = 35

lastMessageTimestamp = 0
lastMessageTimestampCount = 0
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

function broadcast(baseMessage) {
  baseMessage.timestamp = preciseTime()
  tether(baseMessage)

  broadcastCounter++
  baseMessage.notimeout = NO_TIMEOUT
  let newGameState = {...baseMessage}
  delete newGameState.timestamp
  let newGameStateString = JSON.stringify(newGameState)
  let noChange = newGameStateString == gameStateString
  if(noChange && broadcastCounter % counterThreshold != 0){
    return
  }
  gameState = newGameState
  gameStateString = newGameStateString
  broadcastCounter = 0
  for (let id in connections) {
    baseMessage.self = parseInt(id)
    connections[id].send(JSON.stringify(baseMessage))
  }
  delete baseMessage.self
  for (let i = 0; i < connectionQueue.length; i++) {
    baseMessage.queuePosition = i + 1
    connectionQueue[i].send(JSON.stringify(baseMessage))
  }
  delete baseMessage.queuePosition
  delete baseMessage.timestamp
}


let env = {...process.env, CONFIG: JSON.stringify(config)}
const python_process = spawn(PYTHON_EXECUTABLE, ['-u', `${__dirname}/main.py`], {env})
let raw_pixels = null
let raw_json = null
python_process.stdout.on('data', data => {
  messages = data.toString().trim().split("\n")
  for(let message of messages){
    message = message.trim()
    if(!message) continue
    if (message.charAt(0) == "{") {
      raw_json = ""
    } else if(message.startsWith("raw_pixels=")) {
      raw_pixels = ""
      message = message.substr(11).trim()
    } else if(message.startsWith("touchall")) {
      for (let id in connections) {
        connections[id].lastActivityTime = Date.now()
      }
    } else if (raw_pixels === null && raw_json === null) {
      console.log("UNHANDLED STDOUT MESSAGE: `" + message + "`")
    }

    if (raw_json !== null) {
      raw_json += message
      if (raw_json.endsWith("}")) {
        try {
          broadcast(JSON.parse(raw_json))
          if (emulator) emulator.broadcast(raw_json)
        } catch(e) {
          console.log("broadcast error", e, raw_json)
        }
        raw_json = null
      }
    }

    if (raw_pixels !== null) {
      raw_pixels += message
      if (raw_pixels.endsWith(";")) {
        try {
          if (emulator) emulator.broadcast(pako.deflate(raw_pixels.slice(0, -1)))
        } catch(e) {
          console.log("emulator broadcast error", e, raw_pixels)
        }
        raw_pixels = null
      }
    }
  }
});
python_process.stderr.on('data', data => {
  message = data.toString().trim()
  if(message){
    // stderr is used for regular log messages from python
    console.log(message)
  }
});

python_process.on('uncaughtException', function(err, origin) {
  console.log('Caught python exception: ', err, origin);
});


// ---periodic status logging---
function statusLogging() {
  if (orbToRelaySocket && Object.keys(connections).length === 0) {
    return
  }

  console.log("STATUS",{
    id: config.ORB_ID,
    orbToRelaySocket: orbToRelaySocket ? "connected" : null,
    connections,
    connectionQueue,
    game: !gameState ? null : {
      name: gameState.game,
      state: gameState.gameState,
    },
    //gameState,
    //broadcastCounter,
    //lastMessageTimestamp,
    //lastMessageTimestampCount,
  })
}
// statusLogging()
// setInterval(statusLogging, 10 * 60 * 1000)


function handleParentKill(signal){
  console.log("GOT KILL SIGNAL")
  if(python_process){
    python_process.kill()
  }
  process.exit()
}

process.addListener('SIGINT', handleParentKill)
process.addListener('SIGTERM', handleParentKill)
process.addListener('SIGHUP', handleParentKill)

function cleanupTempOrb() {
  if (Object.keys(emulator.orbEmulatorConnections).length > 0) return

  emulator.destroy()
  process.removeListener('SIGINT', handleParentKill)
  process.removeListener('SIGTERM', handleParentKill)
  process.removeListener('SIGHUP', handleParentKill)
  python_process.kill()

  orbToRelaySocket.close()
  for (let interval of intervals) {
    clearInterval(interval)
  }
  tempOrbIDs.remove(config.ORB_ID)
}
if (config.TEMP_ORB) {
  setInterval(cleanupTempOrb, 60 * 1000)
}

let priorityToCurrentText = {}
_displayText = function(text, priority) {
  priority = priority || 0
  if (text == priorityToCurrentText[priority]) return
  priorityToCurrentText[priority] = text
  let message = { type: "text", text, priority }
  python_process.stdin.write(JSON.stringify(message) + "\n", "utf8")
}
}

// Done to pierce through the closure. Should only be used if there is only one orb.
function displayText(...args) {
  _displayText(...args)
}

module.exports = {
  displayText, startOrb,
}
