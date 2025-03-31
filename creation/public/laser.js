
let MM_TO_96DPI = 3.77952755906
let DPI96_TO_MM = 0.26458333333

foldWalls = []
covers = {top: [], bottom: []}
minX = 1e6
minY = 1e6
maxX = -1e6
maxY = -1e6

edgeToWalls = {}

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

  // Rotate all verticies to make this plain lie "flat"
  // Also scale verticies to be in mm space
  let v = plain.normal.cross(FORWARD)
  let c = plain.normal.dot(FORWARD)
  let R = new Matrix().identity()
  // if (c < 0) {
  //   c *= -1
  //   v = v.negate()
  // }

  let vCross = new Matrix().set(
    0, -v.z, v.y,
    v.z, 0, -v.x,
    -v.y, v.x, 0
  )
  R.add(vCross)
  if (epsilonEquals(c, -1)) {
    R.set(-1,0,0,0,1,0,0,0,-1)
  } else {
    R.add(vCross.clone().multiply(vCross).divideScalar(1+c))
  }
  for (let vertex of verticies) {
    vertex.oogCoords = vertex.ogCoords
    vertex.ogCoords = vertex.ogCoords.scale(SCALE()).applyMatrix(R)
  }
  
  let zOffset = 0
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
    zOffset = edge.verticies[0].ogCoords.z
  }

  let outerPath = null

  for (let i = 0; i < 1000; i++) {
    if (directedEdges.length == 0) break
    let lastEdge = directedEdges.pop()
    let dPath = [...lastEdge]
    let cumulativeAngle = 0

    for (let j = 0; j < 1000; j++) {
      let e0 = dPath.last().ogCoords.sub(dPath.last(2).ogCoords)
      let leftmostTurn = null
      let minAngle = 7

      if (dPath[0] == dPath.last()) {
        let e1 = dPath[1].ogCoords.sub(dPath[0].ogCoords)
        minAngle = e1.signedAngle(e0)
      }

      for (let dEdge of directedEdges) {
        let [v0, v1] = dEdge
        if (dPath.last() != v0) continue

        let e1 = v1.ogCoords.sub(v0.ogCoords)
        
        let a = e1.signedAngle(e0)
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
      directedEdges.remove(leftmostTurn)
      cumulativeAngle += minAngle
      dPath.push(leftmostTurn[1])
    }
    dPath.pop() // Remove duplicated first/last vertex

    e0 = dPath[0].ogCoords.sub(dPath.last().ogCoords)
    e1 = dPath[1].ogCoords.sub(dPath[0].ogCoords)
    let lastAngle = e1.signedAngle(e0)

    // Check if first/last vertex doubles back
    if (dPath[0].plains.length == 1 && epsilonEquals(lastAngle, Math.PI)) {
      dPath.unshift(dPath[0]) // Add cap
    }

    cumulativeAngle += lastAngle
    if (epsilonEquals(cumulativeAngle, 2*Math.PI)) {
      outerPath = dPath
    } else if (!epsilonEquals(cumulativeAngle, -2*Math.PI)) {
      // Should always be either 2pi or -2pi
      console.log("Cumulative angle not single turn: " + cumulativeAngle);
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

      let associatedEdge = vertex1.edgeInDirection(e1)
      if (!associatedEdge) { // Assumed due to end cap
        associatedEdge = vertex1.edges[0]
      }

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

      let wallCorner = v2
          .addScaledVector(n, CHANNEL_WIDTH/2 + WALL_THICKNESS)
          .addScaledVector(e1, Math.tan(angle2) * CHANNEL_WIDTH/2)
      if (angle2 > 0) {
        wallCorner = wallCorner.addScaledVector(e1, Math.tan(angle2) * WALL_THICKNESS)
      }
      let worldPlacementOperations = [
        {
          type: "rotate",
          axis: [1, 0, 0],
          angle: Math.PI/2,
        },
        {
          type: "rotate",
          axis: [0, 0, 1],
          angle: RIGHT.signedAngle(e1),
        },
        {
          type: "translate",
          position: wallCorner.toArray(),
        },
        {
          type: "matrix3",
          M: R.invert().toArray(),
        },
        {
          type: "mirror",
          normal: [0, 1, 0],
        },
      ]

      // Logic for fold walls
      let plains1 = vertex1.plains
      let plains2 = vertex2.plains

      function addFoldWallInfo(type) {
        let isOne = type == 1
        let vertex = isOne ? vertex1 : vertex2
        let {deadendPlain, dihedralAngle, aoiComplement} =
            vertex.fold().getCoverInfo(plain, isOne)
        deadendPlain = deadendPlain.rotateAndScale(R, SCALE())

        let outerV = isOne ? v2 : v1
        let wallStartPoint = outerV
            .addScaledVector(n, aoiComplement < 0 ? w2 : w1)
            .addScaledVector(e1, isOne ? lengthOffset2 : lengthOffset1)

        let plainTranslationValue = CHANNEL_DEPTH/2
        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        wallStartPoint = wallStartPoint.addScaledVector(FORWARD, plainTranslationValue)
        let wallEndPoint = deadendPlain.intersection(new Line(wallStartPoint, e1))

        if (wallEndPoint.sub(wallStartPoint).normalize().dot(e1) * (isOne ?-1:1) < 0) {
          console.log("wallStartPoint on wrong side of deadend plain!", isOne ? vertex1 : vertex2)
        }
        wallLength = wallEndPoint.sub(wallStartPoint).length()
        if (isOne) {
          lengthOffset1 = edgeLength + lengthOffset2 - wallLength
        } else {
          lengthOffset2 = wallLength + lengthOffset1 - edgeLength
        }

        // World placement adjustments
        let outerPoint = outerV
            .addScaledVector(n, w2)
            .addScaledVector(e1, isOne ? lengthOffset2 : lengthOffset1)
        let wallCorner = deadendPlain.intersection(new Line(outerPoint, e1))

        worldPlacementOperations[2].position = wallCorner.toArray()
        worldPlacementOperations.splice(1, 0, {
          type: "mirror",
          normal: [1,0,0],
        })
        worldPlacementOperations.splice(2, 0, {
          type: "rotate",
          axis: [0,1,0],
          angle: 0, // Create stub so other functions can manipulate this angle
        })

        vertex.fold().addFoldWallInfo({
          plain,
          isOutgoing: isOne,
          wallLength,
          angle: isOne ? angle2 : angle1,
          lengthOffset: isOne ? lengthOffset2 : lengthOffset1,
          edgeLength,
          worldPlacementOperations,
        })
        associateWallWithEdge(vertex.fold().getWall(plain, isOne), associatedEdge)

      }

      if (plains1.length == 2) {
        addFoldWallInfo(1)
      } else if (plains2.length == 2) {
        addFoldWallInfo(2)
      } else {
        associateWallWithEdge({
          miterAngle: angle1,
          lengthOffset1,
          dihedralAngle: 0,
          zRotationAngle: 0,
          aoiComplement: angle2,
          yRotationAngle: angle2,
          length: wallLength,
          edgeLength,
          worldPlacementOperations,
          leftVertex: vertex1,
          vertex: vertex2,
        }, associatedEdge)
      }

      // Slots
      slotString += singleSlotPath(wallLength,
        [e1, n],
        v1,
        [lengthOffset1, CHANNEL_WIDTH/2],
        print)

      // Border
      let x1 = lengthOffset1 + NOTCH_DEPTH + KERF
      let x2 = edgeLength + lengthOffset2 - NOTCH_DEPTH - KERF
      let width = CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER
      let borderLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      
      if (plains1.length == 2) {
        let {deadendPlain, dihedralAngle, angleOfIncidence} = vertex1.fold().getCoverInfo(plain, true)

        let plainTranslationValue = CHANNEL_DEPTH/2
        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS + EXTRA_COVER_THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        let line = new Line(v0, e0).translate(FORWARD.scale(plainTranslationValue))
        deadendPlain = deadendPlain.rotateAndScale(R, SCALE())
        deadendPlain = deadendPlain.translate(e0.normalize().scale(ORIGAMI_KERF))
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let line2 = line.translate(n.scale(-width))
        let p2 = deadendPlain.intersection(line2)
        borderString += pointsToSVGString([p2, p1])
        borderPoints.push(p2)
        borderPoints.push(p1)

        // fold wall miter
        let skew = Math.tan(angleOfIncidence - Math.PI/2)
        let angle = Math.atan(Math.tan(dihedralAngle/2) / Math.sin(angleOfIncidence))
        centerPoint = v2.addScaledVector(FORWARD, plainTranslationValue)
        let wedgePoint = deadendPlain.intersection(new Line(centerPoint, e1))
        wedgePoint.z = 0
        print.components.push({
          type: "wedge",
          angle: angle * (IS_BOTTOM ? -1 : 1),
          rotationAngle: -e1.signedAngle(LEFT),
          position: wedgePoint.toArray(),
          thickness: THICKNESS + EXTRA_COVER_THICKNESS,
          width: CHANNEL_WIDTH + 2*(WALL_THICKNESS + BORDER),
          skew,
        })
      } else {
        // if (isFinalEdge && IS_BOTTOM && CAT5_HEIGHT > CHANNEL_DEPTH) {
        //   if (cat5PortMidway) {
        //     x1 = (x1 + x2 - CAT5_WIDTH) / 2
        //   }
        //   x1 += CAT5_ADDITONAL_OFFSET
        //   points = [
        //     [borderLengthOffset, width],
        //     [x1, width],
        //     [x1, width - BORDER],
        //     [x1 + CAT5_WIDTH, width - BORDER],
        //     [x1 + CAT5_WIDTH, width],
        //   ]
        // } else {
          points = [[borderLengthOffset, width]]
        // }
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
        let {deadendPlain, dihedralAngle} = vertex1.fold().getCoverInfo(plain, true)

        plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS + EXTRA_COVER_THICKNESS
        plainTranslationValue *= IS_BOTTOM ? 1 : -1
        let line = new Line(v0, e0).translate(FORWARD.scale(plainTranslationValue))
        deadendPlain = deadendPlain.rotateAndScale(R, SCALE())
        deadendPlain = deadendPlain.translate(e0.normalize().scale(5)) // TODO calculate more properply
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let line2 = line.translate(n.scale(-width))
        let p2 = deadendPlain.intersection(line2)
        channelString += pointsToSVGString([p2, p1])
      } else {
        channelString += pointsToSVGString([[channelLengthOffset, width]], [e1, n], v1)
      }

      // Embossed id
      if (!findEmbossing(print)) {
        if (RENDER_MODE == "standard" && !NO_EMBOSSING &&
            !findEmbossing(print) && plains1.length == 1) {
          let z = EXTRA_COVER_THICKNESS + (INNER_CHANNEL_THICKNESS ? INNER_CHANNEL_THICKNESS : THICKNESS)
          let embossing = {
            type: "embossing",
            position: [v1.x, v1.y, z],
            text: "...", // To be filled in later in the process
          }
          if (!IS_BOTTOM) {
            embossing.operations = [{type: "mirror", normal: [1,0,0]}]
            embossing.position[0] *= -1
          }
          print.components.push(embossing)
        }
        if (RENDER_MODE == "parts") {
          let embossing = {
            type: "embossing",
            position: [v1.x, v1.y, -1],
            thickness: 1,
            text: "...", // To be filled in later in the process
          }
          if (IS_BOTTOM) {
            embossing.operations = [{type: "mirror", normal: [1,0,0]}]
            embossing.position[0] *= -1
          }
          print.components.push(embossing)
        }
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

  let importCorrectionOperations = [
    {
      type: "translate",
      position: [minX, 2*minY - maxY, 0]
    },
    {
      type: "mirror",
      normal: [0,1,0],
    }
  ]

  if (RENDER_MODE == "standard") {
    print.components.push({
      type: "svg",
      svg,
      thickness: THICKNESS,
      position: [0,0,EXTRA_COVER_THICKNESS],
      operations: importCorrectionOperations,
    })
    print.components.push({
      type: "svg",
      svg: borderSvg,
      thickness: EXTRA_COVER_THICKNESS,
      operations: importCorrectionOperations,
    })

    if (INNER_CHANNEL_THICKNESS !== null) {
      let embo = findEmbossing(print)
      print = {
        type: "difference",
        components: [
          print,
          {
            type: "svg",
            svg: channelSvg,
            thickness: THICKNESS - INNER_CHANNEL_THICKNESS,
            position: [0,0,EXTRA_COVER_THICKNESS + INNER_CHANNEL_THICKNESS],
            operations: importCorrectionOperations,
          }
        ],
      }
      if (embo) {
        print = {
          type: "union",
          components: [print, embo],
        }
      }
    }
  } else { // RENDER_MODE != "standard"
    print.components.push({
      type: "svg",
      svg: borderSvg,
      thickness: EXTRA_COVER_THICKNESS + THICKNESS,
      operations: importCorrectionOperations,
    })
  }
  print.svg = svg

  print.worldPlacementOperations = [
    {
      type: "translate",
      position: [0, 0, -(CHANNEL_DEPTH/2 + THICKNESS + EXTRA_COVER_THICKNESS)],
    },
  ]
  if (IS_BOTTOM) {
    print.worldPlacementOperations.push({
      type: "mirror",
      normal: [0,0,1],
    })
  }
  print.worldPlacementOperations.push({
    type: "translate",
    position: [0, 0, zOffset],
  })
  print.worldPlacementOperations.push({
    type: "matrix3",
    M: R.invert().toArray(),
  })
  print.worldPlacementOperations.push({
      type: "mirror",
      normal: [0, 1, 0],
  })

  return print
}

function associateWallWithEdge(wall, associatedEdge) {
  if (IS_BOTTOM) return
  if (!edgeToWalls[associatedEdge.index]) {
    edgeToWalls[associatedEdge.index] = []
  }
  if (!edgeToWalls[associatedEdge.index].includes(wall)) {
    edgeToWalls[associatedEdge.index].push(wall)
  }
}

function singleSlotPath(wallLength, basis, offset, localOffset, print) {
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
        angle: CHANNEL_LATCH_ANGLE * Math.PI / 180,
        rotationAngle: -basis[0].scale(directionSign).signedAngle(RIGHT),
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
        rotationAngle: -basis[0].scale(directionSign).signedAngle(RIGHT),
        position: position.toArray(),
        dimensions: [HOOK_OVERHANG, WALL_THICKNESS - 2*KERF, HOOK_THICKNESS],
      })
    }
  }

  let trueNotchDepth = NOTCH_DEPTH
  if (2*NOTCH_DEPTH + MIN_NON_NOTCH_LENGTH > wallLength) {
    trueNotchDepth =  (wallLength - MIN_NON_NOTCH_LENGTH)/2
  }

  let w1 = KERF
  let w2 = WALL_THICKNESS - KERF
  let xs = trueNotchDepth + KERF
  let xt = wallLength - (trueNotchDepth + KERF)

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
  printInfo.prints.last().components.push({
    type: "svg",
    svg: wall.outerHTML,
    thickness: WALL_THICKNESS
  })
}


function createFullModel() {
  let print = blankPrint()
  print.suffix = "_full"
  print.operations = [{ type: "rotate", axis: [1,0,0], angle: -Math.PI/2 }]

  for (let type of ["top", "bottom"]) {
    for (let coverPrint of covers[type]) {
      coverPrint.operations = coverPrint.worldPlacementOperations
      print.components.push(coverPrint)
    }
  }

  let completedParts = {}
  for (let edge of edges) {
    if (edge.isDupe) continue
    for (let wall of edgeToWalls[edge.index]) {
      if (completedParts[wall.partID]) continue
      if (wall.isFoldWall) {
        if (wall.aoiComplement < -0.0001) {
          console.log(wall)
        }
        let wallPrint1 = wallPrints(wall, true)[0]
        wallPrint1.operations = [...wall.worldPlacementOperations1]
        wallPrint1.operations[2] = {...wallPrint1.operations[2]}
        wallPrint1.operations[2].angle += wall.zRotationAngle
        if (wall.aoiComplement < -0.0001) {
          let sign = Math.sign(Math.cos(wallPrint1.operations[2].angle)) // This is probably not right
          console.log(sign)
          wallPrint1.operations.splice(3, 0, {
            type: "translate",
            position: [sign * Math.tan(wall.aoiComplement) * WALL_THICKNESS, 0, 0],
          })
        }
        print.components.push(wallPrint1)

        let wallPrint2 = wallPrints(wall, false)[0]
        wallPrint2.operations = [...wall.worldPlacementOperations2]
        wallPrint2.operations[2] = {...wallPrint2.operations[2]}
        wallPrint2.operations[2].angle -= wall.zRotationAngle
        if (wall.aoiComplement < -0.0001) {
          let sign = -Math.sign(Math.cos(wallPrint2.operations[2].angle)) // This is probably not right
          wallPrint2.operations.splice(3, 0, {
            type: "translate",
            position: [sign * Math.tan(wall.aoiComplement) * WALL_THICKNESS, 0, 0],
          })
        }
        print.components.push(wallPrint2)
      } else {
        let wallPrint = wallPrints(wall, true)[0]
        wallPrint.operations = wall.worldPlacementOperations
        print.components.push(wallPrint)
      }
      completedParts[wall.partID] = true
    }
  }

  return {
    type: "gcode",
    prints: [print],
    PROCESS_STOP: "stl",
  }
}

function createPrintInfo3D() {
  printInfo = {
    type: "gcode",
    PROCESS_STOP,
    INFILL_100,
    prints: [],
  }
  completedPlains = []
  completedWalls = []
  let vertex = startVertex()
  let partID = 1
  
  for (let edgeIndex of path) {
    let edge = edges[edgeIndex]
    vertex = edge.otherVertex(vertex)
    if (edge.isDupe) {
      edgeIndex = edge.dual.index
    }

    for (let wall of edgeToWalls[edgeIndex]) {
      if (completedWalls.includes(wall)) continue
      wall.partID = partID
      if (wall.isFoldWall) {
        foldWallCreation(wall, printInfo)
      } else {
        printInfo.prints = [...printInfo.prints, ...wallPrints(wall, true)]
      }
      completedWalls.push(wall)
      partID += 1
    }

    for (let plain of vertex.plains) {
      if (completedPlains.includes(plain)) continue

      let plainIndex = plains.indexOf(plain)
      let bottomPrint = covers.bottom[plainIndex]
      bottomPrint.suffix = partID + "b"
      let embossing = findEmbossing(bottomPrint)
      if (embossing) {
        embossing.text = bottomPrint.suffix
      }
      printInfo.prints.push(bottomPrint)

      let topPrint = covers.top[plainIndex]
      topPrint.suffix = partID + "t"
      embossing = findEmbossing(topPrint)
      if (embossing && !embossing.operations) {
        embossing.text = topPrint.suffix
      }
      topPrint.operations = [{type: "mirror", normal: [1,0,0]}]
      printInfo.prints.push(topPrint)

      completedPlains.push(plain)
      partID += 1
    }
  }

  let startingPartID = STARTING_PART_ID
  if (startingPartID < 1) {
    startingPartID = 1
  }
  let prints = []
  let hasReachedStart
  let hasReachedEnd
  for (let print of printInfo.prints) {
    hasReachedStart = hasReachedStart || print.suffix.startsWith(STARTING_PART_ID + "")
    hasReachedEnd = hasReachedEnd || print.suffix.startsWith(ENDING_PART_ID + "")
    if (hasReachedStart && !hasReachedEnd) {
      prints.push(print)
    }
  }
  printInfo.prints = prints
  if (window.printPostProcessingFunction) {
    printPostProcessingFunction(printInfo)
  }
  console.log(printInfo)
  return printInfo
}

function findEmbossing(print) {
  if (print.type == "embossing") {
    return print
  }
  if (print.type == "difference") {
    return findEmbossing(print.components[0])
  }
  if (print.type == "union") {
    for (let component of print.components) {
      let embo = findEmbossing(component)
      if (embo) {
        return embo
      }
    }
  }
  return null
}

function foldWallCreation(foldWall, printInfo) {
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

  let leftPrints = wallPrints(foldWall, true)
  let rightPrints = wallPrints(foldWall, false)

  let leftJoint = leftPrints.shift(leftPrints)
  let rightJoint = rightPrints.shift(rightPrints)

  printInfo.prints = [...printInfo.prints, ...leftPrints, ...rightPrints]

  if (epsilonEquals(foldWall.yRotationAngle, 0)) {
    printInfo.prints.push({
      suffix: leftJoint.suffix,
      type: "union",
      components: [
        leftJoint,
        rightJoint,
      ]
    })
    return
  }
  if (PRINT_WALL_HALVES_SEPARATELY) {
    // Left (female) side
    printInfo.prints.push({
      suffix: leftJoint.suffix,
      type: "difference",
      components: [
        leftJoint,
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
              position: [0,0, INNER_WALL_EXTERIOR_THICKNESS],
            },
          ],  
        },
      ]
    })
    
    // Right (male) side
    let rightPrint = {
      suffix: rightJoint.suffix,
      type: "union",
      components: [
        rightJoint,
        {
          type: "difference",
          operations: [
            {
              type: "translate",
              position: [0,0, INNER_WALL_EXTERIOR_THICKNESS + INNER_WALL_KERF],
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
    // TODO: consider just automatically doing this for the case of 0 dihedral angle
    let print = {
      suffix: leftJoint.suffix,
      type: "union",
      operations: [{
        type: "rotate",
        axis: [1, 0, 0],
        angle: Math.PI/2,
      }],
      components: [
        leftJoint,
        {
          operations: [{
            type: "rotate",
            axis: [0,1,0],
            angle: -foldWall.yRotationAngle * 2,
          }],
          ...rightJoint
        },
      ]
    }
    if (foldWall.yRotationAngle < 0) {
      print.components[0].operations = [translation]
      print.components[1].operations.unshift(translation)
    }
    printInfo.prints.push(print)
  }
}


function wallPrints(wall, isLeft) {
  let topLength = wall.length
  let bottomLength = wall.length
  if (!topLength) {
    topLength = isLeft ? wall.topLength1 : wall.topLength2
    bottomLength = isLeft ? wall.bottomLength1 : wall.bottomLength2
  }
  let miterAngle = wall.miterAngle
  if (!miterAngle) {
    miterAngle = isLeft ? wall.miterAngle1 : wall.miterAngle2
  }
  let edgeLength = wall.edgeLength
  if (!edgeLength) {
    edgeLength = isLeft ? wall.edgeLength1 : wall.edgeLength2
  }

  let print = blankPrint()
  print.suffix = wall.partID + ""
  let prints = [print]


  if (wall.isFoldWall) {
    print.suffix += isLeft ? "L" : "R"
  }

  let path = ""
  
  let rotationAngle = wall.zRotationAngle * (isLeft ? 1 : -1)
  let dihedralRatio = 1 / Math.cos(rotationAngle)

  let E = RIGHT.rotate(FORWARD, rotationAngle)
  let N = E.cross(FORWARD).negate()
  if (isLeft) {
    E = E.negate()
  }

  let endNotchDepth = NOTCH_DEPTH - WALL_KERF
  let extraOffset = ZERO
  if (wall.dihedralAngle < 0) {
    extraOffset = E.scale(-THICKNESS * Math.tan(wall.zRotationAngle))
  }

  let insetAngle = (wall.dihedralAngle ?? 0) / 2

  let wallSegments = [UP.scale(CHANNEL_DEPTH/2 * dihedralRatio)]
  if (wall.dihedralAngle < 0) {
    if (coverPrint3D) {
      wallSegments.push(E.scale(-THICKNESS * Math.tan(wall.zRotationAngle)))
    } else {
      wallSegments.push(UP.scale(THICKNESS * dihedralRatio))
      wallSegments.push(N.scale(-THICKNESS))
    }
  }
  wallSegments.push(E.scale(endNotchDepth))
  if (RENDER_MODE == "standard") {
    wallSegments = wallSegments.concat(latchPoints(E,N, false, -insetAngle))
    wallSegments.push(E.scale(topLength - 2*(endNotchDepth + MAX_LATCH_WIDTH)))
    wallSegments = wallSegments.concat(latchPoints(E,N.negate(), true))
  } else {
    wallSegments.push(E.scale(topLength - 2*endNotchDepth))
  }
  wallSegments = wallSegments.concat([
    E.scale(endNotchDepth + WALL_MITER_KERF),
    N.scale(-CHANNEL_DEPTH),
    E.scale(-endNotchDepth - WALL_MITER_KERF),
  ])
  if (RENDER_MODE == "standard") {
    wallSegments = wallSegments.concat(latchPoints(E.negate(),N.negate()))
    wallSegments.push(E.scale(-bottomLength + 2*(endNotchDepth + MAX_LATCH_WIDTH)))
    wallSegments = wallSegments.concat(latchPoints(E.negate(),N, true, insetAngle))
  } else {
    wallSegments.push(E.scale(-bottomLength + 2*endNotchDepth))
  }
  wallSegments.push(E.scale(-endNotchDepth))
  if (wall.dihedralAngle > 0) {
    if (coverPrint3D) {
      wallSegments.push(E.scale(-THICKNESS * Math.tan(wall.zRotationAngle)))
    } else {
      wallSegments.push(N.scale(-THICKNESS))
    }
  }

  let xOffset = (WALL_THICKNESS * Math.abs(Math.tan(wall.yRotationAngle))) * (isLeft ? -1 : 1)
  let yOffset = xOffset * Math.tan(rotationAngle)
  let offset = RIGHT.scale(xOffset)
      .addScaledVector(UP, yOffset)

  path += pathFromSegments(offset, wallSegments)

  let wallStart = offset
      .add(extraOffset)
      .addScaledVector(UP, CHANNEL_DEPTH/2 * dihedralRatio)
      .addScaledVector(E, topLength)
      .addScaledVector(N, -CHANNEL_DEPTH/2)
  let startV = wallStart
      .addScaledVector(E, isLeft ? wall.lengthOffset1 : -wall.lengthOffset2)

  // CAT5 port
  if (print.suffix == cat5partID && RENDER_MODE != "simple") {
    let cat5BottomCenter = wallStart
        .addScaledVector(N, -CHANNEL_DEPTH/2)
    if (cat5PortMidway) {
      cat5BottomCenter = cat5BottomCenter.addScaledVector(E, -topLength/2)
    } else {
      cat5BottomCenter = cat5BottomCenter.addScaledVector(E, -CAT5_WIDTH/2 - NOTCH_DEPTH - CAT5_ADDITONAL_OFFSET)
    }

    let cat5Start1 = cat5BottomCenter
        .addScaledVector(E, CAT5_WIRES_WIDTH/2)
    path += pathFromSegments(cat5Start1, [
      E.scale(-CAT5_WIRES_WIDTH),
      N.scale(CAT5_WIRES_HEIGHT),
      E.scale(CAT5_WIRES_WIDTH),
    ])
    let cat5Start2 = cat5BottomCenter
        .addScaledVector(E, -CAT5_SNAP_DISTANCE/2)
        .addScaledVector(N, CAT5_HEIGHT - CAT5_SNAP_Y)
    path += pathFromSegments(cat5Start2, [
      E.scale(CAT5_SNAP_WIDTH),
      N.scale(CAT5_SNAP_HEIGHT),
      E.scale(-CAT5_SNAP_WIDTH),
    ])
    let cat5Start3 = cat5Start2
        .addScaledVector(E, CAT5_SNAP_DISTANCE)
    path += pathFromSegments(cat5Start3, [
      E.scale(-CAT5_SNAP_WIDTH),
      N.scale(CAT5_SNAP_HEIGHT),
      E.scale(CAT5_SNAP_WIDTH),
    ])

    let qtPosition = cat5BottomCenter.addScaledVector(N, CAT5_WIRES_HEIGHT)
    print.components.push({
      type: "qtClip",
      position: [qtPosition.x, -qtPosition.y, 0],
      rotationAngle: -rotationAngle + Math.PI,
    })
  }

  // Power hole
  if (print.suffix == powerHolePartID) {
    let r = POWER_HOLE_RADIUS
    let powerCenter = wallStart.addScaledVector(E, -topLength/2 + r)
    path += `
      M${powerCenter.x} ${powerCenter.y}
      a ${r},${r} 0 1,0 ${r*2},0
      a ${r},${r} 0 1,0,${-r*2},0`
  }

  // Wedges
  // End wedge
  let position = wallSegments[0].add(offset)
      .add(extraOffset)
      .addScaledVector(E, topLength + WALL_MITER_KERF)
      .addScaledVector(N, -CHANNEL_DEPTH/2)
  let wedge = {
    type: "wedge",
    angle: miterAngle,
    rotationAngle: -rotationAngle + (isLeft ? Math.PI : 0),
    position: [position.x, -position.y, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge)

  // Wedge to join with other half
  let skew = -Math.tan(rotationAngle)
  wedge = {
    type: "wedge",
    angle: wall.aoiComplement,
    skew,
    rotationAngle: -rotationAngle + (isLeft ? 0 : Math.PI),
    position: [xOffset, -yOffset, 0],
    width: CHANNEL_DEPTH,
    thickness: WALL_THICKNESS,
  }
  print.components.push(wedge)


  // LED supports
  position = null
  if (isLeft && !NO_SUPPORTS && print.suffix != cat5partID &&
      !wall.hasWallPort &&
      bottomLength > PIXEL_DISTANCE * 1.2) {
    let supportOffset = PIXEL_DISTANCE * (ledAtVertex ? 1.5 : 1)
    supportOffset += edgeOffset(wall.leftVertex, wall.vertex) * PIXEL_DISTANCE / pixelDensity

    position = startV.addScaledVector(E, -supportOffset)
  }
  if (!isLeft && !NO_SUPPORTS && print.suffix != cat5partID &&
      bottomLength > PIXEL_DISTANCE * 3 &&
      (wall.yRotationAngle >= 0 || !PRINT_WALL_HALVES_SEPARATELY)) {
    let supportOffset = edgeLength - PIXEL_DISTANCE * (ledAtVertex ? 0.5 : 0)
    supportOffset += edgeOffset(wall.rightVertex, wall.vertex) * PIXEL_DISTANCE / pixelDensity

    offsetNegative = supportOffset % PIXEL_DISTANCE
    // TODO better calculation for how much negative offset should be (based on angles)
    while (offsetNegative < PIXEL_DISTANCE/2 + LED_SUPPORT_WIDTH/2) {
      offsetNegative += PIXEL_DISTANCE
    }
    supportOffset -= offsetNegative
    position = startV.addScaledVector(E, -supportOffset)
  }
  if (position && RENDER_MODE == "standard") {
    print.components.push({
      type: "ledSupport",
      position: [position.x, -position.y, WALL_THICKNESS],
      width: LED_SUPPORT_WIDTH,
      height: LED_SUPPORT_HEIGHT(),
      thickness: LED_SUPPORT_THICKNESS,
      gap: LED_SUPPORT_GAP,
      rotationAngle: -rotationAngle,
    })
  }

  if (addNubs && !wall.isFoldWall && RENDER_MODE == "standard") { // Nubs
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

  // Embossing
  if (!NO_EMBOSSING && RENDER_MODE == "standard" &&
    (isLeft || (wall.yRotationAngle > 0 && PRINT_WALL_HALVES_SEPARATELY))) {
    let V = wallStart.sub(extraOffset)
    print.components.push({
      type: "embossing",
      position: [V.x, -V.y, WALL_THICKNESS],
      rotationAngle: -rotationAngle,
      halign: isLeft ? "left" : "right",
      text: print.suffix,
    })
  }
  if (RENDER_MODE == "parts") {
    let V = wallStart.sub(extraOffset).addScaledVector(E, -2)
    let embossing = {
      type: "embossing",
      operations: [
        {type: "rotate", axis: [0,0,1], angle: rotationAngle},
        {type: "mirror", normal: [1,0,0]},
        {type: "translate", position: [V.x, -V.y, -1]},
      ],
      halign: isLeft ? "right" : "left",
      thickness: 1,
      text: print.suffix,
    }
    if (!wall.isFoldWall) {
      embossing.operations.splice(1,1)
    }
    print.components.push(embossing)
  }

  let wallElem = document.getElementById("wall")
  wallElem.querySelector("path").setAttribute("d", path)
  print.components.push({
    type: "svg",
    svg: wallElem.outerHTML,
    thickness: WALL_THICKNESS,
    position: [0, -WALL_PANEL_HEIGHT/2, 0],

  })

  return prints
}

function pathFromSegments(start, segments) {
  let path = ` M${start.x} ${start.y}`
  for (let seg of segments) {
    path += ` l${seg.x} ${seg.y}`
  }
  path += " Z"
  return path
}

function makeNub(position) {
  if (position.isVector) {
    position = [position.x, position.y, WALL_THICKNESS]
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

function latchPoints(E, N, reverse, insetAngle) {
  let points = []
  switch (LATCH_TYPE) {
    case "wedge":
      let inset = 0
      if (insetAngle > 0) {
        inset = Math.tan(insetAngle) * THICKNESS
      }
      points = [
        E.scale(ANTI_CORNER),
        N.scale(THICKNESS).addScaledVector(E, -ANTI_CORNER + inset),
        E.scale(MAX_LATCH_WIDTH - inset),
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

function edgeOffset(vertex, prevVertex) {
  if (vertex.edges.length != 4) return 0

  let nextVertex = null
  let offset = 0
  for (let edge of vertex.edges) {
    if (edge.isDupe) continue
    let other = edge.otherVertex(vertex)
    if (other == prevVertex) continue

    nextVertex = other
    offset = edge.length() % 1
  }
  offset = (edgeOffset(nextVertex, vertex) + 1-offset) % 1
  if (epsilonEquals(offset, 1)) {
    return 0
  } else {
    return offset
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

async function generateManufacturingInfo() {
  document.querySelectorAll("path.laser").forEach(path => path.setAttribute('d', ""))
  if (isWall) {
    KERF = TOP_KERF
    foldWalls = []
    edgeToWalls = {}
    covers = {top: [], bottom: []}
    
    IS_BOTTOM = false
    window.KERF = TOP_KERF
    window.ORIGAMI_KERF = TOP_ORIGAMI_KERF == null ? ORIGAMI_KERF : TOP_ORIGAMI_KERF
    for (let plain of plains) {
      covers.top.push(await createCoverSVG(plain))
      let w = (maxX - minX)
      let h = (maxY - minY)
      let unit = coverPrint3D ? 'mm' : '"'
      let maxDim1 = coverPrint3D ? 250 : 48
      let maxDim2 = coverPrint3D ? 250 : 48
      if (!coverPrint3D) {
        w /= 96
        h /= 96
      }
      if (w > maxDim1 || h > maxDim1 || (w > maxDim2 && h > maxDim2)) {
        console.log(`Warning: top cover ${covers.top.length-1} is ${w.toPrecision(3)}${unit} by ${h.toPrecision(3)}${unit}`)
      }
    }
    IS_BOTTOM = true
    window.KERF = BOTTOM_KERF
    window.ORIGAMI_KERF = BOTTOM_ORIGAMI_KERF == null ? ORIGAMI_KERF : BOTTOM_ORIGAMI_KERF
    for (let plain of plains) {
      covers.bottom.push(await createCoverSVG(plain))
      let w = (maxX - minX) / 96
      let h = (maxY - minY) / 96
      if (coverPrint3D) {
        w *= MM_TO_96DPI
        h *= MM_TO_96DPI
      }
      // console.log(`Bottom svg ${covers.bottom.length-1} is ${w.toFixed(2)}" by ${h.toFixed(2)}"`)
    }
    if (covers.bottom.length[0]) {
      document.getElementById("cover").outerHTML = covers.bottom[0].svg
    }

    let mins = new Vector(1000, 1000, 1000)
    let maxes = new Vector(-1000, -1000, -1000)
    for (let v of verticies) {
      mins = mins.min(v.ogCoords)
      maxes = maxes.max(v.ogCoords)
    }
    let dims = maxes.sub(mins).scale(PIXEL_DISTANCE / pixelDensity / 25.4)
    console.log(`Overall dimensions approx ${dims.x.toFixed(1)}" x ${dims.y.toFixed(1)}" x ${dims.z.toFixed(1)}"`)


    createPrintInfo3D()
  }
}
