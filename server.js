#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./thirdparty/pako.min.js')
const SimpleSignalClient = require('simple-signal-client')
const wrtc = require('wrtc')
const { io } = require("socket.io-client")
const SimplePeerServer = require('simple-peer-server');
const { Server } = require("socket.io");
const { randomUUID } = require('crypto')

// Log to file and standard out
const util = require('util')
const log_file = __dirname + '/debug.log'
const log_stdout = process.stdout
const log_stderr = process.stderr

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

config=require(__dirname + "/config.js")
console.log(config)
const NO_TIMEOUT = process.argv.includes('-t')
let starting_game = null
game_index = process.argv.indexOf('-g') + 1
if (game_index) {
  starting_game = process.argv[game_index]
  console.log("Starting with game: " + starting_game)
}

// Dev Kit Websocket server

var devServer = http.createServer(function(request, response) {
  console.log('Dev Server Received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
devServer.listen(8888, "0.0.0.0", function() {
  console.log('Dev WebSocket Server is listening on port 8888')
})

var wsDevServer = new WebSocket.Server({ 
  server: devServer, 
  autoAcceptConnections: true 
})

wsDevServer.on('connection', socket => {
  socket.binaryType = "arraybuffer"
  console.log('Dev connection accepted.')
  let id = Math.floor(Math.random() * 1000000000)
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

// Orb relay management
const connectedOrbs = {}
const connectedOrbRelays = {}
const connectedOrbClients = {}
const relayClientPairs = {}
const clientRelayPairs = {}

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
  }

  getID() {
    return this.id
  }

  bindWebSocket(socket) {
    let self = this
    this.sockets.push(socket)
    socket.on("message", (data, isBinary) => {
      try {
        let content = JSON.parse(data)
        if(content.timestamp > self.latestMessage){
          self.latestMessage = content.timestamp
          if(self.callbacks.message){
            self.callbacks.message(content)
          }
        }
      } catch(e) {
        console.error("Error processing web socket message", e)
      }
    })
    socket.on("close", () => {
      let index = self.sockets.indexOf(socket)
      self.sockets.splice(index)
      if(self.sockets.length <= 0){
        if(self.callbacks.close){
          self.callbacks.close()
        }
      }
    })
  }

  bindWebRTCSocket(socket) {
    let self = this
    this.sockets.push(socket)
    socket.on("data", (data) => {
      try {
        let content = JSON.parse(data)
        if(content.timestamp > self.latestMessage){
          self.latestMessage = content.timestamp
          if(self.callbacks.message){
            self.callbacks.message(content)
          }
        }
      } catch(e) {
        console.error("Error processing webRTC socket message", e)
      }
    })
    socket.on("close", () => {
      let index = self.sockets.indexOf(socket)
      self.sockets.splice(index)
      if(self.sockets.length <= 0){
        if(self.callbacks.close){
          self.callbacks.close()
        }
      }
    })
    socket.close = socket.destroy
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
        console.error("Error sending to client", e)
      }
    }
  }

  close() {
    for(const socket of this.sockets){
      try {
        socket.close()
      } catch(e) {
        console.error("Error closing client socket", e)
      }
    }
  }
}

const clientConnections = {}

// Client Websocket server

var server = http.createServer(function(request, response) {
  console.log('Websocket Server received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})

wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

wsServer.on('connection', (socket, request) => {
  socket.rid = randomUUID()
  let url = request.url.trim()
  console.log('WS connection request made to',request.url)
  let meta = url.split("/")
  let orbID = meta[1]
  let clientID = meta[2]
  if(orbID == "") { // direct client
    let clientConnection = getClientConnection(clientID)
    clientConnection.bindWebSocket(socket)
    bindRemotePlayer(clientConnection)
  } else if(orbID == "relay") { // relay server
    orbID = clientID
    if(!connectedOrbs[orbID]){
      bindOrbServer(socket, orbID)
    } else {
      bindOrbRelay(socket, orbID)
    }
  } else { //relay client
    socket.clientID = clientID
    bindOrbClient(socket, orbID, clientID)
  }
})

function getClientConnection(clientID) {
  if(!clientConnections[clientID]){
    clientConnections[clientID] = new ClientConnection(clientID)
  }
  return clientConnections[clientID]
}

function bindOrbServer(socket, orbID) {
  console.log("Binding orb server",orbID)
  connectedOrbs[orbID] = socket
  socket.on('message', data => {
    console.log("Got Message from Orb Server: ", data)
  })
  socket.on('close', () => {
    delete connectedOrbs[orbID]
  })
}

function bindOrbRelay(socket, orbID){
  console.log("Binding orb relay",orbID)
  if(!connectedOrbRelays[orbID]) {
    connectedOrbRelays[orbID] = {}
  }
  connectedOrbRelays[orbID][socket.rid] = socket
  socket.on('message', (data,isBinary) => {
    if(!isBinary){
      data = data.toString()
    }
    let client = relayClientPairs[socket.rid]
    if(client) {
      try {
        client.send(data)
      } catch(e) {
        console.error("Orb to Client error:", e)
      }
    } else {
      console.log("Client not connected yet:", orbID)
    }
  })
  socket.on('close', () => {
    delete connectedOrbRelays[orbID][socket.rid]
    let client = relayClientPairs[socket.rid]
    delete relayClientPairs[socket.rid]
    if(client){
      try {
        client.close()
      } catch(e) {
        console.error("Error closing client from relay:",orbID)
      }
    }
  })
}

function bindOrbClient(socket, orbID) {
  console.log("Binding orb client",orbID)
  if(!connectedOrbClients[orbID]){
    connectedOrbClients[orbID] = {}
  }
  connectedOrbClients[orbID][socket.rid] = socket
  socket.on('message', (data, isBinary) => {
    if(!isBinary){
      data = data.toString()
    }
    let orb = clientRelayPairs[socket.rid]
    if(orb){
      try {
        orb.send(data)
      } catch(e) {
        console.error("Client to Orb error:", e)
      }
    } else {
      console.log("Orb not connected yet:", orbID)
    }
  })
  socket.on('close', () => {
    delete connectedOrbClients[orbID][socket.rid]
    relay = clientRelayPairs[socket.rid]
    delete clientRelayPairs[socket.rid]
    if(relay) {
      try {
        relay.close()
      } catch(e) {
        console.error("Error closing relay from client:",e)
      }
    }
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
    starting_game = null
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
  //peer.on('error', (err) => {
  //  console.error("ERROR",peer.pid,err)
  //})
}

// Relay Connection
var relayRequestSocket = null
function relayUpkeep() {
  if(config.CONNECT_TO_RELAY) {
    if(!relayRequestSocket){
      try {
        let relayURL = `ws://${config.CONNECT_TO_RELAY}/relay/${config.ORB_ID}`
        console.log("Initializing relay request socket")
        relayRequestSocket = new WebSocket.WebSocket(relayURL)
        relayRequestSocket.on('message', data => {
          let clientID = data.toString().trim()
          console.log("Got relay request",clientID)
          let socket = new WebSocket.WebSocket(relayURL)
          socket.on('open', () => {
            let clientConnection = getClientConnection(clientID)
            clientConnection.bindWebSocket(socket)
            bindRemotePlayer(clientConnection)
          })
        })
        relayRequestSocket.on('close', () => {
          relayRequestSocket = null
        })
      } catch(e) {
        console.error("Error connecting to relay:", e)
      }
    }
  }
  if(config.ACT_AS_RELAY){
    for(orbID of Object.keys(connectedOrbs)){
      let orbSocket = connectedOrbs[orbID]
      // Connect clients to available relays
      for(client of Object.keys(connectedOrbClients[orbID] || {})){
        if(!clientRelayPairs[client]){
          let found = false
          for(relay of Object.keys(connectedOrbRelays[orbID] || {})){
            if(!relayClientPairs[relay]){
              clientRelayPairs[client]=connectedOrbRelays[orbID][relay]
              relayClientPairs[relay]=connectedOrbClients[orbID][client]
              found = true
              break
            }
          }
          // No available relay sockets, request one
          if(!found && orbSocket){
            orbSocket.send(connectedOrbClients[orbID][client].clientID)
          }
        }
      }
      // Remove excess relays, if any
      for(relay of Object.keys(connectedOrbRelays[orbID] || {})){
        if(!relayClientPairs[relay]){
          connectedOrbRelays[orbID][relay].close()
        }
      }
    }
  }
}

setInterval(relayUpkeep, 500)

function upkeep() {
  // Check for stale players
  if (gameState.players && !NO_TIMEOUT) {
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

MAX_PLAYERS = 6
connections = {}
connectionQueue = []

function ipUpdate(){
  exec("ip addr | grep 'state UP' -A5 | grep 'inet ' | awk '{print $2}' | cut -f1 -d'/'", (error, stdout, stderr) => {
    var ip=stdout.trim().split(/\s+/)[0]
    if(ip !== localIP){
      console.log(`Sending IP '${config.ORB_ID}':${ip}`)
      var options = {
        hostname: 'orbitron.games',
        path: `/ip/${config.ORB_ID}`,
        method: 'POST',
        port: 80,
        headers: {
          'Content-Type': 'text',
        },
      }
      var req = http.request(options, res => {
        let rawData = '';
        res.on('data', chunk => {
          rawData += chunk;
        });
        res.on('end', () => {
          localIP = ip
          console.log(`IP Send Response: ${rawData}`)
          console.log("Sending IP completed")
        });
      });
      req.on('error', err => {
        console.error(`IP Send Error: ${err}`)
        console.error("Sending IP failed")
      });
      req.write(`${ip}`);
      req.end();
    }
  })
}
localIP = ""
ipUpdate()
setInterval(ipUpdate, 10000)

// Communications with python script

gameState = {}
broadcastCounter = 0
const counterThreshold = 30

function broadcast(baseMessage) {
  broadcastCounter++
  baseMessage.notimeout = NO_TIMEOUT
  let noChange = JSON.stringify(baseMessage) == JSON.stringify(gameState)
  gameState = baseMessage
  if(noChange && broadcastCounter % counterThreshold != 0){
    return
  }
  broadcastCounter = 0
  baseMessage.timestamp = Date.now() + (process.hrtime()[1]*0.000001)%1
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
  var filePath = request.url

  if (filePath == '/')
    filePath = "/index.html"
  else if (filePath == '/dev' || filePath == '/view')
    filePath = "/dev.html"
  else if (filePath == '/pixels.json')
    filePath = config.PIXELS || "/pixels-rhomb.json"
  else if (Object.keys(connectedOrbs).includes(filePath.substr(1)))
    filePath = "/index.html"
  else if (filePath.includes("/ip")) {
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
        console.log("POST IP", postData);
        orbIPAddresses[orbID] = postData.trim()
        response.writeHead(200, { 'Content-Type': 'text' })
        response.end(postData, 'utf-8')
      })
    }
    return
  }

  filePath = `${__dirname}/${filePath}`
  //console.log(filePath);

  var extname = path.extname(filePath)
  var contentType = 'text/html'
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
  }

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        fs.readFile('./404.html', function(error, content) {
          response.writeHead(200, { 'Content-Type': contentType })
          response.end(content, 'utf-8')
        });
      }
      else {
        response.writeHead(500)
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
        response.end();
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content, 'utf-8')
    }
  });

})

//WebRTC switchboard
const switchboard = new Server(rootServer);
signalServer = require('simple-signal-server')(switchboard)

connectedWebRTCOrbs = {}

signalServer.on('discover', (request) => {
  //console.log("WEBRTC DISCOVER",request.discoveryData)
  let orbID = request.discoveryData.orbID
  let clientID = request.socket.id // clients are uniquely identified by socket.id
  if(orbID){
    if(request.discoveryData.isOrb) {
      connectedWebRTCOrbs[orbID] = clientID
    }
    request.discover([connectedWebRTCOrbs[orbID]]) // respond with id of connected orb
  }
})

signalServer.on('disconnect', (socket) => {
  console.log("WEBRTC DISCONNECT",socket.id)
  let clientID = socket.id
  let orbID = null
  for(id in connectedWebRTCOrbs){
    if(connectedWebRTCOrbs[id] == clientID){
      orbID = id
      break
    }
  }
  if(orbID){
    delete connectedWebRTCOrbs[orbID]
  }
})

signalServer.on('request', (request) => {
  console.log("WEBRTC REQUEST FORWARDED",request.metadata)
  request.forward() // forward all requests to connect
})
const rootServerPort = config.HTTP_SERVER_PORT || 1337
rootServer.listen(rootServerPort, "0.0.0.0")

//WebRTC connection to switchboard
const socket = io(config.SWITCHBOARD || `http://localhost:${rootServerPort}`);
const signalClient = new SimpleSignalClient(socket)
signalClient.on('discover', (ids) => {
  //console.log("WEBRTC DISCOVER RESPONSE",ids)
})

signalClient.on('request', async (request) => {
  try {
    const { peer, metadata } = await request.accept(null,{wrtc:wrtc}) // Accept the incoming request
    console.log("WEBRTC REQUEST ACCEPTED",metadata)
    let clientConnection = getClientConnection(metadata.clientID)
    clientConnection.bindWebRTCSocket(peer)
    bindRemotePlayer(clientConnection)
  } catch (e) {
    console.error("Error establishing WebRTC connection", e)
  }
})

function webRTCUpkeep() {
  signalClient.discover({orbID:config.ORB_ID,isOrb:true})
}

setInterval(webRTCUpkeep, 5000)

