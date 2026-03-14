
module.exports = () => {
  WALL_THICKNESS = 5
  portPartID = "1"
  PORT_POSITION = "center"

  addPolygon(4, null, [3, 2])


  printPostProcessingFunction = printInfo => {
    let centerX = 36.4
    printInfo.prints[0] = {
      type: "difference",
      suffix: printInfo.prints[0].suffix,
      components: [
        printInfo.prints[0],
        {
          type: "cube",
          position: [centerX, 10 + 3, -1],
          dimensions: [200, 20, 30],
        },
        {
          type: "cube",
          position: [centerX, 10, -1],
          dimensions: [8, 20, 30],
        },
      ]
    }
  }

  EulerianPath(0)
}