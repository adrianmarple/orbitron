
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

  let innerWidth = 32
  let innerLength = 74
  let endWallBuffer = 4
  innerLength += 2*endWallBuffer
  addPolygon(4, [0,0,0], [innerWidth, innerLength])

  let portHeight = 3.2
  let portWidth = 9.3
  let portZOffset = 5.6
  let portLength = 6.6 + 2

  let topPortKerf = 0.4
  let sleaveThickness = 2

  let piAndPcbThickness =  2.8 // TODO I think this can be made smaller (but remember to increase portZOffset)
  let standoffHeight = 3.8 
  CHANNEL_DEPTH = (standoffHeight + piAndPcbThickness)*2 + portHeight - portZOffset
  let standoffRadius = 2.5
  let nubHeight = piAndPcbThickness
  let nubRadius = 1.33
  let standoffX = 23/2
  let standoffY = 58/2
  let standoffOffsetY = 0

  printPostProcessingFunction = printInfo => {
    let position = [-16 - WALL_THICKNESS, portZOffset/2, WALL_THICKNESS - portLength + endWallBuffer]


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
              },
              {
                type: "cube",
                position: [position[0], 0, endWallBuffer/2 + WALL_THICKNESS],
                dimensions: [innerWidth, CHANNEL_DEPTH, endWallBuffer],
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
    let cylinderH = endWallBuffer + WALL_THICKNESS + BORDER + 0.2
    let notchCode = `
    translate([0, 0, ${THICKNESS + (CHANNEL_DEPTH - portZOffset)/2 + topPortKerf}])
    rotate([-90,0,0])
    hull() {
      translate([${(portWidth - portHeight)/2}, 0, 0])
      cylinder(h=${cylinderH}, r=${portHeight/2 + sleaveThickness});
      translate([${-(portWidth - portHeight)/2}, 0, 0])
      cylinder(h=${cylinderH}, r=${portHeight/2 + sleaveThickness});
    };`
    printInfo.prints[2] = {
      type: "difference",
      suffix: printInfo.prints[2].suffix,
      components: [
        printInfo.prints[2],
        {
          position: [0, innerLength/2 - endWallBuffer - 0.2, 0],
          code: notchCode,
        },
        {
          position: [0, -innerLength/2 + endWallBuffer + 0.2 - cylinderH, 0],
          code: notchCode,
        },
      ]
    }

    holder_thickness = 2
    dims = [innerWidth + 1, 44, 8]
    printInfo.prints.push({
      type: "union",
      suffix: printInfo.prints[2].suffix + "+cardholder",
      operations: [{type: "rotate", axis: [0,1,0], angle: Math.PI}],
      components: [
        printInfo.prints[2],
        {
          position: [0, -innerLength/2 -0.5 + dims[1]/2, -dims[2]/2],
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
    })

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