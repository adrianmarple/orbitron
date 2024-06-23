
module.exports = async () => {
  // setLaserParams({
  //   PIXEL_DISTANCE: 10,
  // })
  // pixelDensity = 0.5
  pixelDensity = 0.333333
  // pixelDensity = 0.25
  BOTTOM_THICKNESS = TOP_THICKNESS
  // minimalInnerBorder = true
  isWall = true

  // imageUrl = "signs/made2D (old).png"
  imageUrl = "signs/made2D.png"

  // edgeCentersBlacklist = [
  //   [12.5, -4, 0],
  //   [12.5, -5, 0],
  //   [18.5, -4, 0],
  //   [18.5, -5, 0],
  // ]

  // await addSquaresFromPixels(true, {x:[10], y:[10]})
  await addSquaresFromPixels() // TODO fixe me!
  doubleEdges()
  EulerianPath(63, 1)
}
