
let MM_TO_96DPI = 3.77952755906
let DPI96_TO_MM = 0.26458333333

wallInfo = []
foldWalls = []
covers = {top: [], bottom: []}
entryWallLength = 0
minX = 0
minY = 0
maxX = 0
maxY = 0
coverWedges = null

async function createCoverSVG(plain) {
  let print = blankPrint()
  if (verticies.length <= 1) return

  if (!plain) {
    plain = DEFAULT_PLAIN
  }

  minX = 1e6
  minY = 1e6
  maxX = -1e6
  maxY = -1e6
  const SCALE = PIXEL_DISTANCE / pixelDensity

  // Rotate all verticies to make this plain lie "flat"
  // Also scale verticies to be in mm space
  let v = plain.normal.cross(FORWARD)
  let c = plain.normal.normalize().dot(FORWARD)
  let R = new Matrix().identity()
  let vCross = new Matrix().set(
    0, -v.z, v.y,
    v.z, 0, -v.x,
    -v.y, v.x, 0
  )
  R.add(vCross)
  R.add(vCross.clone().multiply(vCross).divideScalar(1+c))
  for (let vertex of verticies) {
    vertex.oogCoords = vertex.ogCoords
    vertex.ogCoords = vertex.ogCoords.scale(SCALE).applyMatrix(R)
  }
  
  // Gather paths
  let paths = []
  let directedEdges = []
  if (!path) path = [...Array(edges.length).keys()]
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
      if (epsilonEquals(minAngle, Math.PI) &&
          leftmostTurn[0].plains.length <= 1) {
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

  let totalPathString = ""
  let totalBorderString = ""
  let totalChannelString = ""

  for (let dPath of paths) {
    if (exteriorOnly && dPath != outerPath) continue

    let slotString = ""
  	let borderString = ""
    let borderPoints = []
    let channelString = ""

   	for (let i = 0; i < dPath.length; i++) {
      let vertex0 = dPath[i]
      let vertex1 = dPath[(i+1) % dPath.length]
      let vertex2 = dPath[(i+2) % dPath.length]
      let vertex3 = dPath[(i+3) % dPath.length]
  	  let v0 = vertex0.ogCoords
  	  let v1 = vertex1.ogCoords
  	  let v2 = vertex2.ogCoords
  	  let v3 = vertex3.ogCoords
  	  let e0 = v1.sub(v0)
  	  let e1 = v2.sub(v1)
  	  let e2 = v3.sub(v2)

      let a1 = e1.signedAngle(e0)
      let a2 = e1.signedAngle(e2)

      let endCapOffset = CHANNEL_WIDTH * END_CAP_FACTOR * -0.5
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
        e1 = e0.cross(FORWARD).normalize()
      } else {
        e1 = e1.normalize()
      }

      let n = FORWARD.cross(e1)

      let isFinalEdge = dPath == outerPath && e1.normalize().equals(v2.sub(start).normalize())

      let w1 = CHANNEL_WIDTH/2
      let w2 = w1 + WALL_THICKNESS

      let widthFactor1 = a1 > 0 ? w1 : w2
      let lengthOffset1 = -1 / Math.tan((Math.PI - a1)/2)
      lengthOffset1 *= widthFactor1

      let widthFactor2 = a2 < 0 ? w1 : w2
      let lengthOffset2 = -1 / Math.tan((Math.PI - a2)/2)
      lengthOffset2 *= widthFactor2

      let wallLength = edgeLength + lengthOffset2 - lengthOffset1
      let angle1 = a1/2
      let angle2 = -a2/2

      // Logic for fold walls
      let plains1 = dPath[(i+1) % dPath.length].plains
      let plains2 = dPath[(i+2) % dPath.length].plains
      let deadendPlain = null
      let dihedralAngle = 0
      let angleOfIncidence = Math.PI/2

      function addFoldWallInfo(type) {
        let isOne = type == 1
        let plains = (isOne ? plains1 : plains2)
        deadendPlain = plains[0].folds[plains[1].index].rotateAndScale(R, SCALE)
        plains = plains.map(plain => plain.rotateAndScale(R, SCALE))

        let crease = plains[0].intersection(deadendPlain)
        angleOfIncidence = e1.signedAngle(crease.direction) * (isOne ? -1 : 1)
        if (angleOfIncidence < 0) angleOfIncidence += Math.PI
        if (angleOfIncidence > Math.PI) angleOfIncidence -= Math.PI

        let wallStartPoint = (isOne ? v2 : v1)
            .addScaledVector(n, angleOfIncidence > Math.PI/2 ? w2 : w1)
            .addScaledVector(e1, isOne ? lengthOffset2 : lengthOffset1)
        dihedralAngle = plains[0].normal.angleTo(plains[1].normal)
        let sign = (wallStartPoint.isCoplanar(plains[0]) || wallStartPoint.isAbovePlain(plains[0])) &&
            (wallStartPoint.isCoplanar(plains[1]) || wallStartPoint.isAbovePlain(plains[1]))
        if (!sign) {
          dihedralAngle *= -1
        }

        let plainTranslationValue = CHANNEL_DEPTH/2
        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        wallStartPoint = wallStartPoint.addScaledVector(FORWARD, plainTranslationValue)
        let wallEndPoint = deadendPlain.intersection(new Line(wallStartPoint, e1))

        wallLength = wallEndPoint.sub(wallStartPoint).length()
        if (isOne) {
          lengthOffset1 = edgeLength + lengthOffset2 - wallLength
        } else {
          lengthOffset2 = wallLength + lengthOffset1 - edgeLength
        }

        let startingPlain = isOne ? plain : plains2.filter(p => p != plain)[0]
        let vertex = isOne ? vertex1 : vertex2
        let foldWall = { startingPlain, vertex, dihedralAngle, angleOfIncidence }
        foldWall.aoiComplement = Math.PI/2 - angleOfIncidence
        for (let fw of foldWalls) {
          if (fw.vertex == vertex && fw.startingPlain == startingPlain) {
            foldWall = fw
            break
          }
        }
        foldWall[(IS_BOTTOM ? "bottom" : "top") + "Length" + type] = wallLength
        foldWall["miterAngle" + type] = isOne ? angle2 : angle1
        foldWall["lengthOffset" + type] = isOne ? lengthOffset2 : lengthOffset1
        foldWall["edgeLength" + type] = edgeLength
        if (!foldWalls.includes(foldWall)) {
          foldWalls.push(foldWall)
        }
      }

      if (plains1.length == 2) {
        addFoldWallInfo(1)
      } else if (plains2.length == 2) {
        addFoldWallInfo(2)
      } else {

        // Logic for normal walls
        let edgeCenter = v1.addScaledVector(e1, edgeLength/2)
            .addScaledVector(n, w1*1.5)
        let addedToCount = false
        for (let wallType of wallInfo) {
          if (epsilonEquals(wallType.length, wallLength, 0.01) &&
              epsilonEquals(wallType.angle1, angle1, 0.01) &&
              epsilonEquals(wallType.angle2, angle2, 0.01)) {
            if (!wallType.edgeCenters[plain]) {
              wallType.edgeCenters[plain] = []
            }
            wallType.edgeCenters[plain].push(edgeCenter)
            addedToCount = true
            break
          }
        }
        if (!addedToCount) {
          wallInfo.push({
            length: wallLength,
            angle1,
            angle2,
            edgeCenters: {[plain]: [edgeCenter]},
          })
        }
        if (isFinalEdge) {
          entryWallLength = wallLength
        }
      }

      // Slots
      slotString += singleSlotPath(wallLength,
        [e1, n],
        v1,
        [lengthOffset1, CHANNEL_WIDTH/2],
        isFinalEdge,
        print)

      // Border
      let x1 = lengthOffset1 + NOTCH_DEPTH + KERF
      let x2 = edgeLength + lengthOffset2 - NOTCH_DEPTH - KERF
      let width = CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER
      let borderLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      
      if (plains1.length == 2) {
        let plainTranslationValue = CHANNEL_DEPTH/2
        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS + EXTRA_COVER_THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        let line = new Line(v0, e0).translate(FORWARD.scale(plainTranslationValue))
        deadendPlain = deadendPlain.translate(e0.normalize().scale(ORIGAMI_KERF))
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let line2 = line.translate(n.scale(-width))
        let p2 = deadendPlain.intersection(line2)
        borderString += pointsToSVGString([p2, p1])
        borderPoints.push(p2)
        borderPoints.push(p1)

        // fold wall miter
        let skew = -Math.tan(angleOfIncidence - Math.PI/2)
        let angle = Math.atan(Math.tan(dihedralAngle/2) / Math.sin(angleOfIncidence))
        centerPoint = v2.addScaledVector(FORWARD, plainTranslationValue)
        let wedgePoint = deadendPlain.intersection(new Line(centerPoint, e1))
        wedgePoint.z = 0
        print.components.push({
          type: "wedge",
          angle: angle * (IS_BOTTOM ? -1 : 1),
          rotationAngle: e1.signedAngle(LEFT),
          position: wedgePoint.toArray(),
          thickness: THICKNESS + EXTRA_COVER_THICKNESS,
          width: CHANNEL_WIDTH + 2*(WALL_THICKNESS + BORDER),
          skew,
        })
      } else {
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
        borderString += pointsToSVGString(points, [e1, n], v1)
        borderPoints.push(v1
            .addScaledVector(e1, borderLengthOffset)
            .addScaledVector(n, width))
      }

      // Inner Channel
      width = CHANNEL_WIDTH/2 - INNER_CHANNEL_BUFFER
      let channelLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      if (plains1.length == 2) {
        let plainTranslationValue = CHANNEL_DEPTH/2
        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS + EXTRA_COVER_THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        let line = new Line(v0, e0).translate(FORWARD.scale(plainTranslationValue))
        deadendPlain = deadendPlain.translate(e0.normalize().scale(5)) // TODO calculate more properply
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let line2 = line.translate(n.scale(-width))
        let p2 = deadendPlain.intersection(line2)
        channelString += pointsToSVGString([p2, p1])
      } else {
        channelString += pointsToSVGString([[channelLengthOffset, width]], [e1, n], v1)
      }
    } // END for (let i = 0; i < dPath.length; i++)

    let skipBorder = false
    if (imageUrl && imageUrl.endsWith(".pixels") && dPath.length == 4) {
      let center = ZERO
      for (let i = 0; i < 4; i++) {
        center = center.add(dPath[i].ogCoords)
      }
      center = center.scale(0.25 * pixelDensity / PIXEL_DISTANCE)
      let x = Math.round(center.x)
      let y = -Math.round(center.y)
      
      let pixels = await getPixels()
      let offset = x * pixels.stride[0] + y * pixels.stride[1]
      if (pixels.data[offset] + pixels.data[offset+1] + pixels.data[offset+2] == 0) {
        // skip border for black pixels
        skipBorder = true
      }
    }

    // TODO actually detect "negative" area
    let isTooSmall = borderPoints.length == 3 && triangularArea(borderPoints) < 105
    if (!skipBorder && !isTooSmall) {
      borderString = "M" + borderString.substring(1) + "Z "
      totalPathString += borderString
      totalBorderString += borderString
    }
    totalPathString += slotString

    channelString = "M" + channelString.substring(1) + "Z "
    totalChannelString += channelString
  } // END for (let dPath of paths)

  for (let vertex of verticies) {
    vertex.ogCoords = vertex.oogCoords
    delete vertex.oogCoords
  }

  cover.querySelector("path").setAttribute("d", totalPathString)
  let svg = cover.outerHTML
  cover.querySelector("path").setAttribute("d", totalBorderString)
  let borderSvg = cover.outerHTML
  cover.querySelector("path").setAttribute("d", totalChannelString)
  let channelSvg = cover.outerHTML

  print.components.forEach(component => {
    if (component.position) {
      component.position = [
        component.position[0] - minX,
        maxY - 2*minY - component.position[1],
        component.position[2],
      ]
    }
  })

  print.components.push({
    type: "svg",
    svg,
    thickness: THICKNESS,
    position: [0,0,EXTRA_COVER_THICKNESS],
  })
  print.components.push({
    type: "svg",
    svg: borderSvg,
    thickness: EXTRA_COVER_THICKNESS,
  })

  let svgs = [
    {
      svg: svg,
      thickness: THICKNESS,
      position: [0,0,EXTRA_COVER_THICKNESS],
    },
    {
      svg: borderSvg,
      thickness: EXTRA_COVER_THICKNESS,
    },
  ]
  if (INNER_CHANNEL_THICKNESS !== null) {
    print = {
      type: "difference",
      components: [
        print,
        {
          type: "svg",
          svg: channelSvg,
          thickness: THICKNESS - INNER_CHANNEL_THICKNESS,
          position: [0,0,EXTRA_COVER_THICKNESS + INNER_CHANNEL_THICKNESS],
        }
      ]
    }
  }
  print.svg = svg
  return print
}

function singleSlotPath(wallLength, basis, offset, localOffset, isFinalEdge, print) {
  offset = offset.sub(new Vector(0,0, offset.z))
  if (wallLength > 1e6) return ""
  let path = ""
  if (localOffset) {
    offset = offset
        .addScaledVector(basis[0], localOffset[0])
        .addScaledVector(basis[1], localOffset[1])
  }

  function addLatch(x, directionSign) {
    if (LATCH_TYPE == "wedge") {
      let position = offset.addScaledVector(basis[0], x)
          .addScaledVector(basis[1], WALL_THICKNESS/2)
          .addScaledVector(FORWARD, EXTRA_COVER_THICKNESS)
      print.components.push({
        type: "wedge",
        angle: CHANNEL_LATCH_ANGLE,
        rotationAngle: basis[0].scale(directionSign).signedAngle(RIGHT),
        position: position.toArray(),
        thickness: THICKNESS,
        width: WALL_THICKNESS - 2*KERF,
      })
    }
    else if (LATCH_TYPE == "hook") {
      let position = offset.addScaledVector(basis[0], x + HOOK_OVERHANG/2 * directionSign)
          .addScaledVector(basis[1], WALL_THICKNESS/2)
          .addScaledVector(FORWARD, EXTRA_COVER_THICKNESS + THICKNESS - HOOK_THICKNESS/2)
      print.components.push({
        type: "cube",
        rotationAngle: basis[0].scale(directionSign).signedAngle(RIGHT),
        position: position.toArray(),
        dimensions: [HOOK_OVERHANG, WALL_THICKNESS - 2*KERF, HOOK_THICKNESS],
      })
    }

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
    addLatch(xs, 1)
    addLatch(xt, -1)
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
  
  addLatch(xs, 1)
  addLatch(xt, -1)
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
  if (!basis) basis = [RIGHT, UP]
  if (!offset) offset = ZERO

  let s = ""
  for (let point of points) {
    if (point.isVector) {
      point = [point.x, point.y]
    }
  	let truePoint = basis[0].scale(point[0]).addScaledVector(basis[1], point[1])
  	truePoint = truePoint.add(offset)
    if (!coverPrint3D) {
      truePoint = truePoint.scale(MM_TO_96DPI)
    }
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
    type: "union",
    components: [],
  }
}

function setLatestWallSvg(path, printInfo) {
  wall.querySelector("path").setAttribute("d", path)
  printInfo.prints[printInfo.prints.length - 1].components.push({
    type: "svg",
    svg: wall.outerHTML,
    thickness: WALL_THICKNESS
  })
}

function makeNub(position) {
  if (position.isVector) {
    position = [position.x, WALL_PANEL_HEIGHT - position.y, WALL_THICKNESS]
  } else {
    position[2] = WALL_THICKNESS
  }
  return {
    type: "nub",
    width: NUB_WIDTH,
    height: NUB_HEIGHT,
    position,
  }
}

function createPrintInfo3D() {
  printInfo = {
    type: "gcode",
    PROCESS_STOP,
    INFILL_100,
    prints: [],
    // suffix: "walls",
  }
  completedPlains = []
  completedFoldWalls = []
  let vertex = startVertex()
  for (let edgeIndex of path) {
    for (let plain of vertex.plains) {
      if (completedPlains.includes(plain)) continue

      let plainIndex = plains.indexOf(plain)
      let bottomPrint = coverInfo["bottom"][plainIndex]
      bottomPrint.suffix = completedPlains.legnth + "b"
      // TODO add embossing
      printInfo.prints.push(bottomPrint)
      let topPrint = coverInfo["top"][plainIndex]
      topPrint.suffix = completedPlains.legnth + "t"
      // TODO add embossing
      printInfo.prints.push(topPrint)

      completedPlains.push(plain)
    }
    let edge = edges[edgeIndex]
    // TODO assign foldwalls to edges
    for (let foldWall of edge.foldWalls) { // Should always come in pairs
      if (completedFoldWalls.includes(foldWall)) continue

      foldWallCreation(foldWall, printInfo)
      let print = printInfo.prints[printInfo.prints.length - 1]
      let n = completedFoldWalls.length
      print.suffix = Math.floor(n/2) + ((n%2==0) ? "a" : "b")
      // TODO add embossing
    }
  }

  // TODO adjust pixelserver
  //  - Everything but stls in temp folder
  //  - Utilize new "suffix" field and make sure global "suffix" can be empty

  return printInfo
}
  

function createPrintInfo(displayOnly) {
  let printInfo = null
  if (!displayOnly) {
    printInfo = {
      type: "gcode",
      PROCESS_STOP,
      INFILL_100,
      prints: [blankPrint()],
      suffix: "walls",
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
    let targetCount = 0
    for (let plain in wallType.edgeCenters) {
      targetCount += wallType.edgeCenters[plain].length
    }
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
      let context = {
        printInfo,
        offset,
        angle1: wallType.angle1,
        angle2: wallType.angle2,
        isPowerCordPort: wallIndex == powerHoleWallIndex && i == powerHoleInstanceIndex,
      }
      let cat5Offset = NaN
      if (isFinalEdge) {
        if (cat5PortMidway) {
          cat5Offset = wallLength/2
        } else if (cat5PortAtEnd) {
          cat5Offset = wallLength - (NOTCH_DEPTH + CAT5_WIDTH / 2)
        } else {
          cat5Offset = NOTCH_DEPTH + CAT5_WIDTH / 2
        }
      }

      let supportX = PIXEL_DISTANCE * (ledAtVertex ? 1.5 : 1)
      supportX += Math.tan(wallType.angle1) * CHANNEL_WIDTH/2
      if (wallType.angle1 < 0) {
        supportX += Math.tan(wallType.angle1) * WALL_THICKNESS
      }
      
      let notches = generateNotches(wallLength, isFinalEdge)
      let nextNotches = []
      let remainingWallLength = wallLength
      let bottomOnlyNotches = []
      let k = 0
      while (k < 100) {
        if ((notches.length == 0 && remainingWallLength > MAX_WALL_LENGTH) ||
            (notches.length > 0 && notches[0].center > MAX_WALL_LENGTH)) {
          let tempWallLength = nextNotches.pop().center
          let embossingText = `${wallIndex}.${k}`
          k++
          path = wallPath({...context, path, embossingText, cat5Offset, supportX,
            wallLength: tempWallLength,
            angle2: 0,
            notches: nextNotches,
            isPowerCordPort: false
          })
          context.angle1 = 0
          nextNotches = bottomOnlyNotches
          bottomOnlyNotches = []
          nextNotches.forEach(notch => notch.center -= tempWallLength)
          notches.forEach(notch => notch.center -= tempWallLength)
          remainingWallLength -= tempWallLength
          supportX -= tempWallLength
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
      nextNotches = nextNotches.concat(bottomOnlyNotches)
      let embossingText = wallIndex.toString()
      if (k > 0) {
        embossingText += "." + k
      }
      path = wallPath({...context, path, embossingText, cat5Offset, supportX,
        wallLength: remainingWallLength,
        notches: nextNotches
      })

      if (onlyOneWall) break
    }
    if (onlyOneWall) break
  }


  if (printInfo) {
    setLatestWallSvg(path, printInfo)
    path = ""
  }

  for (let foldWall of foldWalls) {
    foldWall.hasWallPort = foldWalls.indexOf(foldWall) == cat5FoldWallIndex
    follWallCreation(foldWall, printInfo)
  }
  
  if (!printInfo) {
    let width = (offset[2]+1)*WALL_PANEL_WIDTH
    wall.querySelector("path").setAttribute("d", path)
    wall.setAttribute("width", width)
    wall.setAttribute("viewBox", `0 0 ${width} ${WALL_PANEL_HEIGHT}`)
  }

  return printInfo
}
function wallPath(context) {
  let {
    path, offset, wallLength, angle1, angle2, notches, cat5Offset,
    isPowerCordPort, embossingText, printInfo, supportX
  } = context

  let print
  if (printInfo) {
    print = printInfo.prints[printInfo.prints.length - 1]
  } else {
    print = blankPrint()
  }
  
  let hasWallPort = cat5Offset !== undefined &&
      cat5Offset !== NaN &&
      cat5Offset < wallLength + CAT5_WIDTH/2 &&
      cat5Offset > -CAT5_WIDTH/2

  offset[0] += wallLength
  if (offset[0] > offset[2]*WALL_PANEL_WIDTH - WALL_SVG_PADDING.right) {
    offset[0] = (offset[2] - 1)*WALL_PANEL_WIDTH + WALL_SVG_PADDING.left + wallLength
    offset[1] += HEIGHT() + WALL_SVG_GAP
  }
  if (offset[1] + HEIGHT() > WALL_PANEL_HEIGHT - WALL_SVG_PADDING.bottom) {
    if (printInfo) {
      setLatestWallSvg(path, printInfo)
      print = blankPrint()
      printInfo.prints.push(print)
      path = ""
      offset[0] = WALL_SVG_PADDING.left + wallLength
    } else {
      offset[0] = offset[2]*WALL_PANEL_WIDTH + WALL_SVG_PADDING.left + wallLength
      offset[2] += 1
    }
    offset[1] = WALL_SVG_PADDING.top
  }

  offset[0] += Math.tan(Math.abs(angle2)) * WALL_THICKNESS
  let endNotchDepth = trueNotchDepth(wallLength) - WALL_KERF
  let midNotchDepth = trueNotchDepth(wallLength) - NOTCH_KERF
  let extra_end_bit = epsilonEquals(angle1, 0) ? WALL_STRAIGHT_KERF : WALL_MITER_KERF
  let extra_start_bit = epsilonEquals(angle2, 0) ? WALL_STRAIGHT_KERF : WALL_MITER_KERF

  // WEDGES
  let y = WALL_PANEL_HEIGHT - offset[1] - THICKNESS - CHANNEL_DEPTH/2
  let wedge1 = {
    type: "wedge",
    angle: angle1,
    rotationAngle: 0,
    position: [offset[0] + extra_end_bit, y, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge1)
  
  let wedge2 = {
    type: "wedge",
    angle: angle2,
    rotationAngle: Math.PI,
    position: [offset[0] - wallLength - extra_start_bit, y, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge2)

  // NUBS
  if (addNubs && wallLength >= NUB_MIN_WALL_LENGTH) {
    let nubY1 = WALL_PANEL_HEIGHT - offset[1] - NUB_WIDTH/2 - NUB_INSET
    let nubY2 = WALL_PANEL_HEIGHT - offset[1] + NUB_WIDTH/2 + NUB_INSET - HEIGHT()

    let x = 0
    let nubX = offset[0] - (x + NOTCH_DEPTH + NUB_INSET_X)
    print.components.push(makeNub([nubX, nubY1]))
    print.components.push(makeNub([nubX, nubY2]))
    for (let notch of notches) {
      x = notch.center
      nubX = offset[0] - (x - NOTCH_DEPTH - NUB_INSET_X)
      print.components.push(makeNub([nubX, nubY1]))
      print.components.push(makeNub([nubX, nubY2]))
      nubX = offset[0] - (x + NOTCH_DEPTH + NUB_INSET_X)
      print.components.push(makeNub([nubX, nubY1]))
      print.components.push(makeNub([nubX, nubY2]))
      x = notch.center
    }
    x = wallLength
    nubX = offset[0] - (x - NOTCH_DEPTH - NUB_INSET_X)
    print.components.push(makeNub([nubX, nubY1]))
    print.components.push(makeNub([nubX, nubY2]))
  }

  // Embossing
  if (!hasWallPort && !isPowerCordPort) {
    print.components.push({
      type: "embossing",
      text: embossingText,
      position: [offset[0] - wallLength/2, y, WALL_THICKNESS],
    })
  }

  // LED SUPPORTS
  if (EDGES_DOUBLED && !noSupports && !hasWallPort) {
    while (supportX < LED_SUPPORT_WIDTH/2) {
      supportX += PIXEL_DISTANCE
    }
    if (supportX + LED_SUPPORT_WIDTH/2 < wallLength) {
      print.components.push({
        type: "ledSupport",
        position: [offset[0] - supportX, y, WALL_THICKNESS],
        width: LED_SUPPORT_WIDTH,
        height: LED_SUPPORT_HEIGHT(),
        thickness: LED_SUPPORT_THICKNESS,
        gap: LED_SUPPORT_GAP,
      })
    }
  }

  let wallSegments = []
  wallSegments = wallSegments.concat(latchPoints(LEFT,UP,true))
  wallSegments.push(LEFT.scale(endNotchDepth))
  wallSegments.push(UP.scale(CHANNEL_DEPTH))
  wallSegments.push(RIGHT.scale(endNotchDepth))
  wallSegments = wallSegments.concat(latchPoints(RIGHT, UP))
  let previousX = endNotchDepth + MAX_LATCH_WIDTH
  for (let {center, bottomOnly} of [...notches].reverse()) { // Top notches
    if (bottomOnly) continue
    wallSegments.push(RIGHT.scale(center - previousX - midNotchDepth - MAX_LATCH_WIDTH))
    wallSegments = wallSegments.concat(latchPoints(RIGHT,DOWN,true))
    wallSegments.push(RIGHT.scale(2*(midNotchDepth + MAX_LATCH_WIDTH)))
    wallSegments = wallSegments.concat(latchPoints(RIGHT,UP))
    previousX = center + midNotchDepth + MAX_LATCH_WIDTH
  }
  wallSegments.push(RIGHT.scale(wallLength - previousX - endNotchDepth - MAX_LATCH_WIDTH))

  wallSegments = wallSegments.concat(latchPoints(RIGHT,DOWN,true))
  wallSegments.push(RIGHT.scale(endNotchDepth))
  wallSegments.push(DOWN.scale(CHANNEL_DEPTH))
  wallSegments.push(LEFT.scale(endNotchDepth))
  wallSegments = wallSegments.concat(latchPoints(LEFT, DOWN))
  previousX = wallLength - endNotchDepth - MAX_LATCH_WIDTH
  for (let {center} of [...notches]) { // Top notches
    wallSegments.push(LEFT.scale(previousX - center - midNotchDepth - MAX_LATCH_WIDTH))
    wallSegments = wallSegments.concat(latchPoints(LEFT,UP,true))
    wallSegments.push(LEFT.scale(2*(midNotchDepth + MAX_LATCH_WIDTH)))
    wallSegments = wallSegments.concat(latchPoints(LEFT,DOWN))
    previousX = center - midNotchDepth - MAX_LATCH_WIDTH
  }

  path += ` M${offset[0] - wallLength + endNotchDepth + MAX_LATCH_WIDTH} ${offset[1]}`
  for (let seg of wallSegments) {
    path += ` l${seg.x} ${seg.y}`
  }
  path += " Z"

  // Is the entry wall for CAT5 port
  if (hasWallPort) {
    path += portPath(offset[0] - cat5Offset, offset[1], print)
  }
  // Hole for power cord port
  if (isPowerCordPort) {
    if (2*POWER_HOLE_RADIUS > CHANNEL_DEPTH) {
      console.error("Power cord hole doesn't fit!")
    }
    let r = POWER_HOLE_RADIUS
    let x1 = offset[0] - wallLength/2 - r
    let y1 = offset[1] + THICKNESS + CHANNEL_DEPTH/2
    path += `
      M${x1} ${y1}
      a ${r},${r} 0 1,0 ${r*2},0
      a ${r},${r} 0 1,0,${-r*2},0`
  }

  offset[0] += Math.tan(Math.abs(angle1)) * WALL_THICKNESS
  offset[0] += WALL_SVG_GAP
  return path
}

function follWallCreation(foldWall, printInfo) {
  if (!printInfo) return

  foldWall.zRotationAngle = Math.atan(Math.tan(foldWall.dihedralAngle/2) / Math.cos(foldWall.aoiComplement))
  foldWall.yRotationAngle = Math.atan(Math.tan(foldWall.aoiComplement) * Math.cos(foldWall.zRotationAngle))

  let translation = {
    type: "translate",
    position: [0, 0, -WALL_THICKNESS],
  }
  let flipOver = {
    type: "rotate",
    axis: [0,1,0],
    angle: Math.PI,
  }

  if (epsilonEquals(foldWall.yRotationAngle, 0)) {
    printInfo.prints.push({
      type: "union",
      components: [
        foldWallHalf(foldWall, true),
        foldWallHalf(foldWall, false),
      ]
    })
    return
  }
  if (PRINT_WALL_HALVES_SEPARATELY) {
    // Left (female) side
    printInfo.prints.push({
      type: "difference",
      components: [
        foldWallHalf(foldWall, true),
        {
          type: "innerwallbit",
          isFemale: true,
          thickness: WALL_THICKNESS - 2*INNER_WALL_EXTERIOR_THICKNESS,
          operations: [
            {
              type: "rotate",
              axis: [0,0,1],
              angle: Math.PI/2 - foldWall.zRotationAngle,
            },
            {
              type: "translate",
              position: [0,WALL_PANEL_HEIGHT, INNER_WALL_EXTERIOR_THICKNESS],
            },
          ],  
        },
      ]
    })
    
    // Right (male) side
    let rightPrint = {
      type: "union",
      components: [
        foldWallHalf(foldWall, false),
        {
          type: "difference",
          operations: [
            {
              type: "translate",
              position: [0,WALL_PANEL_HEIGHT, INNER_WALL_EXTERIOR_THICKNESS + INNER_WALL_KERF],
            },
            {
              type: "rotate",
              axis: [0,1,0],
              angle: foldWall.yRotationAngle * 2,
            },
          ],
          components: [
            {
              type: "innerwallbit",
              isFemale: false,
              thickness: WALL_THICKNESS - 2*INNER_WALL_EXTERIOR_THICKNESS - 2*INNER_WALL_KERF,
              operations: [
                {
                  type: "rotate",
                  axis: [0,0,1],
                  angle: Math.PI/2 - foldWall.zRotationAngle,
                },
              ],  
            },
            {
              type: "cube",
              position: [50, 0, 0],
              dimensions: [100, 100, 100],
            }
          ]
        },
      ]
    }
    if (foldWall.yRotationAngle < 0) {
      rightPrint.operations = [flipOver]
      rightPrint.components[0].operations = [translation]
      rightPrint.components[1].operations.unshift(translation)
    }
    printInfo.prints.push(rightPrint)
  }
  else { // !PRINT_WALL_HALVES_SEPARATELY
    let print = {
      type: "union",
      components: [
        foldWallHalf(foldWall, true),
        {
          operations: [{
            type: "rotate",
            axis: [0,1,0],
            angle: foldWall.yRotationAngle * 2,
          }],
          ...foldWallHalf(foldWall, false)
        },
      ]
    }
    if (foldWall.yRotationAngle < 0) {
      print.operations = [flipOver]
      print.components[0].operations = [translation]
      print.components[1].operations.unshift(translation)
    }
    printInfo.prints.push(print)
  }
}
function foldWallHalf(foldWall, isLeft) {
  let topLength = isLeft ? foldWall.topLength1 : foldWall.topLength2
  let bottomLength = isLeft ? foldWall.bottomLength1 : foldWall.bottomLength2
  let miterAngle = isLeft ? foldWall.miterAngle1 : foldWall.miterAngle2
  let print = blankPrint()
  let path = ""
  
  let connectionMiterAngle = -foldWall.aoiComplement // THIS ANGLE IS WRONG!
  // let connectionMiterAngle = atan(tan(foldWall.angleOfIncidence - Math.PI/2) * )
  let rotationAngle = foldWall.zRotationAngle * (isLeft ? 1 : -1)

  let E = RIGHT.rotate(FORWARD, rotationAngle)
  let N = E.cross(FORWARD).negate()
  if (isLeft) {
    E = E.negate()
  }

  // console.log((CHANNEL_DEPTH + THICKNESS) - (topLength - bottomLength)/Math.tan(foldWall.zRotationAngle))

  let endNotchDepth = NOTCH_DEPTH - WALL_KERF
  let extraOffset = ZERO
  if (foldWall.dihedralAngle < 0) {
    extraOffset = E.scale(THICKNESS * dihedralRatio)
  }

  let dihedralRatio = 1 / Math.cos(rotationAngle)
  let wallSegments = [UP.scale(CHANNEL_DEPTH/2 * dihedralRatio)]
  if (foldWall.dihedralAngle < 0) {
    if (coverPrint3D) {
      wallSegments.push(extraOffset)
    } else {
      wallSegments.push(UP.scale(THICKNESS * dihedralRatio))
      wallSegments.push(N.scale(-THICKNESS))
    }
  }
  wallSegments.push(E.scale(endNotchDepth))
  wallSegments = wallSegments.concat(latchPoints(E,N))
  wallSegments.push(E.scale(topLength - 2*(endNotchDepth + MAX_LATCH_WIDTH)))
  wallSegments = wallSegments.concat(latchPoints(E,N.negate(), true))
  wallSegments = wallSegments.concat([
    E.scale(endNotchDepth + WALL_MITER_KERF),
    N.scale(-CHANNEL_DEPTH),
    E.scale(-endNotchDepth - WALL_MITER_KERF),
  ])
  wallSegments = wallSegments.concat(latchPoints(E.negate(),N.negate()))
  wallSegments.push(E.scale(-bottomLength + 2*(endNotchDepth + MAX_LATCH_WIDTH)))
  wallSegments = wallSegments.concat(latchPoints(E.negate(),N, true))
  wallSegments.push(E.scale(-endNotchDepth))
  if (foldWall.dihedralAngle > 0) {
    if (coverPrint3D) {
      wallSegments.push(E.scale(-THICKNESS * Math.tan(foldWall.zRotationAngle)))
    } else {
      wallSegments.push(N.scale(-THICKNESS))
    }
  }

  let xOffset = (WALL_THICKNESS * Math.abs(Math.tan(foldWall.yRotationAngle))) * (isLeft ? -1 : 1)
  let yOffset = xOffset * Math.tan(rotationAngle)
  let offset = RIGHT.scale(xOffset)
      .addScaledVector(UP, yOffset)

  path += ` M${xOffset} ${yOffset}`
  for (let seg of wallSegments) {
    path += ` l${seg.x} ${seg.y}`
  }
  path += " Z"

  // if (foldWall.hasWallPort && isLeft) {
  //   path += portPath(xOffset - foldWall.bottomLength1 + CAT5_WIDTH/2 + NOTCH_DEPTH,
  //                    -THICKNESS, print)
  // }

  // Wedges
  // End wedge
  let position = wallSegments[0].add(offset)
      .addScaledVector(E, topLength + WALL_MITER_KERF)
      .addScaledVector(N, -CHANNEL_DEPTH/2)
  let wedge = {
    type: "wedge",
    angle: isLeft ? foldWall.miterAngle1 : foldWall.miterAngle2,
    rotationAngle: -rotationAngle + (isLeft ? Math.PI : 0),
    position: [position.x, WALL_PANEL_HEIGHT - position.y, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge)

  // Wedge to join with other half
  let skew = -Math.tan(rotationAngle)
  wedge = {
    type: "wedge",
    angle: foldWall.aoiComplement,
    skew,
    rotationAngle: -rotationAngle + (isLeft ? 0 : Math.PI),
    position: [xOffset, WALL_PANEL_HEIGHT - yOffset, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge)


  // LED supports
  let startV = offset
      .add(extraOffset)
      .addScaledVector(UP, CHANNEL_DEPTH/2 * dihedralRatio)
      .addScaledVector(E, topLength)
      .addScaledVector(N, -CHANNEL_DEPTH/2)
      .addScaledVector(E, isLeft ? -foldWall.lengthOffset1 : -foldWall.lengthOffset2)
  position = null

  if (isLeft &&
      !noSupports &&
      !foldWall.hasWallPort &&
      (foldWall.yRotationAngle > 0 ||
       PRINT_WALL_HALVES_SEPARATELY)) {

    position = startV.addScaledVector(E, -PIXEL_DISTANCE * (ledAtVertex ? 1.5 : 1))
  }
  if (!isLeft &&
      !noSupports &&
      bottomLength > PIXEL_DISTANCE * 3 &&
      foldWall.yRotationAngle > 0 &&
      PRINT_WALL_HALVES_SEPARATELY) {
    console.log("b")

    let supportOffset = foldWall.edgeLength2 + PIXEL_DISTANCE * (ledAtVertex ? 0.5 : 0)
    offsetNegative = supportOffset % PIXEL_DISTANCE
    if (offsetNegative < LED_SUPPORT_WIDTH/2) {
      offsetNegative += PIXEL_DISTANCE
    }
    supportOffset -= offsetNegative
    position = startV.addScaledVector(E, -supportOffset)
  }
  if (position) {
    print.components.push({
      type: "ledSupport",
      position: [position.x, WALL_PANEL_HEIGHT - position.y, WALL_THICKNESS],
      width: LED_SUPPORT_WIDTH,
      height: LED_SUPPORT_HEIGHT(),
      thickness: LED_SUPPORT_THICKNESS,
      gap: LED_SUPPORT_GAP,
      rotationAngle: -rotationAngle,
    })
  }

  if (addNubs) { // Nubs
    let nub = wallSegments[0].add(offset)
        .addScaledVector(E, NUB_INSET_X + NOTCH_DEPTH)
        .addScaledVector(N, -NUB_INSET - NUB_WIDTH/2 + THICKNESS)
        .add(extraOffset)
    if (topLength >= NUB_MIN_WALL_LENGTH) print.components.push(makeNub(nub))
    nub = nub.addScaledVector(E, topLength - 2*(NUB_INSET_X + NOTCH_DEPTH))
    if (topLength >= NUB_MIN_WALL_LENGTH) print.components.push(makeNub(nub))
    nub = nub.addScaledVector(N, -HEIGHT() + NUB_WIDTH + 2*NUB_INSET)
    if (bottomLength >= NUB_MIN_WALL_LENGTH) print.components.push(makeNub(nub))
    nub = nub.addScaledVector(E, -bottomLength + 2*(NUB_INSET_X + NOTCH_DEPTH))
    if (bottomLength >= NUB_MIN_WALL_LENGTH) print.components.push(makeNub(nub))
  }

  wall.querySelector("path").setAttribute("d", path)
  print.components.push({
    type: "svg",
    svg: wall.outerHTML,
    thickness: WALL_THICKNESS,
  })

  return print
}

function latchPoints(E, N, reverse) {
  let points = []
  switch (LATCH_TYPE) {
    case "wedge":
      points = [
        E.scale(ANTI_CORNER),
        N.scale(THICKNESS).addScaledVector(E, -ANTI_CORNER),
        E.scale(MAX_LATCH_WIDTH),
      ]
      break
    case "hook":
      points = [
        E.scale(HOOK_OVERHANG + HOOK_KERF),
        N.scale(HOOK_THICKNESS + 2*HOOK_KERF),
        E.scale(-HOOK_OVERHANG - HOOK_KERF),
        N.scale(THICKNESS - (HOOK_THICKNESS + 2*HOOK_KERF))
         .addScaledVector(E, HOOK_SLOPE),
        E.scale(HOOK_WIDTH - HOOK_SLOPE),
        N.scale(-THICKNESS + HOOK_KERF),
        E.scale(HOOK_GAP),
        N.scale(THICKNESS - HOOK_KERF),
        E.scale(MAX_LATCH_WIDTH - HOOK_WIDTH - HOOK_GAP),
      ]
      break
  }
  if (reverse) {
    points.reverse()
  }
  return points
}

function portPath(x, y, print) {
  let x1 = x - CAT5_WIRES_WIDTH/2 - CAT5_ADDITONAL_OFFSET
  let y1 = y + THICKNESS + CHANNEL_DEPTH
  let x2 = x - CAT5_SNAP_DISTANCE/2 - CAT5_ADDITONAL_OFFSET
  let y2 = y1 - CAT5_HEIGHT + CAT5_SNAP_Y

  print.components.push({
    type: "qtClip",
    position: [x1 + CAT5_WIRES_WIDTH/2, WALL_PANEL_HEIGHT - y1 + CAT5_WIRES_HEIGHT, 0]
  })

  return `
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
  if (isWall) {
    KERF = TOP_KERF
    foldWalls = []
    covers = {top: [], bottom: []}
    
    IS_BOTTOM = false
    window.KERF = TOP_KERF
    window.ORIGAMI_KERF = TOP_ORIGAMI_KERF == null ? ORIGAMI_KERF : TOP_ORIGAMI_KERF
    for (let plain of plains) {
      covers.top.push(await createCoverSVG(plain))
      console.log(`Top svg ${covers.top.length-1} is ${((maxX - minX)/96).toFixed(2)}" by ${((maxY-minY)/96).toFixed(2)}"`)
    }
    wallInfo = [] // Avoid duplicating wall info
    IS_BOTTOM = true
    window.KERF = BOTTOM_KERF
    window.ORIGAMI_KERF = BOTTOM_ORIGAMI_KERF == null ? ORIGAMI_KERF : BOTTOM_ORIGAMI_KERF
    for (let plain of plains) {
      covers.bottom.push(await createCoverSVG(plain))
      console.log(`Bottom svg ${covers.bottom.length-1} is ${((maxX - minX)/96).toFixed(2)}" by ${((maxY-minY)/96).toFixed(2)}"`)
    }
    coverPostProcessingFunction(covers)
    if (covers.bottom.length[0]) {
      document.getElementById("cover").outerHTML = covers.bottom[0].svg
    }

    wallInfo.sort((a,b) => a.length - b.length)
    createPrintInfo(true)
  }
}
