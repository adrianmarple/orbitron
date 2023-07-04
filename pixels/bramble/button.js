
button = document.createElement("div")
button.innerHTML = "Bramble Hex"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', function() {
  name = "bramble"
  reset()
  isWall = true

  let smallEdge = 4
  let bigEdge = 5
  
  let dodecEdges = addDodecagon([0,0,0], [smallEdge, bigEdge])
  let parity = false
  for (let edge of dodecEdges) {
    if (!parity) {
      extrudePolygon(edge, 4, [bigEdge, smallEdge])
    } else {
      hexEdges = extrudePolygon(edge, 6)
      extrudePolygon(hexEdges[0], 3, null, true)
      extrudePolygon(hexEdges[2], 3)
      extrudePolygon(hexEdges[3], 3)
      extrudePolygon(hexEdges[4], 3)
    }
    parity = !parity
  }

  console.log(edges.length)
  path = EulerianPath([0], verticies[0])
})
