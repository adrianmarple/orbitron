
button = document.createElement("div")
button.innerHTML = "Rhombicosidodecahedron"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "rhombicosidodecahedron"
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
  console.log(edges.length)
  path = EulerianPath([0], verticies[0])
})
