
addButton("Letter Test", async () => {
  name = "letters"
  ledAtVertex = false
  pixelDensity = 2
  makeTwoSided()
  setLaserParams({
    NOTCH_DEPTH: 4,
    BORDER: 5,
    // CAT5_ADDITONAL_OFFSET: 10,
  })

  await addFromSVG("test/neodymium.svg")

  doubleEdges()
  center()
  EulerianPath(12, 1)
})