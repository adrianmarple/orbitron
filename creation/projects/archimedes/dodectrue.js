// v1.0.1
module.exports = () => {
  MAX_SLOT_SEGMENT_LENGTH = 30
  CHANNEL_DEPTH = 12
  CHANNEL_WIDTH = 11
  BORDER = 1.4

  buildArchimedean([
    [PHI, 1/PHI, 0],
    [1, 1, 1],
  ], {
    edgeLength: 5,
  })

  let xAngle = verticies[8].ogCoords.angleTo(DOWN)
  rotateXAll(xAngle)

  let wireAngle = edges[20].toVector(9).angleTo(DOWN)

  let centerOffset = 25.16062800551396
  let ec = edges[20].center()
  ec = ec.scale(PIXEL_DISTANCE)
    .add(ec.normalize().scale(CHANNEL_DEPTH/2 + THICKNESS + EXTRA_COVER_THICKNESS))
  ec.y = 0
  let wireOffset = (centerOffset - ec.length()) / Math.sin(wireAngle)
  console.log("Wire offset", wireOffset)

  wireAngle = wireAngle * 180 / Math.PI - 90
  console.log("Wire angle", wireAngle)

  let d0 = 6
  let d1 = 9.5
  let d2 = 12.7
  let h1 = 10
  let h2 = 20
  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {5: 0, "top": 2, "bottom": 3},
      glassROffset: -1,
      highOverhang: 3,
      lowOverhang: 2.5,
    })(printInfo)
    printInfo.prints.push({
      type: "union",
      suffix: "top_with_hole",
      components: [
        {
          type: "difference",
          operations: [
            {type: "rotate", vector: [0, Math.PI, 0]}
          ],
          components: [
            printInfo.prints[2],
            {
              position: [0, wireOffset, -1],
              code: `
              cylinder(h=${5}, d=${d0}, $fn=64);`
            },
          ]
        },
        {
          position: [0, wireOffset, 0],
          code: `
          difference() {
            rotate([${wireAngle},0,0])
            translate([0,0,-1])
            difference() {
              union() {
                cylinder(h=${h2}, d=${d1}, $fn=64);
                cylinder(h=${h1}, d=${d2}, $fn=64);
              }

              cylinder(h=${h2}, d=${d0}, $fn=64);
            }
            
            translate([0,0,-50])
            cube([100,100,100], center=true);
          }`
        },
      ]
    })
  }

  EulerianPath(50)
}
 