// SKI
module.exports = () => {
  setFor3DPrintedCovers()
  cat5FoldWallIndex = 5

  wallPostProcessingFunction = printInfo => {
    printInfo.prints = [printInfo.prints[0], printInfo.prints[2], printInfo.prints[4], printInfo.prints[5]]
  }
  coverPostProcessingFunction = covers => {
    covers.top = [covers.top[0]]
    covers.bottom = [covers.bottom[0]]
  }

  let baseVerticies = [
    [1/PHI, 1/PHI, 3+PHI],
    [2/PHI, PHI, 1 + 2*PHI],
    [1/PHI, PHI*PHI, -1+3*PHI],
    [2*PHI-1, 2, 2+PHI],
    [PHI, 3, 2*PHI],
  ]
  isWall = false // To avoid non-coplanar errors
  for (let baseVertex of baseVerticies) {
    for (let permutation of evenPermutations(baseVertex)) {
      addPlusMinusVertex(permutation)
    }
  }
  scale(1/(2*PHI - 2))

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(verticies[i].ogCoords.distanceTo(verticies[j].ogCoords), 1)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }

  let a = edges[0].verticies[0].ogCoords.angleTo(edges[0].verticies[1].ogCoords)
  let x = verticies[0].ogCoords.length()
  let s = 1 / (Math.tan(a/2) * x)
  let h = s*x / Math.cos(a/2)
  scale(s)

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

  scale(2)
  EulerianPath(1, 1)
}