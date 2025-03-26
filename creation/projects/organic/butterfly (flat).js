module.exports = async () => {
  setFor3DPrintedCovers()

  await addFromSVG("organic/Butterfly wing.svg")
  integerize()

  for (let v of verticies) {
    v.ogCoords.x -= 32
    v.coordinates.x -= 32
    console.log(v.ogCoords.x)
  }
  let indexMapping = {}
  for (let vertex of [...verticies]) {
    let v = vertex.ogCoords
    let newVertex = addVertex([-v.x, v.y, v.z])
    indexMapping[vertex.index] = newVertex.index
  }
  for (let edge of [...edges]) {
    addEdge(indexMapping[edge.verticies[0].index], indexMapping[edge.verticies[1].index])
  }

  // addTriangulation(21, 46, 4)
  addTriangulation(15, 40, 3)

  // zeroFoldAllEdges()
  EulerianPath(0)
}
