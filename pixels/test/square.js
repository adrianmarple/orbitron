
button = document.createElement("div")
button.innerHTML = "Square"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "square"
  reset()
  isWall = true

  addSquare([0,0,0])

  console.log(edges.length)

  path = EulerianPath([0], verticies[1])

  for (let vertex of verticies) {
    vertex.ogCoords = scale(vertex.coordinates, SCALE)
  }
})
