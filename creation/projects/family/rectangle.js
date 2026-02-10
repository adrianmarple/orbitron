// SKIP
module.exports = () => {
  portPartID = "2L"
  ZERO_FOLD_LENGTH_THRESHOLD = 19
  MAX_WALL_LENGTH = 150
  LED_SUPPORT_TYPE = "none"

  // CHANNEL_WIDTH = 10
  PIXEL_DISTANCE = 8.3 //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  // MAX_NOTCH_DISTANCE = 140
  startMidwayDownFinalEdge = true // Broken

  let rectEdges = addPolygon(4, [0,0,0], [44,56])

  for (let i = 0; i < 4; i++) {
    splitEdge(rectEdges[i], -10)
    splitEdge(rectEdges[i], 10)
  }
  edgeCleanup()
  for (let index of [15,13,11,7]) {
    splitEdge(index, edges[index].length()/2)
  }


  for (let index of [0,1,2,3,12,14,16,17,18,19]) {
    let vertex = verticies[index]
    vertex.plains = [DEFAULT_PLAIN.clone()]
  }
  for (let index of [4,5,6,7,8,9,10,11,13,15]) {
    let vertex = verticies[index]
    let vertex0 = vertex.edges[0].otherVertex(vertex)
    let vertex1 = vertex.edges[1].otherVertex(vertex)
    let plain0 = vertex0.plains[0]
    let plain1 = vertex1.plains[0]
    let foldNormal = vertex.ogCoords.sub(vertex1.ogCoords)
    vertex.deadendPlain = new Plain(vertex.ogCoords, foldNormal)
    vertex.plains = []
    vertex.addPlain(plain0)
    vertex.addPlain(plain1)
  }


  EulerianPath(9)

}
