// v1.0.1
module.exports = () => {

  let v0 = addVertex(ZERO)
  let v1 = v0.addLine([0,91,0])
    .addLine([0,4,0])
    .addLine([102,0,0])
  let v2 = v0.addLine([102,0,0])
  let v3 = v2.addLine([0,30,0])
  let v4 = v3.addLine([4,0,0])
    .addLine([0,0,-6])
    .addLine([6,0,0])
    .addLine([0,0,-4])

  v4.addLine([0,35,0])
  let v5 = v3.addLine([0,35,0])
  v5.addLine([0,30,0])
  let v6 = v5.addLine([4,0,0])
     .addLine([0,0,-6])
     .addLine([6,0,0])
     .addLine([0,0,-4])

  v7 = v6.addLine([0,30,0])
  v8 = v7.addLine([0,0,-102])
  v9 = v8.addLine([0,-95,0])
    .addLine([0,0,102])
    .addLine([0,30,0])

  zeroFoldAllEdges()
  
  EulerianPath(0, 1)
}

