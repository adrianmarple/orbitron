module.exports = () => {
  CHANNEL_WIDTH = 13
  BORDER = 12
  MAX_NOTCH_DISTANCE = 100
  // cat5PortMidway = true
  // startMidwayDownFinalEdge = true
  ledAtVertex = true

  xCount = 93
  xWiggle = xCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1524
  console.log("x", xWiggle)
  yCount = 63
  yWiggle = yCount * PIXEL_DISTANCE - CHANNEL_WIDTH - 2*WALL_THICKNESS - 1016
  console.log("y", yWiggle)

  addPolygon(4, [0,0,0], [xCount, yCount])

  EulerianPath(1)
}
