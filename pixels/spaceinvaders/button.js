
addButton("Space Invader", async () => {
  name = "invader"
  pixelDensity = 0.25
  BOTTOM_THICKNESS = TOP_THICKNESS
  WOOD_KERF = 0.12 * MM_TO_96DPI
  minimalInnerBorder = true

  imageUrl = "spaceinvaders/invader1A.png"
  await addSquaresFromPixels()
  doubleEdges()
  console.log(edges.length)

  EulerianPath(verticies[16], [23])
})
