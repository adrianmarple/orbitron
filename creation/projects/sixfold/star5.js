// SKI
module.exports = async () => {
  setFor3DPrintedCovers()

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

  const sides = 10
  const mainGonSize = 6
  const mainSpike = 11
  const mainSpike2 = 5
  const strut = 6
  const innerSpike = 2.5
  const innerSpike2 = 2

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