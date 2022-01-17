#!/usr/bin/env node
const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn } = require('child_process')

const NO_TIMEOUT = process.argv.includes('-t')

// Websocket server

var server = http.createServer(function(request, response) {
  console.log(' Received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})

wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })

wsServer.on('connection', socket => {
  console.log('Connection accepted.')
  connectionQueue.push(socket)
  bindDataEvents(socket)
  upkeep() // Will claim player if available
})

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
    //console.log("CLOSE",peer.pid,peer._id)
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

setInterval(upkeep, 1000)

function upkeep() {
  // Check for stale players
  if (gameState.players && !NO_TIMEOUT) {
    for (let peer of Object.values(connections)) {
      let player = gameState.players[peer.pid]
      if (!player.isReady && !player.isPlaying &&
        Date.now() - peer.lastActivityTime > 30*1000) { // 30 seconds
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

const python_process = spawn('sudo', ['python3', '-u', `${__dirname}/main.py`]);
python_process.stdout.on('data', data => {
  message = data.toString()
  if (data[0] == 123) { // check is first char is '{'
    try {
      // console.log(JSON.parse(message))
      broadcast(JSON.parse(message));
    } catch(e) {
      console.error(e);
      console.error(message);
    }
  } else if(message.startsWith("touchall")) {
    for (let id in connections) {
      connections[id].lastActivityTime = Date.now()
    }
  } else {
    message = message.slice(0, -1)
    if (message) {
      console.log(message)
    }
  }
});
python_process.stderr.on('data', data => {
  message = data.toString()
  if (!message.includes("underrun occurred")) {
    message = message.slice(0, -1)
    if (message) {
      console.log(message)
    }
  }
});

// Simple HTTP server

http.createServer(function (request, response) {
  var filePath = request.url

  if (filePath == '/')
    filePath = `${__dirname}/index.html`
  else
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

}).listen(1337, "0.0.0.0")
