
addButton("Hex Cat", () => {
  name = "bramble"

  let smallEdge = 4
  let bigEdge = 5
  
  let dodecEdges = addDodecagon([0,0,0], [smallEdge, bigEdge])
  let removalEdges = []
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    if (i%2 == 1) {
      extrudePolygon(edge, 4, [bigEdge, smallEdge])
    } else {
      hexEdges = extrudePolygon(edge, 6)

      if (i == 2 || i == 10) {
        removalEdges.push(hexEdges[0])
        extrudePolygon(hexEdges[0], 3)
        removalEdges.push(hexEdges[1])
        removalEdges.push(hexEdges[5])
        removalEdges.push(hexEdges[3])
        extrudePolygon(hexEdges[3], 3)
      } else if (i == 6) {
        removalEdges.push(hexEdges[1])
        removalEdges.push(hexEdges[5])
        removalEdges.push(hexEdges[3])
        extrudePolygon(hexEdges[3], 3)
      } else {
        extrudePolygon(hexEdges[0], 3, null, true)
        extrudePolygon(hexEdges[2], 3)
        extrudePolygon(hexEdges[3], 3)
        extrudePolygon(hexEdges[4], 3)
      }
    }
  }
  for (let edge of removalEdges) {
    removeEdge(edge)
  }

  console.log(edges.length)
  let startingEdge = 47
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
