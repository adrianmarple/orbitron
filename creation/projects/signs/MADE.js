// SKIP
module.exports = async () => {

  // imageUrl = "signs/made2D (old).png"
  imageUrl = "signs/made2D.png"

  // edgeCentersBlacklist = [
  //   [12.5, -4, 0],
  //   [12.5, -5, 0],
  //   [18.5, -4, 0],
  //   [18.5, -5, 0],
  // ]

  // await addSquaresFromPixels(true, {x:[10], y:[10]})
  await addSquaresFromPixels()
  scale(3)
  EulerianPath(63, 1)
}
