
let MM_TO_96DPI = 3.77952755906

let ogReset = reset

function setLaserParams(obj) {
  for (let key in obj) {
    window[key] = obj[key] * MM_TO_96DPI
  }
  if (obj.CHANNEL_DEPTH) {
    useCAT5forChannelDepth = false
  }
  if (useCAT5forChannelDepth) {
    CHANNEL_DEPTH = CAT5_HEIGHT - BOTTOM_THICKNESS
  }
  HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
}
function makeTwoSided() {
  BOTTOM_THICKNESS = TOP_THICKNESS
  setLaserParams({})
}
reset = () => {
  ogReset()
  useCAT5forChannelDepth = true
  setLaserParams({
    BOTTOM_THICKNESS: 5,
    TOP_THICKNESS: 2.9,
    WALL_THICKNESS: 2.35,
    BORDER: 6,
    PIXEL_DISTANCE: 16.66666, // 16.6
    CHANNEL_WIDTH: 12,
    // CHANNEL_DEPTH: 10,
    NOTCH_DEPTH: 5,
    FASTENER_DEPTH: 2.5,
    WOOD_KERF: 0.14,
    ACRYLIC_KERF: -0.03,
    // ACRYLIC_KERF: -0.06, // Used for hex cat recut

    CAT5_HEIGHT: 15.1,
    CAT5_WIDTH: 15.3,
    CAT5_SNAP_DISTANCE: 13.6,
    CAT5_SNAP_WIDTH: 2,
    CAT5_SNAP_HEIGHT: 3.1,
    CAT5_SNAP_OUTER_HEIGHT: 3.9,
    CAT5_SNAP_Y: 6.6,
    CAT5_WIRES_WIDTH: 12,
    CAT5_WIRES_HEIGHT: 5.6,
    CAT5_ADDITONAL_OFFSET: 0,

    POWER_HOLE_RADIUS: 5.8,
  })
  END_CAP_FACTOR = 0.3872
  KERF = ACRYLIC_KERF
  IS_BOTTOM = true

  BALSA_LENGTH = 96*11.85 // A little more than 11 3/4 inches
  WALL_SVG_PADDING = 24
  WALL_SVG_GAP = 6

  minimalInnerBorder = false
  exteriorOnly = false
  cat5PortMidway = false

  powerHoleWallIndex = -1
}

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
}
#wall {
  top: 160px;
}`

let wall = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.body.appendChild(wall)
wall.outerHTML = `
<svg id="wall" width=1000 height=100 viewBox="0 0 1000 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g><path stroke="#808080"/></g>
  <g><path fill="rgba(150,150,150,0.3)"/></g>
</svg>`
wall = document.getElementById("wall")

let cover = document.createElementNS("http://www.w3.org/2000/svg", "svg")
document.body.appendChild(cover)
cover.outerHTML = `
<svg id="cover" width=1000 height=1000 viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scaleY(-1)">
  <path stroke="#808080"/>
</svg>`
cover = document.getElementById("cover")


document.getElementById("download").addEventListener('click', async () => {
  if (isWall) {
    IS_BOTTOM = false
    KERF = ACRYLIC_KERF
    await createCoverSVG()
    downloadSVGAsText("cover", "top (acrylic)")
    IS_BOTTOM = true
    KERF = WOOD_KERF
    await createCoverSVG()
    downloadSVGAsText("cover", "bottom (birch plywood)")

    createWallSVG()
    downloadSVGAsText("wall", "walls (balsa wood)")
  }
})

for (let displayName in buttonClickMap) {
  let onClick = buttonClickMap[displayName]
  buttonClickMap[displayName] = async () => {
    await onClick()
    document.querySelectorAll("path").forEach(path => path.setAttribute('d', ""))
    cover.querySelectorAll("text").forEach(elem => cover.removeChild(elem))
    if (isWall) {
      KERF = ACRYLIC_KERF
      await createCoverSVG()
      console.log(`SVG is ${((maxX - minX)/96).toFixed(1)}" by ${((maxY-minY)/96).toFixed(1)}"`)
      createWallSVG()
    }
  }
}

let wallInfo = []
let entryWallLength = 0
let minX = 0
let minY = 0
let maxX = 0
let maxY = 0

async function createCoverSVG() {
  wallInfo = []
  minX = 0
  minY = 0
  maxX = 0
  maxY = 0
  const SCALE = PIXEL_DISTANCE / pixelDensity
  
  // Gather paths
  let paths = []
  let directedEdges = []
  for (let index of path) {
    let edge = edges[index]
    if (edge.isDupe) continue;
    directedEdges.push([edge.verticies[1], edge.verticies[0]])
    directedEdges.push([edge.verticies[0], edge.verticies[1]])
  }

  for (let i = 0; i < 1000; i++) {
    if (directedEdges.length == 0) break
    let lastEdge = directedEdges.pop()
    let dPath = [...lastEdge]

    for (let j = 0; j < 1000; j++) {
      let e0 = delta(dPath[dPath.length-1].ogCoords, dPath[dPath.length-2].ogCoords)
      let leftmostTurn = null
      let minAngle = 7

      if (dPath[0] == dPath[dPath.length - 1]) {
        let e1 = delta(dPath[1].ogCoords, dPath[0].ogCoords)
        minAngle = signedAngle(e1, e0)
      }

      for (let dEdge of directedEdges) {
        let [v0, v1] = dEdge
        if (dPath[dPath.length - 1] != v0) continue

        let e1 = delta(v1.ogCoords, v0.ogCoords)
        let a = signedAngle(e1, e0)
        if (epsilonEquals(Math.abs(a), Math.PI)) {
          a = Math.abs(a)
        }
        if (a < minAngle) {
          minAngle = a
          leftmostTurn = dEdge
        }
      }
      if (!leftmostTurn) break
      if (epsilonEquals(minAngle, Math.PI)) {
        dPath.push(leftmostTurn[0])
        continue
      }
      directedEdges.splice(directedEdges.indexOf(leftmostTurn), 1)
      if (epsilonEquals(minAngle, 0) && !epsilonEquals(magnitude(e0), 0)) {
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

  // let offsetX = 0;
  // let offsetY = 0;
  // for (let v of verticies) {
  // 	offsetX = Math.min(offsetX, v.ogCoords[0])
  // 	offsetY = Math.min(offsetY, v.ogCoords[1])
  // }
  // let offset = [2 - offsetX, 2 - offsetY, 0]

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

      let endCapOffset = CHANNEL_WIDTH * END_CAP_FACTOR * -0.5 / SCALE
      if (epsilonEquals(magnitude(e0), 0)) {
        a1 = Math.PI/2
        towardsEnd = scale(normalize(e1), -1)
        v0 = add(v0, scale(towardsEnd, endCapOffset))
        v1 = v0
        e1 = delta(v2, v1)
      }
      if (epsilonEquals(magnitude(e1), 0)) {
        a1 = Math.PI/2
        a2 = -Math.PI/2
        towardsEnd = normalize(e0)
        v1 = add(v1, scale(towardsEnd, endCapOffset))
        v2 = v1
        e0 = delta(v1, v0)
        e2 = delta(v3, v2)
      }
      if (epsilonEquals(magnitude(e2), 0)) {
        a2 = -Math.PI/2
        towardsEnd = normalize(e1)
        v2 = add(v2, scale(towardsEnd, endCapOffset))
        v3 = v3
        e1 = delta(v2, v1)
      }

      let edgeLength = magnitude(e1)
      if (epsilonEquals(edgeLength, 0)) {
        e1 = scale(cross(e0, [0,0,1]), 1/magnitude(e0))
      } else {
        e1 = scale(e1, 1/edgeLength)
      }
      edgeLength *= SCALE
      let n = cross(e1, [0,0,-1])
      let localOffset = scale(v1, SCALE)

      let isFinalEdge = vectorEquals(v1, start) && vectorEquals(e1, finalEdgeDirection)

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

      // if (isFinalEdge) {
      //   // Extra gap for strip to enter in
      //   // Note e1 has been normalized already
      //   lengthOffset1 += CHANNEL_WIDTH / Math.sin(Math.abs(a1))
      // }

      let x1 = lengthOffset1 + NOTCH_DEPTH + KERF
      let x2 = edgeLength + lengthOffset2 - NOTCH_DEPTH - KERF

      let wallLength = edgeLength + lengthOffset2 - lengthOffset1
      let edgeCenter = add(add(localOffset, scale(e1, edgeLength/2)), scale(n, w1*1.5))
      let addedToCount = false
      for (let wallType of wallInfo) {
        if (epsilonEquals(wallType.length, wallLength, 0.01)) {
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
      if (isFinalEdge) {
        entryWallLength = wallLength
        // x1 -= NOTCH_DEPTH
      }

      let points = [
        [x1, w1],
        [x1, w2],
        [x2, w2],
        [x2, w1],
      ]
      channelString += "M" + pointsToSVGString(points, [e1, n], localOffset).substring(1) + "Z "
  	

      // Border
      let width = CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER
      let borderLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      
      if (isFinalEdge && IS_BOTTOM && CAT5_HEIGHT > CHANNEL_DEPTH) {
        if (cat5PortMidway) {
          x1 = (x1 + x2 - CAT5_WIDTH) / 2
        }
        x1 += CAT5_ADDITONAL_OFFSET
        points = [
          [borderLengthOffset, width],
          [x1, width],
          [x1, width - BORDER],
          [x1 + CAT5_WIDTH, width - BORDER],
          [x1 + CAT5_WIDTH, width],
        ]
      } else {
        points = [[borderLengthOffset, width]]
      }
      borderString += pointsToSVGString(points, [e1, n], localOffset)

      points = [
        [x1 + FASTENER_DEPTH, w2],
        [x1, w2],
        [x1, w1],
        [x2, w1],
        [x2, w2],
        [x2 - FASTENER_DEPTH, w2],
      ]
      minimalBorderString += pointsToSVGString(points, [e1, n], localOffset)
    } // END for (let i = 0; i < dPath.length; i++)

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
    if (exteriorOnly) break
  } // END for (let dPath of paths)
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

function pointsToSVGString(points, basis, offset, flip) {
  let s = ""
  for (let point of points) {
  	let truePoint = add(scale(basis[0], point[0]), scale(basis[1], point[1]))
  	truePoint = add(truePoint, offset)
    if (truePoint[0] > 1e6 || truePoint[1] > 1e6) {
      console.error(truePoint)
      return ""
    }
    if (truePoint[0] > maxX || truePoint[1] > maxY ||
        truePoint[0] < minX || truePoint[1] < minY) {
      maxX = Math.ceil(Math.max(maxX, truePoint[0]))
      maxY = Math.ceil(Math.max(maxY, truePoint[1]))
      minX = Math.floor(Math.min(minX, truePoint[0]))
      minY = Math.floor(Math.min(minY, truePoint[1]))
      cover.setAttribute("width", maxX - minX)
      cover.setAttribute("height", maxY - minY)
      cover.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`)
    }
  	s += `L${truePoint[0]} ${truePoint[1]} `
  }
  if (flip) {
    s += pointsToSVGString(points.reverse(), basis.reverse(), offset)
  }
  return s
}



function createWallSVG() {
  wall.querySelectorAll("text").forEach(elem => wall.removeChild(elem))
  let path = ""
  let etchingPath = ""
  let wallHeight = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
  let offset = [WALL_SVG_PADDING, WALL_SVG_PADDING]
  let panelCount = 1
  for (let wallIndex = 0; wallIndex < wallInfo.length; wallIndex++) {
    let wallType = wallInfo[wallIndex]
    let wallLength = wallType.length + 2*WOOD_KERF
    let targetCount = wallType.edgeCenters.length

    let [romanPath, romanWidth] = romanNumeralPathInfo(wallIndex, offset)
    path += romanPath
    offset[0] += romanWidth

    if (targetCount > 8) targetCount += 1
    if (targetCount > 30) targetCount += 1
    let powerHoleInstanceIndex = 0
    for (let i = 0; i < targetCount; i++) {
      offset[0] += wallLength
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
        Z`

      // Is the entry wall for CAT5 port
      if (epsilonEquals(wallType.length, entryWallLength, 0.01) && i == 0) {
        powerHoleInstanceIndex = 1;
        let x0 = offset[0]
        if (cat5PortMidway) {
          x0 -= wallLength/2
        } else {
          x0 -= NOTCH_DEPTH + CAT5_WIDTH / 2
        }
        let x1 = x0 - CAT5_WIRES_WIDTH/2 - CAT5_ADDITONAL_OFFSET
        let y1 = offset[1] + BOTTOM_THICKNESS + CHANNEL_DEPTH
        let x2 = x0 - CAT5_SNAP_DISTANCE/2 - CAT5_ADDITONAL_OFFSET
        let y2 = offset[1] + HEIGHT - TOP_THICKNESS - CAT5_HEIGHT + CAT5_SNAP_Y
        path += `
          M${x1} ${y1}
          h${CAT5_WIRES_WIDTH}
          v${-CAT5_WIRES_HEIGHT}
          h${-CAT5_WIRES_WIDTH}
          Z
          M${x2} ${y2}
          h${CAT5_SNAP_WIDTH}
          v${-CAT5_SNAP_HEIGHT}
          h${-CAT5_SNAP_WIDTH}
          Z
          M${x2 + CAT5_SNAP_DISTANCE} ${y2}
          h${-CAT5_SNAP_WIDTH}
          v${-CAT5_SNAP_HEIGHT}
          h${CAT5_SNAP_WIDTH}
          Z`

        y3 = y2 + (CAT5_SNAP_OUTER_HEIGHT - CAT5_SNAP_HEIGHT)/2
        etchingPath += `
          M${x2} ${y3}
          h${CAT5_SNAP_WIDTH}
          v${-CAT5_SNAP_OUTER_HEIGHT}
          h${-CAT5_SNAP_WIDTH}
          Z
          M${x2 + CAT5_SNAP_DISTANCE} ${y3}
          h${-CAT5_SNAP_WIDTH}
          v${-CAT5_SNAP_OUTER_HEIGHT}
          h${CAT5_SNAP_WIDTH}
          Z`
      }

      // Hole for power cord port
      if (wallIndex == powerHoleWallIndex && i == powerHoleInstanceIndex) {
        if (2*POWER_HOLE_RADIUS > CHANNEL_DEPTH) {
          console.error("Power cord hole doesn't fit!")
        }
        let r = POWER_HOLE_RADIUS
        let x1 = offset[0] - wallLength/2 - r
        let y1 = offset[1] + BOTTOM_THICKNESS + CHANNEL_DEPTH/2
        path += `
          M${x1} ${y1}
          a ${r},${r} 0 1,0 ${r*2},0
          a ${r},${r} 0 1,0,${-r*2},0`
      }

      offset[0] += WALL_SVG_GAP
    }

    offset[0] += 20
  }
  
  let pathElems = wall.querySelectorAll("path")
  pathElems[0].setAttribute("d", path)
  pathElems[1].setAttribute("d", etchingPath)
  wall.setAttribute("width", panelCount*BALSA_LENGTH)
  wall.setAttribute("height", BALSA_LENGTH)
  wall.setAttribute("viewBox", `0 0 ${panelCount*BALSA_LENGTH} ${BALSA_LENGTH}`)
}

let decimalToRomanNumeral = [
  "",
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
  "XXI",
  "XXII",
  "XXIII",
  "XXIV",
  "XXV",
  "XXVI",
  "XXVII",
  "XXVIII",
  "XXIX",
  "XXX",
]
function romanNumeralPathInfo(x, offset) {
  let roman = decimalToRomanNumeral[x]
  let path = ""
  let width = 0
  for (let d of roman) {
    if (d == "V" || d == "X") width -= 2
    path += `M${offset[0] + width} ${offset[1]}`
    switch(d) {
      case "I":
        path += "v 30"
        width += 6
        break
      case "V":
        path += "l8 30 l8 -30"
        width += 22
        break
      case "X":
        let subwidth = 14
        path += `l${subwidth} 30
          M${offset[0] + width + subwidth} ${offset[1]}
          l-${subwidth} 30`
        width += subwidth + 6
        break
    }
  }
  return [path, width]
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
