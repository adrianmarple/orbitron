// SKIP

addButton("test/letters", async () => {
  ledAtVertex = false
  // cat5PortMidway = true
  makeTwoSided()
  setLaserParams({
    NOTCH_DEPTH: 4,
    BORDER: 5,
    // CAT5_ADDITONAL_OFFSET: 10,
  })

  await addFromSVG("test/neodymium.svg")

  scale(0.5)
  EulerianPath(12, 1)
})
