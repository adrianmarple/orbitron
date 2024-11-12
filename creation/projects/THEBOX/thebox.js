
module.exports = async () => {
  setFor3DPrintedCovers()
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHoleWallIndex = 0

  PIXEL_DISTANCE = pixelDensity
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  THICKNESS = 2
  INNER_CHANNEL_THICKNESS = null

  await addFromSVG("THEBOX/small boxshape.svg")

  EulerianPath(1)
}