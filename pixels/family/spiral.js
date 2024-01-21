
addButton("Spiral", () => {
  name = "spiral"

  let octEdges = addPolygon(7, [0,0,0], 8)
  let addedVerticies = []
  for (let i = 0; i < octEdges.length; i++) {
    let edge = octEdges[i]
    let v = addTriangulation(edge.verticies[0], edge.verticies[1], 9, 3)
    addedVerticies.push(v)
  }
  for (let i = 0; i < addedVerticies.length; i++) {
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % addedVerticies.length]
    addTriangulation(v1, v2, 21, 14)
  }

  let startingEdge = 0
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
