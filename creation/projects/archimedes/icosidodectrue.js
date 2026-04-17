// v1.0.1
module.exports = () => {
  setThinStrip()

  buildArchimedean([
    [PHI/2, 1/PHI/2, 1/2],
    [1, 0, 0],
  ], {
    edgeLength: 12,
  })

  rotateZAll(0.36486382811348295)

  let wireAngle = edges[50].commonPlain().normal.angleTo(DOWN) * 180 / Math.PI
  console.log(wireAngle)
  let d0 = 4
  let d1 = 5.2
  let d2 = 6.4
  let h1 = 8
  let h2 = 15
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
          rotationAngle: 110.9051574478893 / 180 * Math.PI,
          components: [
            printInfo.prints[5],
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
  EulerianPath(0)
}
 