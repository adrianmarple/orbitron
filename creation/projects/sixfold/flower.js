// SKIP
function processDodec(dodecEdges, parity) {
  parity = parity || 0
  let center = ZERO
  for (let edge of dodecEdges) {
    for (let vertex of edge.verticies) {
      center = center.add(vertex.ogCoords)
    }
  }
  center = center.scale(0.5 / dodecEdges.length)
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    let toCenter = center.sub(edge.verticies[0].ogCoords)
    let negate = toCenter.cross(edge.delta()).z > 0

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

module.exports = () => {
  cat5PortMidway = true
  startMidwayDownFinalEdge = true
  ledAtVertex = false
  CHANNEL_WIDTH = 12
  PIXEL_DISTANCE = 16.6
  LED_SUPPORT_WIDTH = 8

  let dodecEdges = addDodecagon([0,0,0], 3)
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    if (i%2 == 1) {
      let squedges = extrudePolygon(edge, 4)
      let outerDodecEdges = extrudePolygon(squedges[2], 12)
      processDodec(outerDodecEdges)
    } else {
      let hedges = extrudePolygon(edge, 6)
      let squedges = extrudePolygon(hedges[3], 4)
      hedges = extrudePolygon(squedges[2], 6)
    }
  }

  let startingEdge = 47
  EulerianPath(90)
}
