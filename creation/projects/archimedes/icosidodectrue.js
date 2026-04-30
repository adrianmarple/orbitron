// v1.0.1
module.exports = () => {
  setThinStrip()
  MAX_SLOT_SEGMENT_LENGTH = 30

  buildArchimedean([
    [PHI/2, 1/PHI/2, 1/2],
    [1, 0, 0],
  ], {
    edgeLength: 10,
  })

  rotateZAll(0.36486382811348295)

  let wireAngle = edges[50].commonPlain().normal.angleTo(DOWN) * 180 / Math.PI
  console.log("Wire angle", wireAngle)

  let d0 = 6
  let d1 = 9.5
  let d2 = 12.7
  let h1 = 10
  let h2 = 20
  printPostProcessingFunction = printInfo => {
    bracketCapturePostProcessing({
      indicies: {3: 0, 5: 1, "top": 2, "bottom": 3},
      glassROffset: 1,
      highOverhang: 3,
      lowOverhang: 2.5,
    })(printInfo)
    printInfo.prints.push({
      type: "union",
      suffix: "bottom_with_hole",
      components: [
        {
          type: "difference",
          operations: [
            {type: "rotate", vector: [0, Math.PI, 0]}
          ],
          rotationAngle: -110.9051574478893 / 180 * Math.PI,
          components: [
            printInfo.prints[4],
            {
              position: [0, 0, -1],
              code: `
              cylinder(h=${5}, d=${d0}, $fn=64);`
            },
          ]
        },
        {
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

  edgeCleanup()
  doubleEdges()
  EulerianPath(0)

  let polePoint = verticies[80].ogCoords
  polePoint = polePoint.scale(PIXEL_DISTANCE)
    .add(polePoint.normalize().scale(CHANNEL_DEPTH/2 + THICKNESS + EXTRA_COVER_THICKNESS))
  polePoint.y = 0
  console.log("Pole radius", polePoint.length())
}
 