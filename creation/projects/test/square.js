// SKI P

module.exports = () => {
  setFor3DPrintedCovers()
  cat5WallOverride = 13
  // PRINT_WALL_HALVES_SEPARATELY = false

  // addPolygon(3, [0,0,0], 4)
  // zeroFoldAllEdges()

  let e = addPolygon(6, [0,0,0], 3)[3]
  // extrudePolygon(e, 3)
  // removeEdge(e)
  // addPolygon(4, [0,0,0], 4)
  origami(new Plain(
    new Vector(0, 0, 0),
    new Vector(0, 1, 1)
  ))

  doubleEdges()
  EulerianPath(0)
}
