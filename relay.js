#!/usr/bin/env node
const { config, processAdminCommand, noCorsHeader } = require('./lib')
const { pullAndRestart } = require('./gitupdate')
const WebSocket = require('ws')
const http = require('http')
const https = require('https')
const fs = require('fs')
const homedir = require('os').homedir()
const { addGETListener, respondWithFile, addPOSTListener } = require('./server')

const connectedOrbs = {}
const orbToIP = {}
const logsRequested = {}
const connectedClients = {}
const awaitingMessages = {}
let orbInfoCache = {}
let BACKUPS_DIR = "./backups/"


let server
if (config.DEV_MODE) {
  server = http.createServer(serverHandler)
} else {
  server = https.createServer(config.httpsOptions, serverHandler)
}
function serverHandler(request, response) {
  //console.log('Websocket Server received request for ' + request.url)
  response.writeHead(404)
  response.end()
}

function ipFromRequest(request) {
  return request.headers['x-forwarded-for'] || request.connection.remoteAddress
}


server.listen(7777, "0.0.0.0", function() {
  console.log('WebSocket Server is listening on port 7777')
})
let wsServer = new WebSocket.Server({ server, autoAcceptConnections: true })
wsServer.on('connection', (socket, request) => {
  let url = request.url.trim()
  //console.log('WS connection request made to', request.url)
  let meta = url.split("/")
  if(meta[1] == "relay") { // socket from orb to server
    let orbID = meta[2].toLowerCase()
    orbToIP[orbID] = ipFromRequest(request)
    socket.classification = "WS orb to server"
    bindOrb(socket, orbID)
  } else { // client socket connecting to server
    let orbID = meta[1].toLowerCase()
    orbID = config.reverseAliases[orbID] ?? orbID
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

async function loadOrbInfoCache() {
  try {
    orbInfoCache = JSON.parse(await fs.promises.readFile("./orbinfocache.json", "utf8"))
  } catch(_) {}
}

function bindOrb(socket, orbID) {
  if(connectedOrbs[orbID]){
    try {
      connectedOrbs[orbID].close()
    } catch(e) {
      console.log("Error closing existing orb socket",orbID, e)
    }
  }
  connectedOrbs[orbID] = socket
  socket.lastActivityTime = Date.now()
  socket.on('message', async (data, isBinary) => {
    socket.lastActivityTime = Date.now()
    if (data == "PING") return

    try {
      jsonData = JSON.parse(data)
      let messageID = jsonData.messageID
      if (messageID) {
        if (awaitingMessages[messageID]) {
          awaitingMessages[messageID].resolve(jsonData.data)
        }
        return
      }

      let backup = jsonData.backup
      if (backup) {
        let name = backup.nameOverride
        if (name) {
          delete(backup.nameOverride)
        }
        backup = JSON.stringify(backup)
        let id = config.ALIASES[orbID] ?? orbID
        
        if (!fs.existsSync(BACKUPS_DIR)) {
          await fs.promises.mkdir(BACKUPS_DIR)
        }
        let savedPrefFileNames = (await fs.promises.readdir(BACKUPS_DIR))
          .filter(name => name.startsWith(id))
        if (!backup.nameOverride && savedPrefFileNames.length > 0) {
          let lastFilePath = BACKUPS_DIR + savedPrefFileNames.last()
          let lastFileContents = await fs.promises.readFile(lastFilePath)
          if (backup == lastFileContents) {
            return
          }
        }
        
        if (!name) {
          if (id.startsWith("_")) { // Only save manual backups for special lumatrons
            return
          }

          function twoDigit(num) {
            return String(num).padStart(2, '0')
          }
          let d = new Date()
          let dateString = `${d.getFullYear()}-${twoDigit(d.getMonth()+1)}-${twoDigit(d.getDate())}_${twoDigit(d.getHours())}-${twoDigit(d.getMinutes())}`
          name = id + "_" + dateString
        }
        let path = BACKUPS_DIR + name + '.bak'
        await fs.promises.writeFile(path, backup)

        for (let i = 0; i < savedPrefFileNames.length - 4; i++) {
          fs.promises.unlink(BACKUPS_DIR + savedPrefFileNames[i])
        }
        return
      }
    } catch {}

    if(logsRequested[orbID] && isBinary){
      try {
        fs.writeFileSync(`${homedir}/${orbID}_logs.zip`, data)
        console.log("Wrote logs for " + orbID)
      } catch(error) {
        console.log("Error writing log file", error)
      }
      logsRequested[orbID] = false
      return
    }
    if(!isBinary){
      data = data.toString().trim()
    }
    try {
      data = JSON.parse(data);

      if (data.config) { // info dump to cache
        orbInfoCache[orbID] = data
        await fs.promises.writeFile("./orbinfocache.json", JSON.stringify(orbInfoCache), "utf8")
        return
      }

      let clientID = data.clientID;
      let client = connectedClients[orbID] && connectedClients[orbID][clientID]
      if(client) {
        while(client.messageCache.length > 0) {
          let message = client.messageCache.shift()
          try {
            socket.send(message)
          } catch(e) {
            console.log("Error sending cached message to orb", orbID, clientID, e)
          }
        }
        client.send(data.message)
      }
    } catch(e) {
      console.log("Orb to Client error:", orbID, e)
    }

  })
  socket.on('close', () => {
    delete connectedOrbs[orbID]
  })
  socket.on('error', (e) => {
    console.log("Error in orb socket", orbID, e)
    socket.close()
  })
}

function orbUpkeep() {
  for (let socket of Object.values(connectedOrbs)) {
    if (Date.now() - socket.lastActivityTime > 10*1000) {
      socket.close()
    }
  }
}
setInterval(orbUpkeep, 1000)

function bindClient(socket, orbID, clientID) {
  orbID = orbID.toLowerCase()
  if(!connectedClients[orbID]){
    connectedClients[orbID] = {}
  }
  if(connectedClients[orbID][clientID]){
    try {
      connectedClients[orbID][clientID].close()
    } catch(e) {
      console.log("Error closing existing client", orbID, clientID, e)
    }
  }
  connectedClients[orbID][clientID] = socket
  socket.clientID = clientID
  socket.messageCache = []
  socket.on('message', async (data, isBinary) => {
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
      console.log("Client to orb error:", orbID, clientID, e)
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
    console.log("Error on client socket", orbID, clientID, e)
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
    console.log("Error sending initial client message", e)
    socket.close()
  }
} // END web socket section


// Admin commands for this relay
addGETListener(async (response, orbID, _, queryParams) => {
  if (orbID != "admin") return false
  let command = await processAdminCommand(queryParams)
  if (!command) return false

  noCorsHeader(response, 'text/json')
  switch (command.type) {
    case "orblist":
      let orbInfo = []
      for (let id in connectedOrbs) {
        orbInfo.push({
          id,
          alias: config.ALIASES[id],
        })
      }
      response.end(JSON.stringify(orbInfo))
      return true
    case "alias":
      config.ALIASES[command.id] = command.alias
      config.reverseAliases[command.alias] = command.id
      response.end("OK")
      return true
    case "backuplist":
      response.end(JSON.stringify(await fs.promises.readdir(BACKUPS_DIR)))
      return true
    case "backup":
      response.end(await fs.promises.readFile(BACKUPS_DIR + command.fileName))
      return true
    case "deleteBackup":
      response.end(await fs.promises.unlink(BACKUPS_DIR + command.fileName))
      return true
    default:
      return false
  }
})

// Admin commands for orbs
addGETListener(async (response, orbID, filePath, queryParams) => {
  if(!orbID || !connectedOrbs[orbID]) return

  let pathParts = filePath.split("/")
  if (pathParts.length < 3 || pathParts[2] != "admin") return false
  
  queryParams.type = "admin"
  let orb = connectedOrbs[orbID]
  let reply = await new Promise(resolve => {
    orb.send(JSON.stringify(queryParams))
    awaitingMessages[queryParams.hash] = {
      timestamp: Date.now(),
      resolve,
    }
  })
  noCorsHeader(response, 'text/json')
  response.end(reply)
  return true
})


// Get all orbs on same IP
addGETListener(async (response, _, filePath, __, request)=>{
  if (filePath != "/localorbs") return

  const clientIP = ipFromRequest(request)
  noCorsHeader(response, 'text/json')
  let localOrbs = []
  for (let orbID in orbToIP) {
    if (orbToIP[orbID] == clientIP) {
      localOrbs.push(orbID)
    }
  }

  response.end(JSON.stringify(localOrbs))
  return true
})

// Get basic info on orb
addGETListener(async (response, orbID, filePath)=>{
  if (!filePath.includes("/info")) return

  noCorsHeader(response, 'text/json')
  if(!orbID || !orbInfoCache[orbID]) {
    response.end(JSON.stringify(null))
    return true
  }
  localConfig = orbInfoCache[orbID].config
  let info = {
    orbID,
    topology: localConfig.PIXELS,
    isFlat: localConfig.IS_FLAT,
    isCurrentlyConnected: !!connectedOrbs[orbID],
    extraIdle: localConfig.IDLE,
    extraStartingRules: localConfig.EXTRA_STARTING_RULES,
    include: localConfig.INCLUDE || {},
    exclude: localConfig.EXCLUDE || {},
    dimmerStates: localConfig.MANUAL_FADE_STEPS,
  }
  if (config.ALIASES[orbID]) {
    info.alias = config.ALIASES[orbID]
  }
  response.end(JSON.stringify(info))
  return true
})

// Get zip of all logs
addGETListener(async (response, orbID, filePath)=>{
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
    console.log("Error sending log files for " + orbID, error)
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

// Serve actual controller
// Important that this goes last
addGETListener(async (response, orbID, filePath) => {
  if(filePath.includes(".")) return

  if (filePath == "") { // Home page is same as controller now
    respondWithFile(response, "/controller/controller.html")
    return true
  }
  if (!connectedOrbs[orbID]) {
    // Redirect to home page
    response.writeHead(302 , {
        'Location' : '/'
    })
    response.end()
    return true
  }

  let originalOrbID = filePath.split("/")[1].toLowerCase()
  if (config.ALIASES[originalOrbID]) {
    // Always redirect to use alias
    response.writeHead(302 , {
        'Location' : '/' + config.ALIASES[orbID]
    })
    response.end()
  } else {
    respondWithFile(response, "/controller/controller.html")
  }
  return true
})

// Process notification of git update
addPOSTListener(async (response, body) => {
  try {
    // Ignore weird extra POST requests
    if (body.startsWith("0x")) return false
    let payload
    try {
      payload = JSON.parse(body)
    } catch(_) {
      return false
    }
    if (payload.ref !== 'refs/heads/master')
      return false

    // TODO also check secret: config.WEBHOOK_SECRET
    response.writeHead(200)
    response.end('post received')

    for (let orbID in connectedOrbs) {
      let socket = connectedOrbs[orbID]
      socket.send("GIT_HAS_UPDATE")
    }
    pullAndRestart()
    return true
  } catch(e) {
    console.log("POST data didn't parse as JSON", e)
    console.log("POST body:", body)
    response.writeHead(500)
    response.end('error parsing json')
  }
})

loadOrbInfoCache()