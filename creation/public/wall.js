

function foldWallCreation(foldWall, printInfo) {
  if (!printInfo) return

  foldWall.zRotationAngle = Math.atan(Math.tan(foldWall.dihedralAngle/2) / Math.cos(foldWall.aoiComplement))
  foldWall.yRotationAngle = Math.atan(Math.tan(foldWall.aoiComplement) * Math.cos(foldWall.zRotationAngle))

  let translation = {
    type: "translate",
    position: [0, 0, -WALL_THICKNESS],
  }

  let leftJoint = wallPrint(foldWall, true, printInfo)
  let rightJoint = wallPrint(foldWall, false, printInfo)

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
      type: "difference",
      suffix: leftJoint.suffix,
      components: [ {
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
        },
        { // Prevent and LED supports from dropping below z=0
          position: [0,0,-5],
          type: "cube",
          dimensions: [100,100,10],
        }
      ]
    }
    if (foldWall.yRotationAngle < 0) {
      print.components[0].components[0].operations = [translation]
      print.components[0].components[1].operations.unshift(translation)
      flipPrint(print.components[1])
      cleanForFlip(leftJoint)
      flipPrint(print)
    }
    if (leftPort || rightPort) {
      console.log("WARNING! Untested port configuration")
    }
    printInfo.prints.push(print)
    foldWall.print = print
  }
}


// function createOuterSleevePrint(dihedralAngle) {
//   let coverWidth = CHANNEL_WIDTH + 2*(WALL_THICKNESS + BORDER)
//   let coverThickness = THICKNESS + EXTRA_COVER_THICKNESS
//   let outerY = coverWidth + 2*SLEEVE_THICKNESS
//   let outerZ = coverThickness + 2*SLEEVE_THICKNESS
//   let transX = SLEEVE_LENGTH/2

//   let arm = {
//     type: "difference",
//     position: [0, 0, -Math.sign(dihedralAngle) * outerZ/2], // Adjust so arms rotate about wedge tip
//     components: [
//       {
//         type: "union",
//         components: [
//           { // Outer shell
//             type: "cube",
//             dimensions: [SLEEVE_LENGTH, outerY, outerZ],
//             operations: [{ type: "translate", position: [transX, 0, 0] }],
//           },
//           { // Wedge at seam end (X=0)
//             type: "wedge",
//             angle: dihedralAngle / 2,
//             rotationAngle: Math.PI,
//             width: outerY,
//             thickness: outerZ,
//             position: [0, 0, -outerZ/2],
//           },
//         ]
//       },
//       { // Inner hollow where the cover plate sits.
//         type: "cube",
//         dimensions: [SLEEVE_LENGTH + 10, coverWidth, coverThickness],
//         operations: [{ type: "translate", position: [transX, 0, 0] }],
//       },
//       { // Gap for where walls and channel sit.
//         type: "cube",
//         dimensions: [SLEEVE_LENGTH + 10, CHANNEL_WIDTH + 2*WALL_THICKNESS, SLEEVE_THICKNESS+0.1],
//         operations: [{ type: "translate", position: [transX, 0, coverThickness/2 + SLEEVE_THICKNESS/2] }],
//       },
//     ]
//   }

//   return {
//     type: "union",
//     suffix: `outersleeve_dihedral${(dihedralAngle * 180 / Math.PI).toFixed(1)}`,
//     operations: [
//       { type: "rotate", axis: [0, 1, 0], angle: Math.PI/2 },
//     ],
//     components: [
//       arm,
//       { ...arm,
//         operations: [
//           { type: "mirror", normal: [1, 0, 0] },
//           { type: "rotate", axis: [0, 1, 0], angle: dihedralAngle },
//         ]
//       },
//     ],
//   }
// }
// function createInnerSleevePrint(dihedralAngle) {
//   let skew = Math.tan(dihedralAngle/2)
//   let depth = CHANNEL_DEPTH / Math.cos(dihedralAngle/2)
//   let innerY = CHANNEL_WIDTH - 2*SLEEVE_THICKNESS
//   let innerZ = depth- 2*SLEEVE_THICKNESS
//   let transX = SLEEVE_LENGTH/2

//   let arm =  {
//     type: "difference",
//     operations: [
//       { type: "matrix3", M: [1,0,skew, 0,1,0, 0,0,1] },
//       { type: "translate", position: [transX, 0, 0] },
//     ],
//     components: [
//       {
//         type: "cube",
//         dimensions: [SLEEVE_LENGTH, CHANNEL_WIDTH, depth],
//       },

//       {
//         type: "cube",
//         dimensions: [SLEEVE_LENGTH+1, innerY, innerZ],
//       },
//       {
//         type: "cube",
//         dimensions: [SLEEVE_LENGTH+1, SLEEVE_THICKNESS+1, depth/2],
//         position: [0, CHANNEL_WIDTH/2, 0]
//       },
//     ]
//   }

//   return {
//     type: "union",
//     suffix: `innersleeve_dihedral${(dihedralAngle * 180 / Math.PI).toFixed(1)}`,
//     operations: [
//       { type: "rotate", axis: [0, 1, 0], angle: Math.PI/2 },
//     ],
//     components: [
//       arm,
//       {
//         type: "union",
//         operations: [{ type: "mirror", normal: [1, 0, 0] }],
//         components: [arm]
//       },
//     ]
//   }
// }

function wallPrint(wall, isLeft, printInfo) {
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
  wall.print = print
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
  let portPartNumber = portPartID ? portPartID.match(/\d+/)[0] : null
  let isPortRelated = print.suffix.match(/\d+/)[0] == portPartNumber

  let portOffset = lengthOffset + wall.extraLEDSupportOffset
  if (PORT_POSITION == "start") portOffset += USBC_WIDTH/2 + 1
  else if (PORT_POSITION == "center") portOffset += topLength/2
  else if (PORT_POSITION == "end") portOffset += Math.min(topLength, bottomLength) - USBC_WIDTH/2 - 1
  else if (PORT_POSITION == "fold") portOffset += (topLength + bottomLength)/2

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
      for (let wp of printInfo.ledWorldPositions) {
        if (wp.equals(worldPosition)) {
          shouldAddSupport = false
        }
      }
      if (shouldAddSupport) {
        printInfo.ledWorldPositions.push(worldPosition)
        position = startV.addScaledVector(E, -supportOffset)
        print.components.push({
          type: "ledSupport",
          position: [position.x, -position.y, WALL_THICKNESS],
          width: LED_SUPPORT_WIDTH,
          height: LED_SUPPORT_HEIGHT,
          thickness: LED_SUPPORT_THICKNESS,
          gap: LED_SUPPORT_GAP,
          rotationAngle: -rotationAngle,
        })
      }
    }
  }
  if (LED_SUPPORT_TYPE == "all" && RENDER_MODE == "standard") {
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
      maxOffset = Math.min(maxOffset, v0.sub(v1).length()*PIXEL_DISTANCE - 0.1)
    }

    if (hasPort && PORT_TYPE.startsWith("USBC")) {
      let portBlockMin = portOffset - USBC_WIDTH/2 - LED_SUPPORT_WIDTH/2
      let portBlockMax = portOffset + USBC_WIDTH/2 + LED_SUPPORT_WIDTH/2
      let testOffset = supportOffset
      while (testOffset < maxOffset) {
        if (testOffset >= portBlockMin && testOffset <= portBlockMax) {
          printInfo.ledWorldPositions.push(v0.addScaledVector(e, testOffset / PIXEL_DISTANCE))
        }
        testOffset += PIXEL_DISTANCE
      }
    }

    if (!(isPortRelated && PORT_TYPE == "USBC_INTEGRATED") &&
        !(isLeft && wall.isFoldWall && wall.yRotationAngle < 0) ) {
      while (supportOffset < maxOffset) {
        if (supportOffset < minOffset) {
          supportOffset += PIXEL_DISTANCE
          continue
        }

        let worldPosition = v0.addScaledVector(e, supportOffset / PIXEL_DISTANCE)
        let shouldAddSupport = true
        for (let wp of printInfo.ledWorldPositions) {
          if (wp.equals(worldPosition)) {
            shouldAddSupport = false
          }
        }
        if (shouldAddSupport) {
          printInfo.ledWorldPositions.push(worldPosition)
          position = startV.addScaledVector(E, -supportOffset)
          print.components.push({
            type: "ledSupport",
            position: [position.x, -position.y, WALL_THICKNESS],
            width: LED_SUPPORT_WIDTH,
            height: LED_SUPPORT_HEIGHT,
            thickness: LED_SUPPORT_THICKNESS,
            gap: LED_SUPPORT_GAP,
            rotationAngle: -rotationAngle,
          })
        }

        supportOffset += PIXEL_DISTANCE
      }
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
    let portCenter = startV.addScaledVector(E, -portOffset)

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

      let port_width = 9.5
      let port_radius = 1.63

      let pcb_width = 16.2
      let pcb_depth = 2
      let pcb_thickness = 1.6
      let usbc_pcb_thickness = 1
      let pcb_offset = (pcb_thickness - usbc_pcb_thickness)/2
      if (wall.isFoldWall) {
        let firstEdge = edges[window.path[0]]
        if (firstEdge.verticies.includes(wall.left.endVertex)) {
          pcb_offset *= -1
        }
      }

      let top_thickness = 12.2 - WALL_THICKNESS
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
{
  translate([0, 0, ${-top_thickness}])
  pillinder(${port_width}, ${port_radius}, ${top_thickness + WALL_THICKNESS});

  translate([0, ${pcb_offset}, ${WALL_THICKNESS - pcb_depth/2}])
  cube([${pcb_width}, ${pcb_thickness}, ${pcb_depth}], center=true);
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
