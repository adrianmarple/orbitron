
module.exports = async () => {
  setFor3DPrintedCovers()
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  cat5partID = "5"
  powerHolePartID = "3"
  powerHoleWallIndex = 0
  

  PIXEL_DISTANCE = pixelDensity
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"

  await addFromSVG("THEBOX/small boxshape.svg")

  printPostProcessingFunction = printInfo => {
    let width = 10
    let clip_thickness = 4
    let pcb_thickness1 = 1.8
    let pcb_thickness2 = 1.6
    let inset = 0.2
    let notchHeight = 1
    let coverThickness = 2.2
    let segmentClipHeight = 6 + coverThickness
    let piClipHeight = 2 + coverThickness

    let suffix = printInfo.prints[0].suffix
    printInfo.prints[0] = {
      type: "union",
      suffix,
      components: [
        printInfo.prints[0],
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
          position: [5,-10,0],
          components: [
            {
              type: "pcbClip",
              position: [0, -29.9, 0],
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

    // TODO cut out gap for QR code in top
  }

  EulerianPath(1)
}