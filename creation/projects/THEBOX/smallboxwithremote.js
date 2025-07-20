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

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  POWER_TYPE = "USBC"
  PORT_TYPE = "USBC"
  PORT_POSITION = "center"

  addPolygon(4, [0,0,0], [34 - 2*BOTTOM_KERF, 100])

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let pcb_thickness = 1.6
    let inset = 0.2
    let notchHeight = 1
    let piClipHeight = 4 + THICKNESS + EXTRA_COVER_THICKNESS
    let relayClipHeight = 1 + THICKNESS + EXTRA_COVER_THICKNESS
    let relayPCBThickness = 1.2
    let connectorClipHeight = 4.2 + THICKNESS + EXTRA_COVER_THICKNESS

    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        printInfo.prints[1],
        {
          type: "union",
          position: [-15,15,0],
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
          position: [-10,-29,0],
          components: [
            {
              type: "pcbClip",
              position: [0, -12.8, 0],
              height: relayClipHeight,
              pcb_thickness: relayPCBThickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: relayClipHeight,
              pcb_thickness: relayPCBThickness,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
        {
          type: "union",
          position: [8,-26,0],
          components: [
            {
              type: "pcbClip",
              position: [0, -19.1, 0],
              height: connectorClipHeight,
              pcb_thickness: pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: connectorClipHeight,
              pcb_thickness: pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
      ]
    }

    holder_thickness = 2
    dims = [33, 44, 8]
    printInfo.prints[2] = {
      type: "union",
      suffix: printInfo.prints[2].suffix + "+cardholder",
      operations: [{type: "rotate", axis: [0,1,0], angle: Math.PI}],
      components: [
        printInfo.prints[2],
        {
          position: [0, -49 + dims[1]/2, -dims[2]/2],
          type: "difference",
          components: [
            {
              type: "cube",
              dimensions: dims
            },
            {
              type: "cube",
              position: [0, holder_thickness/2, holder_thickness/2],
              dimensions: [
                dims[0] - 2*holder_thickness,
                dims[1] - holder_thickness,
                dims[2] - holder_thickness,
              ]
            },
          ]
        },
      ]
    }
  }

  EulerianPath(1)
}