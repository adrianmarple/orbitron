
button = document.createElement("div")
button.innerHTML = "Bramble Hex"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "bramble"
  reset()
  isWall = true
  
  let dodecEdges = addDodecagon([0,0,0])
  let parity = false
  for (let edge of dodecEdges) {
    if (parity) {
      extrudePolygon(edge, 4)
    } else {
      hexEdges = extrudePolygon(edge, 6)
      extrudePolygon(hexEdges[0], 3, true)
      extrudePolygon(hexEdges[2], 3)
      extrudePolygon(hexEdges[3], 3)
      extrudePolygon(hexEdges[4], 3)
    }
    parity = !parity
  }

  console.log(edges.length)
  path = EulerianPath([0], verticies[0])
})
