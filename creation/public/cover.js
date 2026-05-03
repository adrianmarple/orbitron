
edgeToWalls = {}

function associateWallWithEdge(wall, associatedEdge) {
  if (IS_BOTTOM) return
  if (!edgeToWalls[associatedEdge.index]) {
    edgeToWalls[associatedEdge.index] = []
  }
  if (!edgeToWalls[associatedEdge.index].includes(wall)) {
    edgeToWalls[associatedEdge.index].push(wall)
  }
}


async function createCover(plain) {
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

  print.minX = 1e6
  print.minY = 1e6
  print.maxX = -1e6
  print.maxY = -1e6

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
        let zTransFar = zTrans + TOTAL_THICKNESS
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
        borderString += pointsToSVGString([p2, p1], print)
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
          thickness: TOTAL_THICKNESS,
          width: CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER,
          skew,
        })
      } else if (incomingFoldWall) {
        points = [[borderLengthOffset, width]]
        borderString += pointsToSVGString(points, print, {basis: [e1, n], offset: v1})
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
        borderString += pointsToSVGString([p], print)
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
          thickness: TOTAL_THICKNESS,
          width: CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER,
          skew,
        })
      } else {
        points = [[borderLengthOffset, width]]
        borderString += pointsToSVGString(points, print, {basis: [e1, n], offset: v1})
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
        channelString += pointsToSVGString([p2, p1], print)
      } else if (incomingFoldWall) {
        channelString += pointsToSVGString([[channelLengthOffset, width]], print, {basis: [e1, n], offset: v1})

        let edge = vertex1.getEdge(vertex2)
        let { deadendPlain, line } = vertex2.fold(edge, false).getCoverInfo(edge, false, R)
        deadendPlain = deadendPlain.translate(e1.normalize().scale(5)) // TODO calculate more properply
        let line2 = line.translate(n.scale(width))
        let p = deadendPlain.intersection(line2)
        channelString += pointsToSVGString([p], print)
      } else {
        channelString += pointsToSVGString([[channelLengthOffset, width]], print, {basis: [e1, n], offset: v1})
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
      position: [print.minX, 2*print.minY - print.maxY, 0]
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
      thickness: TOTAL_THICKNESS,
      operations: importCorrectionOperations,
    })
  }
  print.svg = svg

  print.worldPlacementOperations = [
    {
      type: "translate",
      position: [0, 0, -(CHANNEL_DEPTH/2 + TOTAL_THICKNESS)],
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
        .addScaledVector(FORWARD, TOTAL_THICKNESS)
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
          .addScaledVector(FORWARD, TOTAL_THICKNESS - HOOK_THICKNESS/2)
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
    path += "M" + pointsToSVGString(points, print, {basis, offset}).substring(1) + "Z "

    xs = xt + 2*(trueNotchDepth + KERF)
  }
  return path
}

function pointsToSVGString(points, print, {basis, offset, flip} = {}) {
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
    if (truePoint.x > print.maxX || truePoint.y > print.maxY ||
        truePoint.x < print.minX || truePoint.y < print.minY) {
      print.maxX = Math.ceil(Math.max(print.maxX, truePoint.x))
      print.maxY = Math.ceil(Math.max(print.maxY, truePoint.y))
      print.minX = Math.floor(Math.min(print.minX, truePoint.x))
      print.minY = Math.floor(Math.min(print.minY, truePoint.y))
      cover.setAttribute("width", print.maxX - print.minX)
      cover.setAttribute("height", print.maxY - print.minY)
      cover.setAttribute("viewBox", `${print.minX} ${print.minY} ${print.maxX - print.minX} ${print.maxY - print.minY}`)
    }
  	s += `L${truePoint.x} ${truePoint.y} `
  }
  if (flip) {
    s += pointsToSVGString(points.reverse(), print, {basis: basis.reverse(), offset})
  }
  return s
}
