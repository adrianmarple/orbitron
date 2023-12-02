
addButton("MADE", async () => {
  pixelDensity = 0.5
  // pixelDensity = 0.333333
  BOTTOM_THICKNESS = TOP_THICKNESS
  minimalInnerBorder = true
  isWall = true

  imageUrl = "MADE/made2D (old).png"
  // imageUrl = "MADE/made2D.png"

  // edgeCentersBlacklist = [
  //   [12.5, -4, 0],
  //   [12.5, -5, 0],
  //   [18.5, -4, 0],
  //   [18.5, -5, 0],
  // ]

  // await addSquaresFromPixels(true, {x:[10], y:[10]})
  await addSquaresFromPixels()
  doubleEdges()
  EulerianPath(verticies[0], [0])
})
