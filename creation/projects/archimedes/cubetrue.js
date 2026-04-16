module.exports = () => {
  buildArchimedean([
    [1,1,1],
  ], {
    edgeLength: 6,
  })

  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {4: 0, "top": 2, "bottom": 3}
    })(printInfo)
  }

  edgeCleanup()
  EulerianPath(0)
}
