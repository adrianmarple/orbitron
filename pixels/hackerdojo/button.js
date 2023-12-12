
addButton("The Hive", async () => {
  name = "hive"
  BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.5
  setLaserParams({
    BORDER: 4,
    CHANNEL_WIDTH: 5,
    CHANNEL_DEPTH: 8,
    NOTCH_DEPTH: 3,
    PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  })

  await addFromSVG("hackerdojo/hive.svg")
  addTriangulation(verticies[88], verticies[85], 4)

  resizeOnExport = false
  doubleEdges()
  center()
  EulerianPath(37, 1)
})
