
module.exports = async () => {
  pixelDensity = 0.25
  BOTTOM_THICKNESS = TOP_THICKNESS
  WOOD_KERF = 0.12 * MM_TO_96DPI
  minimalInnerBorder = true

  // pixelDensity = 0.25
  // imageUrl = "spaceinvaders/invader1A.png"
  pixelDensity = 0.3333333
  imageUrl = "spaceinvaders/invader1B.png"
  await addSquaresFromPixels()
  doubleEdges()
  // EulerianPath(23)
  EulerianPath(36)
}
