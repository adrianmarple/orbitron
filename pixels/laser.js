let BOTTOM_THICKNESS = 5
let TOP_THICKNESS = 2.9
let WALL_THICKNESS = 2.35
let BORDER = 6
let DEFAULT_PIXEL_DIST = 16.6
let PIXEL_DISTANCE = DEFAULT_PIXEL_DIST
let CHANNEL_WIDTH = 12
let CHANNEL_DEPTH = 10
let HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
let NOTCH_DEPTH = 5
let FASTENER_DEPTH = 3

let WOOD_KERF = 0.14
let ACRYLIC_KERF = -0.06 // Use for hex cat recut


let MM_TO_96DPI = 3.77952755906
// MM_TO_96DPI = 1

BOTTOM_THICKNESS *= MM_TO_96DPI
TOP_THICKNESS *= MM_TO_96DPI
WALL_THICKNESS *= MM_TO_96DPI
BORDER *= MM_TO_96DPI
DEFAULT_PIXEL_DIST *= MM_TO_96DPI
PIXEL_DISTANCE *= MM_TO_96DPI
CHANNEL_WIDTH *= MM_TO_96DPI
CHANNEL_DEPTH *= MM_TO_96DPI
HEIGHT *= MM_TO_96DPI
NOTCH_DEPTH *= MM_TO_96DPI
FASTENER_DEPTH *= MM_TO_96DPI
WOOD_KERF *= MM_TO_96DPI
ACRYLIC_KERF *= MM_TO_96DPI
let KERF = ACRYLIC_KERF

let BALSA_LENGTH = 96*11.77 // A little more than 11 3/4 inches
let WALL_SVG_PADDING = 24
let WALL_SVG_GAP = 6

let minimalInnerBorder = false

let resetOG = reset
reset = () => {
  resetOG()
  minimalInnerBorder = false
}

const svgStyle = document.createElement("style")
document.head.appendChild(svgStyle)
svgStyle.innerHTML = `
svg {
  position: absolute;
  top: 0;
  left: 0;
}
svg text {
  font-size: 20px;
  fill: white;
  transform-box: fill-box;
  transform: scaleY(-1) translate(-5px, -29px);
}`

let wall = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.body.appendChild(wall)
wall.outerHTML = `
<svg id="wall" width=1000 height=100 viewBox="0 0 1000 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path stroke="#808080"/>
</svg>`
wall = document.getElementById("wall")

let cover = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.body.appendChild(cover)
cover.outerHTML = `
<svg id="cover" width=1000 height=1000 viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scaleY(-1)">
  <path stroke="#808080"/>
</svg>`
cover = document.getElementById("cover")


document.getElementById("download").addEventListener('click', function() {
  if (isWall) {
    KERF = ACRYLIC_KERF
    createCoverSVG()
    downloadSVGAsText("cover", "top (acrylic)")
    KERF = WOOD_KERF
    createCoverSVG()
    downloadSVGAsText("cover", "bottom (birch plywood)")

    createWallSVG()
    downloadSVGAsText("wall", "walls (balsa wood)")
  }
})

setTimeout(() => {
  console.log(document.querySelectorAll(".button"))
  document.querySelectorAll(".button").forEach(elem => elem.addEventListener('click', function() {
    setTimeout(() => {
      document.querySelectorAll("path").forEach(path => path.setAttribute('d', ""))
      cover.querySelectorAll("text").forEach(elem => cover.removeChild(elem))
      if (isWall) {
        createCoverSVG()
        // createWallSVG()
      }
    }, 100)
  }))
}, 100)

let wallInfo = []
let maxX = 0
let maxY = 0

async function createCoverSVG() {
  maxX = 0
  maxY = 0
  console.log("creating svgs")

  // Gather paths

  let paths = []
  let directedEdges = []
  for (let index of path) {
    let edge = edges[index]
    if (edge.isDupe) continue;
    directedEdges.push([edge.verticies[0], edge.verticies[1]])
    directedEdges.push([edge.verticies[1], edge.verticies[0]])
  }

  while (directedEdges.length > 0) {
    let lastEdge = directedEdges.pop()
    let dPath = [...lastEdge]

    while (dPath[0] != dPath[dPath.length - 1]) {
      let e0 = delta(dPath[dPath.length-1].ogCoords, dPath[dPath.length-2].ogCoords)
      let leftmostTurn = null
      let minAngle = 7
      for (let dEdge of directedEdges) {
        let [v0, v1] = dEdge
        if (dPath[dPath.length - 1] != v0) continue

        let e1 = delta(v1.ogCoords, v0.ogCoords)
        let a = signedAngle(e1, e0)
        if (epsilonEquals(Math.abs(a), Math.PI)) continue
        if (a < minAngle) {
          minAngle = a
          leftmostTurn = dEdge
        }
      }
      if (leftmostTurn == null) {
        console.error("Path deadend!")
        break
      }
      directedEdges.splice(directedEdges.indexOf(leftmostTurn), 1)
      if (epsilonEquals(minAngle, 0)) {
        dPath.pop() // Join edges if the path is straight
      }
      dPath.push(leftmostTurn[1])
    }
  	dPath.pop() // Remove duplicated first/last vertex

    // Start and end might be straight still
    e0 = delta(dPath[0].ogCoords, dPath[dPath.length-1].ogCoords)
    e1 = delta(dPath[1].ogCoords, dPath[0].ogCoords)
    if (epsilonEquals(signedAngle(e1, e0), 0)) {
      dPath.shift() // Remove middle (start) vertex if start and end is straight
    }

    paths.push(dPath)
  }
  paths.sort((a,b) => b.length - a.length)

  // Draw border and channels
  wallInfo = []

  let offsetX = 0;
  let offsetY = 0;
  for (let v of verticies) {
  	offsetX = Math.min(offsetX, v.ogCoords[0])
  	offsetY = Math.min(offsetY, v.ogCoords[1])
  }
  const SCALE = PIXEL_DISTANCE / pixelDensity
  let offset = [2 - offsetX, 2 - offsetY, 0]

  let start = startVertex().ogCoords
  let penultimate = penultimateVertex().ogCoords
  let finalEdgeDirection = normalize(delta(penultimate, start))

  let totalPathString = ""
  for (let dPath of paths) {
    let channelString = ""
  	let borderString = ""
  	let minimalBorderString = ""
    
   	for (let i = 0; i < dPath.length; i++) {
  	  let v0 = dPath[i].ogCoords
  	  let v1 = dPath[(i+1) % dPath.length].ogCoords
  	  let v2 = dPath[(i+2) % dPath.length].ogCoords
  	  let v3 = dPath[(i+3) % dPath.length].ogCoords
  	  let e0 = delta(v1, v0)
  	  let e1 = delta(v2, v1)
  	  let e2 = delta(v3, v2)

      let a1 = signedAngle(e1, e0)
      let a2 = signedAngle(e1, e2)

      let edgeLength = magnitude(e1)
      e1 = scale(e1, 1/edgeLength)
      edgeLength *= SCALE
      let n = cross(e1, [0,0,-1])
      let width = CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER
      let lengthOffset = width / -Math.tan((Math.PI - a1)/2)
      let localOffset = scale(add(v1, offset), SCALE)

      // Border
      let points = [[lengthOffset, width]]
      borderString += pointsToSVGString(points, [e1, n], localOffset)

      // Channels
      let w1 = CHANNEL_WIDTH/2
      let w2 = w1 + WALL_THICKNESS
      let lengthOffset1 = -1 / Math.tan((Math.PI - a1)/2)
      if (a1 > 0) {
        lengthOffset1 *= w1
      } else {
        lengthOffset1 *= w2
      }
      let lengthOffset2 = -1 / Math.tan((Math.PI - a2)/2)
      if (a2 < 0) {
        lengthOffset2 *= w1
      } else {
        lengthOffset2 *= w2
      }
      w1 += KERF
      w2 -= KERF

      // Extra gap for strip to enter in
      // Note e1 has been normalized already
      if (vectorEquals(v1, start) && vectorEquals(e1, finalEdgeDirection)) {
        lengthOffset1 += CHANNEL_WIDTH / Math.sin(Math.abs(a1))
      }

      let x1 = lengthOffset1 + NOTCH_DEPTH + KERF
      let x2 = edgeLength + lengthOffset2 - NOTCH_DEPTH - KERF

      let wallLength = edgeLength + lengthOffset2 - lengthOffset1
      let edgeCenter = add(add(localOffset, scale(e1, edgeLength/2)), scale(n, w1*1.5))
      let addedToCount = false
      for (let wallType of wallInfo) {
        if (epsilonEquals(wallType.length, wallLength)) {
          wallType.edgeCenters.push(edgeCenter)
          addedToCount = true
        }
      }
      if (!addedToCount) {
        wallInfo.push({
          length: wallLength,
          edgeCenters: [edgeCenter],
        })
      }

      points = [
        [x1, w1],
        [x1, w2],
        [x2, w2],
        [x2, w1],
      ]
      channelString += "M" + pointsToSVGString(points, [e1, n], localOffset).substring(1) + "Z "
  	
      points = [
        [x1 + FASTENER_DEPTH, w2],
        [x1, w2],
        [x1, w1],
        [x2, w1],
        [x2, w2],
        [x2 - FASTENER_DEPTH, w2],
      ]
      minimalBorderString += pointsToSVGString(points, [e1, n], localOffset)
    }

    let skipBorder = false
    if (imageUrl && dPath.length == 4) {
      let center = [0,0,0]
      for (let i = 0; i < 4; i++) {
        center = add(center, dPath[i].ogCoords)
      }
      center = scale(center, 0.25)
      let x = Math.round(center[0])
      let y = -Math.round(center[1])
      
      let imageContext = await getImageContext()
      let pixel = imageContext.getImageData(x, y, 1, 1).data
      if (pixel[0] + pixel[1] + pixel[2] == 0) { // skip border for black pixels
        skipBorder = true
      }
    }

    let useMinimalBorder = minimalInnerBorder && dPath.length == 4 && !skipBorder
    if (useMinimalBorder) {
      for (let i = 0; i < 4; i++) {
        let v0 = dPath[i].ogCoords
        let v1 = dPath[(i+1) % dPath.length].ogCoords
        let e0 = delta(v1, v0)
        if (magnitude(e0) > 1.1) {
          useMinimalBorder = false
        }
      }
    }

    if (useMinimalBorder) {
      totalPathString += "M" + minimalBorderString.substring(1) + "Z "
    } else {
      if (!skipBorder) {
    	  totalPathString += "M" + borderString.substring(1) + "Z "
      }
  	  totalPathString += channelString
    }
  }
  cover.querySelector("path").setAttribute("d", totalPathString)

  wallInfo.sort((a,b) => a.length - b.length)

  if (generateWallNumbers) {
    for (let wallType of wallInfo) {
      let index = wallInfo.indexOf(wallType)
      wallType.id = index
      for (let edgeCenter of wallType.edgeCenters) {
        let txt = document.createElementNS("http://www.w3.org/2000/svg", "text")
        txt.setAttribute("x", edgeCenter[0])
        txt.setAttribute("y", edgeCenter[1])
        txt.innerHTML = "" + index
        cover.appendChild(txt)
      }
    }
  }
}

function createWallSVG() {
  wall.querySelectorAll("text").forEach(elem => wall.removeChild(elem))
  let path = ""
  let wallHeight = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
  let offset = [WALL_SVG_PADDING, WALL_SVG_PADDING]
  let panelCount = 1
  for (let wallType of wallInfo) {
    // let txt = document.createElementNS("http://www.w3.org/2000/svg", "text")
    // txt.setAttribute("x", offset[0] - 10)
    // txt.setAttribute("y", offset[1] + wallHeight/2)
    // txt.setAttribute("font-size", 20)
    // txt.setAttribute("fill", "black")
    // txt.innerHTML = "" + wallType.id
    // wall.appendChild(txt)
    
    let wallLength = wallType.length + 2*WOOD_KERF
    let targetCount = wallType.edgeCenters.length + 1
    if (targetCount > 8) targetCount += 1
    if (targetCount > 30) targetCount += 1
    for (let i = 0; i < targetCount; i++) {
      offset[0] += wallLength + WALL_SVG_GAP
      if (offset[0] > panelCount*BALSA_LENGTH - WALL_SVG_PADDING) {
        offset[0] = (panelCount - 1)*BALSA_LENGTH + WALL_SVG_PADDING + wallLength
        offset[1] += wallHeight + WALL_SVG_GAP
      }
      if (offset[1] + wallHeight > BALSA_LENGTH - WALL_SVG_PADDING) {
        offset = [panelCount*BALSA_LENGTH + WALL_SVG_PADDING + wallLength, WALL_SVG_PADDING]
        panelCount += 1
      }

      path += `M${offset[0] - wallLength} ${offset[1] + BOTTOM_THICKNESS + CHANNEL_DEPTH}
        h${NOTCH_DEPTH + WOOD_KERF}
        v${TOP_THICKNESS}
        h${wallLength - 2*NOTCH_DEPTH}
        v${-TOP_THICKNESS}
        h${NOTCH_DEPTH + WOOD_KERF}
        v${-CHANNEL_DEPTH}
        h${-NOTCH_DEPTH - WOOD_KERF}
        v${-BOTTOM_THICKNESS}
        h${2*NOTCH_DEPTH - wallLength}
        v${BOTTOM_THICKNESS}
        h${-NOTCH_DEPTH - WOOD_KERF}
        Z
        `
    }
    offset[0] += 32
    offset[1] += 16
  }
  
  wall.querySelector("path").setAttribute("d", path)
  wall.setAttribute("width", panelCount*BALSA_LENGTH)
  wall.setAttribute("height", BALSA_LENGTH)
  wall.setAttribute("viewBox", `0 0 ${panelCount*BALSA_LENGTH} ${BALSA_LENGTH}`)
}

function pointsToSVGString(points, basis, offset, flip) {
  let s = ""
  for (let point of points) {
  	let truePoint = add(scale(basis[0], point[0]), scale(basis[1], point[1]))
  	truePoint = add(truePoint, offset)
    if (truePoint[0] > 1e6 || truePoint[1] > 1e6) {
      console.error(truePoint)
      return ""
    }
    if (truePoint[0] > maxX || truePoint[1] > maxY) {
      maxX = Math.ceil(Math.max(maxX, truePoint[0])) + 10
      maxY = Math.ceil(Math.max(maxY, truePoint[1])) + 10
      cover.setAttribute("width", maxX)
      cover.setAttribute("height", maxY)
      cover.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`)
    }
  	s += `L${truePoint[0]} ${truePoint[1]} `
  }
  if (flip) {
    s += pointsToSVGString(points.reverse(), basis.reverse(), offset)
  }
  return s
}

function printPath(path) {
  	console.log("path", path.length)
  	for (let vertex of path) {
  	  console.log(vertex.index)
  	}
}

function downloadSVGAsText(id, name) {
  if (!name) name = id;
  let fileContent = document.getElementById(id).outerHTML
  let blob = new Blob([fileContent], { type: 'text/plain' })
  let a = document.createElement('a')
  a.download = name + '.svg'
  a.href = window.URL.createObjectURL(blob)
  a.textContent = 'Download ready';
  a.style='display:none';
  a.click()
}
