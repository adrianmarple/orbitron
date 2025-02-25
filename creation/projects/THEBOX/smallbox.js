
module.exports = async () => {
  setFor3DPrintedCovers()
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  cat5partID = "5"
  powerHolePartID = "3"
  powerHoleWallIndex = 0
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = pixelDensity
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"

  addPolygon(4, [0,0,0], [34 - 2*BOTTOM_KERF, 84])

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let pcb_thickness1 = 1.8
    let pcb_thickness2 = 1.6
    let inset = 0.2
    let notchHeight = 1
    let segmentClipHeight = 6 + THICKNESS + EXTRA_COVER_THICKNESS
    let piClipHeight = 2 + THICKNESS + EXTRA_COVER_THICKNESS

    printInfo.prints[0] = {
      type: "union",
      suffix: printInfo.prints[0].suffix,
      components: [
        printInfo.prints[0],
        {
          type: "union",
          position: [-15,0,0],
          rotationAngle: Math.PI/2,
          components: [
            {
              type: "pcbClip",
              position: [0, -30, 0],
              height: piClipHeight,
              pcb_thickness: pcb_thickness2,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: piClipHeight,
              pcb_thickness: pcb_thickness2,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
      ]
    }

    // let qrIndentRadius = 6
    // let qrIndentWidth = 54
    // let qrIndentDepth = 1
    // printInfo.prints[1] = {
    //   type: "difference",
    //   suffix: printInfo.prints[1].suffix,
    //   components: [
    //     printInfo.prints[1],
    //     {
    //       position: [0, -20, 0],
    //       code: `
    //       linear_extrude(height=${qrIndentDepth})
    //       offset(r=${qrIndentRadius})
    //       square(${qrIndentWidth - qrIndentRadius*2}, center=true);
    //       `,
    //     }
    //   ]
    // }
  }

  EulerianPath(1)
}