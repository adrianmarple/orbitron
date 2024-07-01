
module.exports = async () => {
  // BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 0

  PIXEL_DISTANCE = pixelDensity
  CHANNEL_WIDTH = 0
  TOP_KERF = -0.2
  CHANNEL_DEPTH = CAT5_HEIGHT
  HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS

  await addFromSVG("THEBOX/small boxshape.svg")

  EulerianPath(1)
}