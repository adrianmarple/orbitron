#!/usr/bin/env node
const http = require('http')
const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')
const { noCorsHeader } = require('../lib')
const fetch = require("node-fetch")

// Imports from .env
console.log(require('dotenv').config())

SVG_SCALE = 2.83464566929 // Sigh. OpenSCAD appears to be importing .svg files as 72 DPI

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

execute("npm run serve") // Run vue server
let printerIP = process.env.PRINTER_IP
execute(`arp -a | grep "${process.env.PRINTER_MAC}"`).then(line => {
  if (!line) return
  let match = line.match(/\(([\d\.]*)\)/)
  if (!match) return
  printerIP = match[1]
  console.log(printerIP)
})

const postListeners = []
const getListeners = []

function addPOSTListener(callback){
  postListeners.push(callback)
}
function addGETListener(callback){
  getListeners.push(callback)
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
  filePath = filePath.replace("%20", " ")
  filePath = `${__dirname}${filePath}`
  let contentType = getContentType(filePath)
  let stream = fs.createReadStream(filePath);
  stream.on('open', function () {
    noCorsHeader(response, contentType)
    stream.pipe(response);
  })
  stream.on('error', function () {
    response.setHeader('Content-Type', 'text/plain');
    response.statusCode = 404;
    response.end('Not found');
  })
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

  if (request.method === 'GET') {
    for (let listener of getListeners) {
      let result = await listener(response, request)
      if (result) return
    }
    respondWithFile(response, request.url)
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

MANUFACTURING_FOLDER = "Dropbox/LumatronManufacturing/" // Move to .env?
MANUFACTURING_FOLDER = path.join(process.env.HOME, MANUFACTURING_FOLDER)

addGETListener((response, request) => {
  if (request.url.endsWith("masterkey")) {
    noCorsHeader(response, 'text/plain')
    response.end(process.env.MASTER_KEY, 'utf-8')
    return true
  } else {
    return false
  }
})
addGETListener(async (response, request) => {
  if (request.url.endsWith("commits")) {
    noCorsHeader(response, 'text/plain')
    let log = await execute("git log --pretty=format:'%H'")
    let commits = log.split("\n")
    response.end(JSON.stringify(commits))
    return true
  } else {
    return false
  }
})
addGETListener(async (response, request) => {
  if (request.url.endsWith(".pixels")) {
    noCorsHeader(response, 'text/plain')
    filePath = `${__dirname}${request.url}`
    filePath = filePath.replace(".pixels", ".png")
    let pixels = await new Promise(resolve => {
      require("get-pixels")(filePath, (err, pixels) => resolve(pixels))
    })
    response.end(JSON.stringify(pixels))
    return true
  } else {
    return false
  }
})

addPOSTListener(async (response, body) => {
  if (body && body.type == "download") {
    let filePath
    if (body.fileName.endsWith(".json")) {
      filePath = "../pixels/"
    } else {
      filePath = MANUFACTURING_FOLDER
    }
    let dirPath = filePath + body.fileName.split("/")[0]
    if (!fs.existsSync(dirPath)) {
      await fs.promises.mkdir(dirPath)
    }
    filePath += body.fileName
    await fs.promises.writeFile(filePath, body.data)
    response.writeHead(200)
    response.end('post received')
    return true
  }
})

async function fleshOutBody(body) {
  let heirarchy = body.fullProjectName.split("/")
  let filePath = MANUFACTURING_FOLDER
  let dirPath = filePath + heirarchy[0]
  let tempDirPath = dirPath + "/temp"
  if (!fs.existsSync(dirPath)) {
    await fs.promises.mkdir(dirPath)
  }
  if (!fs.existsSync(tempDirPath)) {
    await fs.promises.mkdir(tempDirPath)
  }
  body.fileName = heirarchy.last()
  body.fullPath = filePath + body.fullProjectName
  body.tempPath = tempDirPath + "/" + body.fileName
}

function replaceScadVariable(content, variable, value) {
  let regex = new RegExp(variable + " = .+;")
  return content.replace(regex, `${variable} = ${value};`)
}

addPOSTListener(async (response, body) => {
  if (!body || body.type != "qr") return false

  response.writeHead(200)
  response.end('post received')

  await fleshOutBody(body)
  console.log("Downloading png")
  await fs.promises.writeFile(MANUFACTURING_FOLDER + "qr.png", body.data, 'base64')
  console.log("Converting to bmp")
  await execute(`sips -s format bmp ${MANUFACTURING_FOLDER}qr.png --out ${MANUFACTURING_FOLDER}qr.bmp`)
  console.log("Tracing to create svg")
  await execute(`${process.env.POTRACE} ${MANUFACTURING_FOLDER}qr.bmp -s`)

  console.log("Generating stl")
  let thickness = 0.4
  let scadContents = (await fs.promises.readFile("scad/boxtop3D.scad")).toString()
  console.log(scadContents)
  scadContents = replaceScadVariable(scadContents, "thickness", thickness)
  scadContents = replaceScadVariable(scadContents, "SCALE", body.scale * 2.83464566929)
  scadContents = replaceScadVariable(scadContents, "svg_file", `"${MANUFACTURING_FOLDER}qr.svg"`)
  scadContents = replaceScadVariable(scadContents, "frame_file", `"${MANUFACTURING_FOLDER}scad/qrframe.svg"`)
  await fs.promises.writeFile(MANUFACTURING_FOLDER + "qr.scad", scadContents)

  let stlFilePath = MANUFACTURING_FOLDER + body.fullProjectName + "_qr.stl"
  await execute(`openscad -o "${stlFilePath}" "${MANUFACTURING_FOLDER}qr.scad"`)
  if (body.PROCESS_STOP == "stl") return true

  console.log("Generating gcode")
  let gcodeFilePath = MANUFACTURING_FOLDER + body.fullProjectName + "_qr.gcode"
  await execute(`${process.env.SLICER} -g --load box_top_config${body.PETG ? "_petg" : ""}.ini "${stlFilePath}" --output ${gcodeFilePath}`)
  let gcodeContents = (await fs.promises.readFile(gcodeFilePath)).toString()
  let [x,y] = (thickness + 0.2).toFixed(1).split(".")
  let regex = new RegExp(`;Z:${x}\\.${y}.*?G1 E-\\.16 F2100`, "s")

  let chunkToReplace = gcodeContents.match(regex)[0]
  if (chunkToReplace.length < 1000) {
    let chunkLines = chunkToReplace.split("\n")
    chunkLines.pop()
    chunkLines = chunkLines.concat(["M600", "G1 E0.3 F1500"]) // Color change
    gcodeContents = gcodeContents.replace(chunkToReplace, chunkLines.join("\n"))
    await fs.promises.writeFile(gcodeFilePath, gcodeContents)
  }
  
  console.log("Uploading gcode")
  let gcodePrinterFile = body.fullProjectName.split("/")[1] + "_qr.gcode"
  await execute(`curl -X DELETE 'http://${printerIP}/api/v1/files/usb/${gcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}'`)
  let resp = await execute(`curl -X PUT 'http://${printerIP}/api/v1/files/usb/${gcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}' -T ${gcodeFilePath}`)
  console.log(resp)
  console.log("All Done!")
  return true
})

addPOSTListener(async (response, body) => {
  if (!body || body.type != "gcode") return false
  await fleshOutBody(body)

  for (let i = 0; i < body.prints.length; i++) {
    let print = body.prints[i]
    print.index = i
    await generateGCode(body, print)
    console.log("Done " + i)
  }
  response.writeHead(200)
  response.end('post received')
  console.log("All Done!")
  return true
})

async function generateGCode(info, print) {
  info.svgIndex = 0
  if (print.suffix) {
    info.fullSuffix = print.suffix
  } else {
    info.fullSuffix = info.suffix + print.index
  }

  let scadFilePath = `${info.tempPath}_${info.fullSuffix}.scad`
  let stlFilePath = `${print.temp ? info.tempPath: info.fullPath}_${info.fullSuffix}.stl`.replace(" ", "_")
  let bgcodeFilePath = `${info.tempPath}_${info.fullSuffix}.bgcode`.replace(" ", "_")
  let bgcodePrinterFile = `${info.tempPath}_${info.fullSuffix}.bgcode`

  let scadFileContents = `
  $fn=32;
  module wedge(angle, width, thickness, skew) {
      M = [[1, 0, 0, 0],
           [-skew, 1, 0, 0],
           [0, 0, 1, 0],
           [0, 0, 0, 1]];
      x = angle < 0 ? thickness : 0;
      y = -tan(angle) * thickness * (angle < 0 ? 1 : -1);
      rotate(a=-90, v=[0,0,1])
      multmatrix(M)
      rotate(a=-90, v=[0,1,0])
      linear_extrude(width, center=true)
      polygon([[0,0], [thickness, 0], [x, y]]);
  }

  module led_support(width, thickness, height, gap) {
    union() {
      translate([0, (gap + thickness) / 2, height / 2])
      cube([width, thickness, height], center=true);

      translate([0, -(gap + thickness) / 2, height / 2])
      cube([width, thickness, height], center=true);
    }
  }

  module qt_clip() {
    rotate(v=[1,0,0], a=-90) 
    translate([-6,-6,-1])
    linear_extrude(height = 1)
    scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
    import("../../qtclip.svg");
  }

  module innerwall_bit(thickness, is_female) {
    translate([-6.5,-20,0])
    linear_extrude(height = thickness)
    scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
    import(is_female ? "../../innerwall_female.svg" : "../../innerwall_male.svg");
  }
`
  scadFileContents += await generateModule(info, print)

  console.log("Making .scad " + info.fullSuffix)
  await fs.promises.writeFile(scadFilePath, scadFileContents)

  console.log("Generating .stl " + info.fullSuffix)
  await execute(`openscad -o "${stlFilePath}" "${scadFilePath}"`)
  if (info.PROCESS_STOP == "stl" || print.temp) return stlFilePath

  console.log("Generating .bgcode " + info.fullSuffix)
  let config = "wall_config" + (info.INFILL_100 ? "_infill100" : "") + ".ini"
  await execute(`${process.env.SLICER} -g --load ${config} "${stlFilePath}" --output ${bgcodeFilePath}`)
  
  console.log("Uploading .bgcode " + info.fullSuffix)
  await execute(`curl -X DELETE 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}'`)
  await execute(`curl -X PUT 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}' -T ${bgcodeFilePath}`)
  if (info.PROCESS_STOP == "upload") return stlFilePath
}

async function generateModule(info, module) {
  let moduleString = ""
  if (module.position) {
    moduleString += `
      translate([${module.position}])`
  }
  if (module.rotationAngle) {
    moduleString += `
      rotate(a=${module.rotationAngle * 180/Math.PI}, v=[0,0,1])`
  }
  if (module.operations) {
    for (let operation of module.operations.reverse()) {
      switch (operation.type) {
        case "translate":
          moduleString += `
          translate([${operation.position}])`
          break
        case "rotate":
          moduleString += `
          rotate(a=${operation.angle * 180/Math.PI}, v=[${operation.axis}])`
          break
        case "scale":
          moduleString += `
          scale([${operation.scale}, ${operation.scale}, ${operation.scale}])`
          break
        case "mirror":
          moduleString += `
          mirror([${operation.normal}])`
          break
        case "matrix3":
          let M = operation.M
          moduleString += `
          multmatrix([
            [${M[0]}, ${M[3]}, ${M[6]}, 0],
            [${M[1]}, ${M[4]}, ${M[7]}, 0],
            [${M[2]}, ${M[5]}, ${M[8]}, 0],
            [0,          0,           0,         1]
          ])`
          break
      }
    }
  }

  switch (module.type) {
    case "union":
    case "difference":
      moduleString += `
      ${module.type}() {`
      for (let component of module.components) {
        moduleString += await generateModule(info, component)
      }
      moduleString += `
      }`
      break
    case "svg":
      let svgFilePath = `${info.tempPath}_${info.fullSuffix}${info.svgIndex}.svg`
      if (module.type == "svg") {
        info.svgIndex += 1
        await fs.promises.writeFile(svgFilePath, module.svg, {encoding:'utf8',flag:'w'})
      }
      moduleString += `
      linear_extrude(height = ${module.thickness})
      scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
      import("${svgFilePath}");`
      break
    case "wedge":
      let skew = module.skew || 0
      moduleString += `
      wedge(${module.angle * 180/Math.PI}, ${module.width}, ${module.thickness}, ${skew});`
      break
    case "ledSupport":
      moduleString += `
      led_support(${module.width}, ${module.thickness}, ${module.height}, ${module.gap});`
      break
    case "nub":
      moduleString += `
      cylinder(r=${module.width/2}, h=${module.height});`
      break
    case "cube":
      moduleString += `
      cube([${module.dimensions}], center=true);`
      break
    case "embossing":
      let valign = module.valign || "center"
      let halign = module.halign || "center"
      moduleString += `
      linear_extrude(0.2)
      text("${module.text}", size=4, valign="${valign}", halign="${halign}");`
      break
    case "qtClip":
      moduleString += `
      qt_clip();`
      break
    case "innerwallbit":
      moduleString += `
      innerwall_bit(${module.thickness}, ${module.isFemale});`
      break
  }
  return moduleString
}

addPOSTListener(async (response, body) => {
  if (!body || body.type != "cleanup") return false

  let name = body.fullProjectName.split("/")[1].toLowerCase()

  let fileData = await (await fetch(`http://${printerIP}/api/v1/files/usb`, {
    headers: { "X-Api-Key": process.env.PRINTER_LINK_API_KEY},
  })).json()

  console.log(`Cleaning up "${name}" files`)
  for (let {display_name} of fileData.children) {
    if (display_name.toLowerCase().startsWith(name)) {
      execute(`curl -X DELETE 'http://${printerIP}/api/v1/files/usb/${encodeURIComponent(display_name)}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}'`)
        .then(() => console.log(`Deleted ${display_name}`))
    }
  }
  return true
})


addGETListener((response, request) => {
  if (request.url.endsWith("buttonlist.json")) {
    noCorsHeader(response, 'text/plain')
    response.end(JSON.stringify(buttonUrls), 'utf-8')
    return true
  } else {
    return false
  }
})

let buttonUrls = []
async function findAllButtons() {
  // TODO: Log diff when there's a change
  buttonUrls = []
  const folderNames = (await fs.promises.readdir("./projects/", { withFileTypes: true }))
      .filter(file => file.isDirectory())
      .map(directory => directory.name)
  for (const dirName of folderNames) {
    const jsFiles = (await fs.promises.readdir("./projects/" + dirName))
        .filter(name => name.endsWith(".js"))
    for (const fileName of jsFiles) {
      let fullName = dirName + "/" + fileName.slice(0,-3)
      let path = "projects/" + fullName + ".js"
      let fileContents = (await fs.promises.readFile(path)).toString()
      if (fileContents.includes("SKIP")) continue
      buttonUrls.push(fullName)
    }
  }
  buttonUrls = buttonUrls.sort()
}
findAllButtons()
setInterval(findAllButtons, 10 * 1000)

openRootServer()
