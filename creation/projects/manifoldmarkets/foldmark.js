
module.exports = () => {
  // setLaserParams({
  //   BORDER: 4,
  //   CHANNEL_WIDTH: 5,
  //   CHANNEL_DEPTH: 8,
  //   NOTCH_DEPTH: 3,
  //   PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  // })
  setLaserParams({
    NOTCH_DEPTH: 4,
    BORDER: 5,
  })

  let v0 = addVertex([0,0,0])
  let e0 = addLine(v0, 16, 15)
  let v1 = e0.verticies[1]
  let v2 = addTriangulation(v0, v1, 20, 24)
  let [e1, e2] = v2.edges
  let v3 = splitEdge(e0, 8)
  addLine(v3, 6, -55)
  let v4 = splitEdge(e1, 8)
  let e3 = v4.edges[1]
  let v5 = addTriangulation(v0, v4, 12, 14)
  let [e4, e5] = v5.edges
  let v6 = splitEdge(e4, -4)
  addTriangulation(v6, v5, 6, 4)
  let v7 = splitEdge(e5, -3)
  let v8 = splitEdge(e3, 5)
  addTriangulation(v7, v8, 9,10)
  let v9 = splitEdge(e2, -10)
  addTriangulation(v9, v1, 16, 9)

  // let v0 = addVertex([0,0,0])
  // let e0 = addLine(v0, 12, 15)
  // let v1 = e0.verticies[1]
  // let v2 = addTriangulation(v0, v1, 17, 21)
  // let [e1, e2] = v2.edges
  // let v3 = splitEdge(e0, 6)
  // addLine(v3, 5, -55)
  // let v4 = splitEdge(e1, 7)
  // let e3 = v4.edges[1]
  // let v5 = addTriangulation(v0, v4, 10, 12)
  // let [e4, e5] = v5.edges
  // let v6 = splitEdge(e4, -3)
  // addTriangulation(v6, v5, 5, 4)
  // let v7 = splitEdge(e5, -3)
  // let v8 = splitEdge(e3, 4)
  // addTriangulation(v7, v8, 8, 8)
  // let v9 = splitEdge(e2, -7)
  // addTriangulation(v9, v1, 11, 6)

  doubleEdges()
  center()

  EulerianPath(15)
}