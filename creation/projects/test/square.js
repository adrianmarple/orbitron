// SKI P

module.exports = () => {
  setFor3DPrintedCovers()

  // addPolygon(3, [0,0,0], 4)
  // zeroFoldAllEdges()

  addPolygon(6, [0,0,0], 2)
  // addPolygon(4, [0,0,0], 4)
  origami(new Plain(
    new Vector(0, 0, 0),
    new Vector(0, 1, 0.3)
  ))

  
  doubleEdges()
  EulerianPath(0)
}
