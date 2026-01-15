
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

  isStrong = false
  for (let cover of strongCovers) {
    if (cover.plain == plain && cover.isBottom == IS_BOTTOM) {
      isStrong = true
      break
    }
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
    vertex.ogCoords = vertex.ogCoords.scale(PIXEL_DISTANCE).applyMatrix(R)
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
    let negativeAreaDetected = false

   	for (let i = 0; i < dPath.length; i++) {
      let vertex0 = dPath[i]
      let vertex1 = dPath[(i+1) % dPath.length]
      let vertex2 = dPath[(i+2) % dPath.length]
      let vertex3 = dPath[(i+3) % dPath.length]
      let edge0 = vertex0.getEdge(vertex1)
      let edge1 = vertex1.getEdge(vertex2)
      let edge2 = vertex2.getEdge(vertex3)
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
      let extraLEDSupportOffset = 0
      if (epsilonEquals(e0.length(), 0)) {
        a1 = Math.PI/2
        towardsEnd = e1.normalize().multiplyScalar(-1)
        v0 = v0.addScaledVector(towardsEnd, endCapOffset)
        extraLEDSupportOffset = endCapOffset + PIXEL_DISTANCE
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

      let w1 = CHANNEL_WIDTH/2
      let w2 = w1 + WALL_THICKNESS
      let w3 = w2 + BORDER

      let widthFactor1 = a1 > 0 ? w1 : w2
      let lengthRatio1 = -1 / Math.tan((Math.PI - a1)/2)
      let lengthOffset1 = lengthRatio1 * widthFactor1

      let widthFactor2 = a2 < 0 ? w1 : w2
      let lengthRatio2 = -1 / Math.tan((Math.PI - a2)/2)
      let lengthOffset2 = lengthRatio2 * widthFactor2

      let wallLength = edgeLength + lengthOffset2 - lengthOffset1
      let borderLength = edgeLength + (lengthRatio2 - lengthRatio1) * w3
      if (borderLength < 0 && edge1.index != edge2.index) {
        negativeAreaDetected = true
        console.log("Negative area detected")
      }
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
      // let outgoingFoldWall = vertex1.nextEdge(edge1, false) != edge0
      // let incomingFoldWall = vertex2.nextEdge(edge1, true) != edge2
      let outgoingFoldWall = vertex1.plains.length > 1
      let incomingFoldWall = vertex2.plains.length > 1

      function addFoldWallInfo(isOutgoing) {
        let vertex = isOutgoing ? vertex1 : vertex2
        let edge = edge1 // Won't always be the case
        let fold = vertex.fold(edge1, isOutgoing)
        let { deadendPlain, aoiComplement, plainTranslationValue } =
            fold.getCoverInfo(edge1, isOutgoing, R)

        let zTrans = CHANNEL_DEPTH/2
        let zTransFar = zTrans + THICKNESS + EXTRA_COVER_THICKNESS
        zTrans *= IS_BOTTOM ? 1 : -1
        zTransFar *= IS_BOTTOM ? 1 : -1

        let outerV = isOutgoing ? v2 : v1
        let wallStartPoint = outerV
            .addScaledVector(n, aoiComplement < 0 ? w2 : w1)
            .addScaledVector(e1, isOutgoing ? lengthOffset2 : lengthOffset1)
        let nearWallStartPoint = wallStartPoint.addScaledVector(FORWARD, zTrans)
        let farWallStartPoint = wallStartPoint.addScaledVector(FORWARD, zTransFar)
        wallStartPoint = wallStartPoint.addScaledVector(FORWARD, plainTranslationValue)
        let wallEndPoint = deadendPlain.intersection(new Line(wallStartPoint, e1))
        let nearWallEndPoint = deadendPlain.intersection(new Line(nearWallStartPoint, e1))
        let farWallEndPoint = deadendPlain.intersection(new Line(farWallStartPoint, e1))

        if (wallEndPoint.sub(wallStartPoint).normalize().dot(e1) * (isOutgoing ?-1:1) < 0) {
          console.log("wallStartPoint on wrong side of deadend plain!", isOutgoing ? vertex1 : vertex2)
        }
        wallLength = wallEndPoint.sub(wallStartPoint).length()
        let nearWallLength = nearWallEndPoint.sub(nearWallStartPoint).length()
        let farWallLength = farWallEndPoint.sub(farWallStartPoint).length()
        if (!epsilonEquals(wallLength, Math.min(nearWallLength, farWallLength))) {
          console.log(vertex1.index, vertex2.index, deadendPlain, fold)
          console.log(wallLength, nearWallLength, farWallLength, plainTranslationValue)
        }
        if (isOutgoing) {
          lengthOffset1 = edgeLength + lengthOffset2 - wallLength
        } else {
          lengthOffset2 = wallLength + lengthOffset1 - edgeLength
        }

        // World placement adjustments
        let outerPoint = outerV
            .addScaledVector(n, w2)
            .addScaledVector(e1, isOutgoing ? lengthOffset2 : lengthOffset1)
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

        fold.addFoldWallInfo({
          edge,
          isOutgoing,
          isStrong,
          wallLength, farWallLength, nearWallLength,
          angle: isOutgoing ? angle2 : angle1,
          lengthOffset: isOutgoing ? lengthOffset2 : lengthOffset1,
          edgeLength,
          worldPlacementOperations,
        })
        associateWallWithEdge(fold.wall, associatedEdge)
      }

      if (outgoingFoldWall) {
        addFoldWallInfo(true)
      } else if (incomingFoldWall) {
        addFoldWallInfo(false)
      } else {
        associateWallWithEdge({
          miterAngle: angle1,
          lengthOffset: lengthOffset1,
          dihedralAngle: 0,
          zRotationAngle: 0,
          aoiComplement: angle2,
          yRotationAngle: angle2,
          topLength: wallLength,
          bottomLength: wallLength,
          edgeLength,
          worldPlacementOperations,
          endVertex: vertex1,
          vertex: vertex2,
          extraLEDSupportOffset,
        }, associatedEdge)
      }

      // Slots
      if (RENDER_MODE == "standard") {
        slotString += singleSlotPath(wallLength,
          [e1, n],
          v1,
          [lengthOffset1, CHANNEL_WIDTH/2],
          isStrong,
          print)
      }

      // Border
      let width = CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER
      let borderLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      
      if (outgoingFoldWall) {
        let edge = vertex1.getEdge(vertex2)
        let {deadendPlain, line, dihedralAngle, angleOfIncidence} = vertex1
          .fold(edge, true).getCoverInfo(edge, true, R)

        if (RENDER_MODE == "parts") {
          deadendPlain = deadendPlain.translate(e0.normalize().scale(-0.2))
        }
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let p2 = deadendPlain.intersection(line)
        borderString += pointsToSVGString([p2, p1])
        borderPoints.push(p2)
        borderPoints.push(p1)

        // fold wall miter
        let skew = Math.tan(angleOfIncidence - Math.PI/2)
        let angle = Math.atan(Math.tan(dihedralAngle/2) / Math.sin(angleOfIncidence))
        let wedgePoint = p1.add(p2).scale(0.5)
        wedgePoint.z = 0
        print.components.push({
          type: "wedge",
          angle: angle * (IS_BOTTOM ? -1 : 1),
          rotationAngle: -e1.signedAngle(LEFT),
          position: wedgePoint.toArray(),
          thickness: THICKNESS + EXTRA_COVER_THICKNESS,
          width: CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER,
          skew,
        })
      } else if (incomingFoldWall) {
        points = [[borderLengthOffset, width]]
        borderString += pointsToSVGString(points, [e1, n], v1)
        borderPoints.push(v1
            .addScaledVector(e1, borderLengthOffset)
            .addScaledVector(n, width))

        let edge = vertex1.getEdge(vertex2)
        let {deadendPlain, line, dihedralAngle, angleOfIncidence} = vertex2
          .fold(edge, false).getCoverInfo(edge, false, R)

        if (RENDER_MODE == "parts") {
          deadendPlain = deadendPlain.translate(e1.normalize().scale(-0.2))
        }
        let line2 = line.translate(n.scale(width))
        let p = deadendPlain.intersection(line2)
        borderString += pointsToSVGString([p])
        borderPoints.push(p)

        // fold wall miter
        let skew = -Math.tan(angleOfIncidence - Math.PI/2)
        let angle = Math.atan(Math.tan(dihedralAngle/2) / Math.sin(angleOfIncidence))
        let wedgePoint = deadendPlain.intersection(line).add(p).scale(0.5)
        wedgePoint.z = 0
        print.components.push({
          type: "wedge",
          angle: angle * (IS_BOTTOM ? -1 : 1),
          rotationAngle: -e2.signedAngle(LEFT),
          position: wedgePoint.toArray(),
          thickness: THICKNESS + EXTRA_COVER_THICKNESS,
          width: CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER,
          skew,
        })
      } else {
        points = [[borderLengthOffset, width]]
        borderString += pointsToSVGString(points, [e1, n], v1)
        borderPoints.push(v1
            .addScaledVector(e1, borderLengthOffset)
            .addScaledVector(n, width))
      }

      // Inner Channel
      width = CHANNEL_WIDTH/2 - INNER_CHANNEL_BUFFER
      let channelLengthOffset = width / -Math.tan((Math.PI - a1)/2)
      if (outgoingFoldWall) {
        let edge = vertex1.getEdge(vertex2)
        let { deadendPlain, line } = vertex1.fold(edge, true).getCoverInfo(edge, true, R)
        deadendPlain = deadendPlain.translate(e0.normalize().scale(5)) // TODO calculate more properply
        let line1 = line.translate(n.scale(width))
        let p1 = deadendPlain.intersection(line1)
        let p2 = deadendPlain.intersection(line)
        channelString += pointsToSVGString([p2, p1])
      } else if (incomingFoldWall) {
        channelString += pointsToSVGString([[channelLengthOffset, width]], [e1, n], v1)

        let edge = vertex1.getEdge(vertex2)
        let { deadendPlain, line } = vertex2.fold(edge, false).getCoverInfo(edge, false, R)
        deadendPlain = deadendPlain.translate(e1.normalize().scale(5)) // TODO calculate more properply
        let line2 = line.translate(n.scale(width))
        let p = deadendPlain.intersection(line2)
        channelString += pointsToSVGString([p])
      } else {
        channelString += pointsToSVGString([[channelLengthOffset, width]], [e1, n], v1)
      }

      // Embossed id
      if (!findEmbossing(print) && !outgoingFoldWall) {
        if (RENDER_MODE == "standard" && !NO_EMBOSSING) {
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
      center = center.scale(0.25 / PIXEL_DISTANCE)
      let x = Math.round(center.x)
      let y = -Math.round(center.y)
      
      let pixels = await getPixels()
      let offset = x * pixels.stride[0] + y * pixels.stride[1]
      if (pixels.data[offset] + pixels.data[offset+1] + pixels.data[offset+2] == 0) {
        // skip border for black pixels
        skipBorder = true
      }
    }

    if (!skipBorder && !negativeAreaDetected) {
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
    print.components.push({ // OpenSCAD struggled to render sometimes without this union
      type: "union",
      operations: importCorrectionOperations,
      components: [{
        type: "svg",
        svg,
        thickness: THICKNESS,
        position: [0,0,EXTRA_COVER_THICKNESS],
      },
      {
        type: "svg",
        svg: borderSvg,
        thickness: EXTRA_COVER_THICKNESS,
      },
      ]
    })

    if (print.bitsToRemove) {
      print = {
        type: "difference",
        components: [
          print,
          ...print.bitsToRemove
        ],
      }
      delete print.components[0].bitsToRemove
    }

    if (!isStrong && INNER_CHANNEL_THICKNESS !== null) {
      let embo = findEmbossing(print)
      print = {
        type: "difference",
        components: [
          print,
          {
            type: "svg",
            svg: channelSvg,
            thickness: THICKNESS - INNER_CHANNEL_THICKNESS + 0.1,
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

function singleSlotPath(wallLength, basis, offset, localOffset, isStrong, print) {
  offset = offset.sub(new Vector(0,0, offset.z))
  if (wallLength > 1e6) return ""
  let path = ""
  if (localOffset) {
    offset = offset
        .addScaledVector(basis[0], localOffset[0])
        .addScaledVector(basis[1], localOffset[1])
  }

  let trueNotchDepth = NOTCH_DEPTH
  if (2*NOTCH_DEPTH + MIN_NON_NOTCH_LENGTH > wallLength) {
    trueNotchDepth = (wallLength - MIN_NON_NOTCH_LENGTH)/2
  }

  if (isStrong) {
    if (!print.bitsToRemove) {
      print.bitsToRemove = []
    }
    let position = offset
        .addScaledVector(basis[0], wallLength/2)
        .addScaledVector(basis[1], WALL_THICKNESS/2)
        .addScaledVector(FORWARD, THICKNESS + EXTRA_COVER_THICKNESS)
    let rotationAngle = -basis[0].signedAngle(LEFT)
    print.bitsToRemove.push({
      position: position.toArray(),
      rotationAngle,
      code: `
      rotate([0,-90,0])
      linear_extrude(${wallLength - 2*trueNotchDepth}, center=true)
      polygon([[0, ${-WALL_THICKNESS/2 + KERF}],
        [0, ${WALL_THICKNESS/2 - KERF}],
        [${-THICKNESS}, ${STRONG_SLOPE*THICKNESS + WALL_THICKNESS/2 - KERF}],
        [${-THICKNESS}, ${STRONG_SLOPE*THICKNESS - WALL_THICKNESS/2 + KERF}]
      ]);`
    })

    return ""
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
        width: WALL_THICKNESS - 2*KERF + 0.2,
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


  let w1 = KERF
  let w2 = WALL_THICKNESS - KERF
  let xs = trueNotchDepth + KERF

  let segmentCount = Math.ceil(wallLength / MAX_SLOT_SEGMENT_LENGTH)
  let segmentLength = wallLength / segmentCount

  for (let i = 0; i < segmentCount; i++) {
    let xt = xs + segmentLength - 2*(trueNotchDepth + KERF)
    let points = [
      [xs, w1],
      [xs, w2],
      [xt, w2],
      [xt, w1],
    ]
    
    addLatch(xs, 1)
    addLatch(xt, -1)
    path += "M" + pointsToSVGString(points, basis, offset).substring(1) + "Z "

    xs = xt + 2*(trueNotchDepth + KERF)
  }
  return path
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
    if (!coverPrint3D && RENDER_MODE != "simple") {
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

let ledWorldPositions = []

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
  ledWorldPositions = []
  let print = blankPrint()
  print.suffix = "_full"
  print.operations = [{ type: "rotate", axis: [1,0,0], angle: -Math.PI/2 }]

  for (let type of COVER_TYPES) {
    for (let coverPrint of covers[type]) {
      coverPrint.operations = coverPrint.worldPlacementOperations
      print.components.push(coverPrint)
    }
  }
  if (RENDER_MODE == "simple" || RENDER_MODE == "simplest") {
    return {
      type: "gcode",
      prints: [print],
      PROCESS_STOP: "stl",
    }
  }

  let completedParts = {}
  for (let edge of edges) {
    if (edge.isDupe) continue
    for (let wall of edgeToWalls[edge.index]) {
      if (completedParts[wall.partID]) continue
      if (wall.isFoldWall) {
        let wallPrint1 = wallPrint(wall, true)
        wallPrint1.operations = [...wall.worldPlacementOperations1]
        wallPrint1.operations[2] = {...wallPrint1.operations[2]}
        wallPrint1.operations[2].angle += wall.zRotationAngle
        if (wall.aoiComplement < -0.0001) {
          let sign = Math.sign(Math.cos(wallPrint1.operations[2].angle)) // This is probably not right
          wallPrint1.operations.splice(3, 0, {
            type: "translate",
            position: [sign * Math.tan(wall.aoiComplement) * WALL_THICKNESS, 0, 0],
          })
        }
        print.components.push(wallPrint1)

        let wallPrint2 = wallPrint(wall, false)
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
        let wPrint = wallPrint(wall, true)
        wPrint.operations = wall.worldPlacementOperations
        print.components.push(wPrint)
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
  ledWorldPositions = []
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
        let print = wallPrint(wall, true)
        if (print.suffix == portPartID) {
          cleanAndFlip(print)
        }
        printInfo.prints.push(print)
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
      if (embossing) {
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
    if (hasReachedStart && !hasReachedEnd) {
      prints.push(print)
    }
    hasReachedEnd = hasReachedEnd || print.suffix.startsWith(ENDING_PART_ID + "")
  }
  printInfo.prints = prints
  if (window.printPostProcessingFunction) {
    printPostProcessingFunction(printInfo)
  }
  console.log(printInfo)
  return printInfo
}


function findEmbossing(print) {
  return findSubprint("embossing", print)
}
function findSubprint(type, print) {
  if (print.type == type) {
    return print
  }
  if (print.type == "union" || print.type == "difference") {
    for (let component of print.components) {
      let subprint = findSubprint(type, component)
      if (subprint) {
        return subprint
      }
    }
  }
  return null
}
function findSubprints(type, print, list) {
  if (!list) {
    list = []
  }
  if (print.type == type) {
    list.push(print)
    return list
  }
  if (print.type == "union" || print.type == "difference") {
    for (let component of print.components) {
      findSubprints(type, component, list)
    }
  }
  return list
}

function cleanAndFlip(print) {
  cleanForFlip(print)
  flipPrint(print)
}
function cleanForFlip(print) {
  let embos = findSubprints("embossing", print)
  for (let embo of embos) {
    embo.void = true
  }
  let supports = findSubprints("ledSupport", print)
  for (let support of supports) {
    support.void = true
  }
}
function flipPrint(print) {
  print.operations = print.operations ?? []
  print.operations.push({
    type: "rotate",
    vector: [0, Math.PI, 0],
  })
}

function foldWallCreation(foldWall, printInfo) {
  if (!printInfo) return

  foldWall.zRotationAngle = Math.atan(Math.tan(foldWall.dihedralAngle/2) / Math.cos(foldWall.aoiComplement))
  foldWall.yRotationAngle = Math.atan(Math.tan(foldWall.aoiComplement) * Math.cos(foldWall.zRotationAngle))

  let translation = {
    type: "translate",
    position: [0, 0, -WALL_THICKNESS],
  }

  let leftJoint = wallPrint(foldWall, true)
  let rightJoint = wallPrint(foldWall, false)

  let leftPort = portPartID == leftJoint.suffix
  let rightPort = portPartID == rightJoint.suffix

  if (epsilonEquals(foldWall.yRotationAngle, 0)) {
    let foldPrint = {
      suffix: leftJoint.suffix,
      type: "union",
      components: [
        leftJoint,
        rightJoint,
      ]
    }
    if (leftPort || rightPort) {
      cleanAndFlip(foldPrint)
    }
    printInfo.prints.push(foldPrint)
    return
  }
  if (PRINT_WALL_HALVES_SEPARATELY) {
    // Left (female) side
    let leftPrint = {
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
    }
    if (leftPort) {
      cleanAndFlip(leftPort)
    }
    printInfo.prints.push(leftPrint)
    
    // Right (male) side
    let rightPrint = {
      suffix: rightJoint.suffix,
      type: "union",
      components: [
        rightJoint,
        {
          type: "difference",
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
            },
            {
              type: "cube",
              operations: [
                {
                  type: "translate",
                  position: [50, 0, 0],
                },
                  {
                  type: "rotate",
                  axis: [0,1,0],
                  angle: foldWall.yRotationAngle,
                }
              ],
              dimensions: [100, 100, 100],
            }
          ]
        },
      ]
    }
    if (foldWall.yRotationAngle < 0) {
      cleanAndFlip(rightPrint)
      rightPrint.components[0].operations = [translation]
      rightPrint.components[1].components[0].operations.unshift(translation)
      rightPrint.components[1].components[1].operations.unshift(translation)
      if (rightPort) {
        console.error("PORT on already flipped right side.")
      }
    }
    if (rightPort) {
      cleanAndFlip(rightPrint)
    }
    printInfo.prints.push(rightPrint)
  }
  else { // !PRINT_WALL_HALVES_SEPARATELY
    let print = {
      suffix: leftJoint.suffix,
      type: "union",
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
      cleanForFlip(leftJoint)
      flipPrint(print)
    }
    if (leftPort || rightPort) {
      console.log("WARNING! Untested port configuration")
    }
    printInfo.prints.push(print)
  }
}


function wallPrint(wall, isLeft) {
  let side = wall
  if (wall.left) {
    side = wall[isLeft ? "left": "right"]
  }
  let  { miterAngle, edgeLength, lengthOffset, endVertex,
    bottomLength, bottomLengthNear, bottomIsStrong,
    topLength, topLengthNear, topIsStrong,} = side
  let vertex1 = wall.vertex
  let maxLength = Math.max(topLength, bottomLength)

  if (!isLeft) {
    lengthOffset *= -1
  }
  let print = blankPrint()
  print.suffix = wall.partID + ""

  if (RENDER_MODE == "parts" && epsilonEquals(miterAngle, 0)) {
    topLength -= 0.5
    bottomLength -= 0.5
    edgeLength -= 0.5
  }

  if (wall.isFoldWall) {
    print.suffix += isLeft ? "L" : "R"
  }
  let hasPort = print.suffix == portPartID && RENDER_MODE != "simple"
  let portPartNumber = portPartID.match(/\d+/)[0]
  let isPortRelated = print.suffix.match(/\d+/)[0] == portPartNumber

  let path = ""
  
  let rotationAngle = wall.zRotationAngle * (isLeft ? 1 : -1)
  let dihedralRatio = 1 / Math.cos(rotationAngle)

  let E = RIGHT.rotate(FORWARD, rotationAngle)
  let N = E.cross(FORWARD).negate()
  if (isLeft) {
    E = E.negate()
  }

  let xOffset = (WALL_THICKNESS * Math.abs(Math.tan(wall.yRotationAngle))) * (isLeft ? -1 : 1)
  let yOffset = xOffset * Math.tan(rotationAngle)
  let offset = RIGHT.scale(xOffset)
      .addScaledVector(UP, yOffset)


  if (topLengthNear && !E.scale(topLengthNear - bottomLengthNear).addScaledVector(N, -CHANNEL_DEPTH).equals(
      UP.scale(-CHANNEL_DEPTH * dihedralRatio))) {
    console.log(wall, side)
    console.log(E.scale(topLengthNear - bottomLengthNear).addScaledVector(N, -CHANNEL_DEPTH).sub(
      UP.scale(-CHANNEL_DEPTH * dihedralRatio)))
    console.log(E.scale(topLength - bottomLength).addScaledVector(N, -CHANNEL_DEPTH).sub(
      UP.scale(-CHANNEL_DEPTH * dihedralRatio)))
  }

  let topEndNotchDepth = NOTCH_DEPTH
  if (2*NOTCH_DEPTH + MIN_NON_NOTCH_LENGTH > topLength) {
    topEndNotchDepth = (topLength - MIN_NON_NOTCH_LENGTH)/2
  }
  topEndNotchDepth -= WALL_KERF
  let bottomEndNotchDepth = NOTCH_DEPTH
  if (2*NOTCH_DEPTH + MIN_NON_NOTCH_LENGTH > bottomLength) {
    bottomEndNotchDepth = (bottomLength - MIN_NON_NOTCH_LENGTH)/2
  }
  bottomEndNotchDepth -= WALL_KERF


  let bottomSegmentCount = Math.ceil(bottomLength / MAX_SLOT_SEGMENT_LENGTH)
  let bottomSegmentLength = bottomLength / bottomSegmentCount
  let topSegmentCount = Math.ceil(topLength / MAX_SLOT_SEGMENT_LENGTH)
  let topSegmentLength = topLength / topSegmentCount

  let insetAngle = (wall.dihedralAngle ?? 0) / 2
  for (let vertex of vertexPath) {
    if (vertex == endVertex) {
      insetAngle = 0 // Don't inset inner foldwall of from initial direction
      break
    }
    if (vertex == vertex1) {
      break // Reached middle vertex of foldwall first; keep inset
    }
  }
  // Exception for if first wall is foldWall
  if (vertex1 == vertexPath[0] && endVertex == vertexPath[1]) {
    insetAngle = 0
  }

  let wallSegments = [UP.scale(CHANNEL_DEPTH/2 * dihedralRatio)]

  if (topLengthNear) {
    wallSegments.push(E.scale(topLengthNear - topLength))
  }

  if (topIsStrong) {
    wallSegments.push(E.scale(topLength))
    let position = offset
        .addScaledVector(UP, CHANNEL_DEPTH/2 * dihedralRatio)
        .addScaledVector(E, topLength/2)
    print.components.push({
      position: [position.x, -position.y, 0],
      rotationAngle: -rotationAngle,
      code: `
      rotate([0,-90,0])
      linear_extrude(${topLength - 2*topEndNotchDepth}, center=true)
      polygon([[0,0],
        [${WALL_THICKNESS}, 0],
        [${STRONG_SLOPE*THICKNESS + WALL_THICKNESS}, ${-THICKNESS}],
        [${STRONG_SLOPE*THICKNESS}, ${-THICKNESS}]
      ]);`
    })
  } else if (RENDER_MODE == "standard") {
    for (let i = 0; i < topSegmentCount; i++) {
      let insetA = i == 0 ? -insetAngle : 0
      wallSegments.push(E.scale(topEndNotchDepth))
      wallSegments = wallSegments.concat(latchPoints(E,N, false, insetA))
      wallSegments.push(E.scale(topSegmentLength - 2*(topEndNotchDepth + MAX_LATCH_WIDTH)))
      wallSegments = wallSegments.concat(latchPoints(E,N.negate(), true))
      wallSegments.push(E.scale(topEndNotchDepth))
    }
  } else {
    wallSegments.push(E.scale(topLength))
  }
  wallSegments = wallSegments.concat([
    E.scale(WALL_MITER_KERF),
    N.scale(-CHANNEL_DEPTH),
    E.scale(-WALL_MITER_KERF),
  ])
  if (bottomIsStrong) {
    wallSegments.push(E.scale(-bottomLength))
    let position = offset
        .addScaledVector(UP, -CHANNEL_DEPTH/2 * dihedralRatio)
        .addScaledVector(E, bottomLength/2)
    print.components.push({
      position: [position.x, -position.y, 0],
      rotationAngle: -rotationAngle,
      code: `
      rotate([0,-90,0])
      linear_extrude(${bottomLength - 2*bottomEndNotchDepth}, center=true)
      polygon([[0,0],
        [${WALL_THICKNESS}, 0],
        [${STRONG_SLOPE*THICKNESS + WALL_THICKNESS}, ${THICKNESS}],
        [${STRONG_SLOPE*THICKNESS}, ${THICKNESS}]
      ]);`
    })
  } else if (RENDER_MODE == "standard") {
    for (let i = 0; i < bottomSegmentCount; i++) {
      let insetA = i == bottomSegmentCount-1 ? insetAngle : 0
      wallSegments.push(E.scale(-bottomEndNotchDepth)),
      wallSegments = wallSegments.concat(latchPoints(E.negate(),N.negate()))
      wallSegments.push(E.scale(-bottomSegmentLength + 2*(bottomEndNotchDepth + MAX_LATCH_WIDTH)))
      wallSegments = wallSegments.concat(latchPoints(E.negate(),N, true, insetA))
      wallSegments.push(E.scale(-bottomEndNotchDepth))
    }
  } else {
    wallSegments.push(E.scale(-bottomLength))
  }
  if (bottomLengthNear) {
    wallSegments.push(E.scale(-bottomLengthNear + bottomLength))
  }

  path += pathFromSegments(offset, wallSegments)

  let wallStart = offset
      .addScaledVector(UP, CHANNEL_DEPTH/2 * dihedralRatio)
      .addScaledVector(E, topLength)
      .addScaledVector(N, -CHANNEL_DEPTH/2)
  let startV = wallStart
      .addScaledVector(E, lengthOffset + wall.extraLEDSupportOffset)


  // Power hole
  if (print.suffix == powerHolePartID) {
    if (POWER_TYPE == "BARREL") {
      let r = POWER_BARREL_RADIUS
      let powerCenter = wallStart.addScaledVector(E, -topLength/2 + r)
      path += `
        M${powerCenter.x} ${powerCenter.y}
        a ${r},${r} 0 1,0 ${r*2},0
        a ${r},${r} 0 1,0,${-r*2},0`
    } else if (POWER_TYPE == "USBC") {
      let powerHoleStart = wallStart.addScaledVector(E, -topLength/2 - USBC_WIDTH/2)
          .addScaledVector(N, USBC_HEIGHT/2)
      path += pathFromSegments(powerHoleStart, [
        E.scale(USBC_WIDTH),
        N.scale(-USBC_HEIGHT),
        E.scale(-USBC_WIDTH),
        N.scale(USBC_HEIGHT),
      ])
    }
  }

  let wallElem = document.getElementById("wall")
  wallElem.querySelector("path").setAttribute("d", path)
  print.components.push({
    type: "svg",
    svg: wallElem.outerHTML,
    thickness: WALL_THICKNESS,
    position: [0, -WALL_PANEL_HEIGHT/2, 0],
  })

  // Wedges
  // End wedge
  let position = wallSegments[0].add(offset)
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
  if (LED_SUPPORT_TYPE == "single") {
    supportOffset = null
    if (isLeft && print.suffix != portPartID &&
        bottomLength > PIXEL_DISTANCE * 1.2) {
      supportOffset = PIXEL_DISTANCE * (ledAtVertex ? 0.5 : 1)
      supportOffset += edgeOffset(endVertex, wall.vertex) * PIXEL_DISTANCE
      supportOffset += wall.extraLEDSupportOffset
      let threshold = lengthOffset + LED_SUPPORT_WIDTH/2
      if (miterAngle < 0) {
        threshold += Math.tan(miterAngle) * WALL_THICKNESS
      }
      while (supportOffset < threshold) {
        supportOffset += PIXEL_DISTANCE
      }
    }
    if (!isLeft && print.suffix != portPartID
        && maxLength > PIXEL_DISTANCE * 2.5) {
      supportOffset = edgeLength - PIXEL_DISTANCE * (ledAtVertex ? 0.5 : 0)
      supportOffset -= supportOffset % PIXEL_DISTANCE
      supportOffset += edgeOffset(endVertex, wall.vertex) * PIXEL_DISTANCE
      let threshold = edgeLength - PIXEL_DISTANCE/2 - LED_SUPPORT_WIDTH
      while (supportOffset > threshold) {
        supportOffset -= PIXEL_DISTANCE
      }
    }
    if (supportOffset != null && RENDER_MODE == "standard") {
      let v0 = endVertex.ogCoords
      let v1 = vertex1.ogCoords
      let e = v1.sub(v0).normalize()
      let worldPosition = v0.addScaledVector(e, supportOffset / PIXEL_DISTANCE)
      
      let shouldAddSupport = true
      for (let wp of ledWorldPositions) {
        if (wp.equals(worldPosition)) {
          shouldAddSupport = false
        }
      }
      if (shouldAddSupport) {
        ledWorldPositions.push(worldPosition)
        position = startV.addScaledVector(E, -supportOffset)
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
    }
  }
  if (LED_SUPPORT_TYPE == "all" && RENDER_MODE == "standard" &&
      !(isPortRelated && PORT_TYPE == "USBC_INTEGRATED")) {
    let v0 = endVertex.ogCoords
    let v1 = vertex1.ogCoords
    let e = v1.sub(v0).normalize()

    supportOffset = PIXEL_DISTANCE * (ledAtVertex ? -0.5 : 0)
    supportOffset += edgeOffset(endVertex, wall.vertex) * PIXEL_DISTANCE

    let minOffset = lengthOffset + LED_SUPPORT_WIDTH/2 + wall.extraLEDSupportOffset
    minOffset = Math.max(minOffset, 0.1)
    if (miterAngle < 0) {
      minOffset += Math.tan(miterAngle) * WALL_THICKNESS
    }
    let maxOffset = edgeLength - LED_SUPPORT_WIDTH
    if (wall.isFoldWall && epsilonEquals(wall.dihedralAngle, 0)) {
      maxOffset += PIXEL_DISTANCE
    } else {
      maxOffset = Math.min(maxOffset, v0.sub(v1).length() - 0.1)
    }

    while (supportOffset < maxOffset) {
      if (supportOffset < minOffset) {
        supportOffset += PIXEL_DISTANCE
        continue
      }

      let worldPosition = v0.addScaledVector(e, supportOffset / PIXEL_DISTANCE)
      let shouldAddSupport = true
      for (let wp of ledWorldPositions) {
        if (wp.equals(worldPosition)) {
          shouldAddSupport = false
        }
      }
      if (shouldAddSupport) {
        ledWorldPositions.push(worldPosition)
        position = startV.addScaledVector(E, -supportOffset)
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

      supportOffset += PIXEL_DISTANCE
    }
  }

  // Embossing
  if (!NO_EMBOSSING && RENDER_MODE == "standard" &&
    !(hasPort && PORT_TYPE == "USBC_INTEGRATED")) {

    let emboPos = startV.addScaledVector(E, -lengthOffset - wall.extraLEDSupportOffset)
        .addScaledVector(N, -LED_SUPPORT_GAP/2 - LED_SUPPORT_THICKNESS - 0.1)
    print.components.push({
      type: "embossing",
      position: [emboPos.x, -emboPos.y, WALL_THICKNESS],
      rotationAngle: -rotationAngle,
      halign: isLeft ? "left" : "right",
      valign: "bottom",
      text: print.suffix,
    })
  }
  if (RENDER_MODE == "parts") {
    let V = wallStart.addScaledVector(E, -2)
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
      embossing.halign = "left"
    }
    print.components.push(embossing)
  }


  // Port hole
  if (hasPort || (PORT_POSITION == "fold" && isPortRelated)) {
    let portCenter = wallStart
    if (PORT_POSITION == "start") {
      portCenter = portCenter.addScaledVector(E, -USBC_WIDTH/2 - 1)
    }
    if (PORT_POSITION == "center") {
      portCenter = portCenter.addScaledVector(E, -topLength/2)
    }
    if (PORT_POSITION == "end") {
      portCenter = portCenter.addScaledVector(E,
        -Math.min(topLength, bottomLength) + USBC_WIDTH/2 + 1)
    }
    if (PORT_POSITION == "fold") {
      portCenter = portCenter.addScaledVector(E, -(topLength + bottomLength)/2)
    }

    if (PORT_TYPE == "USBC") {
      let portStart = portCenter.addScaledVector(E, -USBC_WIDTH/2)
      .addScaledVector(N, USBC_HEIGHT/2)
      port_path = pathFromSegments(portStart, [
        E.scale(USBC_WIDTH),
        N.scale(-USBC_HEIGHT),
        E.scale(-USBC_WIDTH),
        N.scale(USBC_HEIGHT),
      ])
      wallElem.querySelector("path").setAttribute("d", port_path)
      print = {
        type: "difference",
        suffix: print.suffix,
        components: [
          print,
          {
            type: "svg",
            svg: wallElem.outerHTML,
            thickness: WALL_THICKNESS + 1,
            position: [0, -WALL_PANEL_HEIGHT/2, 0],
          }
        ]
      }
    }
    if (PORT_TYPE == "USBC_INTEGRATED") {
      portCenter.y = -portCenter.y

      let port_width = 9.2
      let port_length = 10.6
      let port_radius = 1.6

      // let pcb_width = 9.1
      let pcb_thickness = 1
      let pcb_cover_length = 1

      let top_gap = 0.4
      let top_thickness = 8.2
      let top_border = 3
      let top_width = port_width + 2*top_border+1
      let top_radius = port_radius + top_border


      let portRotation = wall.dihedralAngle/2 * (isLeft ? -1:1)

      print = {
        type: "difference",
        suffix: print.suffix,
        components: [
          {
            type: "union",
            components: [
              print,
              {
                position: portCenter.toArray(),
                rotationAngle: portRotation,
                code: `
translate([0,0,${-top_thickness}])
pillinder(${top_width}, ${top_radius}, ${top_thickness});`
              },
              {
                type: "prefix",
                code: `
module pillinder(width, radius, height) {
  hull() {
    translate([width/2 - radius, 0, 0])
    cylinder(h=height, r=radius, $fn=64);
    translate([-width/2 + radius, 0, 0])
    cylinder(h=height, r=radius, $fn=64);
  }
}`
              }
            ]
          },
          {
            position: portCenter.toArray(),
            rotationAngle: portRotation,
            code: `
difference() {
  translate([0, 0, ${-top_thickness}])
  pillinder(${port_width}, ${port_radius}, ${port_length + top_gap});

  translate([0, ${(pcb_thickness + port_radius)/2}, ${port_length -top_thickness -top_gap + pcb_cover_length/2+1}])
  cube([${port_width}, ${port_radius}, ${pcb_cover_length+2}], center=true);
}`
          }
        ]
      }
      
      if (!wall.isFoldWall && RENDER_MODE == "standard") {
        print.operations = [{type: "rotation", vector: [Math.PI, 0, 0]}]
      }
    }
  }

  return print
}

function pathFromSegments(start, segments) {
  let path = ` M${start.x} ${start.y}`
  for (let seg of segments) {
    path += ` l${seg.x} ${seg.y}`
  }
  path += " Z"
  return path
}

function latchPoints(E, N, reverse, insetAngle) {
  let points = []
  switch (LATCH_TYPE) {
    case "wedge":
      let inset = 0
      if (insetAngle > 0) {
        insetAngle = insetAngle * insetAngle / (WEDGE_INSET_REDUCTION_FACTOR + insetAngle)
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

function edgeOffset(vertex, prevVertex, startVertex) {
  if (!startVertex) {
    startVertex = prevVertex
  }

  let singleSided = true
  for (let edge of vertex.edges) {
    if (edge.isDupe) {
      singleSided = false
      break
    }
  }
  if (vertex == startVertex) return 0
  if (vertex.edges.length != (singleSided ? 2 : 4)) return 0

  let nextVertex = null
  let offset = 0
  for (let edge of vertex.edges) {
    if (edge.isDupe) continue
    nextVertex = edge.otherVertex(vertex)
    if (nextVertex == prevVertex) continue
    offset = 1 - edge.length()%1
    break
  }
  offset = (edgeOffset(nextVertex, vertex, startVertex) + offset) % 1
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
    foldWalls = []
    edgeToWalls = {}
    covers = {top: [], bottom: []}
    
    IS_BOTTOM = false
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
    let dims = maxes.sub(mins).scale(PIXEL_DISTANCE / 25.4)
    console.log(`Overall dimensions approx ${dims.x.toFixed(1)}" x ${dims.y.toFixed(1)}" x ${dims.z.toFixed(1)}"`)


    createPrintInfo3D()
  }
}
