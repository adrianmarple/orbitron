
button = document.createElement("div")
button.innerHTML = "Invader 1"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "invader1"
  reset()
  pixelDensity = 0.33333
  isWall = true


  addSquare([0,1,0])
  addSquare([0,3,0])
  addSquare([0,4,0])
  addSquare([1,0,0])
  addSquare([1,2,0])
  addSquare([1,3,0])
  addSquare([1,4,0])
  addSquare([1,5,0])
  addSquare([2,3,0])
  addSquare([2,5,0])
  addSquare([2,6,0])
  addSquare([3,2,0])
  addSquare([3,3,0])
  addSquare([3,4,0])
  addSquare([3,5,0])
  addSquare([3,6,0])
  addSquare([3,7,0])
  addSquare([4,2,0])
  addSquare([4,3,0])
  addSquare([4,4,0])
  addSquare([4,5,0])
  addSquare([4,6,0])
  addSquare([4,7,0])
  addSquare([5,3,0])
  addSquare([5,5,0])
  addSquare([5,6,0])
  addSquare([6,0,0])
  addSquare([6,2,0])
  addSquare([6,3,0])
  addSquare([6,4,0])
  addSquare([6,5,0])
  addSquare([7,1,0])
  addSquare([7,3,0])
  addSquare([7,4,0])

  doubleEdges()
  console.log(edges.length)

  center()

  EulerianPath(verticies[10], [12])
})
