#!/usr/bin/env node
const { config, execute, restartOrbitron } = require('./lib')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

// Listeners are keyed by HTTP method. Each one receives a single context object
// { response, request, method, filePath, queryParams, orbID, body, headers }
// and returns truthy to claim the request.
const listeners = {}
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function addListener(method, callback){
  method = method.toUpperCase()
  if(!listeners[method]){
    listeners[method] = []
  }
  listeners[method].push(callback)
}
function removeListener(method, callback) {
  method = method.toUpperCase()
  if(listeners[method]){
    listeners[method].remove(callback)
  }
}

function getContentType(filePath){
  let extname = path.extname(filePath)
  let contentType = 'text/html'
  switch (extname) {
    case '.js':
      contentType = 'text/javascript'
      break
    case '.css':
      contentType = 'text/css'
      break
    case '.json':
      contentType = 'application/json'
      break
    case '.png':
      contentType = 'image/png'
      break
    case '.jpg':
      contentType = 'image/jpg'
      break
    case '.svg':
      contentType = 'image/svg+xml'
      break
    case '.ico':
      contentType = 'image/x-icon'
      break
    case '.wav':
      contentType = 'audio/wav'
      break
    case '.zip':
      contentType = 'application/zip'
      break
    case '.oft':
      contentType = 'font/otf'
      break
    case '.stl':
      contentType = 'model/stl'
      break
  }
  //console.log(filePath, extname, contentType)
  return contentType
}

function respondWithFile(response, filePath, replacements){
  filePath = decodeURI(filePath)
  filePath = `${__dirname}${filePath}`
  let contentType = getContentType(filePath)
  fs.readFile(filePath, async function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        response.writeHead(404, { 'Content-Type': 'text/html' })
        response.end(await fs.promises.readFile("controller/404.html"), 'utf-8')
      }
      else {
        response.writeHead(500)
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
      }
    }
    else {
      if (replacements) {
        content = content.toString()
        for (let searchValue in replacements) {
          let replaceValue = replacements[searchValue]
          content = content.replace(searchValue, replaceValue)
        }
      }
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content, 'utf-8')
    }
  });
}

function readBody(request) {
  return new Promise(resolve => {
    let chunks = []
    request.on('data', function(data) {
      chunks.push(data)
    })
    request.on('end', function() {
      resolve(Buffer.concat(chunks))
    })
  })
}

async function serverHandler(request, response) {
  let method = request.method.toUpperCase()

  let [filePath, search] = request.url.split("?")
  let queryParams = {}
  if (search) {
    const searchParams = new URLSearchParams(search)
    for (const [key, value] of searchParams) {
      queryParams[key] = value
    }
  }
  if(filePath.endsWith('/'))
    filePath = filePath.substring(0,filePath.length-1)
  let processed = filePath.split("/")
  let orbID = processed.length > 1 ? processed[1] : ''
  orbID = orbID.toLowerCase()
  orbID = config.reverseAliases[orbID] ?? orbID

  let body = BODY_METHODS.has(method) ? await readBody(request) : null
  let context = {
    response,
    request,
    method,
    filePath,
    queryParams,
    orbID,
    body,
    headers: request.headers,
  }

  let handled = false
  for (const listener of listeners[method] ?? []) {
    handled = await listener(context)
    if(handled) break
  }
  if(handled) return

  if(method === 'GET'){
    respondWithFile(response, filePath)
  } else if (!response.writableEnded) {
    // console.log("UNHANDLED SERVER REQUEST: ", method, request.url)
    if(method === 'POST'){
      response.writeHead(500)
      response.end('unhandled post')
    } else {
      response.writeHead(405)
      response.end('method not allowed')
    }
  }
}

const rootServerPort = config.HTTP_SERVER_PORT || 1337

let redirectServer
let rootServer
let certLastUpdatedFile = `${require('os').homedir()}/certLastUpdated.json`
if(config.HAS_EMULATION || config.IS_RELAY){
  if(rootServerPort == 443){
    runServerWithRedirect()
  } else {
    openRootServer()
  }
}

async function runServerWithRedirect(){
  let certUpdateTime = Date.now()
  if(fs.existsSync(certLastUpdatedFile)){
    let json = JSON.parse(fs.readFileSync(certLastUpdatedFile).toString())
    certUpdateTime = json.time + 1000 * 60 * 60 * 24 * 10 // try every 10 days
  }
  let delay = certUpdateTime - Date.now()
  if(delay <= 0){
    await updateCert()
  } else {
    setTimeout(updateCert, delay)
    await openRootServer()
    await openRedirectServer()
  }
}

async function updateCert(){
  console.log("UPDATING SSL CERT")
  await closeRootServer()
  await closeRedirectServer()
  let result = (await execute("certbot renew"))
  console.log("Certbot renew output: ", result)
  let lastUpdated = {
    time: Date.now()
  }
  fs.writeFileSync(certLastUpdatedFile, JSON.stringify(lastUpdated))
  console.log("RESTARTING AFTER CERT UPDATE")
  await restartOrbitron()
}

async function openRootServer(){
  await closeRootServer()
  if (config.DEV_MODE) {
    rootServer = http.createServer(config, serverHandler)
  } else {
    rootServer = https.createServer(config.httpsOptions, serverHandler)
  }
  rootServer.listen(rootServerPort, "0.0.0.0",()=>{console.log("Root server listening on port " + rootServerPort)})
}

async function closeRootServer(){
  return new Promise((resolve, reject) =>{
    if(rootServer){
      rootServer.closeAllConnections()
      rootServer.close(()=>{
        rootServer = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}

async function openRedirectServer(){
  await closeRedirectServer()
  redirectServer = http.createServer((req, res)=>{
    res.writeHead(301,{Location: `https://${req.headers.host}${req.url}`})
    res.end()
  })
  redirectServer.listen(80,"0.0.0.0",()=>{console.log("Redirect server listening on port 80")})
}

async function closeRedirectServer(){
  return new Promise((resolve, reject) =>{
    if(redirectServer){
      redirectServer.closeAllConnections()
      redirectServer.close(()=>{
        redirectServer = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}


module.exports = {
  addListener, removeListener, respondWithFile
}