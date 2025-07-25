
module.exports = () => {
  setFor3DPrintedCovers()
  MAX_WALL_LENGTH = 150
  portPartID = "2"
  PORT_POSITION = "center"

  useCorrectedVersion = 1


  let leftmostT = addVertex([13,-1,1]).addLine([2,0,0])
  let mainIcicleBase = leftmostT.addLine([2,0,0])
  //main icicle
  let mainIcicleFinalBranch = mainIcicleBase.addLine([0,-4,0])
  .addLine([0,-5,0])
  .addLine([0,-4,0])
  mainIcicleFinalBranch.addLine([0,-2,0])
  .addLine([0,-12,0])
  mainIcicleFinalBranch.addLine([1,0,0])
  .addLine([0,-2,0])
  .addLine([-1,0,0])
  .addLine([-1,0,0])
  .addLine([0,-5,0])

  let midIcicleT = leftmostT.addLine([0,-3,0])
  .addLine([0,0,-1])
  .addLine([3,0,0])
  .addLine([0,0,1])
  .addLine([0,-1,0])
  midIcicleT.addLine([0,-2,0])
  .addLine([0,0,1])
  .addLine([-2,0,0])
  .addLine([0,0,-1])
  .addLine([0,-3,0])
  .addLine([1,0,0])
  midIcicleT.addLine([-1,0,0])

  let upperOverflowStart = mainIcicleBase.addLine([3,0,0])
  upperOverflowStart.addLine([0,-1,0])
  .addLine([0,0,-1])
  .addLine([0,2,0])
  .addLine([3,0,0])
  .addLine([0,-2,0])
  .addLine([0,0,1])
  .addLine([0,-1,0])

  let upperButtressStart = upperOverflowStart.addLine([1,0,0])
  upperButtressStart.addLine([0,-2,0])
  .addLine([2,0,0])
  .addLine([1,0,0])
  .addLine([0,1,0])
  .addLine([1,0,0])

  let mobiusJointStart = upperButtressStart.addLine([4,0,0])
  .addLine([0,-1,0])
  .addLine([0,-2,0])
  mobiusJointStart.addLine([-1,0,0])
  .addLine([0,-1,0])
  .addLine([0,0,1])
  .addLine([2,0,0])
  .addLine([0,-2,0])
  .addLine([0,0,-1])

  let wallIcicleBase = mobiusJointStart.addLine([0,-2,0])
  .addLine([0,0,-1])
  .addLine([1,0,0])
  .addLine([0,1,0])
  .addLine([0,0,1])

  wallIcicleBase.addLine([0,4,0])

  let wallGreeble2Start
  if (useCorrectedVersion) {
    console.log("Correction")
    wallGreeble2Start = wallIcicleBase.addLine([0,-2,0])
    .addLine([0,-5,0])
  } else {
    console.log("Old incorrect topology")
    wallGreeble2Start = wallIcicleBase.addLine([0,-3,0])
    .addLine([0,-4,0])
  }
  wallGreeble2Start.addLine([0,0,1])
  .addLine([-1,0,0])
  .addLine([0,-3,0])
  .addLine([1,0,0])
  .addLine([0,0,-1])
  .addLine([0,0,-1])
  .addLine([0,-5,0])

  wallGreeble2Start.addLine([0,-3,0])
  .addLine([0,-48,0])

  // Left icicles for reference
  // let v0 = addVertex(ZERO)
  // let v1 = v0.addLine([0,-4,0])
  // let v2 = v1.addLine([0,-1,0])
  // .addLine([1,0,0])
  // .addLine([0,0,2])
  // .addLine([-1,0,0])
  // .addLine([0,2,0])
  // v2.addLine([0,2,0])
  // v0.addLine([3,0,0])
  // .addLine([0,-2,0])
  // .addLine([0,0,2])
  // .addLine([0,1,0])
  // .addLine([-3,0,0])

  // let v3 = v2.addLine([0,0,-1])
  // let v4 = v3.addLine([2,0,0])
  // let v5 = v4.addLine([5,0,0])
  // v4.addLine([0,2,0])
  // .addLine([2,0,0])
  // .addLine([0,0,1])
  // .addLine([2,0,0])
  // .addLine([0,-1,0])
  // .addLine([2,0,0])
  // .addLine([0,-2,0])
  // .addLine([0,0,-2])
  // .addLine([-2,0,0])
  // .addLine([0,0,2])
  // .addLine([1,0,0])
  // .addLine([0,-3,0])
  // .addLine([-1,0,0])
  // .addLine([0,0,-1])
  // .addLine([0,-2,0])
  // .addLine([1,0,0])

  // v5.addLine([0,-6,0])
  // .addLine([0,-10,0])

  // v5.addLine([0,2,0])
  // .addLine([1,0,0])
  // .addLine([0,0,-1])
  // .addLine([0,1,0])
  // .addLine([2,0,0])
  // .addLine([0,-1,0])
  // .addLine([0,0,1])
  // .addLine([3,0,0])

  // let v8 = v1.addLine([0,0,1])
  // .addLine([0,-4,0])

  // let v9 = v8.addLine([0,-6,0])
  // .addLine([0,-4,0])
  // let v10 = v9.addLine([0,-1,0])
  // v10.addLine([0,-50,0])

  // v8.addLine([0,0,-1])
  // .addLine([0,-2,0])
  // .addLine([1,0,0])
  // .addLine([0,0,2])
  // .addLine([-1,0,0])
  // .addLine([0,-4,0])
  // .addLine([0,0,-1])
  // v9.addLine([0,0,-1])
  // .addLine([0,-1,0])
  // .addLine([0,0,1])
  // v10.addLine([0,0,1])
  // .addLine([0,-5,0])

  // Hack due to non-connection, but needing topology to remain basically the same
  if (useCorrectedVersion) {
    sortOverride = (edge, previousEdge, angle) => {
      if ((previousEdge.index == 252 && edge.index == 253) ||
          (previousEdge.index == 223 && edge.index == 216) ||
          (previousEdge.index == 138 && edge.index == 47) ||
          (previousEdge.index == 142 && edge.index == 346) ||
          (previousEdge.index == 371 && edge.index == 260)) {
        return -1e6
      }
      else {
        return potential(edge, previousEdge, angle)
      }
    }
  }

  scale(4)
  zeroFoldAllEdges()
  
  // Hack to make strip fit (no clue why the strip ended up a pixel short)
  verticies[57].ogCoords = verticies[57].ogCoords.addScaledVector(UP, 0)

  EulerianPath(88)
}

