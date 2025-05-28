// SKIP
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  cat5partID = "5"
  powerHolePartID = "3"
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null
  // CHANNEL_DEPTH = 14

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  POWER_TYPE = "USBC"
  PORT_TYPE = "USBC"
  PORT_POSITION = "center"

  addPolygon(4, [0,0,0], [30 + 2, 81 + 2 * (14.5-4-2)])

  printPostProcessingFunction = printInfo => {
    let piAndPcbThickness = 1.6 + 1.4
    let standoffHeight = CHANNEL_DEPTH / 2 - piAndPcbThickness + 0.6
    let standoffRadius = 2.5
    let nubHeight = piAndPcbThickness
    let nubRadius = 1.3
    let standoffX = 23/2
    let standoffY = 58/2
    let standoffOffsetY = (18 - 5) / 2

    let code = `
    union() {
      cylinder(h=${THICKNESS + standoffHeight}, r=${standoffRadius});
      cylinder(h=${THICKNESS + standoffHeight + nubHeight}, r=${nubRadius});
    }`

    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        printInfo.prints[1],
        {
          position: [standoffX, standoffOffsetY + standoffY, 0],
          code
        },
        {
          position: [standoffX, standoffOffsetY - standoffY, 0],
          code
        },
        {
          position: [-standoffX, standoffOffsetY + standoffY, 0],
          code
        },
        {
          position: [-standoffX, standoffOffsetY - standoffY, 0],
          code
        },
      ]
    }
  }

  EulerianPath(1)
}