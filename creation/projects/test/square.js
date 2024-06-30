// 

module.exports = () => {
  pixelDensity = 0.25
  isWall = false

  addPolygon(4, [0,0,0])
  // addPolygon(4, [0,1,0])

  origami({
    offset: [0, 0.1234, 0],
    normal: [0, 1, 1],
  })

  console.log(edges.length)
  for (let {ogCoords} of verticies)
    console.log(ogCoords)
  EulerianPath(0)
}
