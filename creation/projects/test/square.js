// SKI P

module.exports = () => {
  pixelDensity = 0.125
  // isWall = false

  addPolygon(4, [0,0,0])
  // addPolygon(4, [0,1,0])

  origami(new Plain(
    new Vector(0, 0.1234, 0),
    new Vector(0, 1, 2)
  ))

  doubleEdges()
  EulerianPath(0)
}
