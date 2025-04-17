
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  cat5PortMidway = true
  cat5partID = "5"
  powerHolePartID = "3"
  powerHoleWallIndex = 0
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"

  addPolygon(4, [0,0,0], [34 - 2*BOTTOM_KERF, 100])

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let pcb_thickness = 1.6
    let inset = 0.2
    let notchHeight = 1
    let piClipHeight = 4 + THICKNESS + EXTRA_COVER_THICKNESS
    let relayClipHeight = 1 + THICKNESS + EXTRA_COVER_THICKNESS

    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        printInfo.prints[1],
        {
          type: "union",
          position: [-15,12,0],
          rotationAngle: Math.PI/2,
          components: [
            {
              type: "pcbClip",
              position: [0, -30, 0],
              height: piClipHeight,
              pcb_thickness: pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: piClipHeight,
              pcb_thickness: pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
        {
          type: "union",
          position: [-10,-24,0],
          components: [
            {
              type: "pcbClip",
              position: [0, -12.9, 0],
              height: relayClipHeight,
              pcb_thickness: pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: relayClipHeight,
              pcb_thickness: pcb_thickness,
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