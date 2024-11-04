// SKI P

module.exports = () => {
  setFor3DPrintedCovers()

  addPolygon(3, [0,0,0], 4)
  // addPolygon(4, [0,1,0])

  // origami(new Plain(
  //   new Vector(0, 0, 0),
  //   new Vector(0, 1, 2)
  // ))

  doubleEdges()

  zeroFoldAllEdges()

  EulerianPath(0)
}
