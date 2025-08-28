#!/usr/bin/env node
const { config } = require('./lib')
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const { addGETListener, removeGETListener, respondWithFile } = require('./server')

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

wsOrbEmulatorServer.on('connection', (socket, request) => {
  let url = request.url.trim()
  let orbID = url.slice(1)
  let emulator = emulators[orbID]
  if (!emulator) {
    socket.close()
    return
  }
  socket.binaryType = "arraybuffer"
  let id = Math.floor(Math.random() * 1000000000) // change this to uuid?
  emulator.orbEmulatorConnections[id] = socket
  socket.id = id
  socket.on('close', () => {
    delete emulator.orbEmulatorConnections[id]
  })
})

let emulators = {}

class Emulator {
  constructor(config) {
    this.config = config
    this.orbEmulatorConnections = {}
    emulators[config.ORB_ID] = this
    
    addGETListener(this.pixelsGETListener.bind(this))
    addGETListener(this.webpageGETListener.bind(this))
  }

  destroy() {
    removeGETListener(this.pixelsGETListener)
    removeGETListener(this.webpageGETListener)
  }

  broadcast(message) {
    for (let id in this.orbEmulatorConnections) {
      this.orbEmulatorConnections[id].send(message)
    }
  }

  pixelsGETListener(response, orbID, filePath) {
    if (orbID != this.config.ORB_ID.toLowerCase()) return
    if (!filePath.endsWith('/pixels.json')) return

    respondWithFile(response, this.config.PIXELS_FILE)
    return true
  }
  webpageGETListener(response, orbID, filePath) {
    if (orbID != this.config.ORB_ID.toLowerCase()) return
    if (!filePath.includes('dev') && !filePath.includes('view')) return

    respondWithFile(response, "/emulator/emulator.html")
    return true
  }

}

module.exports = {
  Emulator
}