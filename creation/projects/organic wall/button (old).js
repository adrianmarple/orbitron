// SKIP
button = document.createElement("div")
button.innerHTML = "Organic Wall"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "organic wall"
  reset()
  pixelDensity = 0.25
  isWall = true
  
  addSquare([-4,2,0])
  addSquare([-3,-3,0])
  addSquare([-3,1,0])
  addSquare([-3,3,0])
  addSquare([-2,4,0])
  addSquare([-2,2,0])
  addSquare([-2,0,0])
  addSquare([-2,-2,0])
  addSquare([-2,-4,0])
  addSquare([-1,3,0])
  addSquare([-1,1,0])
  addSquare([-1,-1,0])
  addSquare([-1,-3,0])
  addSquare([-1,-5,0])
  addSquare([0,2,0])
  addSquare([0,0,0])
  addSquare([0,-2,0])
  addSquare([0,-4,0])
  addSquare([1,1,0])
  addSquare([1,-1,0])
  addSquare([1,-3,0])
  addSquare([2,2,0])
  addSquare([2,0,0])
  addSquare([2,-2,0])
  addSquare([3,1,0])
  addSquare([3,-1,0])
  addSquare([4,0,0])
  addSquare([4,-2,0])
  addSquare([5,-1,0])

  console.log(edges.length)

  EulerianPath(verticies[1], [0])

  for (let vertex of verticies) {
    vertex.ogCoords = scale(vertex.coordinates, SCALE)
  }
})
