module.exports = () => {
  setFor3DPrintedCovers()
  CHANNEL_DEPTH = 5
  pixelDensity = 0.4

  // cat5FoldWallIndex = 5

  wallPostProcessingFunction = printInfo => {
    printInfo.prints = [printInfo.prints[1], printInfo.prints[3], printInfo.prints[5],
        printInfo.prints[14], printInfo.prints[15], printInfo.prints[25]]
  }
  coverPostProcessingFunction = covers => {
    covers.top = [covers.top[1], covers.top[4]]
    covers.bottom = [covers.bottom[1], covers.bottom[4]]
  }


  isWall = false // To avoid non-coplanar errors

  baseVerticies = [
    [1, 1, Math.pow(PHI, 3)],
    [Math.pow(PHI, 2), PHI, 2 * PHI],
    [2 + PHI, 0 , Math.pow(PHI, 2)],
  ]

  for (let baseVertex of baseVerticies) {
    addPlusMinusVertex(baseVertex)
    addPlusMinusVertex([baseVertex[1], baseVertex[2], baseVertex[0]])
    addPlusMinusVertex([baseVertex[2], baseVertex[0], baseVertex[1]])
  }

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(verticies[i].ogCoords.distanceTo(verticies[j].ogCoords), 2)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }

  // find a pentagon
  let previousVertex = edges[0].verticies[0]
  let currentVertex = edges[0].verticies[1]
  let pentagonVertices = [previousVertex, currentVertex]
  for (let i = 0; i < 3; i++) {
    for (let edge of currentVertex.edges) {
      let vertex = edge.otherVertex(currentVertex)
      let dist = vertex.ogCoords.distanceTo(previousVertex.ogCoords)
      if (dist > 3 && dist < 3.5) {
        previousVertex = currentVertex
        currentVertex = vertex
        pentagonVertices.push(vertex)
        break
      }
    }
  }

  // Remove pentagon and adjoining edges and compute surrounding dodecagon
  let pentagonCenter = ZERO
  let dodecagonVerticies = []
  for (let vertex of pentagonVertices) {
    pentagonCenter = pentagonCenter.add(vertex.ogCoords)
    while (vertex.edges.length > 0) {
      let edge = vertex.edges.pop()
      removeEdge(edge)
      dodecagonVerticies.push(edge.verticies[0])
      dodecagonVerticies.push(edge.verticies[1])
    }
  }
  pentagonCenter = pentagonCenter.normalize()
  dodecagonVerticies = dodecagonVerticies.filter(vert => !pentagonVertices.includes(vert))

  // Remove ever other edge from remaining dodecagon
  function getAdjacentVertexAndEdge(v) {
    for (let edge of v.edges) {
      for (let v1 of dodecagonVerticies) {
        if (edge.verticies.includes(v1)) {
          return [v1, edge]
        }
      }
    }
    return [null,null]
  }
  let start = dodecagonVerticies.pop()
  v0 = start
  while (dodecagonVerticies.length > 0) {
    let [v1, edge] = getAdjacentVertexAndEdge(v0)
    remove(dodecagonVerticies, v1)
    v0 = v1
    if (dodecagonVerticies.length % 2 == 0) {
      removeEdge(edge)
    }
  }

  // Rotate helmet to orient dodec/pentagons down
  rotateYAll(-Math.atan2(pentagonCenter.x, pentagonCenter.z))
  rotateXAll(Math.PI)
  for (let vertex of verticies) {
    vertex.ogCoords = vertex.coordinates.clone()
  }

  // Back to standard new archimedes shit
  scale(1/2, true)

  let a = edges[0].verticies[0].ogCoords.angleTo(edges[0].verticies[1].ogCoords)
  let x = verticies[0].ogCoords.length()
  let s = 1 / (Math.tan(a/2) * x)
  let h = s*x / Math.cos(a/2)
  scale(s, true)

  plains = []
  for (let vertex of verticies) {
    vertex.plains = []
    let plain = new Plain(vertex.ogCoords, vertex.ogCoords)
    addPlain(plain)
    vertex.addPlain(plain)
  }
  
  for (let edge of [...edges]) {
    let plain0 = edge.verticies[0].plains[0]
    let plain1 = edge.verticies[1].plains[0]
    let foldNormal = edge.verticies[0].ogCoords.sub(edge.verticies[1].ogCoords)
    let newVertex = splitEdge(edge, edge.length()/2)
    newVertex.allowNonIntegerLength = true
    newVertex.ogCoords = newVertex.ogCoords.normalize().scale(h)
    let fold = new Plain(newVertex.ogCoords, foldNormal)
    plain0.folds[plain1.index] = fold
    plain1.folds[plain0.index] = fold
    newVertex.plains = []
    newVertex.addPlain(plain0)
    newVertex.addPlain(plain1)
  }

  for (let vertex of verticies) {
    vertex.coordinates = vertex.ogCoords
  }
  isWall = true

  EulerianPath(8, 1)
}