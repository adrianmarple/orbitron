// SKI
module.exports = async () => {
  setFor3DPrintedCovers()

  // portPartID = "1L"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  addVertex(new Vector(0, 18, 0))
  addVertex(new Vector(12, 18, 0))
  addVertex(new Vector(18, 12, 0))
  addVertex(new Vector(18, 0, 0))

  addTriangulation(1, 0, 10, 12)
  addTriangulation(3, 2, 12, 10)
  addTriangulation(2, 1, 10)

  for (let permutation of ["yzx", "zxy"]) {
    for (let edge of [...edges]) {
      let newV0 = addVertex(edge.verticies[0].ogCoords.swizzle(permutation))
      let newV1 = addVertex(edge.verticies[1].ogCoords.swizzle(permutation))
      addEdge(newV0, newV1)
    }
  }

  for (let vertex of verticies) {
    vertex.ogCoords.y *= -1
    vertex.coordinates.y *= -1
  }

  zeroFoldAllEdges(1)
  EulerianPath(0)
  center()
}