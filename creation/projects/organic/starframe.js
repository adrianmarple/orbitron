// v1.0.2
module.exports = () => {
  portPartID = "1"
  PORT_POSITION = "end"

  let W = (1524 - 4)/PIXEL_DISTANCE;
  let L = (913 - 4)/PIXEL_DISTANCE;

  function star(size, armLength, center) {
    if (!center) {
      center = ZERO
    }
    let verticies = []
    for (let i = 0; i < 4; i++) {
      let a = Math.PI/2* i
      let v = new Vector(size * Math.sin(a), size* Math.cos(a), 0)
      verticies.push(addVertex(center.add(v)))
    }
    for (let i = 0; i < 4; i++) {
      addTriangulation(verticies[i], verticies[(i+3)%4], armLength)
    }
  }

  console.log(W, L)

  let L1 = 45
  let S0 = L - L1
  star(S0, 8)
  addLine(0, L1, -90)

  let W0 = 12
  let W1 = 62
  let W2 = 3

  let S1 = 5

  addLine(3, W0, 180)
  star(S1, 4, new Vector(-W0 - S0 - S1, 0, 0))
  addLine(12, W1 - W0 - 2*S1, 180)

  let S2 = (W - W1 - S0 - W2)/2
  star(S2, 7, new Vector(-W1 - S0 - S2, 0, 0))
  addLine(20, W2, 180)

  let L2 = 33
  let S3 = L - L2
  let A0 = 18
  addLine(25, L2, -90)
  star(S3, A0, new Vector(-W, L, 0))

  let W3 = 4
  let W4 = 44
  let S4 = (W - W3 - S3 - W4)/2
  addLine(8, W3, 180)
  star(S4, 9, new Vector(-W3 - S4, L, 0))
  addLine(37, W4, 180)

  let A1 = 4
  let A2 = 7
  for (let i = 29; i <= 36; i += 2) {
    let v1 = splitEdge(i, -A1)
    let v2 = splitEdge(i+1, A1)
    addTriangulation(v2, v1, A2)
  }



  // let L1 = 40
  // let S1 = L - L1
  // star(S1, 12)
  // addLine(0, L1, -90)

  // let W1 = 55
  // let W2 = 5
  // let S2 = (W - W1 - S1 - W2)/2
  // addLine(3, W1, 180)
  // star(S2, 7, new Vector(-W1 - S1 - S2, 0, 0))
  // addLine(12, W2, 180)

  // let L2 = 31
  // let S3 = L - L2
  // addLine(17, L2, -90)
  // star(S3, 20, new Vector(-W, L, 0))

  // let W3 = 3
  // let W4 = 43
  // let S4 = (W - W3 - S3 - W4)/2
  // addLine(8, W3, 180)
  // star(S4, 9, new Vector(-W3 - S4, L, 0))
  // addLine(29, W4, 180)

  // let A1 = 16
  // let A2 = 7
  // for (let i = 20; i <= 27; i += 2) {
  //   let v = edges[i].commonVertex(i+1)
  //   let v1 = splitEdge(i, A1)
  //   let v2 = splitEdge(i+1, -A1)
  //   addTriangulation(v2, v1, A2)
  // }

  zeroFoldAllEdges()
  EulerianPath(27)
}
