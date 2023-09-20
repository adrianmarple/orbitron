
button = document.createElement("div")
button.innerHTML = "Space Invader"

document.getElementById("type-buttons").appendChild(button)
button.classList.add("button")
button.addEventListener('click', async () => {
  name = "invader"
  reset()
  pixelDensity = 0.25
  minimalInnerBorder = true

  imageUrl = "spaceinvaders/invader1A.png"
  await addSquaresFromPixels()
  doubleEdges()
  console.log(edges.length)

  EulerianPath(verticies[16], [23])
})
