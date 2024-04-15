
addButton("hackerdojo/hive", async () => {
  BOTTOM_THICKNESS = TOP_THICKNESS
  ledAtVertex = false
  pixelDensity = 2
  BORDER = 5

  await addFromSVG("hackerdojo/hive.svg")
  // addTriangulation(verticies[89], verticies[86], 8)
  // addTriangulation(verticies[39], verticies[37], 16)
  addTriangulation(verticies[46], verticies[44], 16)

  doubleEdges()
  center()
  // EulerianPath(37, 1)
  // EulerianPath(76)
  EulerianPath(11)
})
