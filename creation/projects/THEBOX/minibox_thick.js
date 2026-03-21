
module.exports = async () => {
  exteriorOnly = true
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  INNER_CHANNEL_THICKNESS = null
  BORDER = 1.6
  NOTCH_DEPTH = 3

  MAX_WALL_LENGTH = 200
  MAX_SLOT_SEGMENT_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"
  HOOK_OVERHANG = 0.5

  let standoffX = 23/2
  let standoffYDist = 58
  let standoffLength1 = 11.2
  let standoffLength2 = 19.2
  let standoffHeight = 5.6 //4 (without capacitor)

  let innerWidth = 32
  let innerLength = standoffYDist + standoffLength1 + standoffLength2
  addPolygon(4, [0,0,0], [innerWidth, innerLength])

  let portHeight = 3.2
  let portWidth = 9.5
  let portLength = 6.6 + 2

  let sleaveThickness = 1.8
  let sleaveHeight = 1.4

  let pcbThickness = 1.6
  let usbcPCBThickness = 1
  CHANNEL_DEPTH = (standoffHeight + 2*pcbThickness)*2 - usbcPCBThickness
  let standoffRadius = 2.5
  let nubHeight = pcbThickness * 2
  let nubRadius = 1.2

  let position = [-16 - WALL_THICKNESS, 0, -sleaveHeight]

  printPostProcessingFunction = printInfo => {

    for (let index of [3,5]) {
      let standoffLength = index == 3 ? standoffLength1 : standoffLength2
      let standoff = {
        type: "union",
        components: [
          {
            type: "cube",
            position: [
              position[0],
              (CHANNEL_DEPTH - standoffHeight)/2,
              WALL_THICKNESS + (standoffLength + standoffRadius)/2
            ],
            dimensions: [standoffRadius*2, standoffHeight, standoffLength + standoffRadius],
          },
          {
            position: [
              position[0],
              CHANNEL_DEPTH/2 - standoffHeight,
              WALL_THICKNESS + standoffLength
            ],
            code: `
              rotate([90,0,0])
              cylinder(h=${nubHeight}, r=${nubRadius});`,
          },
        ]
      }

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
                position: [standoffX, 0, 0],
                ...standoff,
              },
              {
                position: [-standoffX, 0, 0],
                ...standoff,
              },
              {
                position,
                code: `
                hull() {
                  translate([${(portWidth - portHeight)/2}, 0, 0])
                  cylinder(h=${sleaveHeight}, r=${portHeight/2 + sleaveThickness});
                  translate([${-(portWidth - portHeight)/2}, 0, 0])
                  cylinder(h=${sleaveHeight}, r=${portHeight/2 + sleaveThickness});
                };`
              },
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
        ]
      }
    }


    // holder_thickness = 2
    // dims = [innerWidth + 1, 44, 8]
    // printInfo.prints.push({
    //   type: "union",
    //   suffix: printInfo.prints[2].suffix + "+cardholder",
    //   operations: [{type: "rotate", axis: [0,1,0], angle: Math.PI}],
    //   components: [
    //     printInfo.prints[2],
    //     {
    //       position: [0, -innerLength/2 -0.5 + dims[1]/2, -dims[2]/2],
    //       type: "difference",
    //       components: [
    //         {
    //           type: "cube",
    //           dimensions: dims
    //         },
    //         {
    //           type: "cube",
    //           position: [0, holder_thickness/2, holder_thickness/2],
    //           dimensions: [
    //             dims[0] - 2*holder_thickness,
    //             dims[1] - holder_thickness,
    //             dims[2] - holder_thickness,
    //           ]
    //         },
    //       ]
    //     },
    //   ]
    // })

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
              scale(0.11)
              import("../../lumatron.svg", center=true, dpi=25.4);`
          },
        ]
      }
    }

  }

  EulerianPath(1)
}