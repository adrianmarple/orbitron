// SKIP
addButton("test/starofdavid", () => {
  pixelDensity = 0.25

  let hexEdges = addPolygon(6, [0,0,0])
  for (let edge of hexEdges) {
    extrudePolygon(edge, 3)
  }

  console.log(edges.length)
  let startingEdge = 12
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
