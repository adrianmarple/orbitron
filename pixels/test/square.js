

addButton("Square", () => {
  name = "square"
  isWall = true
  pixelDensity = 0.25

  addPolygon(4, [0,0,0])

  console.log(edges.length)
  EulerianPath(verticies[0], [0])
})
