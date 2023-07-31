#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
//const https = require('https')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn, exec, execSync } = require('child_process')
const pako = require('./thirdparty/pako.min.js')
//const { v4: uuidv4 } = require('uuid')
const homedir = require('os').homedir();

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

config = require(__dirname + "/config.js")
console.log(config)
const NO_TIMEOUT = process.argv.includes('-t')
let starting_game = null
game_index = process.argv.indexOf('-g') + 1
if (game_index) {
  starting_game = process.argv[game_index]
  console.log("Starting with game: " + starting_game)
}

// Dev Kit Websocket server

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

devConnections = {}

function devBroadcast(message) {
  for (let id in devConnections) {
    devConnections[id].send(message)
  }
}

// Class that handles mutliple redundant connections between client and orb
class ClientConnection {
  constructor(id) {
    this.id = id
    this.sockets = []
    this.callbacks = {}
    this.latestMessage = 0
    // used by business logic
    this.pid = null
    this.lastActivityTime = null
    this.timeout = 10 * 1000
    this.numSockets = 0
  }

  getID() {
    return this.id
  }

  removeSocket(socket) {
    let startLength = this.sockets.length
    let index = this.sockets.indexOf(socket)
    if(index >= 0) {
      let removed = this.sockets.splice(index)[0]
      if(removed){
        this[removed.classification] = false
      }
    }
    if(this.sockets.length <= 0 && startLength > 0){
      if(this.callbacks.close){
        this.callbacks.close()
      }
    }
    this.numSockets = this.sockets.length
  }

  bindWebSocket(socket) {
    // for stats logging
    this[socket.classification] = true
    let counter = socket.classification + " Count"
    let skipped = socket.classification + " Skipped"
    if(!this[counter]) {
      this[counter] = 0
    }
    if(!this[skipped]) {
      this[skipped] = 0
    }

    let self = this
    this.sockets.push(socket)
    this.numSockets = this.sockets.length
    socket.on("message", (data, isBinary) => {
      try {
        let content = JSON.parse(data)
        if(content.timestamp > self.latestMessage){
          self.latestMessage = content.timestamp
          if(self.callbacks.message){
            self.callbacks.message(content)
          }
          //for logging of which sockets get used
          self[counter] += 1
        } else {
          self[skipped] += 1
        }
      } catch(e) {
        console.error("Error processing web socket message", e, socket.clientID, socket.classification)
      }
    })
    socket.on("close", () => {
      self.removeSocket(socket)
    })
    socket.on("error", () => {
      socket.close()
      self.removeSocket(socket)
    })
  }

  // functions used by business logic
  on(e, callback) {
    this.callbacks[e] = callback
  }

  send(message) {
    for(const socket of this.sockets){
      try {
        socket.send(message)
      } catch(e) {
        console.error("Error sending to client", e, socket.clientID, socket.classification)
        setTimeout(() => {
          try {
            socket.close()
          } catch(e) {
            console.error("Error closing socket after failed message send", e, socket.clientID, socket.classification)
          }
        })
      }
    }
  }

  close() {
    for(const socket of this.sockets){
      setTimeout(() =>{
        try {
          socket.close()
        } catch(e) {
          console.error("Error closing socket from complete close call", e, socket.clientID, socket.classification)
        }
      })
    }
  }
}

const clientConnections = {}

// Orb relay management
const connectedOrbs = {}
const logsRequested = {}
const connectedRelays = {}
const connectedClients = {}

let server = http.createServer(function(request, response) {
  console.log('Websocket Server received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})

wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

wsServer.on('connection', (socket, request) => {
  let url = request.url.trim()
  console.log('WS connection request made to', request.url)
  let meta = url.split("/")
  let orbID = meta[1]
  let clientID = meta[2]
  if(orbID == "") { // direct client socket
    socket.classification = "WS direct client to orb"
    socket.clientID = clientID
    let clientConnection = getClientConnection(clientID)
    clientConnection.bindWebSocket(socket)
    bindRemotePlayer(clientConnection)
  } else if(orbID == "relay") { // relay socket from orb
    orbID = meta[2]
    if(meta.length > 3){ // actual relay socket for a client
      clientID = meta[3]
      socket.classification = "WS orb to relay"
      bindRelay(socket, orbID, clientID)
    } else { // socket to request relay sockets over
      socket.classification = "WS orb relay requester"
      bindRelayRequester(socket, orbID)
    }
  } else { // client socket connecting to relay
    socket.clientID = clientID
    socket.classification = "WS client to relay"
    bindClient(socket, orbID, clientID)
  }
})

function getClientConnection(clientID) {
  if(!clientConnections[clientID]){
    clientConnections[clientID] = new ClientConnection(clientID)
  }
  return clientConnections[clientID]
}

function bindRelayRequester(socket, orbID) {
  console.log("Binding relay requester",orbID)
  if(connectedOrbs[orbID]){
    console.log("Already an existing relay requester socket, closing it")
    try {
      connectedOrbs[orbID].close()
    } catch(e) {
      console.error("Error closing existing orb relay request socket",orbID, e)
    }
  }
  connectedOrbs[orbID] = socket
  socket.pingInterval = setInterval(() => {
    socket.send("PING")
  }, 3000)
  socket.on('message', data => {
    console.log("Got Message from relay requester: ", orbID, data)
    if(data instanceof Buffer){
      try {
        fs.writeFileSync(`${homedir}/${orbID}_logs.zip`, data)
        console.log("Wrote logs for " + orbID)
      } catch(error) {
        console.error("Error writing log file", error)
      }
    }
    logsRequested[orbID] = false
  })
  socket.on('close', () => {
    console.log("Closing relay requester socket", orbID)
    clearInterval(socket.pingInterval)
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.error("Error in relay requester socket", orbID, e)
    socket.close()
  })
}

function bindRelay(socket, orbID, clientID) {
  console.log("Binding relay", orbID, clientID)
  if(!connectedRelays[orbID]) {
    connectedRelays[orbID] = {}
  }
  if(connectedRelays[orbID][clientID]){
    console.log("Trying to close existing relay")
    try {
      connectedRelays[orbID][clientID].close()
    } catch(e) {
      console.error("Error closing existing relay", orbID, clientID, e)
    }
  }
  connectedRelays[orbID][clientID] = socket
  socket.clientID = clientID
  socket.on('message', (data, isBinary) => {
    if(!isBinary){
      data = data.toString()
    }
    try {
      let client = connectedClients[orbID] && connectedClients[orbID][clientID]
      if(client){
        while(client.messageCache.length > 0) {
          let message = client.messageCache.shift()
          console.log("SENDING CACHED", message)
          try {
            socket.send(message)
          } catch(e) {
            console.error("Error sending cached message to relay", orbID, clientID, e)
          }
        }
        client.send(data)
      }
    } catch(e) {
      console.error("Relay to Client error:", orbID, clientID, e)
    }
  })
  socket.on('close', () => {
    delete connectedRelays[orbID][clientID]
    try {
      let client = connectedClients[orbID] && connectedClients[orbID][clientID]
      if(client) {
        client.close()
      }
    } catch(e) {
      console.error("Error closing client from relay:",orbID, clientID, e)
    }
  })
  socket.on('error', (e) => {
    console.error("Error in relay socket", orbID, clientID, e)
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
      data = data.toString()
    }
    try {
      let relay = connectedRelays[orbID] && connectedRelays[orbID][clientID]
      if(relay){
        relay.send(data)
      }else{
        console.log("CACHING MESSAGE",data)
        socket.messageCache.push(data)
        if(socket.messageCache.length > 16) {
          socket.messageCache.shift()
        }
        if(connectedOrbs[orbID]) {
          connectedOrbs[orbID].send(clientID)
        }
      }
    } catch(e) {
      console.error("Client to relay error:", orbID, clientID, e)
    }
  })
  socket.on('close', () => {
    delete connectedClients[orbID][clientID]
    try {
      relay = connectedRelays[orbID] && connectedRelays[orbID][clientID]
      if(relay){
        relay.close()
      }
    } catch(e) {
      console.error("Error closing relay from client:", orbID, clientID, e)
    }
  })
  socket.on('error', (e) => {
    console.error("Error on client socket", orbID, clientID, e)
    socket.close()
  })
}

function bindRemotePlayer(socket) {
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
  peer.on('error', (err) => {
   console.error("ERROR",peer.pid,err)
  })
}

// Relay Connection
let relayRequesterSocket = null
function relayUpkeep() {
  if(config.CONNECT_TO_RELAY) {
    if(!relayRequesterSocket){
      try {
        let relayURL = `ws://${config.CONNECT_TO_RELAY}:7777/relay/${config.ORB_ID}`
        console.log("Initializing relay requester socket", relayURL)
        relayRequesterSocket = new WebSocket.WebSocket(relayURL)
        relayRequesterSocket.on('message', data => {
          let clientID = data.toString().trim()
          if(clientID == "PING") return
          if(clientID == "GET_LOGS"){
            try {
              execSync(`${__dirname}/utility_scripts/zip_logs.sh`)
              let logfile = fs.readFileSync(`${homedir}/logs.zip`)
              relayRequesterSocket.send(logfile)
            } catch(error) {
              console.error("Error sending logs", error)
            }
            return
          }
          console.log("Got relay request",clientID)
          let socket = new WebSocket.WebSocket(`${relayURL}/${clientID}`)
          socket.relayBound = false
          socket.clientID = clientID
          socket.classification = "WS orb to relay"
          socket.on('open', () => {
            if(!socket.relayBound){
              socket.relayBound = true
              let clientConnection = getClientConnection(clientID)
              clientConnection.bindWebSocket(socket)
              bindRemotePlayer(clientConnection)
            }
          })
        })
        relayRequesterSocket.on('close', () => {
          console.log("Relay requester socket closed")
          relayRequesterSocket = null
        })
        relayRequesterSocket.on('error', (e) => {
          console.log("Relay requester socket error", e)
          relayRequesterSocket.close()
        })
      } catch(e) {
        console.error("Error connecting to relay:", e)
        relayRequesterSocket = null
      }
    }
  }
  if(config.ACT_AS_RELAY){
    for(orbID of Object.keys(connectedOrbs)){
      let orbSocket = connectedOrbs[orbID]
      // Request relays for dangling clients
      if(orbSocket) {
        for(clientID of Object.keys(connectedClients[orbID] || {})){
          if(!connectedRelays[orbID] || !connectedRelays[orbID][clientID]){
            try {
              console.log("Requesting relay for client", orbID, clientID)
              orbSocket.send(clientID)
            } catch(e) {
              console.error("Error requesting relay for client", orbID, clientID, e)
            }
          }
        }
      }
      // Remove excess relays, if any
      for(clientID of Object.keys(connectedRelays[orbID] || {})){
        if(!connectedClients[orbID] || !connectedClients[orbID][clientID]){
          try {
            console.log("Closing excess relay", orbID, clientID)
            connectedRelays[orbID][clientID].close()
          } catch(e) {
            console.error("Error closing excess relay", orbID, clientID)
          }
        }
      }
    }
  }
}

setInterval(relayUpkeep, 500)

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

function ipUpdate(){
  exec("ip addr | grep 'state UP' -A5 | grep 'inet ' | awk '{print $2}' | cut -f1 -d'/'", (error, stdout, stderr) => {
    let ip=stdout.trim().split(/\s+/)[0]
    //console.log(`Sending IP '${config.ORB_ID}':${ip}`)
    let options = {
      hostname: 'orbitron.games',
      path: `/ip/${config.ORB_ID}`,
      method: 'POST',
      port: 80,
      headers: {
        'Content-Type': 'text',
      },
    }
    let req = http.request(options, res => {
      let rawData = '';
      res.on('data', chunk => {
        rawData += chunk;
      });
      res.on('end', () => {
        localIP = ip
        //console.log(`IP Send Response: ${rawData}`)
        //console.log("Sending IP completed")
      });
    });
    req.on('error', err => {
      console.error(`IP Send Error: ${err}`)
      console.error("Sending IP failed")
    });
    req.write(`${ip}`);
    req.end();
  })
}
ipUpdate()
setInterval(ipUpdate, 30 * 1000)

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
  for(message of messages){
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


// Orb IP address storage
const orbIPAddresses = {}

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
    filePath = `/pixels/${filePath}/${filePath}.json`
  }
  else if (Object.keys(connectedOrbs).includes(filePath.split("/")[1])){
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
  } else if (filePath.includes("/ip")) {
    let meta = filePath.split("/")
    let orbID = meta[2]
    if(request.method == "GET") {
      let ip = orbIPAddresses[orbID]
      response.writeHead(200, { 'Content-Type': 'text' })
      response.end(ip, 'utf-8')
    } else if(request.method == "POST") {
      let postData = '';
      request.on('data', function (chunk) {
        postData += chunk;
      });
      request.on('end', function () {
        let ip = postData.trim()
        if(ip != orbIPAddresses[orbID]) {
          console.log("Got orb IP update", orbID, ip);
        }
        orbIPAddresses[orbID] = ip
        response.writeHead(200, { 'Content-Type': 'text' })
        response.end(postData, 'utf-8')
      })
    }
    return
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
  let _connectedOrbs = {}
  for(const orb in connectedOrbs) {
    _connectedOrbs[orb] = connectedOrbs[orb].classification
  }
  console.log("STATUS",new Date(),{
    devConnections,
    connectedOrbs: _connectedOrbs,
    connectedRelays,
    connectedClients,
    relayRequesterSocket: !relayRequesterSocket ? null : "connected",
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
    orbIPAddresses,
  })
}
statusLogging()
setInterval(statusLogging,60 * 1000)
