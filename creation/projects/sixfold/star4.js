// SKI
module.exports = async () => {
  // portPartID = "1L"
  CENTER = new Vector(3, 3, 3)
  const SIZE = -4

  // const sides = 5
  // const mainGonSize = 10
  // const mainSpike = 13
  // const strut = 4
  // const innerSpike = 6

  // const sides = 6
  // const mainGonSize = 8
  // const mainSpike = 13
  // const strut = 4
  // const innerSpike = 7
  // const mainSpike2 = mainSpike
  // const innerSpike2 = innerSpike

  const sides = 8
  const mainGonSize = 6.5
  const mainSpike = 12
  const mainSpike2 = 7
  const strut = 5
  const innerSpike = 5
  const innerSpike2 = 3

  let gon = addPolygon(sides, ZERO, mainGonSize)
  for (let edge of gon) {
    let spike = edge.index % 2 == 0 ? mainSpike : mainSpike2
    addTriangulation(edge.verticies[0], edge.verticies[1], spike)
  }
  removeEdges(...gon)

  for (let i = 0; i < sides; i++) {
    addLine(i, strut, 360/sides * i + 90 - 180/sides)
  }
  
  for (let i = 0; i < sides; i++) {
    let spike = i % 2 == 0 ? innerSpike : innerSpike2
    addTriangulation(i + 2*sides, (i+1)%sides + 2*sides, spike)
  }

  zeroFoldAllEdges()
  EulerianPath(0)
  center()
}