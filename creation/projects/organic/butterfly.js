module.exports = async () => {
  portPartID = "1R"
  NOTCH_DEPTH = 5
  THICKNES = 1.8
  MAX_SLOT_SEGMENT_LENGTH = 200

  await addFromSVG("organic/Butterfly wing.svg")
  integerize()

  for (let v of verticies) {
    v.ogCoords.x -= 32
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

  // addTriangulation(16, 54, 3.5)
  addTriangulation(15, 40, 3)

  origami(new Plain(ZERO, new Vector(1, 0, -1)))

  zeroFoldAllEdges()
  EulerianPath(5,1)
}
