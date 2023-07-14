
let button = document.createElement("div")
button.innerHTML = "Helmet"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "helmet";
  reset()
  pixelDensity = 0.5
  isWall = false
  baseVerticies = [
    [1, 1, Math.pow(PHI, 3)],
    [Math.pow(PHI, 2), PHI, 2 * PHI],
    [2 + PHI, 0 , Math.pow(PHI, 2)],
  ]

  for (let baseVertex of baseVerticies) {
    addPlusMinusVertex(baseVertex)
    addPlusMinusVertex([baseVertex[1], baseVertex[2], baseVertex[0]])
    addPlusMinusVertex([baseVertex[2], baseVertex[0], baseVertex[1]])
  }

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(d(verticies[i].coordinates, verticies[j].coordinates), 2)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }

  // find a pentagon
  let previousVertex = edges[0].verticies[0]
  let currentVertex = edges[0].verticies[1]
  let pentagonVertices = [previousVertex, currentVertex]
  for (let i = 0; i < 3; i++) {
    for (let edge of currentVertex.edges) {
      let vertex = otherVertex(edge, currentVertex)
      let dist = d(vertex.coordinates, previousVertex.coordinates)
      if (dist > 3 && dist < 3.5) {
        previousVertex = currentVertex
        currentVertex = vertex
        pentagonVertices.push(vertex)
        break
      }
    }
  }

  // Remove pentagon and adjoining edges and compute surrounding dodecagon
  let pentagonCenter = [0,0,0]
  let dodecagonVerticies = []
  for (let vertex of pentagonVertices) {
    pentagonCenter = add(pentagonCenter, vertex.coordinates)
    while (vertex.edges.length > 0) {
      let edge = vertex.edges.pop()
      removeEdge(edge)
      dodecagonVerticies.push(edge.verticies[0])
      dodecagonVerticies.push(edge.verticies[1])
    }
  }
  pentagonCenter = normalize(pentagonCenter)
  dodecagonVerticies = dodecagonVerticies.filter(vert => !pentagonVertices.includes(vert))

  // Remove ever other edge from remaining dodecagon
  function getAdjacentVertexAndEdge(v) {
    for (let edge of v.edges) {
      for (let v1 of dodecagonVerticies) {
        if (edge.verticies.includes(v1)) {
          return [v1, edge]
        }
      }
    }
    return [null,null]
  }
  let start = dodecagonVerticies.pop()
  v0 = start
  while (dodecagonVerticies.length > 0) {
    let [v1, edge] = getAdjacentVertexAndEdge(v0)
    remove(dodecagonVerticies, v1)
    v0 = v1
    if (dodecagonVerticies.length % 2 == 0) {
      removeEdge(edge)
    }
  }

  // Rotate helmet to orient dodec/pentagons down
  rotateYAll(-Math.atan2(pentagonCenter[0], pentagonCenter[2]))
  rotateXAll(Math.PI)
  for (let vertex of verticies) {
    // vertex.ogCoords = scale(vertex.coordinates, 1)
    vertex.ogCoords = [
      vertex.coordinates[1],
      vertex.coordinates[0], 
      vertex.coordinates[2]
    ]
  }

  console.log(edges.length)
  EulerianPath(start, [start.edges[1].index])
})
