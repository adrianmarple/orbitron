// Large
a = 9.1
b = 7
c = 6
e = 10
f = 6
g = 18
h = 15
j = 16
k = 3
l = 26

// Medium
a = 5.25
b = 4
c = 3
e = 7
f = 3
g = 13
h = 9
j = 10
k = 2
l = 20

// // Small
// a = 3.91
// b = 3
// c = 2
// e = 4
// f = 2
// g = 7
// h = 6
// j = 6
// k = 1
// l = 10

module.exports = () => {
  // setLaserParams({
  //   BORDER: 4,
  //   CHANNEL_WIDTH: 5,
  //   CHANNEL_DEPTH: 8,
  //   NOTCH_DEPTH: 3,
  //   PIXEL_DISTANCE: 8.333, //https://www.superlightingled.com/4mm-ws2812c-individually-addressable-rgb-led-strip-light-120ledsm-328ft1m-p-4003.html
  // })

  for (let i = 0; i < 4; i++) {
    addVertex(new Vector(0,a,0).applyAxisAngle(BACKWARD, i * Math.PI/2))
  }
  for (let i = 0; i < 4; i++) {
    let v1 = verticies[i]
    let v2 = verticies[(i+1) % 4]
    addTriangulation(v1, v2, b)
  }
  let octEdges = [...edges]

  // let octEdges = addPolygon(8, [0,0,0], 8)
  // rotateZAll(Math.PI / 8, true)

  let addedVerticies = []
  for (let i = 0; i < octEdges.length; i++) {
    let edge = octEdges[i]
    let v1 = edge.verticies[0]
    let v2 = edge.verticies[1]
    let v = addTriangulation(v1, v2, c)
    addedVerticies.push(v)
  }
  
  let moreVerticies = []
  for (let i = 1; i < addedVerticies.length; i += 2) {
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % addedVerticies.length]
    let [v3,v4] = addSquareulation(v1, v2, e, f)
    addTriangulation(v3,v4, g)
    let v5 = addTriangulation(v1,v3, h,j)
    let v6 = addTriangulation(v4,v2, j,h)
    moreVerticies.push(v5)
    moreVerticies.push(v6)
  }
  for (let i = 1; i < moreVerticies.length; i += 2) {
    let v1 = moreVerticies[i]
    let v2 = moreVerticies[(i+1) % moreVerticies.length]
    
    addTriangulation(v1, v2, k)
    addTriangulation(v1, v2, l)
  }
  
  EulerianPath(36)
}