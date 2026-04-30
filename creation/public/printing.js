
covers = {top: [], bottom: []}

function blackPrintInfo(prints=[]) {
  return {
    type: "gcode",
    ledWorldPositions: [],
    prints,
  }
}
function blankPrint() {
  return {
    type: "union",
    components: [],
  }
}

function createFullModel() {
  let print = blankPrint()
  let printInfo = blackPrintInfo([print])
  print.suffix = "_full"
  print.operations = [{ type: "rotate", axis: [1,0,0], angle: -Math.PI/2 }]

  for (let type of COVER_TYPES) {
    for (let coverPrint of covers[type]) {
      coverPrint.operations = coverPrint.worldPlacementOperations
      print.components.push(coverPrint)
    }
  }
  if (RENDER_MODE == "simple" || RENDER_MODE == "simplest") {
    return printInfo
  }

  let completedParts = {}
  for (let edge of edges) {
    if (edge.isDupe) continue
    for (let wall of edgeToWalls[edge.index]) {
      if (completedParts[wall.partID]) continue
      if (wall.isFoldWall) {
        let wallPrint1 = wallPrint(wall, true, printInfo)
        wallPrint1.operations = [...wall.left.worldPlacementOperations]
        wallPrint1.operations[2] = {...wallPrint1.operations[2]}
        wallPrint1.operations[2].angle += wall.zRotationAngle
        if (wall.aoiComplement < -0.0001) {
          wallPrint1.operations.splice(3, 0, {
            type: "translate",
            position: [Math.tan(wall.aoiComplement) * WALL_THICKNESS, 0, 0],
          })
        }
        print.components.push(wallPrint1)

        let wallPrint2 = wallPrint(wall, false, printInfo)
        wallPrint2.operations = [...wall.right.worldPlacementOperations]
        wallPrint2.operations[2] = {...wallPrint2.operations[2]}
        wallPrint2.operations[2].angle -= wall.zRotationAngle
        if (wall.aoiComplement < -0.0001) {
          wallPrint2.operations.splice(3, 0, {
            type: "translate",
            position: [-Math.tan(wall.aoiComplement) * WALL_THICKNESS, 0, 0],
          })
        }
        print.components.push(wallPrint2)
      } else {
        let wPrint = wallPrint(wall, true, printInfo)
        wPrint.operations = wall.worldPlacementOperations
        print.components.push(wPrint)
      }
      completedParts[wall.partID] = true
    }
  }

  return printInfo
}

function createPrintInfo3D() {
  printInfo = blackPrintInfo()
  let completedPlains = []
  let completedWalls = []
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
        let print = wallPrint(wall, true, printInfo)
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

  if (SLEEVE_TYPE != null) {
    let uniqueSleeveWalls = []
    for (let wall of completedWalls) {
      if (!wall.isFoldWall) continue
      let isNew = !uniqueSleeveWalls.some(({dihedralAngle, aoiComplement}) =>
        epsilonEquals(dihedralAngle, wall.dihedralAngle) &&
        epsilonEquals(aoiComplement, wall.aoiComplement))
      if (isNew) {
        uniqueSleeveWalls.push(wall)
      }
    }
    for (let wall of uniqueSleeveWalls) {
      // [TODO] for now, I'm assuming an angle of incidence of 90deg, make more general later
      if (epsilonEquals(wall.aoiComplement, 0)) {
        if (SLEEVE_TYPE == "OUTER") {
          printInfo.prints.push(createOuterSleevePrint(wall.dihedralAngle))
          printInfo.prints.push(createOuterSleevePrint(-wall.dihedralAngle))
        } else if (SLEEVE_TYPE == "INNER") {
          printInfo.prints.push(createInnerSleevePrint(wall.dihedralAngle))
        }
      } else {
        console.error("Trying to make sleeves for wall with non-zero aoiComplement", wall)
      }
    }
  }

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

function bracketCapturePostProcessing({
  glassT = 1.5,
  captureWallExtra = 1.5,
  glassROffset = 4,
  highOverhang = 6,
  lowOverhang = 4.8,
  indicies = {},
} = {}) {

  // Enumerate one representative face per unique n-gon type by walking nextEdge.
  function enumerateFacesByType() {
    let visitedFaces = new Set()
    let facesByType = {}
    let startVertex = verticies[0]
    for (let startEdge of startVertex.edges) {
      if (startEdge.isDupe) continue
      let faceVerts = [startVertex]
      let prevEdge = startEdge
      let nextVertex = startEdge.otherVertex(startVertex)
      while (nextVertex !== startVertex) {
        faceVerts.push(nextVertex)
        prevEdge = nextVertex.nextEdge(prevEdge)
        nextVertex = prevEdge.otherVertex(nextVertex)
        prevEdge.toLine()
        if (prevEdge.toLine().isColinear(faceVerts[faceVerts.length - 2].ogCoords)) {
          faceVerts.pop()
        }
      }
      if (faceVerts.length < 3) continue
      let key = faceVerts.map(v => verticies.indexOf(v)).sort((a, b) => a - b).join(',')
      if (visitedFaces.has(key)) continue
      visitedFaces.add(key)
      let n = faceVerts.length
      if (!facesByType[n]) facesByType[n] = faceVerts
    }
    return facesByType
  }

  return printInfo => {
    let captureWall = glassT / 2 + captureWallExtra
    let facesByType = enumerateFacesByType()
    let newPrints = []

    for (let n in facesByType) {
      let index = indicies[n]
      let print = printInfo.prints[index]

      let faceVerts = facesByType[n]
      let vertex = faceVerts[0]
      let v = vertex.ogCoords
      let v0 = faceVerts[1].ogCoords
      let v1 = faceVerts[n - 1].ogCoords
      let e0 = v0.sub(v).normalize()
      let e1 = v1.sub(v).normalize()
      let facePlain = new Plain(v, e0.cross(e1))
      let faceCenter = facePlain.offset

      let e0Plain = vertex.commonPlain(faceVerts[1])
      let wallStart = crease(CHANNEL_WIDTH/2).intersection(e0Plain)
      let glassPlain = facePlain.shiftToIncludePoint(wallStart)

      // Angle between the two face edges in the tangent plane at this vertex.
      let wallAngle = v.cross(e0).normalize().angleTo(
        v.cross(e1).normalize())

      function crease(creaseOffset) {
        creaseOffset /= PIXEL_DISTANCE
        let plain0 = new Plain(v, v.cross(e0))
        let sign0 = Math.sign(plain0.normal.dot(e1))
        plain0 = plain0.translate(plain0.normal.scale(creaseOffset * sign0))
        let plain1 = new Plain(v, v.cross(e1))
        let sign1 = Math.sign(plain1.normal.dot(e0))
        plain1 = plain1.translate(plain1.normal.scale(creaseOffset * sign1))
        return plain0.intersection(plain1)
      }
      function creaseR(creaseOffset) {
        let cr = crease(creaseOffset)
        let creaseInter = glassPlain.intersection(cr)
        return glassPlain.offset.sub(creaseInter).length() * PIXEL_DISTANCE
      }

      let faceH = faceCenter.length() * PIXEL_DISTANCE
      let faceR = faceCenter.sub(v).length() * PIXEL_DISTANCE
      let slope = faceH / faceR
      let outerR = creaseR(CHANNEL_WIDTH/2)
      let innerR = creaseR(CHANNEL_WIDTH/2 + WALL_THICKNESS)
      let glassR = Math.round(innerR - glassROffset)
      let lowR = innerR + captureWall / slope
      let highR = innerR - captureWall / slope
      let slopeAngle = -Math.atan(slope) * 180 / Math.PI
      // rotY bisects the wallAngle to center the bracket between the two face edges.
      let rotY = -90 - wallAngle / 2 * 180 / Math.PI
      let sectorAngle = 360 / n

      console.log(`Glass Radius for ${n}-gon:`, glassR)

      function makeBracketCode(open) {
        return { code:`
            sectorPoints = concat([[0, 0]],
                [100 * cos(${sectorAngle / 2}), 100 * sin(${sectorAngle / 2})],
                [100 * cos(${-sectorAngle / 2}), 100 * sin(${-sectorAngle / 2})]
                // [for(a = [${sectorAngle / 2} : 10 : 360 - ${sectorAngle / 2}])
                //     [100 * cos(a), 100 * sin(a)]
                // ]
            );
            rotate([${slopeAngle}, ${rotY}, 0])
            translate([0, ${outerR}, 0])
            rotate([0, 0, -90])
            intersection() {
              difference() {
                cylinder(h=${2 * captureWall}, r1=${lowR}, r2=${highR}, $fn=${n}, center=true);

                cylinder(h=${glassT}, r=${glassR + 0.5}, $fn=${n}, center=true);
                if (${open}) {
                  translate([0, 0, ${-captureWall}])
                  cylinder(h=${captureWall}, r=${glassR + 0.5}, $fn=${n});
                }

                cylinder(h=100, r=${glassR - lowOverhang}, $fn=${n});
                translate([0, 0, ${-captureWall} - 1])
                cylinder(h=${captureWall} + 1, r=${glassR - highOverhang}, $fn=${n});
              }
              translate([0, 0, ${-captureWall} - 1])
              linear_extrude(${2*captureWall + 2})
              polygon([[0, 0],
                [100 * cos(${sectorAngle / 2}), 100 * sin(${sectorAngle / 2})],
                [100 * cos(${-sectorAngle / 2}), 100 * sin(${-sectorAngle / 2})]
              ]);
            }` }
      }
      newPrints.push({
        type: 'union',
        suffix: `wall${n}`,
        components: [print, makeBracketCode(false)]
      })
      newPrints.push({
        type: 'union',
        suffix: `wall${n}_open`,
        components: [print, makeBracketCode(true)]
      })
    }

    for (let key in indicies) {
      if (key < 20) continue // Terrible js hack
      let print = printInfo.prints[indicies[key]]
      print.suffix = key
      newPrints.push(print)
    }
    printInfo.prints = newPrints
  }
}

async function generateManufacturingInfo() {
  document.querySelectorAll("path.laser").forEach(path => path.setAttribute('d', ""))
  edgeToWalls = {}
  covers = {top: [], bottom: []}

  IS_BOTTOM = false
  for (let plain of plains) {
    covers.top.push(await createCover(plain))
    let coverPrint = covers.top.last()
    let w = (coverPrint.maxX - coverPrint.minX)
    let h = (coverPrint.maxY - coverPrint.minY)
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
    covers.bottom.push(await createCover(plain))
    let coverPrint = covers.bottom.last()
    let w = (coverPrint.maxX - coverPrint.minX) / 96
    let h = (coverPrint.maxY - coverPrint.minY) / 96
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


  if (RENDER_MODE != "simple" && RENDER_MODE != "simplest") {
    createPrintInfo3D()
  }
}
