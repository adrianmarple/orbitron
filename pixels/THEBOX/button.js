
addButton("THE BOX", async () => {
  name = "thebox"
  // BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 0

  setLaserParams({
    PIXEL_DISTANCE: pixelDensity,
    CHANNEL_WIDTH: 0,
    CHANNEL_DEPTH: 16.2,
  })

  await addFromSVG("THEBOX/hex boxshape.svg")
  center()
  EulerianPath(0)
})
