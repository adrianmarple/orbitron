module.exports = () => {
  NO_EMBOSSING = true

  let baseVerticies = [
    [1/PHI, 1/PHI, 3+PHI],
    [2/PHI, PHI, 1 + 2*PHI],
    [1/PHI, PHI*PHI, -1+3*PHI],
    [2*PHI-1, 2, 2+PHI],
    [PHI, 3, 2*PHI],
  ]
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
  scale(s)
  scale(2)

  for (let vertex of verticies) {
    vertex.plains = []
  }
  for (let edge of edges) {
    let v0 = edge.verticies[0]
    let v1 = edge.verticies[1]
    let center = v0.ogCoords.add(v1.ogCoords).scale(0.5)
    let plain = new Plain(center, center)
    v0.addPlain(plain)
    v1.addPlain(plain)
  }

  edgeCleanup()
  EulerianPath(0)
}
