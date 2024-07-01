
module.exports = () => {
  function tieFighter(dodecEdges, parity) {
    parity = parity || 0
    let center = new Vector(0,0,0)
    for (let edge of dodecEdges) {
      for (let vertex of edge.verticies) {
        center = center.add(vertex.ogCoords)
      }
    }
    center = center.scale(0.5 / dodecEdges.length)
    for (let i = 0; i < dodecEdges.length; i++) {
      let edge = dodecEdges[i]
      let toCenter = center.sub(edge.verticies[0].ogCoords)
      let negate = toCenter.cross(edgeDelta(edge)).z > 0

      if (i%4 == parity + 2) {
        let squedges = extrudePolygon(edge,4,null,negate)
        if (i == parity+2) extrudePolygon(squedges[2], 6)
      }

      // if (i%2 == parity) {
      //   extrudePolygon(edge,4,null,negate)
      // } else {
      //   extrudePolygon(edge,3,null,negate)
      // }
    }
  }

  let dodecEdges = addDodecagon([0,0,0], 3)
  // tieFighter(dodecEdges, 1)
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    if (i%2 == 1) {
      // extrudePolygon(edge, 4, null, true)
      let squedges = extrudePolygon(edge, 4)
      let outerDodecEdges = extrudePolygon(squedges[2], 12)
      // if (i%4 == 1) {
        tieFighter(outerDodecEdges)
      // } else {
        // squedges = extrudePolygon(outerDodecEdges[6], 4)
        // extrudePolygon(squedges[1], 6)
        // extrudePolygon(squedges[3], 6)
      // }
    } else {
      let hedges = extrudePolygon(edge, 6)
      let squedges = extrudePolygon(hedges[3], 4)
      hedges = extrudePolygon(squedges[2], 6)
      extrudePolygon(hedges[2], 4)
      extrudePolygon(hedges[4], 4)
    }
  }
  rotateZAll(-Math.PI/6, true)
  EulerianPath(139)
}
