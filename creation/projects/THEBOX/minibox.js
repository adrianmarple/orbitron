
module.exports = async () => {
  setFor3DPrintedCovers()
  exteriorOnly = true
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null
  BORDER = 2
  NOTCH_DEPTH = 3

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.5

  innerWidth = 32
  innerLength = 73.2
  addPolygon(4, [0,0,0], [innerWidth, innerLength])

  let portHeight = 3.2
  let portWidth = 9.3
  let portZOffset = 5.6
  let portLength = 6.6 + 2;

  let sleaveThickness = 2;

  let ovalHeight = portHeight + 3
  let ovalWidth = portWidth + 5
  let ovalThickness = 0.3
  let ovalInset = 0.6


  let piAndPcbThickness =  2.8 //3
  let standoffHeight = 3.8 // TODO I think this can be made smaller
  CHANNEL_DEPTH = (standoffHeight + piAndPcbThickness)*2 + portHeight - portZOffset
  let standoffRadius = 2.5
  let nubHeight = piAndPcbThickness
  let nubRadius = 1.33
  let standoffX = 23/2
  let standoffY = 58/2
  let standoffOffsetY = (5 - 2) / 2

  printPostProcessingFunction = printInfo => {
    let position = [-16 - WALL_THICKNESS, portZOffset/2, WALL_THICKNESS - portLength]


    for (let index of [3,5]) {
      printInfo.prints[index] = {
        type: "difference",
        suffix: printInfo.prints[index].suffix,
        operations: [{ type: "rotate", axis: [1,0,0], angle: Math.PI }],
        components: [
          {
            type: "union",
            components: [
              printInfo.prints[index],
              {
                position,
                code: `
                hull() {
                  translate([${(portWidth - portHeight)/2}, 0, 0])
                  cylinder(h=${portLength}, r=${portHeight/2 + sleaveThickness});
                  translate([${-(portWidth - portHeight)/2}, 0, 0])
                  cylinder(h=${portLength}, r=${portHeight/2 + sleaveThickness});
                };`
              }
            ]
          },
          {
            position,
            code: `
            hull() {
              translate([${(portWidth - portHeight)/2}, 0, 0])
              cylinder(h=${portLength}, r=${portHeight/2});
              translate([${-(portWidth - portHeight)/2}, 0, 0])
              cylinder(h=${portLength}, r=${portHeight/2});
            };`
          },
          // {
          //   position,
          //   code: `
          //   linear_extrude(height=${ovalInset})
          //   difference() {
          //     offset(r=${ovalHeight/2}) square([${ovalWidth - ovalHeight}, 0.001], center=true);
          //     offset(r=${ovalHeight/2 - ovalThickness}) square([${ovalWidth - ovalHeight - 2*ovalThickness}, 0.001], center=true);
          //   };`
          // },
        ]
      }
    }



    let standoffCode = `
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
          code: standoffCode,
        },
        {
          position: [standoffX, standoffOffsetY - standoffY, 0],
          code: standoffCode,
        },
        {
          position: [-standoffX, standoffOffsetY + standoffY, 0],
          code: standoffCode,
        },
        {
          position: [-standoffX, standoffOffsetY - standoffY, 0],
          code: standoffCode,
        },
      ]
    }

    // Notches cut out of top for USB-C sleeves
    let notchCode = `
    translate([0, 0, ${THICKNESS + (CHANNEL_DEPTH - portZOffset)/2}])
    rotate([-90,0,0])
    hull() {
      translate([${(portWidth - portHeight)/2}, 0, 0])
      cylinder(h=${BORDER + 1}, r=${portHeight/2 + sleaveThickness});
      translate([${-(portWidth - portHeight)/2}, 0, 0])
      cylinder(h=${BORDER + 1}, r=${portHeight/2 + sleaveThickness});
    };`
    printInfo.prints[2] = {
      type: "difference",
      suffix: printInfo.prints[2].suffix,
      components: [
        printInfo.prints[2],
        {
          position: [0, innerLength/2 + WALL_THICKNESS, 0],
          code: notchCode,
        },
        {
          position: [0, -innerLength/2 - WALL_THICKNESS - BORDER - 1, 0],
          code: notchCode,
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
              linear_extrude(height=0.6)
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