#!/usr/bin/env node
const { config } = require('./lib')
const WebSocket = require('ws')
const http = require('http')
const { addListener, respondWithFile } = require('./server')

// ---Orb Emulator Server---
let orbEmulatorServer = http.createServer(function(request, response) {})

orbEmulatorServer.listen(8888, "0.0.0.0", function() {
  console.log('Orb Emulator WebSocket Server is listening on port 8888')
})

let wsOrbEmulatorServer = new WebSocket.Server({ 
  server: orbEmulatorServer, 
  autoAcceptConnections: true 
})

wsOrbEmulatorServer.on('connection', socket => {
  socket.binaryType = "arraybuffer"
  let id = Math.floor(Math.random() * 1000000000) // change this to uuid?
  orbEmulatorConnections[id] = socket
  socket.id = id
  socket.on('close', () => {
    delete orbEmulatorConnections[id]
  })
})

let orbEmulatorConnections = {}

function orbEmulatorBroadcast(message) {
  for (let id in orbEmulatorConnections) {
    orbEmulatorConnections[id].send(message)
  }
}

addListener((orbID, filePath, response)=>{
  if (filePath == '/pixels.json') {
    respondWithFile(config.PIXELS, response)
    return true
  }
})

addListener((orbID, filePath, response) => {
  if(!orbID || orbID != config.ORB_ID) return

  if (filePath.includes('dev') || filePath.includes('view')){
    respondWithFile("/emulator/emulator.html", response)
    return true
  }
})

module.exports = {
  orbEmulatorBroadcast
}