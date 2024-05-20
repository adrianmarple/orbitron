
module.exports = () => {
  CHANNEL_WIDTH = 10
  PIXEL_DISTANCE = 8.3 //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  MAX_NOTCH_DISTANCE = 140
  cat5PortMidway = true
  startMidwayDownFinalEdge = true
  ledAtVertex = false
  // EXTRA_SCALE = 1.0015
  WALL_VERT_KERF = 0.15

  addPolygon(4, [0,0,0], [44,56])

  EulerianPath(1)
}
