
module.exports = () => {

  let dodecEdges = addDodecagon([0,0,0], 5)
  let nextVerticies = []
  for (let i = 0; i < dodecEdges.length; i++) {
    let edge = dodecEdges[i]
    nextVerticies.push(addTriangulation(edge.verticies[0], edge.verticies[1], 3))
  }

  let nextNextVerticies = []
  for (let i = 0; i < 12; i++) {
    let v0 = nextVerticies[i]
    let v1 = nextVerticies[(i+1)%12]
    nextNextVerticies.push(addTriangulation(v0, v1, 4))
  }

  for (let i = 0; i < 12; i++) {
    let v0 = nextNextVerticies[i]
    let v1 = nextNextVerticies[(i+1)%12]
    addTriangulation(v0, v1, 7)
  }

  let edgesToRemove = [
    0,1,11,12,13,14,35,59,36,
    16,38,60,62,40,64,81,57,79,77,55,33
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }

  // Replace "pinions"
  edgesToRemove = [
    10,28,45,29,46,47,
    58,42,59,25,43,60,
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }
  addLine(1, 14-2, -90)
  addLine(11, 11-2, -60)
  addLine(20, 7-2, -30)
  addLine(8, 14-2, -90)
  addLine(17, 11-2, -120)
  addLine(25, 7-2, -150)

  // Replace "tear" top bit
  edgesToRemove = [
    0,9,25,50,49,38,24,8,
  ]
  edgesToRemove = edgesToRemove.sort((a,b)=>b-a)
  console.log(edgesToRemove)
  for (let edgeIndex of edgesToRemove) {
    removeEdge(edgeIndex)
  }
  addTriangulation(7,0, 19)

  doubleEdges()
  let startingEdge = 37
  EulerianPath(startingEdge)
}