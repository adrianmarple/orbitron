function addPolygram(sideCount, center, edgeLengths) {
  if (!edgeLengths) {
    edgeLengths = [1]
  }
  if (typeof edgeLengths == "number") {
    edgeLengths = [edgeLengths]
  }

  let newEdges = []
  let edgeVector = RIGHT
  let point = ZERO
  let points = []
  for (let i = 0; i < sideCount; i++) {
    edgeVector = edgeVector.normalize()
    edgeVector = edgeVector.scale(edgeLengths[i%edgeLengths.length]) 
    point = point.add(edgeVector)
    points.push(point)
    edgeVector = edgeVector.applyAxisAngle(BACKWARD, Math.PI*4 / sideCount)
  }

  let average = ZERO
  for (let point of points) {
    average = average.add(point)
  }
  average = average.scale(1.0/points.length)
  center = center.sub(average)
  let previousVertex = addVertex(points.last().add(center))
  for (let point of points) {
    let vertex = addVertex(point.add(center))
    newEdges.push(addEdge(previousVertex, vertex))
    previousVertex = vertex
  }
  return newEdges
}

// SKIP
module.exports = () => {
  sortOverride = (edge, previousEdge, angle) => {
    if(epsilonEquals(angle,Math.PI*4/5)){
      return 1
    }
    return -angle
  }

  // 180 pixels per pentagram line and 112 per pentagon edge
  let pentagramEdges = addPolygram(5,ZERO,180)
  for (let i = 0; i < 5; i++) {
    let v0 = verticies[i]
    let v1 = verticies[(i+3)%5]
    addTriangulation(v0, v1, 56)
  }
  rotateZAll(-Math.PI*4/5, true)
  EulerianPath(0)
}
