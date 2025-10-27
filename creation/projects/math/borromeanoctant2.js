
module.exports = async () => {
  setFor3DPrintedCovers()

  portPartID = "1L"
  PORT_POSITION = "end"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  await addFromSVG("math/Borromean wedge.svg")
  verticies[7].addLine([0,0,-8]).addLine([0,16,0])

  for (let v of verticies) {
    v.ogCoords.x = -v.ogCoords.x
  }

  for (let permutation of ["yzx", "zxy"]) {
    for (let edge of [...edges]) {
      let newV0 = addVertex(edge.verticies[0].ogCoords.swizzle(permutation))
      let newV1 = addVertex(edge.verticies[1].ogCoords.swizzle(permutation))
      addEdge(newV0, newV1)
    }
  }

  sortOverride = (edge, previousEdge, angle) => {
    if ((previousEdge.index == 157 && edge.index == 161) ||
        (previousEdge.index == 7 && edge.index == 11)) {
      return -1e6
    }
    else {
      return potential(edge, previousEdge, angle)
    }
  }

  zeroFoldAllEdges()
  EulerianPath(17,1)
  center()
}