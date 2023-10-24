#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
//const https = require('https')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn } = require('child_process')
const pako = require('./thirdparty/pako.min.js')
//const { v4: uuidv4 } = require('uuid')
const homedir = require('os').homedir()
const qs = require('querystring')

//add timestamps to logs
const clog = console.log
const cerr = console.error
console.log = function(){
  clog(new Date().toISOString(), ...arguments)
}
console.error = function(){
  cerr(new Date().toISOString(), ...arguments)
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

process.on('uncaughtException', function(err, origin) {
  console.error('Uncaught exception: ', err, origin)
});

//load and process config and environment variables
let config = require(__dirname + "/config.js")
console.log(config)
const NO_TIMEOUT = process.argv.includes('-t')
let starting_game = null
let game_index = process.argv.indexOf('-g') + 1
if (game_index) {
  starting_game = process.argv[game_index]
  console.log("Starting with game: " + starting_game)
}
const IS_SERVER = !config.CONNECT_TO_RELAY

// mod exec sync to add sudo if running on an orb
let { execSync } = require('child_process')
let _execSync = execSync
execSync = (command) =>{
  return _execSync((IS_SERVER ? "" : "sudo ") + command)
}

//Update checking code
function tryExecSync(command){
  try {
    return execSync(command)
  } catch(err){
    console.error("tryExecSync Error", err)
    return ""
  }
}

function checkConnection() {
  return new Promise((resolve) => {
    try{
      let output = execSync('curl -Is -H "Cache-Control: no-cache, no-store;Pragma: no-cache"  "http://www.google.com/?$(date +%s)" | head -n 1')
      if(output.indexOf("200 OK") >= 0){
        resolve(true)
      } else {
        resolve(false)
      }
    } catch(e) {
      console.error("Error checking connection", e)
      resolve(false)
    }
  });
};

function timeUntilHour(hour) {
  if (hour < 0 || hour > 24) throw new Error("Invalid hour format!");

  const now = new Date();
  const target = new Date(now);

  if (now.getHours() >= hour)
      target.setDate(now.getDate() + 1);

  target.setHours(hour);
  target.setMinutes(0);
  target.setSeconds(0);
  target.setMilliseconds(0);

  return target.getTime() - 
  now.getTime();
}

function checkForUpdates(){
  checkConnection().then((connected)=>{
    let nextUpdateTime = connected ? timeUntilHour(2) : 1e4
    //console.log("hours until 2am", timeUntilHour(2) / 3600000)
    setTimeout(() => {
      checkForUpdates()
    }, nextUpdateTime);
    if(!connected) return
    pullAndRestart()
  }).catch((error)=>{
    console.error("checkForUpdates Error", error)
    setTimeout(() => {
      checkForUpdates()
    }, 6e4);
  })
}

function pullAndRestart() {
  tryExecSync("git config pull.ff only")
  let output = execSync("git pull").toString().toLowerCase()
  if(output.indexOf("already up to date") >= 0){
    console.log("Already has latest code from git")
  } else if(output.indexOf("fatal") >= 0){
    console.log("Git pull failed: " + output)
  } else if(output.indexOf("fast-forward") >= 0 || output.indexOf("files changed") >= 0){
    console.log("Has git updates, restarting!")
    execSync("pm2 restart all")
  }
}

if (!config.DEV_MODE && !config.CONTINUOUS_INTEGRATION) {
  checkForUpdates()
}

// ---Dev Kit Websocket server---

let devServer = http.createServer(function(request, response) {
  console.log('Dev Server Received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
devServer.listen(8888, "0.0.0.0", function() {
  console.log('Dev WebSocket Server is listening on port 8888')
})

let wsDevServer = new WebSocket.Server({ 
  server: devServer, 
  autoAcceptConnections: true 
})

wsDevServer.on('connection', socket => {
  socket.binaryType = "arraybuffer"
  let id = Math.floor(Math.random() * 1000000000) // change this to uuid?
  devConnections[id] = socket
  socket.id = id
  socket.on('close', () => {
    delete devConnections[id]
  })
})

let devConnections = {}

function devBroadcast(message) {
  for (let id in devConnections) {
    devConnections[id].send(message)
  }
}

// ---Server code---
const connectedOrbs = {}
const logsRequested = {}
const connectedClients = {}
if(IS_SERVER){
  let server = http.createServer(function(request, response) {
    //console.log('Websocket Server received request for ' + request.url)
    response.writeHead(404)
    response.end()
  })
  server.listen(7777, "0.0.0.0", function() {
    console.log('WebSocket Server is listening on port 7777')
  })

  let wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

  wsServer.on('connection', (socket, request) => {
    let url = request.url.trim()
    //console.log('WS connection request made to', request.url)
    let meta = url.split("/")
    if(meta[1] == "relay") { // socket from orb to server
      let orbID = meta[2]
      socket.classification = "WS orb to server"
      bindOrb(socket, orbID)
    } else { // client socket connecting to server
      let orbID = meta[1]
      let clientID = meta[2]
      socket.clientID = clientID
      socket.classification = "WS client to server"
      bindClient(socket, orbID, clientID)
    }
  })
}
function bindOrb(socket, orbID) {
  //console.log("Binding orb",orbID)
  if(connectedOrbs[orbID]){
    try {
      connectedOrbs[orbID].close()
    } catch(e) {
      console.error("Error closing existing orb socket",orbID, e)
    }
  }
  connectedOrbs[orbID] = socket
  socket.on('message', (data, isBinary) => {
    if (data == "PING") return
    if(logsRequested[orbID] && isBinary){
      try {
        fs.writeFileSync(`${homedir}/${orbID}_logs.zip`, data)
        console.log("Wrote logs for " + orbID)
      } catch(error) {
        console.error("Error writing log file", error)
      }
      logsRequested[orbID] = false
      return
    }
    if(!isBinary){
      data = data.toString().trim()
    }
    try {
      data = JSON.parse(data);
      let clientID = data.clientID;
      let client = connectedClients[orbID] && connectedClients[orbID][clientID]
      if(client){
        while(client.messageCache.length > 0) {
          let message = client.messageCache.shift()
          try {
            socket.send(message)
          } catch(e) {
            console.error("Error sending cached message to orb", orbID, clientID, e)
          }
        }
        client.send(data.message)
      }
    } catch(e) {
      console.error("Orb to Client error:", orbID, clientID, e)
    }

  })
  socket.on('close', () => {
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.error("Error in orb socket", orbID, e)
    socket.close()
  })
}

function bindClient(socket, orbID, clientID) {
  //console.log("Binding client",orbID,clientID)
  if(!connectedClients[orbID]){
    connectedClients[orbID] = {}
  }
  if(connectedClients[orbID][clientID]){
    try {
      connectedClients[orbID][clientID].close()
    } catch(e) {
      console.error("Error closing existing client", orbID, clientID, e)
    }
  }
  connectedClients[orbID][clientID] = socket
  socket.clientID = clientID
  socket.messageCache = []
  socket.on('message', (data, isBinary) => {
    if(!isBinary){
      data = data.toString().trim()
    }
    try {
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
      console.error("Client to orb error:", orbID, clientID, e)
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
  })
  socket.on('error', (e) => {
    console.error("Error on client socket", orbID, clientID, e)
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
    console.error("Error sending initial client message", e)
    socket.close()
  }
}

function pingHandler() {
  if(orbToServerSocket && orbToServerSocket.readyState === WebSocket.OPEN){
    orbToServerSocket.send("PING")
    if(Date.now() - orbToServerSocket.lastPingReceived > 60 * 1000){
      orbToServerSocket.close()
    }
  }
  for (const orbID in connectedOrbs) {
    connectedOrbs[orbID].send("PING")
  }
}

setInterval(pingHandler, 3000)

// ---Orb code---

let orbToServerSocket = null
function relayUpkeep() {
  if(IS_SERVER || orbToServerSocket) return
  checkConnection().then((connected)=>{
    if(connected){
      connectOrbToServer()
    }
  }).catch((e) => {
    console.error("Error upkeeping orb to server socket", e)
  })
}
function connectOrbToServer(){
  try {
    let serverURL = `ws://${config.CONNECT_TO_RELAY}:7777/relay/${config.ORB_ID}`
    //console.log("Initializing orb to server socket", serverURL)
    orbToServerSocket = new WebSocket.WebSocket(serverURL)
    orbToServerSocket.lastPingReceived = Date.now()
    orbToServerSocket.on('message', (data, isBinary) => {
      if(!isBinary){
        data = data.toString().trim()
      }      
      if(data == "PING"){
        orbToServerSocket.lastPingReceived = Date.now()
        return
      }
      if(data == "GIT_HAS_UPDATE"){
        if (config.CONTINUOUS_INTEGRATION){
          pullAndRestart()
        }
        return
      }
      if(data == "GET_LOGS"){
        try {
          execSync(`${__dirname}/utility_scripts/zip_logs.sh`)
          let logfile = fs.readFileSync(`${homedir}/logs.zip`)
          orbToServerSocket.send(logfile)
        } catch(error) {
          console.error("Error sending logs", error)
        }
        return
      }
      // Actual Client message
      data = JSON.parse(data)
      let clientID = data.clientID
      let clientConnection = getClientConnection(clientID)
      if(!clientConnection && !data.closed){
        clientConnection = createClientConnection(clientID, orbToServerSocket)
      }
      if(clientConnection) {
        if(data.closed){
          clientConnection.close()
        } else {
          clientConnection.processMessage(data.message)
        }
      }
    })
    orbToServerSocket.on('close', () => {
      orbToServerSocket = null
    })
    orbToServerSocket.on('error', (e) => {
      console.error("Orb to server socket error", e)
      orbToServerSocket.close()
    })
  } catch(e) {
    console.error("Error connecting to server:", e)
    orbToServerSocket = null
  }
}

setInterval(relayUpkeep, 5e3)

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
    message = {
      clientID: this.id,
      message: message
    }
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


// Game Related Code
function bindPlayer(socket) {
  if(connectionQueue.includes(socket) || Object.values(connections).includes(socket)){
    return
  }
  connectionQueue.push(socket)
  bindDataEvents(socket)
  upkeep() // Will claim player if available
  if (starting_game) {
    let message = {type: 'start', game: starting_game}
    python_process.stdin.write(JSON.stringify(message) + "\n", "utf8")
  }
}

function bindDataEvents(peer) {
  peer.on('message', content => {
    if (!typeof(peer.pid)==="number" || !connections[peer.pid]) {
      return
    }
    content.self = peer.pid
    peer.lastActivityTime = Date.now()
    python_process.stdin.write(JSON.stringify(content) + "\n", "utf8")
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
  broadcastCounter++
  baseMessage.notimeout = NO_TIMEOUT
  let noChange = JSON.stringify(baseMessage) == JSON.stringify(gameState)
  gameState = baseMessage
  if(noChange && broadcastCounter % counterThreshold != 0){
    return
  }
  broadcastCounter = 0
  baseMessage.timestamp = preciseTime()
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

const python_process = spawn('python3', ['-u', `${__dirname}/main.py`],{env:{...process.env,...config}})
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
    } else if (raw_pixels === null) {
      console.log("UNHANDLED STDOUT MESSAGE: `" + message + "`")
    }

    if (raw_json !== null) {
      raw_json += message
      if (raw_json.endsWith("}")) {
        try {
          broadcast(JSON.parse(message));
          devBroadcast(message);
        } catch(e) {
          console.error("broadcast error", e, message);
        }
        raw_json = null
      }
    }

    if (raw_pixels !== null) {
      raw_pixels += message
      if (raw_pixels.endsWith(";")) {
        try {
          //console.log(pako.inflate(pako.deflate(message.substr(11).trim()),{to:"string"}))
          devBroadcast(pako.deflate(raw_pixels.slice(0, -1)))
        } catch(e) {
          console.error("devBroadcast error", e, raw_pixels)
        }
        raw_pixels = null
      }
    }
  }
});
python_process.stderr.on('data', data => {
  message = data.toString().trim()
  if(message){
    // we use stderr for regular log messages from python
    console.log(message)
  }
});

python_process.on('uncaughtException', function(err, origin) {
  console.error('Caught python exception: ', err, origin);
});


// Simple HTTP server
const rootServer = http.createServer(function (request, response) {

  // Github webhook to restart pm2 after a push
  if (request.method === 'POST') {
    console.log("Receiving github webhook update.")
    let body = ''
    request.on('data', function(data) {
      body += data
    })
    request.on('end', function() {
      payload = JSON.parse(body)
      console.log(payload)
      response.writeHead(200)
      response.end('post received')

      for (let orbID in connectedOrbs) {
        let socket = connectedOrbs[orbID]
        socket.send("GIT_HAS_UPDATE")
      }
      // TODO also check secret: config.WEBHOOK_SECRET
      if (payload.ref === 'refs/heads/master') {
        pullAndRestart()
      }
    })
    return
  }

  // http GET stuff
  let filePath = request.url
  let fileRelativeToScript = true
  if (filePath == '/')
    filePath = "/controller/controller.html"
  else if (filePath == `/${config.ORB_ID}/dev` || filePath == `/${config.ORB_ID}/view`)
    filePath = "/emulator/dev.html"
  else if (filePath == '/pixels.json') {
    filePath = config.PIXELS || "rhombicosidodecahedron"
    if (filePath.startsWith("/pixels/"))
      filePath = filePath.slice(8)
    if (filePath.endsWith(".json"))
      filePath = filePath.slice(0, filePath.length - 5)
    if (!filePath.includes("/"))
      filePath = filePath + "/" + filePath
    filePath = `/pixels/${filePath}.json`
  }
  else if (connectedOrbs[filePath.split("/")[1]]){
    if(filePath.includes("/logs")){
      let orbID = filePath.split("/")[1]
      if(logsRequested[orbID] || !connectedOrbs[orbID]){
        response.writeHead(500)
        response.end('Cannot fetch logs for ' + orbID + ` debug info - requested: ${logsRequested[orbID]} - connected: ${connectedOrbs[orbID] != null}`)
        return
      }
      logsRequested[orbID] = true
      connectedOrbs[orbID].send("GET_LOGS")
      let start_time = Date.now()
      new Promise((resolve, reject) => {
          let timer = setInterval(()=>{
            if(logsRequested[orbID] == false){
              resolve()
              clearInterval(timer)
            } else if(Date.now() - start_time > 30 * 1000) {
              reject()
              clearInterval(timer)
              logsRequested[orbID] = false
            }
          },100)
        }).then(()=>{
          try {
            filePath = `${homedir}/${orbID}_logs.zip`
            let data = fs.readFileSync(filePath)
            response.writeHead(200, { 'Content-Type': 'application/zip' })
            response.end(data, 'utf-8')
          } catch(error) {
            console.error("Error sending log files for " + orbID, error)
            if(error.code == 'ENOENT'){
              response.writeHead(404)
              response.end(`Unable to find log files on server for ${orbID}`, 'utf-8')
            }
            else {
              response.writeHead(500)
              response.end(`Error sending log files: ${error.code}`)
            }
          }
        }).catch(()=>{
          response.writeHead(500)
          response.end('Timed out fetching logs for ' + orbID)
        })
      return
    } else {
      filePath = "/controller/controller.html"
    }
  } else if(filePath == "/logs") {
    try {
      execSync(`${__dirname}/utility_scripts/zip_logs.sh`)
      filePath = `${homedir}/logs.zip`
      fileRelativeToScript = false
    } catch(error) {
      response.writeHead(500)
      response.end('Sorry, check with the site admin for error: '+error+' ..\n')
    }
  }

  if(fileRelativeToScript) {
    filePath = `${__dirname}${filePath}`
  }
  //console.log(filePath);

  let extname = path.extname(filePath)
  let contentType = 'text/html'
  switch (extname) {
    case '.js':
      contentType = 'text/javascript'
      break;
    case '.css':
      contentType = 'text/css'
      break;
    case '.json':
      contentType = 'application/json'
      break;
    case '.png':
      contentType = 'image/png'
      break;      
    case '.jpg':
      contentType = 'image/jpg'
      break;    
    case '.ico':
      contentType = 'image/x-icon'
      break;
    case '.wav':
      contentType = 'audio/wav'
      break;
    case '.zip':
      contentType = 'application/zip'
  }

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        response.writeHead(404)
        response.end(`Nothing found at ${request.url}. Either the Orb is not connected or the URL is incorrect. Check the URL or refresh the page to try again.`, 'utf-8')
      }
      else {
        response.writeHead(500)
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content, 'utf-8')
    }
  });

})

const rootServerPort = config.HTTP_SERVER_PORT || 1337
rootServer.listen(rootServerPort, "0.0.0.0")

// ---Wifi Setup Code---
let FORM = `
<!DOCTYPE html>
<html>

   <head>
      <title>Add Wifi Network</title>
   </head>

   <body>
      <form action="/" method="post">
         SSID: <input type = "text" name = "ssid" />
         <br>
         <br>
         Password: <input type = "password" name = "password" />
         <br>
         <br>
         Priority: <input type = "radio" name = "priority" value = "low" checked> Low
         <input type = "radio" name = "priority" value = "high"> High
         <br>
         <br>
         <input type = "submit" name = "submit" value = "Submit" />
      </form>
   </body>

</html>
`
let SUBMITTED = `
<!DOCTYPE html>
<html>
   <meta http-equiv="Refresh" content="3">
   <head>
      <title>Submission Completed</title>
   </head>

   <body>
        SSID and Password submitted, WiFi will now restart to apply changes and the page will refresh.
   </body>

</html>
`

function startAccessPoint(){
  tryExecSync("mv /etc/dhcpcd.conf.accesspoint /etc/dhcpcd.conf")
  tryExecSync("systemctl enable hostapd")
  tryExecSync("systemctl restart networking.service")
  tryExecSync("systemctl restart dhcpcd")
  tryExecSync("systemctl restart hostapd")
  console.log("STARTED ACCESS POINT")
}

function stopAccessPoint(){
  tryExecSync("systemctl stop hostapd")
  tryExecSync("systemctl disable hostapd")
  tryExecSync("mv /etc/dhcpcd.conf /etc/dhcpcd.conf.accesspoint")
  tryExecSync("systemctl restart networking.service")
  tryExecSync("systemctl restart dhcpcd")
  tryExecSync("wpa_cli reconfigure")
  console.log("STOPPED ACCESS POINT")
}

function submitSSID(formData) {
  let ssid = formData.ssid.replace(/'/g, "\\'")
  console.log("Adding SSID: ", ssid)
  if(ssid == ""){
    stopAccessPoint()
    return
  }
  let password = formData.password.replace(/'/g, "\\'")
  let priority = formData.priority == 'low' ? 1 : 2
  let append = ""
  if(password.trim() == ""){
    append = `
network={
    ssid="${ssid}"
    key_mgmt=NONE
    scan_ssid=1
    id_str="${ssid}"
    priority=${priority}
}
`
  } else {
    append = `
network={
    ssid="${ssid}"
    psk="${password}"
    key_mgmt=WPA-PSK
    scan_ssid=1
    id_str="${ssid}"
    priority=${priority}
}
`
  }
  let toExec=`echo '${append}' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf`
  tryExecSync(toExec)
  stopAccessPoint()
}

let isFirstNetworkCheck = true
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0
function networkCheck(){
  checkConnection().then((connected)=>{
    if(!connected){
      numTimesNetworkCheckFailed += 1
      stopAccessPoint()
      setTimeout(() => {
        isFirstNetworkCheck = false
        checkConnection().then((connected2)=>{
          if(!connected2){
            numTimesAccessPointStarted += 1
            startAccessPoint()
            setTimeout(networkCheck, 10 * 6e4);
          } else {
            numTimesNetworkRestartWorked += 1
            setTimeout(networkCheck, 2 * 6e4);
          }
        }).catch((error)=>{
          console.error("second network check error", error)
          setTimeout(networkCheck, 6e4);
        })
      }, isFirstNetworkCheck ? 3e4 : 3 * 6e4);
    } else {
      isFirstNetworkCheck = false
      setTimeout(networkCheck, 2 * 6e4);
    }
  }).catch((error)=>{
    console.error("network check error", error)
    setTimeout(networkCheck, 6e4);
  })
}

if(!IS_SERVER){
  let wifiSetupServer = http.createServer(function (req, res) {
    if (req.method === 'GET') { 
      res.writeHead(200, { 'Content-Type': 'text/html' }) 
      res.write(FORM)
      res.end()
    } else if (req.method === 'POST') {
      let body = ""
      req.on('data', function(data) {
        body += data
      })
      req.on('end', function() {
        let formData = qs.parse(body)
        console.log(formData)
        res.writeHead(200, {'Content-Type': 'text/html'})
        res.write(SUBMITTED)
        res.end()
        submitSSID(formData)
      })
    }
  })

  wifiSetupServer.listen(9090,function(){
    console.log("wifi setup Listening on port 9090")
  })
  setTimeout(() => {
    networkCheck()
  }, 6e4);
}

// periodic status logging
function statusLogging() {
  let _connectedOrbs = {}
  for(const orb in connectedOrbs) {
    _connectedOrbs[orb] = connectedOrbs[orb].classification
  }
  console.log("STATUS",{
    id: config.ORB_ID,
    isServer: IS_SERVER,
    devConnections,
    connectedOrbs: _connectedOrbs,
    connectedClients,
    orbToServerSocket: !orbToServerSocket ? null : "connected",
    connections,
    connectionQueue,
    game: !gameState ? null : {
      name: gameState.game,
      state: gameState.gameState,
    },
    numTimesNetworkCheckFailed,
    numTimesNetworkRestartWorked,
    numTimesAccessPointStarted,
    //gameState,
    //broadcastCounter,
    //lastMessageTimestamp,
    //lastMessageTimestampCount,
  })
}
statusLogging()
setInterval(statusLogging,60 * 60 * 1000)
