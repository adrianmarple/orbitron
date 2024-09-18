
module.exports = () => {
  let k = Math.sqrt(2)/2
  CHANNEL_WIDTH = 11

  let tips = []

  let vs = addRhombus(8, RIGHT.scale(2*k))
  tips.push(vs[3])
  vs = addRhombus(12, RIGHT.scale(14*k))
  tips.push(vs[3])
  addRhombus(6, vs[1].ogCoords)
  vs = addRhombus(18, RIGHT.scale(34*k))
  addRhombus(10, vs[1].ogCoords)
  vs = addRhombus(12, RIGHT.scale(54*k))
  addRhombus(6, vs[1].ogCoords)
  addRhombus(8, RIGHT.scale(66*k))

  cleanupIntersectingEdges()

  EulerianPath(0)
}
