const fs = require('fs')
const http = require('http')
const path = require('path')
const SimplePeerServer = require('simple-peer-server');
const { Server } = require("socket.io");

let GAME = process.env.ORBITRON_GAME || "bomberman"
let PORT = process.env.PORT || 9000
let DEBUG = process.env.DEBUG || true

// Simple HTTP server
let server = http.createServer(function (request, response) {
  var filePath = request.url

  if (filePath == '/')
    filePath = `${__dirname}/index.html`
  else
    filePath = `${__dirname}/${filePath}`
  console.log(filePath);

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
const io = new Server(server);
// Singaling Server
signalServer = require('simple-signal-server')(io)

const installations = {}
const installationMap = {}
const installationKeys={
  "debug":DEBUG,
}

signalServer.on('discover', (request) => {
  console.log("DISCOVER",request.discoveryData)
  var installation = request.discoveryData.installation
  if(installation){
    const clientID = request.socket.id // clients are uniquely identified by socket.id
    if(!installations[installation]){
      installations[installation]=new Set()
    }
    var online = installations[installation]
    var key = request.discoveryData.key
    if(key && installationKeys[key]){
      online.add(clientID)
      installationMap[clientID]=online
    }
    request.discover(Array.from(online)) // respond with ids of online installations
  }
})

signalServer.on('disconnect', (socket) => {
  console.log("DISCONNECT",socket.id)
  const clientID = socket.id
  online = installationMap[clientID]
  if(online){
    online.delete(clientID)
    delete installationMap[clientID]
  }
})

signalServer.on('request', (request) => {
  console.log("REQUEST",request)
  request.forward() // forward all requests to connect
})

server.listen(PORT,function(err){
  console.log("Listening on " + PORT,err)
});

