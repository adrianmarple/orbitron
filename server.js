#!/usr/bin/env node
const { execute, config } = require('./lib')
const { pullAndRestart } = require('./gitupdate')
const http = require('http')
const fs = require('fs')
const path = require('path')
const homedir = require('os').homedir()

const listeners = []

function addListener(callback){
  listeners.push(callback)
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
    case '.ico':
      contentType = 'image/x-icon'
      break;
    case '.wav':
      contentType = 'audio/wav'
      break;
    case '.zip':
      contentType = 'application/zip'
  }
  console.log(filePath, extname, contentType)
  return contentType
}

function respondWithFile(filePath, response){
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

// Simple HTTP server
const rootServer = http.createServer(async (request, response) => {
  // Github webhook to restart pm2 after a push
  if (request.method === 'POST') {
    console.log("Receiving github webhook update.")
    let body = ''
    request.on('data', function(data) {
      body += data
    })
    request.on('end', function() {
      console.log(body)
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
        }  
      } catch(e) {
        console.error("POST data didn't parse as JSON", e)
        response.writeHead(500)
        response.end('error parsing json')
      }
    })
    return
  }

  // http GET stuff
  let filePath = request.url
  let handled = false
  let processed = filePath.split("/")
  let orbID = processed.length > 1 ? processed[1] : ''
  for (const listener of listeners) {
    handled = await listener(orbID, filePath, response)
    if(handled) break
  }
  if(!handled){
    respondWithFile(filePath, response)
  }
})

const rootServerPort = config.HTTP_SERVER_PORT || 1337
rootServer.listen(rootServerPort, "0.0.0.0")

module.exports = {
  addListener, respondWithFile
}