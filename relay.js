#!/usr/bin/env node
const { config } = require('./lib')
const { pullAndRestart } = require('./gitupdate')
const WebSocket = require('ws')
const http = require('http')
const fs = require('fs')
const homedir = require('os').homedir()
const { addListener, respondWithFile, addPOSTListener } = require('./server')

const connectedOrbs = {}
const logsRequested = {}
const connectedClients = {}
let server = http.createServer(function(request, response) {
  //console.log('Websocket Server received request for ' + request.url)
  response.writeHead(404)
  response.end()
})
server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})
let wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })
wsServer.on('connection', (socket, request) => {
  let url = request.url.trim()
  //console.log('WS connection request made to', request.url)
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

let serverPingHandler = () => {
  for (const orbID in connectedOrbs) {
    connectedOrbs[orbID].send("PING")
  }
}
setInterval(serverPingHandler, 3000)  

function bindOrb(socket, orbID) {
  //console.log("Binding orb",orbID)
  if(connectedOrbs[orbID]){
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
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.error("Error in orb socket", orbID, e)
    socket.close()
  })
}

function bindClient(socket, orbID, clientID) {
  //console.log("Binding client",orbID,clientID)
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
        message: "{}",
        closed: false,
      }  
      orb.send(JSON.stringify(initial_message))
    }
  } catch(e) {
    console.error("Error sending initial client message", e)
    socket.close()
  }
}

addListener(async (orbID, filePath, response)=>{
  if(!orbID || !connectedOrbs[orbID] || filePath.includes("/logs")) return

  respondWithFile("/controller/controller.html",response)
  return true
})

addListener(async (orbID, filePath, response)=>{
  if(!orbID || !connectedOrbs[orbID] || !filePath.includes("/logs")) return

  if(logsRequested[orbID]){
    response.writeHead(500)
    response.end('Cannot fetch logs for ' + orbID + ` debug info - requested: ${logsRequested[orbID]} - connected: ${connectedOrbs[orbID] != null}`)
    return true
  }
  logsRequested[orbID] = true
  connectedOrbs[orbID].send("GET_LOGS")
  let start_time = Date.now()
  try {
    await new Promise((resolve, reject) => {
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
    })
  } catch {
    response.writeHead(500)
    response.end('Timed out fetching logs for ' + orbID)
    return
  }
  try {
    let logZipPath = `${homedir}/${orbID}_logs.zip`
    let data = fs.readFileSync(logZipPath)
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
  return true
})

addPOSTListener(async (body, response) => {
  try {
    let payload = JSON.parse(body)
    response.writeHead(200)
    response.end('post received')

    // TODO also check secret: config.WEBHOOK_SECRET
    if (payload.ref === 'refs/heads/master') {
      for (let orbID in connectedOrbs) {
        let socket = connectedOrbs[orbID]
        socket.send("GIT_HAS_UPDATE")
      }
      pullAndRestart()
      return true
    }  
  } catch(e) {
    console.error("POST data didn't parse as JSON", e)
    response.writeHead(500)
    response.end('error parsing json')
  }
})