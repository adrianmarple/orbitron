
button = document.createElement("div")
button.innerHTML = "Dodecagons"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "dodecwall"
  reset()
  const Y_GAP = 2.4
  const X_GAP = 1.375
  isWall = true
  
  addDodecagon([-3*X_GAP,-Y_GAP,0])
  addDodecagon([-1*X_GAP,-Y_GAP,0])
  addDodecagon([1*X_GAP,-Y_GAP,0])
  addDodecagon([3*X_GAP,-Y_GAP,0])
  addDodecagon([-2*X_GAP,0,0])
  addDodecagon([0,0,0])
  addDodecagon([2*X_GAP,0,0])
  addDodecagon([-1*X_GAP,Y_GAP,0])
  addDodecagon([1*X_GAP,Y_GAP,0])
  addDodecagon([0,2*Y_GAP,0])
  console.log(edges.length)
  path = EulerianPath([0], verticies[0])
})
