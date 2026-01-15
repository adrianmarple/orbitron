// SKIP
module.exports = () => {
  CHANNEL_WIDTH = 13
  BORDER = 10
  PRINT_WALL_HALVES_SEPARATELY = false
  // LED_SUPPORT_GAP = 1
  PORT_POSITION = "center"
  portPartID = "3L"

  let xCount = 93
  let xWiggle = xCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1524
  console.log("x", xWiggle)
  let yCount = 63
  let yWiggle = yCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1015
  console.log("y", yWiggle)


  let INITIAL_OFFSET = 4
  let GAP = 12
  let BONE_LENGTH = 4
  let ANGLE = -135
  let POINT_LENGTH = 5
  let MID_LENGTH_S = 6.5
  let MID_LENGTH_L = 9.5

  let points = []
  let ends = []


  let squedges = addPolygon(4, [0,0,0], [xCount, yCount])
  for (let side of squedges) {
    let initialLength = side.length()
    let v = splitEdge(side, INITIAL_OFFSET)
    side = v.edges[1]
    let outerV = addLine(v, BONE_LENGTH, ANGLE).otherVertex(v)
    points.push(outerV)
    for (let i = 0; i < 1000; i++) {
      if (side.length() < initialLength/2 + GAP) {
        break
      }
      v = splitEdge(side, GAP)
      side = v.edges[1]
      let outerV2 = addLine(v, BONE_LENGTH, ANGLE).otherVertex(v)
      addEdge(outerV, outerV2)
      outerV = outerV2
    }
    ends.push(outerV)

    if (epsilonEquals(initialLength, xCount)) {
      ANGLE = -180 - ANGLE
    } else {
      ANGLE *= -1
    }

    v = splitEdge(side, side.length() - INITIAL_OFFSET)
    outerV = addLine(v, BONE_LENGTH, ANGLE).otherVertex(v)
    points.push(outerV)
    for (let i = 0; i < 1000; i++) {
      if (side.length() < 1.48*GAP) {
        break
      }
      v = splitEdge(side, side.length() - GAP)
      let outerV2 = addLine(v, BONE_LENGTH, ANGLE).otherVertex(v)
      addEdge(outerV, outerV2)
      outerV = outerV2
    }
    ends.push(outerV)

    if (epsilonEquals(initialLength, xCount)) {
      ANGLE = -90 - ANGLE
    } else {
      ANGLE = 90 - ANGLE
    }
  }

  let tips = []
  for (let i = 0; i < 4; i++) {
    let v = addTriangulation(points[(i*2 + 7)%8], points[i*2], POINT_LENGTH)
    tips.push(v)
  }
  for (let i = 0; i < 4; i++) {
    addTriangulation(ends[i*2], ends[(i*2 + 1)%8], i%2==0 ? MID_LENGTH_L : MID_LENGTH_S)
  }
  origami(new Plain(ZERO, RIGHT))
  let rightSide = plains[1]
  origami(new Plain(tips[0].ogCoords, new Vector(1,1,0)))
  origami(new Plain(tips[3].ogCoords, new Vector(1,-1,0)))
  currentPlain = rightSide
  origami(new Plain(tips[2].ogCoords, new Vector(-1,-1,0)))
  origami(new Plain(tips[1].ogCoords, new Vector(1,-1,0)))

  for (let i of [4,10,18,12,20,24,30,26,32,38,46,40,48,52,58,54]) {
    verticies[i].dontMergeEdges = true
  }
  for (let v of verticies) {
    v.dontMergeEdges = true
  }

  printPostProcessingFunction = printInfo => {
    for (let print of printInfo.prints) {
      if (print.suffix.endsWith("t") || print.suffix.endsWith("b")) {
        continue
      }
      print.operations = print.operations || []
      print.operations.push({ type: "scale", scale: 1.009 })
    }
  }

  EulerianPath(82)
}
