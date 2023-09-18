#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
//const https = require('https')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn, execSync } = require('child_process')
const pako = require('./thirdparty/pako.min.js')
//const { v4: uuidv4 } = require('uuid')
const homedir = require('os').homedir();

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

process.on('uncaughtException', function(err) {
  console.error('Uncaught exception: ' + err)
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
  console.log('Dev connection accepted.')
  let id = Math.floor(Math.random() * 1000000000) // change this to uuid?
  devConnections[id] = socket
  socket.id = id
  socket.on('close', () => {
    console.log("Dev connection closed.")
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
    console.log('Websocket Server received request for ' + request.url)
    response.writeHead(404)
    response.end()
  })
  server.listen(7777, "0.0.0.0", function() {
    console.log('WebSocket Server is listening on port 7777')
  })

  let wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

  wsServer.on('connection', (socket, request) => {
    let url = request.url.trim()
    console.log('WS connection request made to', request.url)
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
  console.log("Binding orb",orbID)
  if(connectedOrbs[orbID]){
    console.log("Already an existing orb socket, closing it")
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
          console.log("SENDING CACHED", message)
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
    console.log("Closing orb socket", orbID)
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.error("Error in orb socket", orbID, e)
    socket.close()
  })
}

function bindClient(socket, orbID, clientID) {
  console.log("Binding client",orbID,clientID)
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
        console.log("CACHING MESSAGE",data)
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
    console.log("Closing client socket", orbID)
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
        message: "",
        closed: false,
      }  
      orb.send(JSON.stringify(initial_message))
    }
  } catch(e) {
    console.log("Error sending initial client message", e)
    socket.close()
  }
}

function pingHandler() {
  if(orbToServerSocket){
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
  try {
    let serverURL = `ws://${config.CONNECT_TO_RELAY}:7777/relay/${config.ORB_ID}`
    console.log("Initializing orb to server socket", serverURL)
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
      console.log("Relay requester socket closed")
      orbToServerSocket = null
    })
    orbToServerSocket.on('error', (e) => {
      console.log("Relay requester socket error", e)
      orbToServerSocket.close()
    })
  } catch(e) {
    console.error("Error connecting to relay:", e)
    orbToServerSocket = null
  }
}

setInterval(relayUpkeep, 500)

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

python_process.stdout.on('data', data => {
  messages = data.toString().trim().split("\n")
  for(let message of messages){
    message = message.trim()
    if(!message) continue
    if (message.charAt(0) == "{") { // check is first char is '{'
      try {
        broadcast(JSON.parse(message));
        devBroadcast(message);
      } catch(e) {
        console.error(e);
        console.error(message);
      }
    } else if(message.startsWith("touchall")) {
      for (let id in connections) {
        connections[id].lastActivityTime = Date.now()
      }
    } else if(message.startsWith("raw_pixels=")) {
      try {
        //console.log(pako.inflate(pako.deflate(message.substr(11).trim()),{to:"string"}))
        devBroadcast(pako.deflate(message.substr(11).trim()));
      } catch(e) {
        console.error(e);
        console.error(message);
      }
    } else{
      console.log("UNHANDLED STDOUT MESSAGE: `" + message + "`")
    }
  }
});
python_process.stderr.on('data', data => {
  message = data.toString().trim()
  if(message){
    console.log(message)
  }
});

python_process.on('uncaughtException', function(err) {
  console.error('Caught python exception: ' + err);
});


// Simple HTTP server
const rootServer = http.createServer(function (request, response) {
  let filePath = request.url

  let fileRelativeToScript = true
  if (filePath == '/')
    filePath = "/controller/controller.html"
  else if (filePath == '/dev' || filePath == '/view')
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

// periodic status logging
function statusLogging() {
  let _connectedOrbs = null
  let _connectedClients = null
  if(IS_SERVER){
    _connectedOrbs = {}
    for(const orb in connectedOrbs) {
      _connectedOrbs[orb] = connectedOrbs[orb].classification
    }
    _connectedClients = connectedClients
  }
  console.log("STATUS",{
    devConnections,
    connectedOrbs: _connectedOrbs,
    connectedClients: _connectedClients,
    orbToServerSocket: !orbToServerSocket ? null : "connected",
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
setInterval(statusLogging,5 * 60 * 1000)

//Update checking code
const http2 = require('http2');

function checkConnection() {
  return new Promise((resolve) => {
    const client = http2.connect('https://www.google.com');
    client.setTimeout(5000)
    client.on('connect', () => {
      resolve(true);
      client.destroy();
    });
    client.on('error', () => {
      resolve(false);
      client.destroy();
    });
    client.on('timeout', () => {
      resolve(false);
      client.destroy();
    });
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
    console.log("hours until 2am", timeUntilHour(2) / 3600000)
    setTimeout(() => {
      checkForUpdates()
    }, nextUpdateTime);
    if(!connected) return
    console.log("Pulling git updates...")
    execSync("git config pull.ff only")
    let output = execSync("sudo git pull")
    if(output.toString().toLowerCase().indexOf("already up to date") < 0){
      console.log("Has updates, restarting!")
      execSync("sudo pm2 restart all")
    }
  })
}

checkForUpdates()
