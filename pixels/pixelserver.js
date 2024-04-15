#!/usr/bin/env node
const http = require('http')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')


function execute(command){
  return new Promise(resolve => {
    exec(command, (error, stdout, stderr) => {
      if(error){
        console.error("execute Error:", error, stdout, stderr)
      }
      resolve(stdout.toString() + " " + stderr.toString())
    })
  })
}

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
  let [filePath, queryParams] = decodeURI(request.url).split("?")
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
      filePath = path.join(process.env.HOME, "Dropbox/OrbitronManufacturing/")
      let dirPath = filePath + body.fileName.split("/")[0]
      if (!fs.existsSync(dirPath)) {
        await fs.promises.mkdir(dirPath)
      }
    }
    filePath += body.fileName
    await fs.promises.writeFile(filePath, body.data)
    response.writeHead(200)
    response.end('post received')
    return true
  }
})

addPOSTListener(async (response, body) => {
  console.log(body.fullProjectName)
  if (body && body.type == "gcode") {
    let filePath = path.join(process.env.HOME, "Dropbox/OrbitronManufacturing/")
    let dirPath = filePath + body.fullProjectName.split("/")[0]
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath)
    }
    body.fullProjectName = filePath + body.fullProjectName
    for (let i = 0; i < body.prints.length; i++) {
      await generateGCode(body, i) // Slic3r doesn't seem to work when running in parallel
    }
    response.writeHead(200)
    response.end('post received')
    return true
  }
})

async function generateGCode(info, index) {
  let print = info.prints[index]
  if (info.prints.length == 1) {
    index = ""
  }
  let svgFilePath = `${info.fullProjectName}${index} walls.svg`
  let scadFilePath = `${info.fullProjectName}${index} walls.scad`
  let stlFilePath = `${info.fullProjectName}${index}_walls.stl`.replace(" ", "_")

  await fs.promises.writeFile(svgFilePath, print.svg, {encoding:'utf8',flag:'w'})
  let scale = 2.83464566929 // Sigh. OpenSCAD appears to be importing the .svg as 72 DPI
  let scadFileContents = `
module wedge(angle, position, direction_angle, width, thickness) {
    pivot_z = angle < 0 ? 0 : thickness;
    actual_angle = angle < 0 ? -90 - angle : 90 - angle;
    
    translate(position)
    rotate(a=direction_angle, v=[0,0,1])
    difference() {
        translate([0, -width/2, pivot_z])
        rotate(a=actual_angle, v=[0,1,0])
        translate([0, 0, -pivot_z])
        cube([90, width, thickness]);
        
        translate([0,0,-100])
        cube([200,200,200], center=true);
        
        translate([0,0,100 + thickness])
        cube([200,200,200], center=true);
    }
}

scale([${info.EXTRA_SCALE}, 1, 1])
union() {`
for (let wedge of print.wedges) {
  scadFileContents += `
  wedge(${wedge.angle}, [${wedge.position}], ${wedge.directionAngle}, ${wedge.width}, ${wedge.thickness});`
}
scadFileContents += `

  linear_extrude(height = ${info.thickness})
  scale([${scale},${scale},${scale}])
  import("${svgFilePath}");
}
`
  console.log("Making .scad " + index)
  await fs.promises.writeFile(scadFilePath, scadFileContents)
  console.log("Generating .stl " + index)
  await execute(`openscad -o "${stlFilePath}" "${scadFilePath}"`)
  console.log("Generating .gcode " + index)

  // await execute(`/Applications/Slic3r.app/Contents/MacOS/Slic3r --load makergear2_slic3r_config.ini --rotate 90 "${stlFilePath}"`)
  let slic3rPath = "/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer"
  let suffix = info.noInputShaper ? "_noIS" : ""
  await execute(`${slic3rPath} -g --load ${info.printer}_config${suffix}.ini "${stlFilePath}"`)
  console.log("Done " + index)
}

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
  // TODO: Log diff when there's a change
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

      let replacement = `addButton("${path.slice(0,-3)}"`
      fileContents = fileContents.replace(/addButton\(\"(.*)\"/, replacement)
      fs.promises.writeFile(path, fileContents)
      buttonUrls.push(path)
    }
  }
  buttonUrls = buttonUrls.sort()
}

findAllButtons()
setInterval(findAllButtons, 10 * 1000)

openRootServer()
