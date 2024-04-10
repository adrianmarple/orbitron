
addButton("math/sierpinski", function() {
  cat5PortMidway = true
  EXTRA_SCALE = 1
  STARTING_WALL_INDEX = 1


  sortOverride = (edge, previousEdge, angle) => {
    if (epsilonEquals(angle, 0)) {
      angle = Math.PI
    }
    return -angle
  }

  let iterations = 3

  let triangle = addPolygon(3, [0,0,0], 4 << iterations)
  subdivide(triangle, iterations)
  rotateZAll(Math.PI/3, true)

  EulerianPath(9)
  EulerianPath(26)
})

function subdivide(triangle, iterations) {
  if (iterations == 0) return
  let newVerticies = []
  for (let edge of triangle) {
    newVerticies.push(splitEdge(edge, edgeLength(edge)/2))
  }
  for (let i = 0; i < 3; i++) {
    let newTriangle = []
    let v0 = newVerticies[i]
    let v1 = newVerticies[(i+1)%3]
    newTriangle.push(addEdge(v0,v1))

    let v2 = otherVertex(v0.edges[0], v0)
    if (v1.edges[0].verticies.includes(v2)) {
      newTriangle.push(v0.edges[0])
      newTriangle.push(v1.edges[0])
    } else if (v1.edges[1].verticies.includes(v2)) {
      newTriangle.push(v0.edges[0])
      newTriangle.push(v1.edges[1])
    } else {
      v2 = otherVertex(v0.edges[1], v0)
      if (v1.edges[0].verticies.includes(v2)) {
        newTriangle.push(v0.edges[1])
        newTriangle.push(v1.edges[0])
      } else if (v1.edges[1].verticies.includes(v2)) {
        newTriangle.push(v0.edges[1])
        newTriangle.push(v1.edges[1])
      }
    }

    subdivide(newTriangle, iterations - 1)
  }
}
