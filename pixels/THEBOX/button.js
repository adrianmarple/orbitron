
addButton("THE BOX", async () => {
  name = "thebox"
  // BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.1
  exteriorOnly = true
  setLaserParams({
    PIXEL_DISTANCE: pixelDensity,
    CHANNEL_WIDTH: 0,
  })

  await addFromSVG("THEBOX/boxshape.svg")
  center()
  EulerianPath(0)
})
