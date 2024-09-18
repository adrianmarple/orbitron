
module.exports = () => {
  let k = Math.sqrt(2)/2
  CHANNEL_WIDTH = 11
  let bigDiamondEdge = 8
  let diamondConnection = 1
  let diamondGap = diamondConnection + k*bigDiamondEdge

  let tips = []

  let vs = addRhombus(bigDiamondEdge, ZERO)
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap))
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  addRhombus(4, vs[1].ogCoords)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap))
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  let vs2 = addRhombus(6, vs[1].ogCoords.addScaledVector(DOWN, 2*k))
  addRhombus(4, vs2[1].ogCoords)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap))
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  addRhombus(4, vs[1].ogCoords)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap))
  tips.push(vs[3])

  let tips2 = []
  for (let tip of tips) {
    tips2.push(addLine(tip, 3, -90).verticies[1])
  }

  let v = addTriangulation(tips2[0], tips2[2], 14)
  let a = -2 * tips2[0].ogCoords.sub(v.ogCoords).signedAngle(RIGHT)
  addRhombus(6, v.ogCoords, a)
  v = addTriangulation(tips2[1], tips2[3], 14)
  v = addTriangulation(tips2[2], tips2[4], 14)
  addRhombus(6, v.ogCoords, a)

  cleanupIntersectingEdges()

  let offset = tips[0].ogCoords.add(tips2[1].ogCoords).scale(0.5)
  origami(new Plain(offset, new Vector(0,1,-1)))

  EulerianPath(0)
}
