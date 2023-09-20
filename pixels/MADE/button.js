
button = document.createElement("div")
button.innerHTML = "MADE"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', async () => {
  name = "MADE"
  reset()
  pixelDensity = 0.333333
  minimalInnerBorder = true
  isWall = true

  imageUrl = "MADE/made2D.png"
  await addSquaresFromPixels()
  doubleEdges()
  console.log(edges.length)

  EulerianPath(verticies[0], [0])
})
