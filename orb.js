#!/usr/bin/env node
let { checkConnection, delay, execute, config, processAdminCommand, PYTHON_EXECUTABLE, restartOrbitron} = require('./lib')
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
let orbEmulatorBroadcast = () => {}
if(config.HAS_EMULATION){
  orbEmulatorBroadcast = require('./emulator.js').orbEmulatorBroadcast
}

function handleKill(signal){
  console.log("GOT KILL SIGNAL")
  if(python_process){
    python_process.kill()
  }
  process.exit()
}
process.on('SIGINT', handleKill)
process.on('SIGTERM', handleKill)
process.on('SIGHUP', handleKill)

const NO_TIMEOUT = process.argv.includes('-t')
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
  let savedPrefFileNames = await fs.promises.readdir("savedprefs")
  let savedPrefs = {}
  for (let fileName of savedPrefFileNames) {
    savedPrefs[fileName] = (await fs.promises.readFile("savedprefs/" + fileName)).toString()
  }
  let timingprefs = (await fs.promises.readFile("timingprefs.json")).toString()
  let backup = {
    nameOverride,
    savedPrefs,
    timingprefs,
    config: (await fs.promises.readFile("config.js")).toString(),
  }
  if (timingprefs.match(/"useTimer"\:\s*false,/)) {
    backup.prefs = (await fs.promises.readFile("prefs.json")).toString()
  }
  orbToRelaySocket.send(JSON.stringify({ backup }))
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
          console.error("Error sending logs", error)
        }
        return
      }
      data = JSON.parse(data)

      // Admin command
      if (data.type == "admin") {
        let messageID = data.hash
        command = await processAdminCommand(data)
        if (!command) return

        let returnData = "OK"
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
          returnData = (await fs.promises.readFile("prefs.json")).toString()
        }
        if (command.type == "gettimingprefs") {
          returnData = (await fs.promises.readFile("timingprefs.json")).toString()
        }
        if (command.type == "geterror") {
          if (config.DEV_MODE) {
            returnData = "no pm2 running"
          } else {
            returnData = (await fs.promises.readFile("/root/.pm2/logs/startscript-error.log")).toString()
          }
        }
        if (command.type == "getlog") {
          if (config.DEV_MODE) {
            returnData = "no pm2 running"
          } else {
            returnData = (await fs.promises.readFile("/root/.pm2/logs/startscript-out.log")).toString()
          }
        }
        if (command.type == "ip") {
          let interfaces = require('os').networkInterfaces();
          for (var devName in interfaces) {
            var iface = interfaces[devName];

            for (var i = 0; i < iface.length; i++) {
              var alias = iface[i];
              if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal)
                returnData = alias.address;
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
            restartOrbitron()
          } catch(_) {
            console.log("Couldn't parse pref to save: ", command.data)
          }
        }
        if (command.type == "settimingprefs") {
          try {
            JSON.parse(command.data)
            await fs.promises.writeFile("timingprefs.json", command.data)
            restartOrbitron()
          } catch(_) {
            console.log("Couldn't parse timingpref to save: ", command.data)
          }
        }

        if (command.type == "manualBackup") {
          await saveBackup(command.nameOverride)
        }
        if (command.type == "restoreFromBackup") {
          let promises = []
          let backup = command.backup
          promises.push(fs.promises.writeFile("config.js", backup.config))
          promises.push(fs.promises.writeFile("timingprefs.json", backup.timingprefs))
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
      console.error("Orb to relay socket error", e)
      orbToRelaySocket.close()
    })
  } catch(e) {
    displayText("CONNECTION ERROR")
    console.error("Error connecting to relay:", e)
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
    if(Date.now() - orbToRelaySocket.lastPingReceived > 60 * 1000){
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
    clientConnection.on("close", ()=>{
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
      console.error("Error processing message", e)
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
      console.error("Error sending to client", e, this.id)
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

let tethereeSocket = null
let tetherClientID = uuid()
let shouldUpdateTetheree = true
function tether(broadcastMessage) {
  if (!config.TETHER_ORB_ID) return

  if (!tethereeSocket || tethereeSocket.readyState === WebSocket.CLOSED) {
    try {
      createTether()
    } catch(e) {
      console.log(e)
    }
  } else if(shouldUpdateTetheree && tethereeSocket.readyState === WebSocket.OPEN) {
    try {
      shouldUpdateTetheree = false
      tethereeSocket.send(JSON.stringify({
        type: "prefs",
        update: broadcastMessage.prefs,
        timestamp: broadcastMessage.timestamp,
      }))
    } catch (error) {
      console.error(error)
      destroyTether()
      createTether()
    }
  }
}
function createTether() {
  if (!config.TETHER_ORB_ID) return

  let protocolAndHost = "wss://my.lumatron.art"
  tethereeSocket = new WebSocket(`${protocolAndHost}:7777/${config.TETHER_ORB_ID}/${tetherClientID}`)
  tethereeSocket.onclose = _ => {
    setTimeout(destroyTether)
  }
  tethereeSocket.onerror = event => {
    console.error("ERROR",event)
    setTimeout(destroyTether)
  }
}
function destroyTether() {
  if(tethereeSocket) {
    try {
      tethereeSocket.close()
    } catch(e) {
      console.log("Error closing relay socket",e)
    }
    tethereeSocket = null
  }
}
createTether()

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
broadcastCounter = 0
const counterThreshold = 35

lastMessageTimestamp = 0
lastMessageTimestampCount = 0
function preciseTime(){
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
  let noChange = JSON.stringify(baseMessage) == JSON.stringify(gameState)
  gameState = baseMessage
  if(noChange && broadcastCounter % counterThreshold != 0){
    return
  }
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

let priorityToCurrentText = {}
function displayText(text, priority) {
  priority = priority || 0
  if (text == priorityToCurrentText[priority]) return
  priorityToCurrentText[priority] = text
  let message = { type: "text", text, priority }
  python_process.stdin.write(JSON.stringify(message) + "\n", "utf8")
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
          orbEmulatorBroadcast(raw_json)
        } catch(e) {
          console.error("broadcast error", e, raw_json)
        }
        raw_json = null
      }
    }

    if (raw_pixels !== null) {
      raw_pixels += message
      if (raw_pixels.endsWith(";")) {
        try {
          orbEmulatorBroadcast(pako.deflate(raw_pixels.slice(0, -1)))
        } catch(e) {
          console.error("orbEmulatorBroadcast error", e, raw_pixels)
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
  console.error('Caught python exception: ', err, origin);
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
statusLogging()
setInterval(statusLogging, 10 * 60 * 1000)

fixExternalWifi()

module.exports = {
  displayText,
}
