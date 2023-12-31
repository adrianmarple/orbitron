#!/usr/bin/env node
const { config } = require('./lib')
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


if (config.DEV_MODE) {
  rootServer = http.createServer(config, serverHandler)
} else {
  rootServer = https.createServer(config.httpsOptions, serverHandler)
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
rootServer.listen(rootServerPort, "0.0.0.0")

// redirect http to https
if(rootServerPort == 443){
  let redirectServer = http.createServer((req, res)=>{
    res.writeHead(301,{Location: `https://${req.headers.host}${req.url}`})
    res.end()
  })
  redirectServer.listen(80,"0.0.0.0")
}


module.exports = {
  addGETListener, addPOSTListener, respondWithFile
}