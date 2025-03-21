
module.exports = async () => {
  setFor3DPrintedCovers()

  cat5partID = "3L"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  addVertex(new Vector(0, 1, 0).scale(SIZE))
  addVertex(new Vector(0, 3, 0).scale(SIZE))
  addVertex(new Vector(1, 0, 0).scale(SIZE))
  addVertex(new Vector(1, 1, 0).scale(SIZE))
  addVertex(new Vector(1, 2, 0).scale(SIZE))
  addVertex(new Vector(1, 3, 0).scale(SIZE))
  addVertex(new Vector(1, 4, 0).scale(SIZE))
  addVertex(new Vector(2, 1, 0).scale(SIZE))
  addVertex(new Vector(2, 2, 0).scale(SIZE))
  addVertex(new Vector(2, 3, 0).scale(SIZE))
  addVertex(new Vector(3, 0, 0).scale(SIZE))
  addVertex(new Vector(3, 1, 0).scale(SIZE))
  addVertex(new Vector(3, 2, 0).scale(SIZE))
  addVertex(new Vector(4, 1, 0).scale(SIZE))

  addVertex(new Vector(1, 2, 4).scale(SIZE))
  addVertex(new Vector(1, 0, 4).scale(SIZE))

  addEdge(0, 3)
  addEdge(1, 5)
  addEdge(2, 3)
  addEdge(4, 5)
  addEdge(5, 6)
  addEdge(3, 7)
  addEdge(5, 9)
  addEdge(7, 8)
  addEdge(8, 9)
  addEdge(8, 12)
  addEdge(10, 11)
  addEdge(11, 12)
  addEdge(11, 13)

  addEdge(4, 14)
  addEdge(14, 15)

  removeVertex(6)

  for (let permutation of ["yzx", "zxy"]) {
    for (let edge of [...edges]) {
      let newV0 = addVertex(edge.verticies[0].ogCoords.swizzle(permutation))
      let newV1 = addVertex(edge.verticies[1].ogCoords.swizzle(permutation))
      addEdge(newV0, newV1)
    }
  }

  zeroFoldAllEdges()
  EulerianPath(37)
  center()
}