module.exports = () => {
  buildArchimedean([
    [1,1,1], [-1,1,-1], [-1,-1,1], [1,-1,-1],
  ], {
    symmetry: 'raw',
    edgeLength: 10,
  })
  rotateXAll(Math.PI)

  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {3: 0, "top": 2, "bottom": 3}
    })(printInfo)
    printInfo.prints.push({
      type: "difference",
      suffix: "bottom_with_hole",
      components: [
        printInfo.prints[1],
        {
          position: [0, 0, -1],
          code: `
          cylinder(h=${5}, r=${5.2}, $fn=64);`
        },
      ]
    })
  }

  edgeCleanup()
  EulerianPath(0)
}
