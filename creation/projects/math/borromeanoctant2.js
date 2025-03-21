
module.exports = async () => {
  setFor3DPrintedCovers()

  cat5partID = "16L"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  await addFromSVG("math/Borromean wedge.svg")
  verticies[7].addLine([0,0,-8]).addLine([0,16,0])

  for (let v of verticies) {
    v.ogCoords.x = -v.ogCoords.x
    v.coordinates.x = -v.coordinates.x
  }

  for (let permutation of ["yzx", "zxy"]) {
    for (let edge of [...edges]) {
      let newV0 = addVertex(edge.verticies[0].ogCoords.swizzle(permutation))
      let newV1 = addVertex(edge.verticies[1].ogCoords.swizzle(permutation))
      addEdge(newV0, newV1)
    }
  }

  zeroFoldAllEdges()
  EulerianPath(16,1)
  center()
}