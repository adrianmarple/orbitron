
module.exports = async () => {
  setFor3DPrintedCovers()
  pixelDensity = 0.1
  exteriorOnly = true
  cat5PortMidway = true
  powerHolePartID = "2"
  powerHoleWallIndex = 0

  NO_EMBOSSING = true
  PIXEL_DISTANCE = pixelDensity
  WALL_THICKNESS = 2
  CHANNEL_DEPTH = 14
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.6

  addPolygon(6, [0,0,0], 60)

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
          position: [-5,15,0],
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

    let negativeThickness = THICKNESS + EXTRA_COVER_THICKNESS
    console.log()
    let snapY = CAT5_HEIGHT - CAT5_SNAP_Y + CAT5_SNAP_HEIGHT/2
    let snapX = CAT5_SNAP_DISTANCE/2 - CAT5_SNAP_WIDTH/2
    let BUFFER = 10
    let CAT5_THICKNESS = 13
    let cat5Holes = {
      type: "union",
      position: [0, -CAT5_HEIGHT/2, negativeThickness/2],
      components: [
        {
          type: "cube",
          position: [snapX, snapY, 0],
          dimensions: [CAT5_SNAP_WIDTH, CAT5_SNAP_HEIGHT, negativeThickness + 1 + 2*BUFFER]
        },
        {
          type: "cube",
          position: [-snapX, snapY, 0],
          dimensions: [CAT5_SNAP_WIDTH, CAT5_SNAP_HEIGHT, negativeThickness + 1 + 2*BUFFER]
        },
        {
          type: "cube",
          position: [0, CAT5_WIRES_HEIGHT/2, 0],
          dimensions: [CAT5_WIRES_WIDTH, CAT5_WIRES_HEIGHT, negativeThickness + 1 + 2*BUFFER]
        },
      ]
    }
    printInfo.prints[1] = {
      type: "union",
      suffix: printInfo.prints[1].suffix,
      components: [
        {
          type: "difference",
          operations: [{type: "rotate", axis: [0,1,0], angle: Math.PI}],
          components: [
            printInfo.prints[1],
            cat5Holes,
          ]
        },
        {
          type: "qtClip",
          operations: [{type: "rotate", axis: [0,1,0], angle: Math.PI}],
          position: [0, CAT5_WIRES_HEIGHT - CAT5_HEIGHT/2, -BUFFER]
        },
        {
          type: "difference",
          components: [
            {
              code: `
              union() {
                linear_extrude(height=${CAT5_THICKNESS + BUFFER - 2}, scale=0.7)
                circle(62, $fn=6);

                translate([0,0, ${(CAT5_THICKNESS + BUFFER)/2}])
                cube([17.4, 17.4, ${CAT5_THICKNESS + BUFFER}], center=true);
              }`,
            },
            cat5Holes,
            {
              type: "cube",
              position: [0, 0, BUFFER + CAT5_THICKNESS/2 + 1],
              dimensions: [15.4, 15.4, CAT5_THICKNESS+2]
            }
          ]
        }
      ]
    }

  // printInfo.prints[1] = {
  //   type: "union",
  //   suffix: printInfo.prints[1].suffix,
  //   components: [
  //     {
  //       type: "difference",
  //       components: [
  //         printInfo.prints[1],
  //         {
  //           type: "union",
  //           position: [0, -CAT5_HEIGHT/2, negativeThickness/2],
  //           components: [
  //             {
  //               type: "cube",
  //               position: [snapX, snapY, 0],
  //               dimensions: [CAT5_SNAP_WIDTH, CAT5_SNAP_HEIGHT, negativeThickness + 1]
  //             },
  //             {
  //               type: "cube",
  //               position: [-snapX, snapY, 0],
  //               dimensions: [CAT5_SNAP_WIDTH, CAT5_SNAP_HEIGHT, negativeThickness + 1]
  //             },
  //             {
  //               type: "cube",
  //               position: [0, CAT5_WIRES_HEIGHT/2, 0],
  //               dimensions: [CAT5_WIRES_WIDTH, CAT5_WIRES_HEIGHT, negativeThickness + 1]
  //             },
  //           ]
  //         }
  //       ]
  //     },
  //     {
  //       type: "qtClip",
  //       position: [0, CAT5_WIRES_HEIGHT - CAT5_HEIGHT/2, -3]
  //     }
  //   ]
  // }
  }

  EulerianPath(1)
}