// SKIP

module.exports = () => {
  setFor3DPrintedCovers()
  MAX_WALL_LENGTH = 1000
  // PRINT_WALL_HALVES_SEPARATELY = false

  // addPolygon(3, [0,0,0], 4)
  // zeroFoldAllEdges()
  let offset = new Vector(1,-2,0)
  // currentPlain = new Plain(offset, FORWARD)
  // plains = [currentPlain]
  let e = addPolygon(6, offset, 3)[3]
  // let e = addPolygon(4, offset, 4)[2]
  origami(new Plain(
    offset,
    new Vector(0, 1, 1)
  ))
  addTriangulation(e.verticies[0], e.verticies[1], 3, 4)
  removeEdge(e)

  doubleEdges()
  EulerianPath(0)
}
