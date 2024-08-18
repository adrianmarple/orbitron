// 

module.exports = () => {
  pixelDensity = 0.125
  // isWall = false

  addPolygon(3, [0,0,0])
  rotateZAll(20, true)
  // addPolygon(4, [0,1,0])

  origami(new Plain(
    new Vector(0, 0.01234, 0),
    new Vector(0, 1, 2)
  ))

  EulerianPath(0)
}
