#!/usr/bin/env node
const { config, execute } = require('./lib')
const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')

const getListeners = []
const postListeners = []

function addGETListener(callback){
  getListeners.push(callback)
}

function addPOSTListener(callback){
  postListeners.push(callback)
}

function getContentType(filePath){
  let extname = path.extname(filePath)
  let contentType = 'text/html'
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
    case '.svg':
      contentType = 'image/svg+xml'
      break;
    case '.ico':
      contentType = 'image/x-icon'
      break;
    case '.wav':
      contentType = 'audio/wav'
      break;
    case '.zip':
      contentType = 'application/zip'
  }
  //console.log(filePath, extname, contentType)
  return contentType
}

function respondWithFile(response, filePath){
  filePath = `${__dirname}${filePath}`
  let contentType = getContentType(filePath)
  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        response.writeHead(404)
        response.end(`Nothing found at ${filePath}. Either the Orb is not connected or the URL is incorrect. Check the URL or refresh the page to try again.`, 'utf-8')
      }
      else {
        response.writeHead(500)
        response.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
      }
    }
    else {
      response.writeHead(200, { 'Content-Type': contentType })
      response.end(content, 'utf-8')
    }
  });
}


async function serverHandler(request, response) {
  // Github webhook to restart pm2 after a push
  if (request.method === 'POST') {
    console.log("Receiving github webhook update.")
    let body = ''
    request.on('data', function(data) {
      body += data
    })
    request.on('end', async function() {
      console.log(body)
      let handled = false
      for (const listener of postListeners) {
        handled = await listener(response, body)
        if(handled) break
      }
      if(!handled){
        console.error("UNHANDLED SERVER POST: ", request.url)
        response.writeHead(500)
        response.end('unhandled post')
      }
    })
    return
  }

  // http GET stuff
  let [filePath, queryParams] = request.url.split("?")
  if (queryParams) {
    queryParams = queryParams.split("&")
  }
  if(filePath.endsWith('/'))
    filePath = filePath.substring(0,filePath.length-1)
  let handled = false
  let processed = filePath.split("/")
  let orbID = processed.length > 1 ? processed[1] : ''
  orbID = orbID.toLowerCase()
  for (const listener of getListeners) {
    handled = await listener(response, orbID, filePath, queryParams)
    if(handled) break
  }
  if(!handled){
    respondWithFile(response, filePath)
  }
}

const rootServerPort = config.HTTP_SERVER_PORT || 1337

let redirectServer
let rootServer
let certLastUpdatedFile = `${require('os').homedir()}/certLastUpdated.json`
if(rootServerPort == 443){
  runServerWithRedirect()
} else {
  openRootServer()
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
  await execute("pm2 restart all")
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
  addGETListener, addPOSTListener, respondWithFile
}