// SKIP
module.exports = async () => {
  exteriorOnly = true
  PORT_POSITION = "center"
  powerHoleWallIndex = 0

  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  TOP_KERF = -0.2
  CHANNEL_DEPTH = CAT5_HEIGHT

  await addFromSVG("THEBOX/medium boxshape.svg")

  EulerianPath(1)
}