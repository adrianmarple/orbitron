// SKI
module.exports = () => {
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
  scale(6)

  splitEdge(0, EDGE_LENGTH/2)
  zeroFoldAllEdges(verticies.length - 1)
  edgeCleanup()
  doubleEdges()
  EulerianPath(0)


  EulerianPath(1,1)
}