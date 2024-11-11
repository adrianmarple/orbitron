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
  body.fileName = heirarchy[heirarchy.length - 1]
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
  if (body.PROCESS_STOP == "scad") return true

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
  if (body.PROCESS_STOP == "bgcode") return true
  
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

// async function generateGCode(info, print) {
//   index += 1
//   print.wedges = print.wedges ?? []
//   print.ledSupports = print.ledSupports ?? []
//   print.nubs = print.nubs ?? []
//   print.embossings = print.embossings ?? []
//   print.qtClips = print.qtClips ?? []

//   if (info.prints.length == 1) {
//     index = ""
//   }
//   function svgFilePath(svg) {
//     let svgIndex = print.svgs.indexOf(svg)
//     if (print.svgs.length == 1) {
//       svgIndex = ""
//     }
//     return `${info.tempPath}${index}_${info.suffix}${svgIndex}.svg`
//   }
//   let scadFilePath = `${info.tempPath}${index}_${info.suffix}.scad`
//   let stlFilePath = `${print.temp ? info.tempPath: info.fullPath}${index}_${info.suffix}.stl`.replace(" ", "_")
//   let bgcodeFilePath = `${info.tempPath}${index}_${info.suffix}.bgcode`.replace(" ", "_")
//   let bgcodePrinterFile = `${info.tempPath}${index}_${info.suffix}.bgcode`

//   for (let svg of print.svgs) {
//     await fs.promises.writeFile(svgFilePath(svg), svg.svg, {encoding:'utf8',flag:'w'})
//   }

//   let scadFileContents = `
//   $fn=32;
//   module wedge(angle, direction_angle, width, thickness) {
//       x = angle < 0 ? thickness : 0;
//       y = -tan(angle) * thickness * (angle < 0 ? 1 : -1);
//       rotate(a=direction_angle- 90, v=[0,0,1])
//       rotate(a=-90, v=[0,1,0])
//       linear_extrude(width, center=true)
//       polygon([[0,0], [thickness, 0], [x, y]]);
//   }

//   module led_support(width, thickness, height, gap) {
//     union() {
//       translate([0, (gap + thickness) / 2, height / 2])
//       cube([width, thickness, height], center=true);

//       translate([0, -(gap + thickness) / 2, height / 2])
//       cube([width, thickness, height], center=true);
//     }
//   }

//   module qt_clip() {
//     rotate(v=[1,0,0], a=-90) 
//     translate([-6,-6,-1])
//     linear_extrude(height = 1)
//     scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
//     import("../qtclip.svg");
//   }

//   difference() {
//   union() {`
//     for (let wedge of print.wedges) {
//       scadFileContents += `
//       translate([${wedge.position}])
//       wedge(${wedge.angle}, ${wedge.directionAngle}, ${wedge.width}, ${wedge.thickness});`
//     }
//     for (let support of print.ledSupports) {
//       scadFileContents += `
//       translate([${support.position}])
//       rotate(a=${support.rotationAngle}, v=[0,0,1])
//       led_support(${support.width}, ${support.thickness}, ${support.height}, ${support.gap});`
//     }
//     for (let embossing of print.embossings) {
//       scadFileContents += `
//       translate([${embossing.position}])
//       translate([-5,-2.5,0])
//       linear_extrude(0.2)
//       text("${embossing.text}", size= 5);`
//     }
//     for (let nub of print.nubs) {
//       scadFileContents += `
//       translate([${nub.position}])
//       cylinder(r=${nub.width/2}, h=${nub.height});`
//     }
//     for (let qtClips of print.qtClips) {
//       scadFileContents += `
//       translate([${qtClips.position}])
//       qt_clip();`
//     }

//     for (let svg of print.svgs) {
//       if (svg.negative) continue
//       if (svg.position) {
//         scadFileContents += `
//       translate([${svg.position}])`
//       }
//       scadFileContents += `
//       linear_extrude(height = ${svg.thickness})
//       scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
//       import("${svgFilePath(svg)}");`
//     }
//     scadFileContents += `
//   }`
//     for (let svg of print.svgs) {
//       if (!svg.negative) continue
//       if (svg.position) {
//         scadFileContents += `
//       translate([${svg.position}])`
//       }
//       scadFileContents += `
//       linear_extrude(height = ${svg.thickness})
//       scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
//       import("${svgFilePath(svg)}");`
//     }
//     scadFileContents += `
//   }`
//   console.log("Making .scad " + index)
//   await fs.promises.writeFile(scadFilePath, scadFileContents)

//   console.log("Generating .stl " + index)
//   await execute(`openscad -o "${stlFilePath}" "${scadFilePath}"`)
//   if (info.PROCESS_STOP == "stl" || print.temp) return stlFilePath

//   console.log("Generating .bgcode " + index)
//   let config = "wall_config" + (info.INFILL_100 ? "_infill100" : "") + ".ini"
//   await execute(`${process.env.SLICER} -g --load ${config} "${stlFilePath}" --output ${bgcodeFilePath}`)
  
//   console.log("Uploading .bgcode " + index)
//   await execute(`curl -X DELETE 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}'`)
//   await execute(`curl -X PUT 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}' -T ${bgcodeFilePath}`)
//   if (info.PROCESS_STOP == "upload") return stlFilePath
// }


async function generateGCode(info, print) {
  let index = print.index

  let scadFilePath = `${info.tempPath}${index}_${info.suffix}.scad`
  let stlFilePath = `${print.temp ? info.tempPath: info.fullPath}${index}_${info.suffix}.stl`.replace(" ", "_")
  let bgcodeFilePath = `${info.tempPath}${index}_${info.suffix}.bgcode`.replace(" ", "_")
  let bgcodePrinterFile = `${info.tempPath}${index}_${info.suffix}.bgcode`

  let scadFileContents = `
  $fn=32;
  module wedge(angle, direction_angle, width, thickness, skew) {
      M = [[1, 0, 0, 0],
           [-skew, 1, 0, 0],
           [0, 0, 1, 0],
           [0, 0, 0, 1]];
      x = angle < 0 ? thickness : 0;
      y = -tan(angle) * thickness * (angle < 0 ? 1 : -1);
      rotate(a=direction_angle- 90, v=[0,0,1])
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
    import("../qtclip.svg");
  }
`
  if (print.modules) {
    let moduleIndex = 0
    for (let module of print.modules) {
      module.index = moduleIndex
      scadFileContents += `
  module module${module.index}() {`

      switch(module.type) {
        case "union":
          scadFileContents += generateUnionModule(module)
          break
        default:
          scadFileContents += await generateLeafModule(info, module)
      }
      scadFileContents += `
  }
  `
      moduleIndex += 1
    }
    scadFileContents += `module${moduleIndex - 1}();`
  } else {
    scadFileContents += await generateLeafModule(info, print)
  }

  console.log("Making .scad " + index)
  await fs.promises.writeFile(scadFilePath, scadFileContents)

  console.log("Generating .stl " + index)
  await execute(`openscad -o "${stlFilePath}" "${scadFilePath}"`)
  if (info.PROCESS_STOP == "stl" || print.temp) return stlFilePath

  console.log("Generating .bgcode " + index)
  let config = "wall_config" + (info.INFILL_100 ? "_infill100" : "") + ".ini"
  await execute(`${process.env.SLICER} -g --load ${config} "${stlFilePath}" --output ${bgcodeFilePath}`)
  
  console.log("Uploading .bgcode " + index)
  await execute(`curl -X DELETE 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}'`)
  await execute(`curl -X PUT 'http://${printerIP}/api/v1/files/usb/${bgcodePrinterFile}' -H 'X-Api-Key: ${process.env.PRINTER_LINK_API_KEY}' -T ${bgcodeFilePath}`)
  if (info.PROCESS_STOP == "upload") return stlFilePath
}


function generateUnionModule(module) {
  let moduleString = `
  union() {`
    for (let component of module.components) {
      for (let operation of component.operations) {
        switch (operation.type) {
          case "translate":
            moduleString += `
            translate([${operation.position}])`
            break
          case "rotate":
            moduleString += `
            rotate(a=${operation.angle}, v=[${operation.axis}])`
            break
        }
      }
      moduleString += `
      module${component.index}();`
    }
    moduleString += `
  }`
  return moduleString
}
async function generateLeafModule(info, print) {
  print.wedges = print.wedges ?? []
  print.ledSupports = print.ledSupports ?? []
  print.nubs = print.nubs ?? []
  print.embossings = print.embossings ?? []
  print.qtClips = print.qtClips ?? []

  let moduleIndex = print.index || 0
  function svgFilePath(svg) {
    let svgIndex = print.svgs.indexOf(svg)
    if (print.svgs.length == 1) {
      svgIndex = ""
    }
    return `${info.tempPath}${info.index}_${moduleIndex}_${info.suffix}${svgIndex}.svg`
  }

  for (let svg of print.svgs) {
    await fs.promises.writeFile(svgFilePath(svg), svg.svg, {encoding:'utf8',flag:'w'})
  }
  moduleString = `
  difference() {
  union() {`
    for (let wedge of print.wedges) {
      let skew = wedge.skew || 0
      moduleString += `
      translate([${wedge.position}])
      wedge(${wedge.angle}, ${wedge.directionAngle}, ${wedge.width}, ${wedge.thickness}, ${skew});`
    }
    for (let support of print.ledSupports) {
      moduleString += `
      translate([${support.position}])
      rotate(a=${support.rotationAngle}, v=[0,0,1])
      led_support(${support.width}, ${support.thickness}, ${support.height}, ${support.gap});`
    }
    for (let embossing of print.embossings) {
      moduleString += `
      translate([${embossing.position}])
      translate([-5,-2.5,0])
      linear_extrude(0.2)
      text("${embossing.text}", size= 5);`
    }
    for (let nub of print.nubs) {
      moduleString += `
      translate([${nub.position}])
      cylinder(r=${nub.width/2}, h=${nub.height});`
    }
    for (let qtClips of print.qtClips) {
      moduleString += `
      translate([${qtClips.position}])
      qt_clip();`
    }

    for (let svg of print.svgs) {
      if (svg.negative) continue
      if (svg.position) {
        moduleString += `
      translate([${svg.position}])`
      }
      moduleString += `
      linear_extrude(height = ${svg.thickness})
      scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
      import("${svgFilePath(svg)}");`
    }
    moduleString += `
  }`
    for (let svg of print.svgs) {
      if (!svg.negative) continue
      if (svg.position) {
        moduleString += `
      translate([${svg.position}])`
      }
      moduleString += `
      linear_extrude(height = ${svg.thickness})
      scale([${SVG_SCALE},${SVG_SCALE},${SVG_SCALE}])
      import("${svgFilePath(svg)}");`
    }
    moduleString += `
  }`
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
