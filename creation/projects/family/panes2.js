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
  let v5 = v3.addLine([0,30,0])
  let v6 = v5.addLine([4,0,0])
     .addLine([0,0,-6])
     .addLine([6,0,0])
     .addLine([0,0,-4])

  v7 = v6.addLine([0,35,0])
  v8 = v7.addLine([0,0,-102])
  v9 = v8.addLine([0,-40,0])
    .addLine([0,-30,0]) //.addLine([0,-45,0])

  splitEdge(2, -24)
    .addLine([0,16,0])
  splitEdge(2, 36)
    .addLine([0,24,0])
  splitEdge(2, 20)
    .addLine([0,8,0])

  splitEdge(15, -20)
    .addLine([0,-32,0])
  splitEdge(15, 40)
    .addLine([0,-52,0])
  splitEdge(15, 24)
    .addLine([0,-40,0])


  zeroFoldAllEdges()
  
  EulerianPath(1)
}

