// SKIP
module.exports = () => {
  MAX_WALL_LENGTH = 180
  portPartID = "2"
  PORT_POSITION = "center"

  let v0 = addVertex([0,0,0])
  let v1 = addVertex([156,0,0])
  addEdge(v0,v1)

  zeroFoldAllEdges(2)
  EulerianPath(0, 1)
}