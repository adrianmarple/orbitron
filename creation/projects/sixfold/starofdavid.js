
module.exports = () => {
  setFor3DPrintedCovers()

  let hedges = addPolygon(6, [0,0,0], 4)
  for (let i = 0; i < hedges.length; i++) {
    let edge = hedges[i]
    extrudePolygon(edge, 3)
  }

  EulerianPath(0)
}