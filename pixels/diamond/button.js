
button = document.createElement("div")
button.innerHTML = "Diamond"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "diamond"
  reset()
  pixelDensity = 0.25
  isWall = true

  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      let manhattan = Math.abs(i) + Math.abs(j)
      if (manhattan > 6) {
        continue
      }
      if (manhattan < 3) {
        continue
      }

      addSquare([i,j,0])
    }
  }

  console.log(edges.length)

  EulerianPath(verticies[1], [0])

  // rotateZAll(Math.PI/2);
  // for (let vertex of verticies) {
  //   vertex.ogCoords = scale(vertex.coordinates, 1)
  // }
})
