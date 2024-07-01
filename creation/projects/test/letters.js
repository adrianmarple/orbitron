// SKIP

addButton("test/letters", async () => {
  ledAtVertex = false
  pixelDensity = 2
  // cat5PortMidway = true
  makeTwoSided()
  setLaserParams({
    NOTCH_DEPTH: 4,
    BORDER: 5,
    // CAT5_ADDITONAL_OFFSET: 10,
  })

  await addFromSVG("test/neodymium.svg")

  EulerianPath(12, 1)
})
