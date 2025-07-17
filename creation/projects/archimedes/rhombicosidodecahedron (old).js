// SKIP
module.exports = () => {
  isWall = false
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
  scale(2)
  EulerianPath(verticies[0],[0])
}