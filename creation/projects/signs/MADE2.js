
module.exports = async () => {
  await addFromSVG("signs/MADE.svg")
  ledAtVertex = true
  cat5WallOverride = 30

  splitEdge(57,-2)
  splitEdge(59,2)
  addTriangulation(49,48, 4,3)
  removeVertex(46)
  removeVertex(46)

  splitEdge(52,2)
  splitEdge(50,-2)
  addTriangulation(49,50, 3,4)
  removeVertex(42)
  removeVertex(42)

  EulerianPath(4)
}
