// v1.0.1
module.exports = () => {
  // portPartID = "2"

  let v0 = addVertex(ZERO)
  let v1 = v0.addLine([0,-4,0])
    .addLine([0,-40,0])
  let v2 = v0.addLine([102,0,0])
  let v3 = v2.addLine([0,-16,0])
  let v4 = v3.addLine([4,0,0])
    .addLine([0,0,-6])
    .addLine([6,0,0])
    .addLine([0,0,-4])

  v4.addLine([0,-20,0])
  let v5 = v3.addLine([0,-20,0])
  v5.addLine([0,-40,0])
  let v6 = v5.addLine([4,0,0])
     .addLine([0,0,-6])
     .addLine([6,0,0])
     .addLine([0,0,-4])
  v6.addLine([0,-54,0])
  v7 = v4.addLine([0,16,0])
  v8 = v7.addLine([0,0,-102])
  v9 = v8.addLine([0,-60,0])

  splitEdge(2, -24)
    .addLine([0,-20,0])
  splitEdge(2, 40)
    .addLine([0,-32,0])
  splitEdge(2, 20)
    .addLine([0,-12,0])

  splitEdge(17, -20)
    .addLine([0,-20,0])
  splitEdge(17, 40)
    .addLine([0,-44,0])
  splitEdge(17, 24)
    .addLine([0,-32,0])


  zeroFoldAllEdges()
  
  EulerianPath(0,1)
}

