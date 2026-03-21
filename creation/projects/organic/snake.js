module.exports = async () => {
  await addFromSVG("organic/snake.svg")
  integerize()

  const spineWidths = [
    [2.5,2.5],
    [2.7,3.3],
    [3.0,4.0],
    [3.3,3.7],
    [4,3],
    [4.5,3.5],
    [4.6,3.4],
    [3.2,2.8],
  ]
  const n = spineWidths.length
  const start = verticies[13]
  const sides = start.edges.map(startEdge => {
    const side = []
    let prev = start
    let curr = startEdge.otherVertex(start)
    for (let i = 0; i < n; i++) {
      side.push(curr)
      const nextEdge = curr.edges.find(e => e.otherVertex(curr) !== prev)
      if (!nextEdge) break
      prev = curr
      curr = nextEdge.otherVertex(curr)
    }
    return side
  })

  for (let i = 0; i < n; i ++) {
    addTriangulation(sides[1][i], sides[0][i], ...spineWidths[i])
  }

  EulerianPath(0)
}
