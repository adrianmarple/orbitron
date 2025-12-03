// SKI

module.exports = () => {
  // exteriorOnly = true
  
  let origin = addVertex(ZERO)
  let v1 = addVertex([3,4,0])
  let v2 = addVertex([-3,4,0])
  let v3 = addVertex([0,8,0])
  addEdge(origin, v1)
  addEdge(origin, v2)
  addEdge(v1,v3)
  addEdge(v2,v3)

  let plain2 = new Plain(ZERO, UP)
  let v4 = addVertex([3,0,4])
  let v5 = addVertex([-3,0,4])
  let v6 = addVertex([0,0,8])
  v4.plains = []
  v5.plains = []
  v6.plains = []
  addEdge(origin, v4)
  addEdge(origin, v5)
  addEdge(v4,v6)
  addEdge(v5,v6)
  origin.addPlain(plain2)
  v4.addPlain(plain2)
  v5.addPlain(plain2)
  v6.addPlain(plain2)

  setTimeout(() => {
  console.log(origin.negations)
  }, 100)
  doubleEdges()
  EulerianPath(0)
}
