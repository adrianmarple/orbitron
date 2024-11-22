
module.exports = async () => {
  await addFromSVG("signs/MADE.svg")
  ledAtVertex = true
  cat5WallOverride = 30

  splitEdge(57,-2)
  splitEdge(59,2)
  addTriangulation(49,48, 4,3)
  removeVertex(46)
  removeVertex(46)

  splitEdge(52,2)
  splitEdge(50,-2)
  addTriangulation(49,50, 3,4)
  removeVertex(42)
  removeVertex(42)

  EulerianPath(4)

  dataPostProcessingFunction = info => {
    let deadends = []
    for (let i = 0; i < info.neighbors.length; i++) {
      if (info.neighbors[i].length == 1) {
        deadends.push(i)
      }
    }
    connectPixels(info, deadends.pop(), deadends.pop())

    info.northPole = [
      ...range(359, 385),
      ...range(420, 442),
    ]
  }
}

function range(start, end, step = 1) {
  return Array.from(
    { length: Math.ceil((end - start) / step) }, 
    (_, i) => i * step + start
  )
}
