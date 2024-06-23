module.exports = async () => {
  BOTTOM_THICKNESS = TOP_THICKNESS
  pixelDensity = 2

  await addFromSVG("signs/hive.svg")
  addTriangulation(verticies[46], verticies[44], 16)

  doubleEdges()
  center()
  EulerianPath(11)
}
