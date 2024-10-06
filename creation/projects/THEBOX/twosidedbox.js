
module.exports = async () => {
  setFor3DPrintedCovers()
  pixelDensity = 1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 0

  PIXEL_DISTANCE = pixelDensity
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  TOP_KERF = -0.2
  CHANNEL_DEPTH = CAT5_HEIGHT
  HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS

  await addFromSVG("THEBOX/medium boxshape.svg")

  EulerianPath(1)
}