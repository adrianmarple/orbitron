module.exports = () => {
  CHANNEL_WIDTH = 13
  BORDER = 12
  MAX_NOTCH_DISTANCE = 100
  // cat5PortMidway = true
  // startMidwayDownFinalEdge = true
  // ledAtVertex = true

  let xCount = 93
  let xWiggle = xCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1524
  console.log("x", xWiggle)
  let yCount = 63
  let yWiggle = yCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1016
  console.log("y", yWiggle)

  // let ANGLE = -120
  // let INITIAL_OFFSET = 4
  // let GAP = 5
  // let BONE_LENGTH = 5
  // let POINT_LENGTH = 7
  // let MID_LENGTH = 6
  let ANGLE = -120
  let INITIAL_OFFSET = 4
  let GAP = 12
  let BONE_LENGTH = 4
  let POINT_LENGTH = 7
  let MID_LENGTH_S = 6
  let MID_LENGTH_L = 9

  let points = []
  let ends = []

  let squedges = addPolygon(4, [0,0,0], [xCount, yCount])
  for (let side of squedges) {
    let initialLength = side.length()
    let v = splitEdge(side, INITIAL_OFFSET)
    side = v.edges[1]
    let outerV = otherVertex(addLine(v, BONE_LENGTH, ANGLE), v)
    points.push(outerV)
    for (let i = 0; i < 1000; i++) {
      if (side.length() < initialLength/2 + GAP) {
        break
      }
      v = splitEdge(side, GAP)
      side = v.edges[1]
      let outerV2 = otherVertex(addLine(v, BONE_LENGTH, ANGLE), v)
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
    outerV = otherVertex(addLine(v, BONE_LENGTH, ANGLE), v)
    points.push(outerV)
    for (let i = 0; i < 1000; i++) {
      if (side.length() < 1.48*GAP) {
        break
      }
      v = splitEdge(side, side.length() - GAP)
      let outerV2 = otherVertex(addLine(v, BONE_LENGTH, ANGLE), v)
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

  for (let i = 0; i < 4; i++) {
    addTriangulation(points[(i*2 + 7)%8], points[i*2], POINT_LENGTH)
  }
  for (let i = 0; i < 4; i++) {
    addTriangulation(ends[i*2], ends[(i*2 + 1)%8], i%2==0 ? MID_LENGTH_L : MID_LENGTH_S)
  }

  EulerianPath(92)
}
