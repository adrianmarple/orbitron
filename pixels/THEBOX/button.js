
addButton("THE BOX", async () => {
  name = "thebox"
  // BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 1

  setLaserParams({
    PIXEL_DISTANCE: pixelDensity,
    CHANNEL_WIDTH: 0,
    CHANNEL_DEPTH: 16.2,
  })
  
  let x = 9
  let dodecEdges = addDodecagon([0,0,0], [4*x, 5*x])
  extrudePolygon(dodecEdges[2], 3)
  removeEdge(dodecEdges[2])
  extrudePolygon(dodecEdges[10], 3)
  removeEdge(dodecEdges[10])

  // await addFromSVG("THEBOX/cat boxshape.svg")
  center()
  EulerianPath(4)
})
