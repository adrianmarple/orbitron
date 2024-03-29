
addButton("THEBOX/thebox", async () => {
  // BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 0

  setLaserParams({
    PIXEL_DISTANCE: pixelDensity,
    CHANNEL_WIDTH: 0,
    // CHANNEL_DEPTH: 16.2,
    // BORDER: 4,
    BOTTOM_THICKNESS: 0,
  })
  CHANNEL_DEPTH = CAT5_HEIGHT
  HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
  
  // let x = 9
  // let dodecEdges = addDodecagon([0,0,0], [4*x, 5*x])
  // extrudePolygon(dodecEdges[2], 3)
  // removeEdge(dodecEdges[2])
  // extrudePolygon(dodecEdges[10], 3)
  // removeEdge(dodecEdges[10])

  await addFromSVG("THEBOX/small boxshape.svg")
  center()
  EulerianPath(1)
})
