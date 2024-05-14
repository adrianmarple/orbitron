module.exports = async () => {
  BOTTOM_THICKNESS = TOP_THICKNESS
  ledAtVertex = false
  pixelDensity = 2
  BORDER = 5

  await addFromSVG("hackerdojo/hive.svg")
  addTriangulation(verticies[46], verticies[44], 16)

  doubleEdges()
  center()
  EulerianPath(11)
}
