// SKIP
module.exports = () => {
  portPartID = "2"
  PORT_POSITION = "center"

  const EDGE_LENGTH = 2
  // const EDGE_LENGTH = 3
  const CLAW_LENGTH = 5
  // const CLAW_ANGLE = Math.PI / 5 - 0.099794
  const CLAW_ANGLE = Math.PI / 5 - 0.0185985
  const CLAW_SEGEMENTS = 9

  let edges = addPolygon(10, [0,0,0], EDGE_LENGTH)
  for (let edge of edges) {
    if ([3,8].includes(edge.index)) {
      claw(edge.verticies[0], edge.index > 6)
    }
  }

  let e = addEdge(27,18)
  console.log(e.length())

  // const EDGE_LENGTH = 6
  // const CLAW_LENGTH = 6
  // const CLAW_ANGLE = Math.PI / 4 - 0.1
  // const CLAW_SEGEMENTS = 6

  // let edges = addPolygon(12, [0,0,0], EDGE_LENGTH)
  // for (let edge of edges) {
  //   if ([2,3,4, 8,9,10].includes(edge.index)) {
  //     claw(edge.verticies[0], edge.index > 6)
  //   }
  // }

  // addEdge(23,41)
  // rotateZAll(-Math.PI/12, true)
  
  rotateYAll(Math.PI * 0.27, true)

  zeroFoldAllEdges()
  EulerianPath(0,1)

  function claw(vert, sign) {
    let delta = vert.ogCoords.normalize().scale(CLAW_LENGTH)
    let axis = delta.cross(FORWARD).normalize()
    if (sign) axis = axis.negate()
    for (let i = 0; i < CLAW_SEGEMENTS; i++) {
      let newV = addVertex(vert.ogCoords.add(delta))
      addEdge(newV, vert)
      vert = newV
      delta = delta.rotate(axis, CLAW_ANGLE)
    }
    return vert
  }
}
