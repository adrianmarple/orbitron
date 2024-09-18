
module.exports = () => {
  let theta =  Math.PI/2 + 0.2 //2
  let k = Math.cos(theta/2)
  CHANNEL_WIDTH = 11
  let bigDiamondEdge = 10
  let diamondConnection = 2
  let diamondGap = diamondConnection + k*bigDiamondEdge

  let tips = []

  let vs = addRhombus(bigDiamondEdge, ZERO, theta)
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  addRhombus(6, vs[1].ogCoords, theta)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap), theta)
  tips.push(vs[3])
  addLine(vs[0], diamondConnection, 0)
  addRhombus(bigDiamondEdge, vs[1].ogCoords.addScaledVector(DOWN, 2*k), theta)
  vs = addRhombus(bigDiamondEdge, vs[0].ogCoords.addScaledVector(RIGHT, diamondGap), theta)
  tips.push(vs[3])
  addRhombus(6, vs[1].ogCoords, theta)

  let tips2 = []
  for (let tip of tips) {
    tips2.push(addLine(tip, 3, -90).verticies[1])
  }

  let l = 9
  let v = addTriangulation(tips2[0], tips2[1], l)
  let a = v.ogCoords.sub(tips2[1].ogCoords).signedAngle(RIGHT)
  addRhombus(6, v.ogCoords, 2*a)
  v = addTriangulation(tips2[1], tips2[2], l)
  addRhombus(6, v.ogCoords, 2*a)

  let centerOffset = v.ogCoords.y - tips2[0].ogCoords.y

  for (let tip of tips2) {
    addRhombus(l, tip.ogCoords.addScaledVector(UP, centerOffset), 2*a)
  }

  cleanupIntersectingEdges()

  let offset = tips[0].ogCoords.add(tips2[1].ogCoords).scale(0.5)
  origami(new Plain(offset, new Vector(0,1,-1)))

  removeEdges(62,29,70,35)

  EulerianPath(0)
}
