module.exports = async () => {
  CHANNEL_WIDTH = 11

  await addFromSVG("organic/tree.svg")

  integerize()

  let edgesToVerticalize = [1, 12, 30]
  for (let edgeIndex of edgesToVerticalize) {
    let edge = edges[edgeIndex]
    let lowerVertex = edge.verticies[0]
    let higherVertex = edge.verticies[1]
    if (higherVertex.ogCoords[1] < lowerVertex.ogCoords[1]) {
      higherVertex = lowerVertex
      lowerVertex = edge.verticies[1]
    }
    higherVertex.ogCoords.x = lowerVertex.ogCoords.x
    higherVertex.coordinates.x = lowerVertex.coordinates.x
  }
  integerize(-41)

  origami(new Plain(
    new Vector(0, -41, 0),
    new Vector(0, 1, 1)
  ))

  EulerianPath(0)
}
