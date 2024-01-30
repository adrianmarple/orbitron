function addPolygram(sideCount, center, edgeLengths) {
  if (!edgeLengths) {
    edgeLengths = [1]
  }
  if (typeof edgeLengths == "number") {
    edgeLengths = [edgeLengths]
  }

  let newEdges = []
  let edgeVector = [1,0,0]
  let point = [0,0,0]
  let points = []
  edgeVector = rotateZ(edgeVector, -Math.PI*4 / sideCount)
  for (let i = 0; i < sideCount; i++) {
    edgeVector = normalize(edgeVector)
    edgeVector = scale(edgeVector, edgeLengths[i%edgeLengths.length]) 
    point = add(point, edgeVector)
    points.push(point)
    edgeVector = rotateZ(edgeVector, Math.PI*4 / sideCount)
  }

  let average = [0,0,0]
  for (let point of points) {
    average = add(average, point)
  }
  average = scale(average, 1.0/points.length)
  center = delta(center, average)
  let previousVertex = addVertex(add(points[points.length - 1], center))
  for (let point of points) {
    let vertex = addVertex(add(point, center))
    newEdges.push(addEdge(previousVertex, vertex))
    previousVertex = vertex
  }
  return newEdges
}


addButton("pentagram", () => {
  name = "pentagram"
  sortOverride = (edge, previousEdge, angle) => {
    if(epsilonEquals(angle,Math.PI*4/5)){
      return 1
    }
    return -angle
  }


  let pentagramEdges = addPolygram(5,[0,0,0],180)
  for (let i = 0; i < 5; i++) {
    let v0 = verticies[i]
    let v1 = verticies[(i+3)%5]
    addTriangulation(v0, v1, 56)
  }
  EulerianPath(0)
})
