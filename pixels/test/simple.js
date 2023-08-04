
button = document.createElement("div")
button.innerHTML = "Simple Grid"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "simple"
  reset()
  isWall = true
  pixelDensity = 0.25

  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      let manhattan = Math.abs(i) + Math.abs(j)
      if (manhattan > 1) {
        continue
      }
      addSquare([i,j,0])
    }
  }

  console.log(edges.length)
  EulerianPath(verticies[1], [0])
})
