// SKI
module.exports = async () => {
  setFor3DPrintedCovers()

  // portPartID = "1L"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  // let cornerSpike = 18
  // let midSpike = 15
  // let spikeTriangle1 = 10
  // let spikeTriangle2 = 12
  // let angle = 30

  // let strut = 4
  // let innerTriangle1 = 8
  // let innerTriangle2 = 7


  let cornerSpike = 20
  let midSpike = 17
  let spikeTriangle1 = 10
  let spikeTriangle2 = 12
  let angle = 30

  let strut = 5
  let innerTriangle1 = 8
  let innerTriangle2 = 6

  addVertex(new Vector(0, cornerSpike, 0))
  addVertex(new Vector(midSpike, midSpike, 0))
  addVertex(new Vector(cornerSpike, 0, 0))

  addTriangulation(1, 0, spikeTriangle1, spikeTriangle2)
  addTriangulation(2, 1, spikeTriangle2, spikeTriangle1)

  let v5 = addLine(4, strut, 180 - angle).verticies[1]
  let v6 = addLine(3, strut, 90 + angle).verticies[1]


  addTriangulation(6, 5, innerTriangle1)

  addVertex(new Vector(v5.ogCoords.x, -v5.ogCoords.y, v5.ogCoords.z))
  addTriangulation(5, 8, innerTriangle2)
  removeVertex(8)

  console.log(v6)
  addVertex(new Vector(-v6.ogCoords.x, v6.ogCoords.y, v6.ogCoords.z))
  addTriangulation(9, 6, innerTriangle2)
  removeVertex(9)


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