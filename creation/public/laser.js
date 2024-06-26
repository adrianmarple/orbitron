
let MM_TO_96DPI = 3.77952755906

wallInfo = []
entryWallLength = 0
minX = 0
minY = 0
maxX = 0
maxY = 0

async function createCoverSVG(plain) {
  if (verticies.length <= 1) return

  if (!plain) {
    plain = DEFAULT_PLAIN
  }

  wallInfo = []
  minX = 1e6
  minY = 1e6
  maxX = -1e6
  maxY = -1e6
  const SCALE = PIXEL_DISTANCE / pixelDensity

  // TODO find rotation vector that transforms plain.normal to FORWARD
  // then apply this to all verticies' ogCoords
  // remember to invert this operation at the end
  
  // Gather paths
  let paths = []
  let directedEdges = []
  for (let index of path) {
    let edge = edges[index]
    if (edge.isDupe) continue;
    if (!edge.verticies[0].plains.includes(plain)) continue
    if (!edge.verticies[1].plains.includes(plain)) continue
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
      let e0 = dPath[dPath.length-1].ogCoords.sub(dPath[dPath.length-2].ogCoords)
      let leftmostTurn = null
      let minAngle = 7

      if (dPath[0] == dPath[dPath.length - 1]) {
        let e1 = dPath[1].ogCoords.sub(dPath[0].ogCoords)
        minAngle = e1.signedAngle(e0)
      }

      for (let dEdge of directedEdges) {
        let [v0, v1] = dEdge
        if (dPath[dPath.length - 1] != v0) continue

        let e1 = v1.ogCoords.sub(v0.ogCoords)
        
        let a = e1.signedAngle(e0)
        if (epsilonEquals(Math.abs(a), Math.PI)) {
          a = Math.PI
        }
        if (a < minAngle) {
          minAngle = a
          leftmostTurn = dEdge
        }
      }
      if (!leftmostTurn) break
      if (epsilonEquals(minAngle, Math.PI)) { // TODO detect end of plain
        // End cap for double back
        dPath.push(leftmostTurn[0])
      }
      directedEdges.splice(directedEdges.indexOf(leftmostTurn), 1)
      if (epsilonEquals(minAngle, 0) && !epsilonEquals(e0.length(), 0)) {
        dPath.pop() // Join edges if the path is straight
      }
      cumulativeAngle += minAngle
      dPath.push(leftmostTurn[1])
    }
  	dPath.pop() // Remove duplicated first/last vertex

    // Start and end might be straight still
    e0 = dPath[0].ogCoords.sub(dPath[dPath.length-1].ogCoords)
    e1 = dPath[1].ogCoords.sub(dPath[0].ogCoords)
    let lastAngle = e1.signedAngle(e0)
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

  let start = startVertex()
  if (!start) return
  start = start.ogCoords
  let penultimate = penultimateVertex().ogCoords
  let finalEdgeDirection = penultimate.sub(start).normalize()

  let totalPathString = ""
  for (let dPath of paths) {
    if (exteriorOnly && dPath != outerPath) continue

    let channelString = ""
  	let borderString = ""
  	let minimalBorderString = ""
    
   	for (let i = 0; i < dPath.length; i++) {
  	  let v0 = dPath[i].ogCoords
  	  let v1 = dPath[(i+1) % dPath.length].ogCoords
  	  let v2 = dPath[(i+2) % dPath.length].ogCoords
  	  let v3 = dPath[(i+3) % dPath.length].ogCoords
  	  let e0 = v1.sub(v0)
  	  let e1 = v2.sub(v1)
  	  let e2 = v3.sub(v2)

      let a1 = e1.signedAngle(e0)
      let a2 = e1.signedAngle(e2)

      let endCapOffset = CHANNEL_WIDTH * END_CAP_FACTOR * -0.5 / SCALE
      if (epsilonEquals(e0.length(), 0)) {
        a1 = Math.PI/2
        towardsEnd = e1.normalize().multiplyScalar(-1)
        v0 = v0.addScaledVector(towardsEnd, endCapOffset)
        v1 = v0
        e1 = v2.sub(v1)
      }
      if (epsilonEquals(e1.length(), 0)) {
        a1 = Math.PI/2
        a2 = -Math.PI/2
        towardsEnd = e0.normalize()
        v1 = v1.addScaledVector(towardsEnd, endCapOffset)
        v2 = v1
        e0 = v1.sub(v0)
        e2 = v3.sub(v2)
      }
      if (epsilonEquals(e2.length(), 0)) {
        a2 = -Math.PI/2
        towardsEnd = e1.normalize()
        v2 = v2.addScaledVector(towardsEnd, endCapOffset)
        v3 = v3
        e1 = v2.sub(v1)
      }

      let edgeLength = e1.length()
      if (epsilonEquals(edgeLength, 0)) {
        e1 = e0.cross(FORWARD).scale(1/e0.length())
      } else {
        e1 = e1.scale(1/edgeLength)
      }
      edgeLength *= SCALE
      let n = FORWARD.cross(e1)
      let offset = v1.scale(SCALE)

      let isFinalEdge = dPath == outerPath && e1.normalize().equals(v2.sub(start).normalize())
      
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
      let angle1 = a1/2
      let angle2 = -a2/2
      // if (!EDGES_DOUBLED) {
      //   if (angle1 < 0 && angle2 < 0 ||
      //       -angle1 > angle2 ||
      //       -angle2 > angle1) {
      //     let t = angle1
      //     angle1 = -angle2
      //     angle2 = -t
      //   }
      //   if (epsilonEquals(TOP_THICKNESS, BOTTOM_THICKNESS) && !isFinalEdge &&
      //       angle1 > angle2) {
      //     let t = angle1
      //     angle1 = angle2
      //     angle2 = t
      //   }
      // }
      let edgeCenter = offset.addScaledVector(e1, edgeLength/2)
          .addScaledVector(n, w1*1.5)
      let addedToCount = false
      for (let wallType of wallInfo) {
        if (epsilonEquals(wallType.length, wallLength, 0.01) &&
            epsilonEquals(wallType.angle1, angle1, 0.01) &&
            epsilonEquals(wallType.angle2, angle2, 0.01)) {
          wallType.edgeCenters.push(edgeCenter)
          addedToCount = true
          break
        }
      }
      if (!addedToCount) {
        wallInfo.push({
          length: wallLength,
          angle1,
          angle2,
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
    if (imageUrl && imageUrl.endsWith(".png") && dPath.length == 4) {
      let center = [0,0,0]
      for (let i = 0; i < 4; i++) {
        center = add(center, dPath[i].ogCoords)
      }
      center = center.scale(0.25)
      let x = Math.round(center.x)
      let y = -Math.round(center.y)
      
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
        let e0 = v1.sub(v0)
        if (e0.length() > 1.1) {
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
  } // END for (let dPath of paths)
  cover.querySelector("path").setAttribute("d", totalPathString)

  wallInfo.sort((a,b) => a.length - b.length)

  if (generateWallNumbers) {
    for (let wallType of wallInfo) {
      let index = wallInfo.indexOf(wallType)
      wallType.id = index
      for (let edgeCenter of wallType.edgeCenters) {
        let txt = document.createElementNS("http://www.w3.org/2000/svg", "text")
        txt.setAttribute("x", edgeCenter[0] * MM_TO_96DPI)
        txt.setAttribute("y", edgeCenter[1] * MM_TO_96DPI)
        txt.innerHTML = "" + index
        cover.appendChild(txt)
      }
    }
  }
}

function singleChannelPath(wallLength, basis, offset, localOffset, isFinalEdge) {
  let path = ""
  if (localOffset) {
    offset = offset
        .addScaledVector(basis[0], localOffset[0])
        .addScaledVector(basis[1], localOffset[1])
  }
  let w1 = KERF
  let w2 = WALL_THICKNESS - KERF
  let xs = trueNotchDepth(wallLength) + KERF
  for (let {center, bottomOnly} of generateNotches(wallLength, isFinalEdge)) {
    if (!IS_BOTTOM && bottomOnly) continue
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
  let xt = wallLength - (trueNotchDepth(wallLength) + KERF)

  let points = [
    [xs, w1],
    [xs, w2],
    [xt, w2],
    [xt, w1],
  ]
  return path + "M" + pointsToSVGString(points, basis, offset).substring(1) + "Z "
}

function trueNotchDepth(wallLength) {
  if (2*NOTCH_DEPTH + MIN_NON_NOTCH_LENGTH > wallLength) {
    return (wallLength - MIN_NON_NOTCH_LENGTH)/2
  } else {
    return NOTCH_DEPTH
  }
}

function pointsToSVGString(points, basis, offset, flip) {
  let s = ""
  for (let point of points) {
  	let truePoint = basis[0].scale(point[0]).addScaledVector(basis[1], point[1])
  	truePoint = truePoint.add(offset)
    truePoint = truePoint.scale(MM_TO_96DPI)
    if (truePoint.x > 1e6 || truePoint.y > 1e6) {
      console.error(truePoint)
      return ""
    }
    if (truePoint.x > maxX || truePoint.y > maxY ||
        truePoint.x < minX || truePoint.y < minY) {
      maxX = Math.ceil(Math.max(maxX, truePoint.x))
      maxY = Math.ceil(Math.max(maxY, truePoint.y))
      minX = Math.floor(Math.min(minX, truePoint.x))
      minY = Math.floor(Math.min(minY, truePoint.y))
      cover.setAttribute("width", maxX - minX)
      cover.setAttribute("height", maxY - minY)
      cover.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`)
    }
  	s += `L${truePoint.x} ${truePoint.y} `
  }
  if (flip) {
    s += pointsToSVGString(points.reverse(), basis.reverse(), offset)
  }
  return s
}

function generateNotches(wallLength, isFinalEdge) {
  if (wallLength === Infinity || wallLength === NaN) return []

  let notchCount = Math.ceil(wallLength / MAX_NOTCH_DISTANCE) // Effectively includes starting/ending half notches
  let notchDistance = wallLength / notchCount
  let notches = []
  for (let i = 1; i < notchCount; i++) {
    notches.push({
      center: notchDistance * i,
    })
  }
  if (isFinalEdge && IS_BOTTOM && CAT5_HEIGHT > CHANNEL_DEPTH) {
    if (cat5PortMidway) {
      notches.push({
        center: (wallLength + CAT5_WIDTH)/2 + NOTCH_DEPTH + KERF,
        bottomOnly: true,
      })
      notches.push({
        center: (wallLength - CAT5_WIDTH)/2 - (NOTCH_DEPTH + KERF),
        bottomOnly: true,
      })
      notches.sort((a,b) => a.center - b.center)
    } else {
      notches.unshift({
        center: CAT5_WIDTH + 2*(NOTCH_DEPTH + KERF),
        bottomOnly: true,
      })
    }
  }
  return notches
}

// =======================================================================
// WALL CREATION
// =======================================================================

function blankPrint() {
  return {
    wedges: [],
    ledSupports: [],
    embossings: [],
  }
}

function createPrintInfo(displayOnly) {
  let printInfo = null
  if (!displayOnly) {
    printInfo = {
      type: "gcode",
      thickness: WALL_THICKNESS + WALL_VERT_KERF,
      noInputShaper,
      EXTRA_SCALE,
      PROCESS_STOP,
      prints: [blankPrint()],
    }
  }
  wall.querySelectorAll("text").forEach(elem => wall.removeChild(elem))
  // Set now in case of pagination
  wall.setAttribute("width", WALL_PANEL_WIDTH)
  wall.setAttribute("height", WALL_PANEL_HEIGHT)
  wall.setAttribute("viewBox", `0 0 ${WALL_PANEL_WIDTH} ${WALL_PANEL_HEIGHT}`)

  let path = ""
  let offset = [WALL_SVG_PADDING.left, WALL_SVG_PADDING.top, 1] // offset[2] is panelCount
  for (let wallIndex = STARTING_WALL_INDEX; wallIndex < wallInfo.length; wallIndex++) {
    let wallType = wallInfo[wallIndex]
    let wallLength = wallType.length
    let targetCount = wallType.edgeCenters.length
    if (displayOnly) {
      path += decimalPath(wallIndex, offset)
    } else {
      offset[0] += 8 * (""+wallIndex).length
    }

    if (targetCount > 8) targetCount += 1
    if (targetCount > 30) targetCount += 1
    for (let i = STARTING_I; i < targetCount; i++) {
      let isFinalEdge = epsilonEquals(wallType.length, entryWallLength, 0.01)
      if (cat5WallOverride >= 0) {
        isFinalEdge = wallIndex == cat5WallOverride
      }
      let powerHoleInstanceIndex = isFinalEdge ? 1:0

      isFinalEdge = isFinalEdge && i == 0
      let cat5Offset = NaN
      if (isFinalEdge) {
        if (cat5PortMidway) {
          cat5Offset = wallLength/2
        } else {
          cat5Offset = NOTCH_DEPTH + CAT5_WIDTH / 2
        }
      }
      let isPowerCordPort = wallIndex == powerHoleWallIndex && i == powerHoleInstanceIndex
      
      let notches = generateNotches(wallLength, isFinalEdge)
      let nextNotches = []
      let remainingWallLength = wallLength
      let angle1 = wallType.angle1
      let angle2 = wallType.angle2
      let bottomOnlyNotches = []
      let k = 0
      for (; k < 100; k++) {
        if ((notches.length == 0 && remainingWallLength > MAX_WALL_LENGTH) ||
            (notches.length > 0 && notches[0].center > MAX_WALL_LENGTH)) {
          let tempWallLength = nextNotches.pop().center
          let embossingText = `${wallIndex}.${k}`
          path = wallPath(path, offset, tempWallLength, angle1, 0, nextNotches,
            cat5Offset, false, embossingText, printInfo)
          angle1 = 0
          nextNotches = bottomOnlyNotches
          bottomOnlyNotches = []
          nextNotches.forEach(notch => notch.center -= tempWallLength)
          notches.forEach(notch => notch.center -= tempWallLength)
          remainingWallLength -= tempWallLength
          cat5Offset -= tempWallLength
        } else if (notches.length == 0) {
          break
        } else {
          let notch = notches.shift()
          if (notch.bottomOnly) {
            bottomOnlyNotches.push(notch)
          } else {
            nextNotches = nextNotches.concat(bottomOnlyNotches)
            bottomOnlyNotches = []
            nextNotches.push(notch)
          }
        }
      }
      // TODO check angles of split walls
      nextNotches = nextNotches.concat(bottomOnlyNotches)
      let embossingText = wallIndex.toString()
      if (k > 0) {
        embossingText += "." + k
      }
      path = wallPath(path, offset, remainingWallLength, angle1, angle2,
          nextNotches, cat5Offset, isPowerCordPort, embossingText, printInfo)

      if (onlyOneWall) break
    }
    // offset[0] += 5
    if (onlyOneWall) break
  }
  
  let width = (offset[2]+1)*WALL_PANEL_WIDTH
  wall.querySelector("path").setAttribute("d", path)
  wall.setAttribute("width", width)
  wall.setAttribute("viewBox", `0 0 ${width} ${WALL_PANEL_HEIGHT}`)
  if (printInfo) {
    printInfo.prints[printInfo.prints.length - 1].svg = wall.outerHTML
  }

  return printInfo
}

function wallPath(path, offset, wallLength, angle1, angle2,
    notches, cat5Offset, isPowerCordPort, embossingText, printInfo) {
  
  let hasWallPort = cat5Offset !== undefined &&
      cat5Offset !== NaN &&
      cat5Offset < wallLength + CAT5_WIDTH/2 &&
      cat5Offset > -CAT5_WIDTH/2

  let wallHeight = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
  offset[0] += wallLength
  if (offset[0] > offset[2]*WALL_PANEL_WIDTH - WALL_SVG_PADDING.right) {
    offset[0] = (offset[2] - 1)*WALL_PANEL_WIDTH + WALL_SVG_PADDING.left + wallLength
    offset[1] += wallHeight + WALL_SVG_GAP
  }
  if (offset[1] + wallHeight > WALL_PANEL_HEIGHT - WALL_SVG_PADDING.bottom) {
    if (printInfo) {
      wall.querySelector("path").setAttribute("d", path)
      printInfo.prints[printInfo.prints.length - 1].svg = wall.outerHTML
      printInfo.prints.push(blankPrint())
      path = ""
      offset[0] = WALL_SVG_PADDING.left + wallLength
    } else {
      offset[0] = offset[2]*WALL_PANEL_WIDTH + WALL_SVG_PADDING.left + wallLength
      offset[2] += 1
    }
    offset[1] = WALL_SVG_PADDING.top
  }

  offset[0] += Math.tan(Math.abs(angle2)) * WALL_THICKNESS

  if (printInfo) {
    let y = WALL_PANEL_HEIGHT - offset[1] - BOTTOM_THICKNESS - CHANNEL_DEPTH/2
    let print = printInfo.prints[printInfo.prints.length - 1]
    let wedge1 = {
      angle: angle1 * 180/Math.PI,
      directionAngle: 0,
      position: [offset[0], y, 0],
      width: CHANNEL_DEPTH,
      thickness: printInfo.thickness,
    }
    if (epsilonEquals(angle1, 0)) {
      wedge1.angle = 45
      wedge1.centered = true
    }
    print.wedges.push(wedge1)
    
    let wedge2 = {
      angle: angle2 * 180/Math.PI,
      directionAngle: 180,
      position: [offset[0] - wallLength, y, 0],
      width: CHANNEL_DEPTH,
      thickness: printInfo.thickness,
    }
    if (epsilonEquals(angle2, 0)) {
      wedge2.angle = -45
      wedge2.centered = true
    }
    print.wedges.push(wedge2)

    if (!hasWallPort && !isPowerCordPort) {
      print.embossings.push({
        text: embossingText,
        position: [offset[0] - wallLength/2, y, 0],
      })
    }

    if (EDGES_DOUBLED && !hasWallPort) {
      let supportX = PIXEL_DISTANCE * (ledAtVertex ? 1.5 : 1)
      supportX += Math.tan(angle1) * CHANNEL_WIDTH/2
      if (angle1 < 0) {
        supportX += Math.tan(angle1) * WALL_THICKNESS
      }
      while (supportX < 0) {
        supportX += PIXEL_DISTANCE
      }
      if (supportX + LED_SUPPORT_WIDTH/2 < wallLength) {
        print.ledSupports.push({
          position: [offset[0] - supportX, y, 0],
          width: LED_SUPPORT_WIDTH,
          height: LED_SUPPORT_HEIGHT,
          thickness: LED_SUPPORT_THICKNESS,
          gap: LED_SUPPORT_GAP,
        })
      }
    }
  }

  let endNotchDepth = trueNotchDepth(wallLength) - WALL_KERF
  let midNotchDepth = trueNotchDepth(wallLength) - NOTCH_KERF
  let extra_end_bit = epsilonEquals(angle1, 0) ? WALL_STRAIGHT_KERF : 0
  let extra_start_bit = epsilonEquals(angle2, 0) ? WALL_STRAIGHT_KERF : 0

  path += `
    M${offset[0] - wallLength + endNotchDepth} ${offset[1]}
    v${BOTTOM_THICKNESS}
    h${-endNotchDepth - extra_start_bit}
    v${CHANNEL_DEPTH}
    h${endNotchDepth + extra_start_bit}
    v${TOP_THICKNESS}`
  for (let {center, bottomOnly} of [...notches].reverse()) { // Top notches
    if (bottomOnly) continue
    path += `
    H${offset[0] - center - midNotchDepth}
    v${-TOP_THICKNESS}
    h${2*midNotchDepth}
    v${TOP_THICKNESS}`
  }
  path += `
    H${offset[0] - endNotchDepth}
    v${-TOP_THICKNESS}
    h${endNotchDepth + extra_end_bit}
    v${-CHANNEL_DEPTH}
    h${-endNotchDepth - extra_end_bit}
    v${-BOTTOM_THICKNESS}`
  for (let {center} of notches) { // Bottom notches
    path += `
    H${offset[0] - center + midNotchDepth}
    v${BOTTOM_THICKNESS}
    h${-2*midNotchDepth}
    v${-BOTTOM_THICKNESS}`
  }
  path += `Z`

  // Is the entry wall for CAT5 port
  if (hasWallPort) {
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

  offset[0] += Math.tan(Math.abs(angle1)) * WALL_THICKNESS
  offset[0] += WALL_SVG_GAP
  return path
}

function decimalPath(x, offset) {
  minX = Math.min(minX, offset[0])
  minY = Math.min(minY, offset[1])

  x = "" + x
  let path = ""
  for (let d of x) {
    if (d == ".") {
      path += `M${offset[0]-2} ${offset[1] + 10}
      v -1 h 1 v 1 Z`
      continue
    }

    switch(d) {
      case "0":
        path += `M${offset[0]} ${offset[1]}
        h 5 v 10 h -5 v -8`
        break
      case "1":
        path += `M${offset[0] + 5} ${offset[1]}
        v 10`
        break
      case "2":
        path += `M${offset[0]} ${offset[1]}
        h 5 v 5 h -5 v 5 h 5`
        break
      case "3":
        path += `M${offset[0]} ${offset[1]}
        h 5 v 10 h -5 m 0 -5 h 5`
        break
      case "4":
        path += `M${offset[0]} ${offset[1]}
        v 5 h 5 v -5 v 10`
        break
      case "5":
        path += `M${offset[0] + 5} ${offset[1]}
        h -5 v 5 h 5 v 5 h -5`
        break
      case "6":
        path += `M${offset[0] + 5} ${offset[1]}
        h -5 v 10 h 5 v -5 h -3`
        break
      case "7":
        path += `M${offset[0]} ${offset[1]}
        h 5 l -4 10`
        break
      case "8":
        path += `M${offset[0]} ${offset[1]}
        h 5 v 10 h -5 v -8 m 0 3 h 3`
        break
      case "9":
        path += `M${offset[0] + 5} ${offset[1] + 10}
        v -10 h -5 v 5 h 3`
        break
    }
    offset[0] += 8
  }
  maxX = Math.max(maxX, offset[0])
  maxY = Math.max(maxY, offset[1] + 10)
  return path
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

async function generateManufacturingInfo() {
  document.querySelectorAll("path.laser").forEach(path => path.setAttribute('d', ""))
  cover.querySelectorAll("text").forEach(elem => cover.removeChild(elem))
  if (isWall) {
    KERF = TOP_KERF
    await createCoverSVG()
    // await createCoverSVG(plains[plains.length - 1])
    console.log(`SVG is ${((maxX - minX)/96).toFixed(1)}" by ${((maxY-minY)/96).toFixed(1)}"`)
    createPrintInfo(true)
  }
}
