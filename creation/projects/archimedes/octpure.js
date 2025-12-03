// SKI
module.exports = () => {
  const EDGE_LENGTH = 6

  for (let permutation of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    addPlusMinusVertex(permutation)
  }

  let minDist = 1e6
  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      minDist = Math.min(minDist, verticies[i].ogCoords.distanceTo(verticies[j].ogCoords))
    }
  }
  scale(1/minDist)

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(verticies[i].ogCoords.distanceTo(verticies[j].ogCoords), 1)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }
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
  scale(EDGE_LENGTH)

  // splitEdge(0, EDGE_LENGTH/2)
  // zeroFoldAllEdges(verticies.length - 1)
  edgeCleanup()
  doubleEdges()
  EulerianPath(0)


  EulerianPath(1,1)
}