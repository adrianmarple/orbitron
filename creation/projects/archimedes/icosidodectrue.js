module.exports = () => {
  setThinStrip()

  buildArchimedean([
    [PHI/2, 1/PHI/2, 1/2],
    [1, 0, 0],
  ], {
    edgeLength: 6,
  })


  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {3: 0, 5: 1, "top": 2, "bottom": 3},
      glassROffset: 1,
      highOverhang: 3,
      lowOverhang: 2.5,
    })(printInfo)
    // printInfo.prints.push({
    //   type: "difference",
    //   suffix: "bottom_with_hole",
    //   components: [
    //     printInfo.prints[1],
    //     {
    //       position: [0, 0, -1],
    //       code: `
    //       cylinder(h=${5}, r=${5.2}, $fn=64);`
    //     },
    //   ]
    // })
  }

  edgeCleanup()
  EulerianPath(0)
}
