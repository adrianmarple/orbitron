
addButton("de Ruyter Crest", () => {
  name = "deruyter"

  let octEdges = addPolygon(8, [0,0,0], 8)
  rotateZAll(Math.PI / 8, true)
  let addedVerticies = []
  for (let i = 0; i < octEdges.length; i++) {
    let edge = octEdges[i]
    let a = 7
    let b = 6
    if (i%2 == 1) {
      let t = a
      a = b
      b = t      
    }
    let v = addTriangulation(edge.verticies[0], edge.verticies[1], a, b)
    addedVerticies.push(v)
  }
  for (let i = 0; i < addedVerticies.length; i++) {
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % 8]
    let w = (i%2 == 1) ? 24 : 40
    addTriangulation(v1, v2, w, w)
  }

  let startingEdge = 0
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
