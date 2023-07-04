
let button = document.createElement("div")
button.innerHTML = "Helmet"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "helmet";
  reset()
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

  function removeEdge(edge) {
    remove(edges, edge)
    for (let vertex of verticies) {
      remove(vertex.edges, edge)
    }
  }

  // Remove pentagon and adjoining edges and compute surrounding dodecagon
  let pentagonCenter = [0,0,0]
  let dodecagonVerticies = []
  for (let vertex of pentagonVertices) {
    pentagonCenter = add(pentagonCenter, vertex.coordinates)
    remove(verticies, vertex)
    for (let edge of vertex.edges) {
      removeEdge(edge)
      dodecagonVerticies.push(edge.verticies[0])
      dodecagonVerticies.push(edge.verticies[1])
    }
  }
  pentagonCenter = normalize(pentagonCenter)
  dodecagonVerticies = dodecagonVerticies.filter(vert => !pentagonVertices.includes(vert))

  // Remove ever other edge from remaining dodecagon
  for (let i = 0; i < 10; i += 2) {
    let v0 = dodecagonVerticies[i]
    let v1 = dodecagonVerticies[i + 1]
    let edge = null
    for (let e of v0.edges) {
      if (e.verticies.includes(v1)) {
        edge = e
        break
      }
    }
    removeEdge(edge)
  }

  for (let i = 0; i < verticies.length; i++) {
    verticies[i].index = i
  }
  for (let i = 0; i < edges.length; i++) {
    edges[i].index = i
  }

  // Rotate helmet to orient dodec/pentagons down
  rotateYAll(-Math.atan2(pentagonCenter[0], pentagonCenter[2]))
  rotateXAll(Math.PI)
  for (let vertex of verticies) {
    vertex.ogCoords = scale(vertex.coordinates, SCALE)
  }

  console.log(edges.length)
  path = EulerianPath([dodecagonVerticies[0].edges[0].index], dodecagonVerticies[0])
})
