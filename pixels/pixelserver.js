#!/usr/bin/env node
const http = require('http')
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
  // console.log(filePath, extname, contentType)
  return contentType
}

function respondWithFile(response, filePath) {
  filePath = `${__dirname}${filePath}`
  let contentType = getContentType(filePath)
  fs.readFile(filePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT'){
        response.writeHead(404)
        response.end(`Nothing found at ${filePath}. Check the URL or refresh the page to try again.`, 'utf-8')
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
  // POST stuff
  if (request.method === 'POST') {
    let rawbody = ''
    request.on('data', function(data) {
      rawbody += data
    })
    request.on('end', async function() {
      let body
      // try {
        body = JSON.parse(rawbody)
      // } catch {}
      let handled = false
      for (const listener of postListeners) {
        handled = await listener(response, body, rawbody)
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
  } else {
    queryParams = []
  }
  if(filePath.endsWith('/'))
    filePath = filePath.substring(0,filePath.length-1)
  let handled = false
  for (const listener of getListeners) {
    handled = await listener(response, filePath, queryParams)
    if(handled) break
  }
  if(!handled){
    respondWithFile(response, filePath)
  }
}

let rootServer
let PORT = 8000
async function openRootServer() {
  await closeRootServer()
  rootServer = http.createServer(serverHandler)
  rootServer.listen(PORT, "0.0.0.0",() => {
    console.log("Root server listening on port " + PORT)
  })
}

async function closeRootServer() {
  return new Promise((resolve) => {
    if(rootServer){
      rootServer.closeAllConnections()
      rootServer.close(() => {
        rootServer = null
        resolve()
      })
    } else {
      resolve()
    }
  })
}

addPOSTListener(async (response, body) => {
  if (body && body.type == "download") {
    let filePath = ""
    if (!body.fileName.endsWith(".json")) {
      filePath = path.join(process.env.HOME, "Dropbox/Orbitron Manufacturing/")
      let dirPath = filePath + body.fileName.split("/")[0]
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath)
      }
    }
    filePath += body.fileName
    console.log(filePath)
    await fs.promises.writeFile(filePath, body.data)
    response.writeHead(200)
    response.end('post received')
    return true
  }
})

addGETListener((response, filePath) => {
  if (filePath == "" || filePath == "pixels.html") {
    respondWithFile(response, "/website/pixels.html")
    return true
  }
})
addGETListener((response, filePath) => {
  if (filePath == "/buttonUrls.json") {
    response.writeHead(200, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify(buttonUrls), 'utf-8')
    return true
  }
})

let buttonUrls = []
async function findAllButtons() {
  buttonUrls = []
  const folderNames = (await fs.promises.readdir(".", { withFileTypes: true }))
      .filter(file => file.isDirectory())
      .map(directory => directory.name)
  for (const dirName of folderNames) {
    if (dirName == "website") continue
    const jsFiles = (await fs.promises.readdir("./" + dirName))
        .filter(name => name.endsWith(".js"))
    for (const fileName of jsFiles) {
      let path = dirName + "/" + fileName
      let fileContents = (await fs.promises.readFile(path)).toString()
      if (fileContents.includes("SKIP")) continue
      if (!fileContents.includes("addButton")) continue

      console.log(fileName)
      let replacement = `addButton("${path.slice(0,-3)}"`
      fileContents = fileContents.replace(/addButton\(\"(.*)\"/, replacement)
      fs.promises.writeFile(path, fileContents)
      buttonUrls.push(path)
    }
  }
  buttonUrls = buttonUrls.sort()
}

findAllButtons()
// setInterval(findAllButtons, 10 * 1000)

openRootServer()
