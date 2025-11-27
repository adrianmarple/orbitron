// SKI
module.exports = async () => {
  exteriorOnly = true

  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_DEPTH = 30
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.6

  addPolygon(12, [0,0,0], 31.5)
  rotateZAll(Math.PI/12)

  printPostProcessingFunction = printInfo => {
    let pipeR = 8
    let width = 10
    let clip_thickness = 4
    let psu_pcb_thickness = 1.4
    let pi_pcb_thickness = 1.6
    let inset = 0.2
    let notchHeight = 1
    let clipHeight = 3 + THICKNESS + EXTRA_COVER_THICKNESS
    let screwR = 2.5
    let screwSpacing = 69.85
    let wireR = 2

    let topIndex = 2
    let bottomIndex = 1

    printInfo.prints = printInfo.prints.slice(0,3)

    printInfo.prints[bottomIndex] = {
      type: "union",
      suffix: printInfo.prints[bottomIndex].suffix,
      components: [
        {
          type: "difference",
          components: [
            printInfo.prints[bottomIndex],
            {
              position: [screwSpacing/2, 0, 0],
              code: `
              cylinder(h=10, r=${screwR});`
            },
            {
              position: [-screwSpacing/2, 0, 0],
              code: `
              cylinder(h=10, r=${screwR});`
            },
            {
              position: [3, 0, 0],
              code: `
              cylinder(h=10, r=${wireR});`
            },
            {
              position: [-3, 0, 0],
              code: `
              cylinder(h=10, r=${wireR});`
            },
          ],
        },
        {
          type: "union",
          position: [-5,-20,0],
          components: [
            {
              type: "pcbClip",
              position: [0, -30, 0],
              height: clipHeight,
              pcb_thickness: pi_pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              rotationAngle: Math.PI,
              height: clipHeight,
              pcb_thickness: pi_pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
        {
          type: "union",
          position: [0,-17,0],
          components: [
            {
              type: "pcbClip",
              height: clipHeight,
              rotationAngle: Math.PI,
              position: [0,screwSpacing - 0.4, 0],
              pcb_thickness: psu_pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
            {
              type: "pcbClip",
              height: clipHeight,
              pcb_thickness: psu_pcb_thickness,
              width, inset, clip_thickness, notchHeight,
            },
          ]
        },
      ]
    }

    printInfo.prints[topIndex] = {
      type: "union",
      suffix: printInfo.prints[topIndex].suffix,
      components: [
        {
          type: "difference",
          operations: [{ type: "rotate", vector: [Math.PI,0,0], }],
          components: [
            printInfo.prints[topIndex],
            {
              code: `
              cylinder(h=10, r=${pipeR + 2});`
            },
            {
              code: `
              scale(1.1,1.1,1)
              linear_extrude(0.6)
              import("SOURCE_FOLDER/scad/ravenstear.svg", center=true);`
            },
          ]
        },
        {
          type: "prefix",
          code: `
          use <SOURCE_FOLDER/scad/pipe.scad>`
        },
        {
          operations: [{ type: "rotate", vector: [Math.PI,0,0], }],
          position: [0,0,-20 +THICKNESS+EXTRA_COVER_THICKNESS],
          code: `
          outer_cuff(${pipeR});`
        }
      ]
    }

  }

  EulerianPath(1)
}