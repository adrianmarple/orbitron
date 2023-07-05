
button = document.createElement("div")
button.innerHTML = "Organic Wall"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "organic wall"
  reset()
  pixelDensity = 0.25
  isWall = true

  edgeCentersBlacklist = [
    [0, 3.5, 0],
    [3, -0.5, 0],
    [4, -0.5, 0],
    [4, -1.5, 0],
    [2.5, -1, 0],
    [2.5, -2, 0],
    [3.5, -2, 0],
  ]

  addSquare([-3,-3,0])
  addSquare([1,-3,0])
  addSquare([4,4,0])
  addSquare([-5,3,0])
  addSquare([-1,3,0])
  addSquare([0,3,0])
  addSquare([1,3,0])
  addSquare([5,3,0])
  addSquare([-6,2,0])
  addSquare([-4,2,0])
  addSquare([-2,2,0])
  addSquare([-1,2,0])
  addSquare([1,2,0])
  addSquare([2,2,0])
  addSquare([4,2,0])
  addSquare([6,2,0])
  addSquare([-5,1,0])
  addSquare([-3,1,0])
  addSquare([-2,1,0])
  addSquare([2,1,0])
  addSquare([3,1,0])
  addSquare([5,1,0])
  addSquare([-6,0,0])
  addSquare([-2,0,0])
  addSquare([-1,0,0])
  addSquare([3,0,0])
  addSquare([4,0,0])
  addSquare([-5,-1,0])
  addSquare([-3,-1,0])
  addSquare([-1,-1,0])
  addSquare([0,-1,0])
  addSquare([2,-1,0])
  addSquare([4,-1,0])
  addSquare([-4,-2,0])
  addSquare([-2,-2,0])
  addSquare([0,-2,0])
  addSquare([1,-2,0])
  addSquare([2,-2,0])
  addSquare([3,-2,0])
  addSquare([4,-2,0])

  console.log(edges.length)

  EulerianPath(verticies[2], [2])
})
