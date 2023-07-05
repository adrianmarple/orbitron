
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
  EulerianPath(verticies[0], [0])
})
