#!/usr/bin/env node
const { config } = require('./lib')
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const { addGETListener, respondWithFile } = require('./server')

// ---Orb Emulator Server---
let orbEmulatorServer
if (config.DEV_MODE) {
  orbEmulatorServer = http.createServer(() => {})
} else {
  orbEmulatorServer = https.createServer(config.httpsOptions, () => {})
}
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

addGETListener((response, orbID, filePath)=>{
  if (filePath == '/pixels.json') {
    respondWithFile(response, config.PIXELS_FILE)
    return true
  }
})

addGETListener((response, orbID, filePath) => {
  if(!orbID || orbID != config.ORB_ID.toLowerCase()) return

  if (filePath.includes('dev') || filePath.includes('view')){
    respondWithFile(response, "/emulator/emulator.html")
    return true
  }
})

module.exports = {
  orbEmulatorBroadcast
}