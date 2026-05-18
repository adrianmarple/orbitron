// v1.0.1
module.exports = () => {
  CHANNEL_DEPTH = 12
  CHANNEL_WIDTH = 12
  BORDER = 1.4

  buildArchimedean([
    [1,1,1],
  ], {
    edgeLength: 26,
  })

  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {4: 0, "top": 2, "bottom": 3},
      glassROffset: -1,
    })(printInfo)
  }

  for (let edge of [...edges]) {
    splitEdge(edge, edge.length()/2)
  }

  edgeCleanup()
  EulerianPath(0, 1)
}
