
addButton("hackerdojo/hive", async () => {
  BOTTOM_THICKNESS = TOP_THICKNESS
  ledAtVertex = false
  pixelDensity = 2
  // setLaserParams({
  //   BORDER: 4,
  //   CHANNEL_WIDTH: 5,
  //   CHANNEL_DEPTH: 8,
  //   NOTCH_DEPTH: 3,
  //   PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  // })
  BORDER = 5

  await addFromSVG("hackerdojo/hive.svg")
  // addTriangulation(verticies[89], verticies[86], 8)
  // addTriangulation(verticies[39], verticies[37], 16)
  addTriangulation(verticies[46], verticies[44], 16)

  doubleEdges()
  center()
  // EulerianPath(37, 1)
  // EulerianPath(76)
  EulerianPath(75, 1)
})
