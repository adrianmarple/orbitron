
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null
  CHANNEL_DEPTH = 16.2

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.5

  addPolygon(4, [0,0,0], [32, 72.8])

  let portHeight = 2.6
  let portWidth = 8.7
  let portZOffset = 5

  let ovalHeight = portHeight + 3
  let ovalWidth = portWidth + 5
  let ovalThickness = 0.3
  let ovalInset = 0.6


  let piAndPcbThickness = 1.6 + 1.4
  let standoffHeight = 3.8
  CHANNEL_DEPTH = (standoffHeight + piAndPcbThickness)*2 + portHeight - portZOffset
  // let standoffHeight = CHANNEL_DEPTH / 2 - piAndPcbThickness - portHeight/2
  let standoffRadius = 2.5
  let nubHeight = piAndPcbThickness
  let nubRadius = 1.33
  let standoffX = 23/2
  let standoffY = 58/2
  let standoffOffsetY = (5 - 2) / 2

  printPostProcessingFunction = printInfo => {
    let position = [-16 - WALL_THICKNESS, portZOffset/2, 0]


    for (let index of [3,5]) {
      printInfo.prints[index] = {
        type: "difference",
        suffix: printInfo.prints[index].suffix,
        components: [
          printInfo.prints[index],
          {
            position,
            code: `
            hull() {
              translate([${(portWidth - portHeight)/2}, 0, 0])
              cylinder(h=${THICKNESS}, r=${portHeight/2});
              translate([${-(portWidth - portHeight)/2}, 0, 0])
              cylinder(h=${THICKNESS}, r=${portHeight/2});
            };`
          },
          {
            position,
            code: `
            linear_extrude(height=${ovalInset})
            difference() {
              offset(r=${ovalHeight/2}) square([${ovalWidth - ovalHeight}, 0.001], center=true);
              offset(r=${ovalHeight/2 - ovalThickness}) square([${ovalWidth - ovalHeight - 2*ovalThickness}, 0.001], center=true);
            };`
          },
        ]
      }
    }



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

    // Wordmark deboss
    for (let index of [1,2]) {
      printInfo.prints[index] = {
        type: "difference",
        suffix: printInfo.prints[index].suffix,
        components: [
          printInfo.prints[index],
          {
            position: [7, 0, 0],
            code: `
              linear_extrude(height=0.4)
              rotate([0,0,-90])
              mirror([1,0,0])
              scale(0.1)
              import("../../lumatron.svg", center=true, dpi=25.4);`
          },
        ]
      }
    }
  }

  EulerianPath(1)
}