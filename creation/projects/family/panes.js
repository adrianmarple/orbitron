// v1.0.1
module.exports = () => {
  // portPartID = "2"

  let v0 = addVertex(ZERO)
  let v1 = v0.addLine([0,91,0])
    .addLine([0,4,0])
  let v2 = v0.addLine([102,0,0])
  let v3 = v2.addLine([0,30,0])
  let v4 = v3.addLine([4,0,0])
    .addLine([0,0,-6])
    .addLine([6,0,0])
    .addLine([0,0,-4])

  v4.addLine([0,30,0])
  v4.addLine([0,-12,0])
  let v5 = v3.addLine([0,12,0])
    .addLine([0,18,0])
  v5.addLine([0,12,0])
  let v6 = v5.addLine([4,0,0])
     .addLine([0,0,-6])
     .addLine([6,0,0])
     .addLine([0,0,-4])

  v7 = v6.addLine([0,35,0])
  v8 = v7.addLine([0,0,-102])
  v9 = v8.addLine([0,-40,0])
    .addLine([0,-30,0]) //.addLine([0,-45,0])

  splitEdge(2, -10)
    .addLine([0,42,0])
    .addLine([10,0,0])
  // splitEdge(2, -30)
  //   .addLine([0,24,0])
  // splitEdge(2, 24)
  //   .addLine([0,44,0])


  let v10 = splitEdge(18, -10)
    .addLine([0,-22,0])
    .addLine([0,-18,0])
  v10.addLine([0,-8,0])
  let v11 = v10.addLine([0,0,-10])
  removeVertex(18)
  let v12 = v11.addLine([0,18,0])
  v12.addLine([0,8,0])
  v12.addLine([0,0,10])
  splitEdge(18, -20)
    .addLine([0,-10,0])

  splitEdge(18, 32)
    .addLine([0,-18,0])
    // .addLine([0,-4,0])
  splitEdge(18, 20)
    .addLine([0,-18,0])
    .addLine([0,0,-12])

  zeroFoldAllEdges()
  
  EulerianPath(1)
}

