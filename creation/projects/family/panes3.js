// v1.0.1
module.exports = () => {
  // portPartID = "2"

  addVertex(ZERO)
    .addLine([0,-4,0])
    .addLine([0,-91,0])
    .addLine([106,0,0])
    .addLine([0,0,-6])
    .addLine([6,0,0])
    .addLine([0,0,-106])
    .addLine([0,95,0])
    .addLine([0,0,106])
    .addLine([-6,0,0])
    .addLine([0,0,6])
    .addLine([-106,0,0])


  zeroFoldAllEdges()
  
  EulerianPath(0, 1)
}

