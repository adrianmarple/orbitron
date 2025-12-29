// SKIP
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  PORT_POSITION = "center"
  portPartID = "5"
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

  addPolygon(4, [0,0,0], [34 - 2*KERF, 120])

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let inset = 0.2
    let notchHeight = 1
    let pcb_thickness1 = 1.6
    let pcb_thickness2 = 1.8
    let piClipHeight = 5 + THICKNESS + EXTRA_COVER_THICKNESS
    let protoBoardWidth = 19
    let protoBoarClipHeight = 2 + THICKNESS + EXTRA_COVER_THICKNESS
    let micWidth = 14.5
    let micClipHeight = 1 + THICKNESS + EXTRA_COVER_THICKNESS

    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        printInfo.prints[1],
        {
          type: "union",
          position: [-15,13,0],
          rotationAngle: Math.PI/2,
          components: [
            {
              type: "pcbClip",
              position: [0, -30, 0],
              height: piClipHeight,
              pcb_thickness: pcb_thickness1,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: piClipHeight,
              pcb_thickness: pcb_thickness1,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
        {
          type: "union",
          position: [0,-30,0],
          rotationAngle: Math.PI/2,
          components: [
            {
              type: "pcbClip",
              position: [0, -protoBoardWidth/2, 0],
              height: protoBoarClipHeight,
              pcb_thickness: pcb_thickness2,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              position: [0, protoBoardWidth/2, 0],
              rotationAngle: Math.PI,
              height: protoBoarClipHeight,
              pcb_thickness: pcb_thickness2,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
      ]
    }

    printInfo.prints[1] = {
      type: "difference",
      suffix: printInfo.prints[1].suffix,
      components: [
        {
          type: "union",
          suffix: printInfo.prints[0].suffix,
          components: [
            printInfo.prints[1],
            {
              type: "union",
              position: [0,-25,0],
              rotationAngle: Math.PI/2,
              components: [
                {
                  type: "pcbClip",
                  position: [0, -micWidth/2, 0],
                  height: micClipHeight,
                  pcb_thickness: pcb_thickness2,
                  width, inset, clip_thickness, notchHeight,
                },
                {
                  type: "pcbClip",
                  position: [0, micWidth/2, 0],
                  rotationAngle: Math.PI,
                  height: micClipHeight,
                  pcb_thickness: pcb_thickness2,
                  width, inset, clip_thickness, notchHeight,
                },
              ]
            },
          ]
        },
        {
          position: [0, -35, -1],
          code: `
          cylinder(h=10, r=5);
          `,
        }
      ]
    }
  }

  EulerianPath(1)
}