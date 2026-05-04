module.exports = async () => {
  exteriorOnly = true

  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_DEPTH = 20
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.6

  addPolygon(12, [0,0,0], 31.5)

  printPostProcessingFunction = printInfo => {
    let pipeR = 8
    let screwR = 2.5
    let screwSpacing = 69.85
    let wireR = 3

    let topIndex = 2
    let bottomIndex = 1

    let sconceInset = 10
    let psuWidth = 55
    let psuLength = 35

    printInfo.prints = printInfo.prints.slice(0,3)

    printInfo.prints[bottomIndex] = {
      type: "difference",
      suffix: printInfo.prints[bottomIndex].suffix,
      components: [
        {
          type: "union",
          operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
          components: [
            printInfo.prints[bottomIndex],
            {
              type: "cube",
              position: [0,0, (sconceInset+1.5)/-2 + TOTAL_THICKNESS],
              dimensions: [psuLength+3, psuWidth+3, sconceInset+1.5],
            }
          ],
        },
        {
          type: "cube",
          position: [0,0, sconceInset/2 - TOTAL_THICKNESS],
          dimensions: [psuLength, psuWidth, sconceInset],
        },
        {
          position: [screwSpacing/2, 0, -5],
          code: `
          cylinder(h=10, r=${screwR});`
        },
        {
          position: [-screwSpacing/2, 0, -5],
          code: `
          cylinder(h=10, r=${screwR});`
        },
        {
          position: [5, 0, 0],
          code: `
          cylinder(h=20, r=${wireR});`
        },
        {
          position: [-5, 0, 0],
          code: `
          cylinder(h=20, r=${wireR});`
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
              rotationAngle: Math.PI/12,
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