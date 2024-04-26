
addButton("sixfold/flower", () => {
  cat5PortMidway = true
  
  let dodecEdges = addDodecagon([0,0,0], 3)
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    if (i%2 == 1) {
      // extrudePolygon(edge, 4, null, true)
      let squedges = extrudePolygon(edge, 4)
      let outerDodecEdges = extrudePolygon(squedges[2], 12)
      processDodec(outerDodecEdges)
    } else {
      let hedges = extrudePolygon(edge, 6)
      let squedges = extrudePolygon(hedges[3], 4)
      hedges = extrudePolygon(squedges[2], 6)
      // extrudePolygon(hedges[2], 4)
      // extrudePolygon(hedges[4], 4)
    }
  }

  doubleEdges()
  let startingEdge = 47
  EulerianPath(90)
})

function processDodec(dodecEdges, parity) {
  parity = parity || 0
  let center = [0,0,0]
  for (let edge of dodecEdges) {
    for (let vertex of edge.verticies) {
      center = add(center, vertex.ogCoords)
    }
  }
  center = scale(center, 0.5 / dodecEdges.length)
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    let toCenter = delta(center, edge.verticies[0].ogCoords)
    let negate = cross(toCenter, edgeDelta(edge))[2] > 0

    if (i%4 == parity) {
      let squedges = extrudePolygon(edge,4,null,negate)
      if (i == parity) {
        extrudePolygon(squedges[2], 6)
        // extrudePolygon(squedges[2], 3)
        // removeEdge(squedges[0])
        removeEdge(squedges[2])
      }
      if (i == 4) {
        removeEdge(squedges[1])
      }
      if (i == 8) {
        removeEdge(squedges[3])
      }
    }

    if (i > 3 && i < 9) {
      removeEdge(dodecEdges[i])
    }

  }
}
