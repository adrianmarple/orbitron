
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  PORT_POSITION = "center"
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

  addPolygon(4, [0,0,0], [72, 108])

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let pcb_thickness1 = 1.8
    let pcb_thickness2 = 1.6
    let inset = 0.2
    let notchHeight = 1
    let segmentClipHeight = 6 + THICKNESS + EXTRA_COVER_THICKNESS
    let piClipHeight = 2 + THICKNESS + EXTRA_COVER_THICKNESS

    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        printInfo.prints[1],
        {
          type: "union",
          position: [0, 13, 0],
          components: [
            {
              type: "pcbClip",
              position: [0, 0.1, 0],
              height: segmentClipHeight,
              pcb_thickness: pcb_thickness1,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              position: [20, 27.9, 0],
              rotationAngle: Math.PI,
              height: segmentClipHeight,
              pcb_thickness: pcb_thickness1,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              position: [-20, 27.9, 0],
              rotationAngle: Math.PI,
              height: segmentClipHeight,
              pcb_thickness: pcb_thickness1,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
        {
          type: "union",
          position: [-5,-10,0],
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

    let qrIndentRadius = 6
    let qrIndentWidth = 54
    let qrIndentDepth = 1
    printInfo.prints[2] = {
      type: "difference",
      suffix: printInfo.prints[2].suffix,
      components: [
        printInfo.prints[2],
        {
          position: [0, -20, 0],
          code: `
          linear_extrude(height=${qrIndentDepth})
          offset(r=${qrIndentRadius})
          square(${qrIndentWidth - qrIndentRadius*2}, center=true);
          `,
        }
      ]
    }
  }

  EulerianPath(1)
}