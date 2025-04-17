// SKIP
addButton("test/starofdavid", () => {
  let hexEdges = addPolygon(6, [0,0,0])
  for (let edge of hexEdges) {
    extrudePolygon(edge, 3)
  }

  scale(4)
  let startingEdge = 12
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
