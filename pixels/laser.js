
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
    BOTTOM_KERF: 0.14,
    TOP_KERF: -0.03,
    // ACRYLIC_KERF: -0.06, // Used for hex cat recut

    CAT5_HEIGHT: 15.1,
    CAT5_WIDTH: 15.3,
    CAT5_SNAP_DISTANCE: 13.6,
    CAT5_SNAP_WIDTH: 2,
    CAT5_SNAP_HEIGHT: 3.1,
    CAT5_SNAP_Y: 6.6,
    CAT5_WIRES_WIDTH: 12,
    CAT5_WIRES_HEIGHT: 5.6,
    CAT5_ADDITONAL_OFFSET: 0,

    POWER_HOLE_RADIUS: 5.8,
  })
  END_CAP_FACTOR = 0.3872
  WOOD_KERF = BOTTOM_KERF
  KERF = TOP_KERF
  IS_BOTTOM = true

  BALSA_LENGTH = 96*11.85 // A little more than 11 3/4 inches
  WALL_SVG_PADDING = 24
  WALL_SVG_GAP = 6

  MAX_WALL_LENGTH = BALSA_LENGTH - 2*WALL_SVG_PADDING
  MAX_NOTCH_DISTANCE = MAX_WALL_LENGTH / 2

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


document.getElementById("download").addEventListener('click', async () => {
  if (isWall) {
    if (downloadsTopSVG) {
      IS_BOTTOM = false
      KERF = TOP_KERF
      await createCoverSVG()
      downloadSVGAsText("cover", "top (acrylic)")
    }
    if (downloadsBottomSVG) {
      IS_BOTTOM = true
      KERF = BOTTOM_KERF
      await createCoverSVG()
      downloadSVGAsText("cover", "bottom (birch plywood)")
    }

    if (downloadsWallSVG) {
      createWallSVG()
      downloadSVGAsText("wall", "walls (balsa wood)")
    }
  }
})

for (let displayName in buttonClickMap) {
  let onClick = buttonClickMap[displayName]
  buttonClickMap[displayName] = async () => {
    await onClick()
    document.querySelectorAll("path").forEach(path => path.setAttribute('d', ""))
    cover.querySelectorAll("text").forEach(elem => cover.removeChild(elem))
    if (isWall) {
      KERF = TOP_KERF
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

async function createChannelTestSVG() {
  let wallLength = 50 * MM_TO_96DPI
  let path = ""
  let kerfs = [0.10, 0.09, 0.08, 0.07]
  let thicknesses = [2.35, 2.73, 2.75, 2.77]
  let offset = [0,0]
  let basis = [[1,0,0], [0,1,0]]

  wallInfo = [{
    length: wallLength,
    edgeCenters: [[wallLength, 0]],
  }]

  for (let kerf of kerfs) {
    path += decimalPath(kerf, add(offset, [-50, -5]))
    offset[1] += 40
  }
  for (let thickness of thicknesses) {
    path += decimalPath(thickness, add(offset, [20, -10]))
    setLaserParams({WALL_THICKNESS: thickness})
    offset[1] = 0
    for (let kerf of kerfs) {
      setLaserParams({KERF: kerf})
      path += singleChannelPath(wallLength, basis, offset)
      offset[1] += 40
    }
    offset[0] += wallLength
  }
  cover.querySelector("path").setAttribute("d", path)
}

async function createCoverSVG() {
  if (name == "channeltest") {
    createChannelTestSVG()
    return
  }

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

  let outerPath = null

  for (let i = 0; i < 1000; i++) {
    if (directedEdges.length == 0) break
    let lastEdge = directedEdges.pop()
    let dPath = [...lastEdge]
    let cumulativeAngle = 0

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
        // End cap for double back
        dPath.push(leftmostTurn[0])
      }
      directedEdges.splice(directedEdges.indexOf(leftmostTurn), 1)
      if (epsilonEquals(minAngle, 0) && !epsilonEquals(magnitude(e0), 0)) {
        dPath.pop() // Join edges if the path is straight
      }
      cumulativeAngle += minAngle
      dPath.push(leftmostTurn[1])
    }
  	dPath.pop() // Remove duplicated first/last vertex

    // Start and end might be straight still
    e0 = delta(dPath[0].ogCoords, dPath[dPath.length-1].ogCoords)
    e1 = delta(dPath[1].ogCoords, dPath[0].ogCoords)
    let lastAngle = signedAngle(e1, e0)
    if (epsilonEquals(lastAngle, 0)) {
      dPath.shift() // Remove middle (start) vertex if start and end is straight
    }
    cumulativeAngle += lastAngle
    if (epsilonEquals(cumulativeAngle, 2*Math.PI)) {
      outerPath = dPath
    } else if (!epsilonEquals(cumulativeAngle, -2*Math.PI)) {
      // Should always be either 2pi or -2pi
      console.error("Cumulative angle not single turn: " + cumulativeAngle);
    }
    paths.push(dPath)
  }
  paths.sort((a,b) => b.length - a.length)


  // Draw border and channels

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
      let offset = scale(v1, SCALE)

      let isFinalEdge = dPath == outerPath && vectorEquals(normalize(e1), normalize(delta(v2, start)))
      
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

      // if (isFinalEdge) {
      //   // Extra gap for strip to enter in
      //   // Note e1 has been normalized already
      //   lengthOffset1 += CHANNEL_WIDTH / Math.sin(Math.abs(a1))
      // }

      let wallLength = edgeLength + lengthOffset2 - lengthOffset1
      let edgeCenter = add(add(offset, scale(e1, edgeLength/2)), scale(n, w1*1.5))
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
      }

      channelString += singleChannelPath(wallLength,
        [e1, n],
        offset,
        [lengthOffset1, CHANNEL_WIDTH/2],
        isFinalEdge)

      // Border
      let x1 = lengthOffset1 + NOTCH_DEPTH + KERF
      let x2 = edgeLength + lengthOffset2 - NOTCH_DEPTH - KERF
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
      borderString += pointsToSVGString(points, [e1, n], offset)

      points = [
        [x1 + FASTENER_DEPTH, w2],
        [x1, w2],
        [x1, w1],
        [x2, w1],
        [x2, w2],
        [x2 - FASTENER_DEPTH, w2],
      ]
      minimalBorderString += pointsToSVGString(points, [e1, n], offset)
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

function singleChannelPath(wallLength, basis, offset, localOffset, isFinalEdge) {
  let path = ""
  if (localOffset) {
    offset = add(offset, add(scale(basis[0], localOffset[0]), scale(basis[1], localOffset[1])))
  }
  let w1 = KERF
  let w2 = WALL_THICKNESS - KERF
  let xs = NOTCH_DEPTH + KERF
  for (let center of notchCenters(wallLength, isFinalEdge)) {
    let next = NOTCH_DEPTH + KERF + center
    let xt = next - 2*(NOTCH_DEPTH + KERF)
    let points = [
      [xs, w1],
      [xs, w2],
      [xt, w2],
      [xt, w1],
    ]
    xs = next
    path += "M" + pointsToSVGString(points, basis, offset).substring(1) + "Z "
  }
  let xt = wallLength - (NOTCH_DEPTH + KERF)

  let points = [
    [xs, w1],
    [xs, w2],
    [xt, w2],
    [xt, w1],
  ]
  return path + "M" + pointsToSVGString(points, basis, offset).substring(1) + "Z "
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

function notchCenters(wallLength, isFinalEdge) {
  if (wallLength === Infinity || wallLength === NaN) return []
  
  let notchCount = Math.ceil(wallLength / MAX_NOTCH_DISTANCE) // Effectively includes starting/ending half notches
  let notchDistance = wallLength / notchCount
  let centers = []
  for (let i = 1; i < notchCount; i++) {
    centers.push(notchDistance * i)
  }
  if (isFinalEdge && IS_BOTTOM && CAT5_HEIGHT > CHANNEL_DEPTH) {
    if (cat5PortMidway) {
      centers.push((wallLength + CAT5_WIDTH)/2 + NOTCH_DEPTH + KERF)
      centers.push((wallLength - CAT5_WIDTH)/2 - (NOTCH_DEPTH + KERF))
      centers.sort((a,b) => a-b)
    } else {
      centers.unshift(CAT5_WIDTH + 2*(NOTCH_DEPTH + KERF))
    }
  }
  return centers
}

// =======================================================================
// WALL CREATION
// =======================================================================
function createWallSVG() {
  wall.querySelectorAll("text").forEach(elem => wall.removeChild(elem))
  let path = ""
  let offset = [WALL_SVG_PADDING, WALL_SVG_PADDING, 1] // offset[2] is panelCount
  for (let wallIndex = 0; wallIndex < wallInfo.length; wallIndex++) {
    let wallType = wallInfo[wallIndex]
    let wallLength = wallType.length + 2*WOOD_KERF
    let targetCount = wallType.edgeCenters.length
    path += romanNumeralPath(wallIndex, offset)

    if (targetCount > 8) targetCount += 1
    if (targetCount > 30) targetCount += 1
    for (let i = 0; i < targetCount; i++) {
      let isFinalEdge = epsilonEquals(wallType.length, entryWallLength, 0.01) && i == 0
      let cat5Offset = NaN
      if (isFinalEdge) {
        if (cat5PortMidway) {
          cat5Offset = wallLength/2
        } else {
          cat5Offset = NOTCH_DEPTH + CAT5_WIDTH / 2
        }
      }
      let powerHoleInstanceIndex = epsilonEquals(wallType.length, entryWallLength, 0.01) ? 1:0
      let isPowerCordPort = wallIndex == powerHoleWallIndex && i == powerHoleInstanceIndex
      
      let notches = notchCenters(wallLength, isFinalEdge)
      let nextNotches = []
      let remainingWallLength = wallLength
      for (let k = 0; k < 100; k++) {
        if ((notches.length == 0 && remainingWallLength > MAX_WALL_LENGTH)
            || (notches[0] > MAX_WALL_LENGTH)) {
          let tempWallLength = nextNotches.pop()
          path += wallPath(offset, tempWallLength, nextNotches, cat5Offset, isPowerCordPort)
          nextNotches = []
          notches = notches.map(x => x - tempWallLength)
          remainingWallLength -= tempWallLength
          cat5Offset -= tempWallLength
        } else if (notches.length == 0) {
          break
        } else {
          nextNotches.push(notches.shift())
        }
      }
      path += wallPath(offset, remainingWallLength, nextNotches, cat5Offset, isPowerCordPort)
    }
    offset[0] += 20
  }
  
  let pathElems = wall.querySelectorAll("path")
  pathElems[0].setAttribute("d", path)
  wall.setAttribute("width", offset[2]*BALSA_LENGTH)
  wall.setAttribute("height", BALSA_LENGTH)
  wall.setAttribute("viewBox", `0 0 ${offset[2]*BALSA_LENGTH} ${BALSA_LENGTH}`)
}

function wallPath(offset, wallLength, notches, cat5Offset, isPowerCordPort) {
  let path = ""
  let wallHeight = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
  offset[0] += wallLength
  if (offset[0] > offset[2]*BALSA_LENGTH - WALL_SVG_PADDING) {
    offset[0] = (offset[2] - 1)*BALSA_LENGTH + WALL_SVG_PADDING + wallLength
    offset[1] += wallHeight + WALL_SVG_GAP
  }
  if (offset[1] + wallHeight > BALSA_LENGTH - WALL_SVG_PADDING) {
    offset[0] = offset[2]*BALSA_LENGTH + WALL_SVG_PADDING + wallLength
    offset[1] = WALL_SVG_PADDING
    offset[2] += 1
  }

  path += `
    M${offset[0] - wallLength} ${offset[1] + BOTTOM_THICKNESS + CHANNEL_DEPTH}
    h${NOTCH_DEPTH + WOOD_KERF}
    v${TOP_THICKNESS}
    h${wallLength - 2*NOTCH_DEPTH}
    v${-TOP_THICKNESS}
    h${NOTCH_DEPTH + WOOD_KERF}
    v${-CHANNEL_DEPTH}
    h${-NOTCH_DEPTH - WOOD_KERF}
    v${-BOTTOM_THICKNESS}`
  for (let center of notches) {
    path += `
    H${offset[0] - center + NOTCH_DEPTH}
    v${BOTTOM_THICKNESS}
    h${-2*NOTCH_DEPTH}
    v${-BOTTOM_THICKNESS}`
  }
  path += `
    H${offset[0] - wallLength + NOTCH_DEPTH + WOOD_KERF}
    v${BOTTOM_THICKNESS}
    h${-NOTCH_DEPTH - WOOD_KERF}
    Z`

  // Is the entry wall for CAT5 port
  if (cat5Offset !== undefined &&
      cat5Offset !== NaN &&
      cat5Offset < wallLength + CAT5_WIDTH/2 &&
      cat5Offset > -CAT5_WIDTH/2) {
    let x0 = offset[0] - cat5Offset
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
  }

  // Hole for power cord port
  if (isPowerCordPort) {
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
  return path
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
function romanNumeralPath(x, offset) {
  minX = Math.min(minX, offset[0])
  minY = Math.min(minY, offset[1])
  x = parseInt(x)
  let roman = decimalToRomanNumeral[x]
  let path = ""
  for (let d of roman) {
    if (d == "V" || d == "X") offset[0] -= 2
    path += `M${offset[0]} ${offset[1]}`
    switch(d) {
      case "I":
        path += "v 30"
        offset[0] += 6
        break
      case "V":
        path += "l8 30 l8 -30"
        offset[0] += 22
        break
      case "X":
        let subwidth = 14
        path += `l${subwidth} 30
          M${offset[0] + subwidth} ${offset[1]}
          l-${subwidth} 30`
        offset[0] += subwidth + 6
        break
    }
  }
  maxX = Math.min(maxX, offset[0])
  maxY = Math.min(maxY, offset[1] + 30)
  return path
}

function decimalPath(x, offset) {
  minX = Math.min(minX, offset[0])
  minY = Math.min(minY, offset[1])

  x = "" + x
  let path = ""
  for (let d of x) {
    if (d == ".") {
      path += `M${offset[0]-4} ${offset[1] + 20}
      v -1 h 1 v 1 Z`
      continue
    }

    switch(d) {
      case "0":
        path += `M${offset[0]} ${offset[1]}
        h 10 v 20 h -10 v -16`
        break
      case "1":
        path += `M${offset[0] + 10} ${offset[1]}
        v 20`
        break
      case "2":
        path += `M${offset[0]} ${offset[1]}
        h 10 v 10 h -10 v 10 h 10`
        break
      case "3":
        path += `M${offset[0]} ${offset[1]}
        h 10 v 20 h -10 m 0 -10 h 10`
        break
      case "4":
        path += `M${offset[0]} ${offset[1]}
        v 10 h 10 v -10 v 20`
        break
      case "5":
        path += `M${offset[0] + 10} ${offset[1]}
        h -10 v 10 h 10 v 10 h -10`
        break
      case "6":
        path += `M${offset[0] + 10} ${offset[1]}
        h -10 v 20 h 10 v -10 h -6`
        break
      case "7":
        path += `M${offset[0]} ${offset[1]}
        h 10 v 20`
        break
      case "8":
        path += `M${offset[0]} ${offset[1]}
        h 10 v 20 h -10 v -16 m 0 6 h 6`
        break
      case "9":
        path += `M${offset[0] + 10} ${offset[1] + 20}
        v -20 h -10 v 10 h 6`
        break
    }
    offset[0] += 17
  }
  maxX = Math.max(maxX, offset[0])
  maxY = Math.max(maxY, offset[1] + 20)
  return path
}

function printPath(path) {
  	console.log("path", path.length)
  	for (let vertex of path) {
  	  console.log(vertex.index)
  	}
}

function downloadSVGAsText(id, name) {
  if (!name) name = id;
  let elem = document.getElementById(id)
  elem.style.display = "block"
  let fileContent = elem.outerHTML
  let blob = new Blob([fileContent], { type: 'text/plain' })
  let a = document.createElement('a')
  a.download = name + '.svg'
  a.href = window.URL.createObjectURL(blob)
  a.textContent = 'Download ready';
  a.style='display:none';
  a.click()
}
