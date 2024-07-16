
module.exports = () => {
  let septEdges = addPolygon(7, ZERO, 3)
  let addedVerticies = []
  for (let edge of septEdges) {
    let v = addTriangulation(edge.verticies[0], edge.verticies[1], 4, 2)
    addedVerticies.push(v)
  }
  let edgeSequece = [
    [10,6],
    [10,6],
    [9,5],
    [11,7],
    [10,6],
    [10,6],
    [10,6],
  ]
  for (let i = 0; i < addedVerticies.length; i++) {
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % addedVerticies.length]
    let [a,b] = edgeSequece[i]
    addTriangulation(v1, v2, a, b)
  }
  rotateZAll(-0.05863, true)

  let starEdges = addPolygon(13, [29.844,0,0], 5)
  addedVerticies = []
  for (let i = 0; i < 13; i++) {
    let edge = starEdges[i]
    let v = addTriangulation(edge.verticies[0], edge.verticies[1], 3)
    addedVerticies.push(v)
  }

  edgeSequece = [
    [4,4],
    [4,4],
    [4,4],
    [4,4],
    [4,4],
    [4,4],
    [3,5],
    [3,5],
    [5,7],
    [8,8],
    [7,5],
    [6,4],
    [5,3],
  ]
  for (let i = 0; i < addedVerticies.length; i++) {
    let [a,b] = edgeSequece[i]
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % addedVerticies.length]
    addTriangulation(v1, v2, a, b)
  }

  console.log(addEdge(16,57).length())
  console.log(addEdge(17,55).length())

  EulerianPath(0)
}
