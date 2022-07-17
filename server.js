#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./thirdparty/pako.min.js')

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
  console.log('Caught exception: ' + err)
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
  console.log(' Received request for ' + request.url)
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

// Orb management
const connectedOrbs = {}
const connectedOrbRelays = {}
const connectedOrbClients = {}
const relayClientPairs = {}
const clientRelayPairs = {}

// Client Websocket server

var server = http.createServer(function(request, response) {
  console.log(' Received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})

wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

wsServer.on('connection', (socket, request) => {
  socket.uid = Date.now()
  let url = request.url.trim()
  console.log('Connection accepted to',request.url)
  if(url.includes("relay")){
    let orbID = url.split("/")[2]
    if(!connectedOrbs[orbID]){
      bindOrbServer(socket, orbID)
    } else {
      bindOrbRelay(socket, orbID)
    }
  } else {
    if(url == "/") {
      bindRemotePlayer(socket)
    } else { // relay client
      let orbID = url.substr(1)
      bindOrbClient(socket, orbID)
    }
  }
})

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
  connectedOrbRelays[orbID][socket.uid] = socket
  socket.on('message', (data,isBinary) => {
    if(!isBinary){
      data = data.toString()
    }
    let client = relayClientPairs[socket.uid]
    if(client) {
      try {
        client.send(data)
      } catch(e) {
        console.log("Orb to Client error:", e)
      }
    } else {
      console.log("Client not connected:", orbID, relayClientPairs)
    }
  })
  socket.on('close', () => {
    delete connectedOrbRelays[orbID][socket.uid]
    let client = relayClientPairs[socket.uid]
    delete relayClientPairs[socket.uid]
    if(client){
      try {
        client.close()
      } catch(e) {
        console.log("Error closing client from relay:",orbID)
      }
    }
  })
}

function bindOrbClient(socket, orbID) {
  console.log("Binding orb client",orbID)
  if(!connectedOrbClients[orbID]){
    connectedOrbClients[orbID] = {}
  }
  connectedOrbClients[orbID][socket.uid] = socket
  socket.on('message', (data, isBinary) => {
    if(!isBinary){
      data = data.toString()
    }
    let orb = clientRelayPairs[socket.uid]
    if(orb){
      try {
        orb.send(data)
      } catch(e) {
        console.log("Client to Orb error:", e)
      }
    } else {
      console.log("Orb not connected:", orbID, clientRelayPairs)
    }
  })
  socket.on('close', () => {
    delete connectedOrbClients[orbID][socket.uid]
    relay = clientRelayPairs[socket.uid]
    delete clientRelayPairs[socket.uid]
    if(relay) {
      try {
        relay.close()
      } catch(e) {
        console.log("Error closing relay from client:",e)
      }
    }
  })
}

function bindRemotePlayer(socket) {
  console.log("Binding remote player")
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
  peer.on('message', data => {
    //console.log("DATA",peer.pid,peer._id,!peer.pid,!connections[peer.pid])
    if (!typeof(peer.pid)==="number" || !connections[peer.pid]) {
      return
    }
    content = JSON.parse(data)
    content.self = peer.pid
    peer.lastActivityTime = Date.now()
    // console.log("DATA CONTENT",content)
    python_process.stdin.write(JSON.stringify(content) + "\n", "utf8")

  })

  peer.on('close', () => {
    //console.log("CLOSE "+ peer.pid)
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
        console.log("Initializing relay request socket")
        relayRequestSocket = new WebSocket.WebSocket(config.CONNECT_TO_RELAY)
        relayRequestSocket.on('message', data => {
          let message = data.toString().trim()
          console.log("Got relay request",message)
          if(message == "GET"){
            let socket = new WebSocket.WebSocket(config.CONNECT_TO_RELAY)
            socket.on('open', () => {
              bindRemotePlayer(socket)
            })
          }
        })
        relayRequestSocket.on('close', () => {
          relayRequestSocket = null
        })
      } catch(e) {
        console.log("Error connecting to relay:", e)
      }
    }
  }
  if(config.ACT_AS_RELAY){
    for(orbID of Object.keys(connectedOrbs)){
      let orbSocket = connectedOrbs[orbID]
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
          if(!found && orbSocket){
            orbSocket.send("GET")
          }
        }
      }
    }
  }
}

setInterval(relayUpkeep, 500)

setInterval(upkeep, 1000)

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

MAX_PLAYERS = 6
connections = {}
connectionQueue = []

// setInterval(ipUpdate, 10000)
// function ipUpdate(){
//   exec("ip addr | grep 'state UP' -A2 | tail -n1 | awk '{print $2}' | cut -f1  -d'/'", (error, stdout, stderr) => {
//     var ip=stdout.trim()
//     if(ip !== localIP){
//       console.log(`Sending IP '${config.ORB_ID}':${ip}`)
//       var options = {
//         hostname: 'super-orbitron-default-rtdb.firebaseio.com',
//         path: `/ips/${config.ORB_ID}.json`,
//         method: 'PUT',
//         port: 443,
//         headers: {
//           'Content-Type': 'application/json',
//         },
//       }
//       var req = https.request(options, res => {
//         let rawData = '';

//         res.on('data', chunk => {
//           rawData += chunk;
//         });

//         res.on('end', () => {
//           localIP = ip
//           console.log(`IP Send Response: ${rawData}`)
//           console.log("Sending IP completed")
//         });
//       });
//       req.on('error', err => {
//         console.error(`IP Send Error: ${err}`)
//         console.error("Sending IP failed")
//       });
//       req.write(JSON.stringify(`${ip}`));
//       req.end();
//     }
//   })
// }
// localIP = ""
// ipUpdate()


// Communications with python script

gameState = {}

function broadcast(baseMessage) {
  gameState = baseMessage
  baseMessage.notimeout = NO_TIMEOUT

  for (let id in connections) {
    baseMessage.self = parseInt(id)
    connections[id].send(JSON.stringify(baseMessage))
  }
  delete baseMessage.self
  for (let i = 0; i < connectionQueue.length; i++) {
    baseMessage.queuePosition = i + 1
    connectionQueue[i].send(JSON.stringify(baseMessage))
  }
}

const python_process = spawn('python3', ['-u', `${__dirname}/main.py`],{env:{...process.env,...config}})

python_process.stdout.on('data', data => {
  messages = data.toString().trim().split("\n")
  for(message of messages){
    message = message.trim()
    if(!message) continue
    if (message.charAt(0) == "{") { // check is first char is '{'
      try {
        //console.log(JSON.parse(message))
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
  console.log('Caught python exception: ' + err);
});


// Simple HTTP server

http.createServer(function (request, response) {
  var filePath = request.url

  if (filePath == '/')
    filePath = "/index.html"
  else if (filePath == '/dev' || filePath == '/view')
    filePath = "/dev.html"
  else if (filePath == '/pixels.json')
    filePath = config.PIXELS || "/pixels-rhomb.json"
  else if (Object.keys(connectedOrbs).includes(filePath.substr(1)))
    filePath = "/index.html"

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

}).listen(config.HTTP_SERVER_PORT || 1337, "0.0.0.0")
