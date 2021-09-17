#!/usr/bin/env node
const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

 

// Websocket server

var server = http.createServer(function(request, response) {
  console.log(' Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
server.listen(7777, function() {
  console.log('WebSocket Server is listening on port 7777');
});
 
wsServer = new WebSocket.Server({ server, autoAcceptConnections: true });
wsServer.on('connection', connection => {
  console.log('Connection accepted.');

  let id = 0;
  while(true) {
    if (!connections[id]) {
      connections[id] = connection;
      lastActivityTimes[id] = Date.now()
      break;
    }
    id += 1;
  }

  claim = { self: id, type: "claim" };
  process.stdin.write(JSON.stringify(claim) + "\n", "utf8");

  connection.on('message', function(message) {
    content = JSON.parse(message)
    content.self = id
    lastActivityTimes[id] = Date.now()
    process.stdin.write(JSON.stringify(content) + "\n", "utf8")
  });
  connection.on('close', function(reasonCode, description) {
    release = { self: id, type: "release" }
    process.stdin.write(JSON.stringify(release) + "\n", "utf8")
    delete connections[id]
  });
});

// Check for stale players
setInterval(() => {
  if (!gameState.players) {
    return
  }
  for (var id in connections) {
    let player = gameState.players[id]
    if (!player.isReady && !player.isPlaying &&
        Date.now() - lastActivityTimes[id] > 30*1000) { // 30 seconds
      console.log("Player timed out.")
      connections[id].close()
    }
  }
}, 1000)

connections = {};
lastActivityTimes = {};


// Communications with python script

gameState = {};

function broadcast(baseMessage) {
  gameState = baseMessage
  for (let id in connections) {
    baseMessage.self = id
    connections[id].send(JSON.stringify(baseMessage))
  }
}
const process = spawn('sudo', ['python3', '-u', '/home/pi/Rhomberman/main.py']);
process.stdout.on('data', data => {
  if (data[0] == 123) { // check is first char is '{'
    try {
      broadcast(JSON.parse(data.toString()));
    } catch(e) {
      console.error(e);
      console.error(data.toString());
    }
  } else {
    console.log(data.toString());
  }
});
process.stderr.on('data', data => {
  console.log(data.toString());
});



// Simple HTTP server

http.createServer(function (request, response) {
  var filePath = request.url;

  if (filePath == '/')
    filePath = '/index.html';
  filePath = '/home/pi/Rhomberman' + filePath;

  console.log(filePath);

  var extname = path.extname(filePath);
  var contentType = 'text/html';
  switch (extname) {
    case '.js':
      contentType = 'text/javascript';
      break;
    case '.css':
      contentType = 'text/css';
      break;
    case '.json':
      contentType = 'application/json';
      break;
    case '.png':
      contentType = 'image/png';
      break;      
    case '.jpg':
      contentType = 'image/jpg';
      break;    
    case '.ico':
      contentType = 'image/x-icon';
      break;
    case '.wav':
      contentType = 'audio/wav';
      break;
  }

  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        fs.readFile('./404.html', function(error, content) {
          response.writeHead(200, { 'Content-Type': contentType });
          response.end(content, 'utf-8');
        });
      }
      else {
        response.writeHead(500);
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
        response.end(); 
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });

}).listen(1337);
