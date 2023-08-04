
button = document.createElement("div")
button.innerHTML = "Star of David"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "sod"
  reset()
  isWall = true
  pixelDensity = 0.25

  let hexEdges = addPolygon(6, [0,0,0])
  for (let edge of hexEdges) {
    extrudePolygon(edge, 3)
  }

  console.log(edges.length)
  let startingEdge = 12
  EulerianPath(edges[startingEdge].verticies[0], [startingEdge])
})
