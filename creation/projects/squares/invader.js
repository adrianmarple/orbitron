// SKIP
module.exports = async () => {
  WOOD_KERF = 0.12 * MM_TO_96DPI
  minimalInnerBorder = true

  imageUrl = "spaceinvaders/invader1A.png"
  // imageUrl = "spaceinvaders/invader1B.png"
  await addSquaresFromPixels()
  scale(4)
  EulerianPath(23)
  // scale(3)
  // EulerianPath(36)
}
