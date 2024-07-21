// SKIP
module.exports = () => {
  BORDER = 9
  NOTCH_DEPTH = 9

  let longSequence = [5,6,8,10,10,8,6,5,4,4,4]
  let shortSequence = [5,6,8,8,6,5,4,4,4]
  longSequence = shortSequence

  let square = addSquare([0,0,0], 4)
  extrudePolygon(square[0], 4)
  extrudePolygon(square[1], 4)
  removeVertex(7)
  extrudePolygon(square[3], 4)
  removeVertex(7)

  diamonds(verticies[3], verticies[7], [...longSequence], true)
  diamonds(verticies[verticies.length - 5],
    verticies[verticies.length - 1], [...shortSequence], true)
  diamonds(verticies[2], verticies[6], [...shortSequence], false)
  diamonds(verticies[verticies.length - 5],
    verticies[verticies.length - 1], [...longSequence], false)

  EulerianPath(59)
}

function diamonds(base0, base1, lengths, handedness) {
  if (lengths.length == 0) return

  let length = lengths.shift()
  let newBase0
  if (handedness) {
    newBase0 = addTriangulation(base0, base1, length)
  } else {
    newBase0 = addTriangulation(base1, base0, length)
  }
  let crossDelta = base0.ogCoords.sub(base1.ogCoords)
  let newBase1 = addVertex(newBase0.ogCoords.add(crossDelta))
  addEdge(base0, newBase1)

  diamonds(newBase0, newBase1, lengths, !handedness)
}
