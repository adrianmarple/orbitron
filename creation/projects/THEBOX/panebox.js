
module.exports = async () => {
  exteriorOnly = true
  //PORT_POSITION = "center" //"start"
  //portPartID = "1"
  
  NO_EMBOSSING = true
  PIXEL_DISTANCE = 1
  WALL_THICKNESS = 2
  CHANNEL_WIDTH = 0
  CHANNEL_DEPTH = 40
  INNER_CHANNEL_THICKNESS = null

  MAX_WALL_LENGTH = 200
  THICKNESS = 2.6
  LATCH_TYPE = "hook"

  addPolygon(4, [0,0,0], [40, 74])

  printPostProcessingFunction = printInfo => {
    printInfo.prints[4] = {
      type: "difference",
      suffix: printInfo.prints[4].suffix,
      components: [
        printInfo.prints[4],
        {
          position: [-10,0,0],
          code: `
          cylinder(h=10, d=8);`
        },
      ]
    }

    let port_width = 9.5
    let port_radius = 1.63

    let top_thickness = 13
    let top_border = 3
    let top_width = port_width + 2*top_border+1
    let top_radius = port_radius + top_border
    let port_angle = 60

    let position = [-56,0,0]


    printInfo.prints[0] = {
      type: "difference",
      suffix: printInfo.prints[0].suffix,
      components: [
        {
          type: "union",
          components: [
            {
              type: "union",
              operations: [
                {type: "rotate", vector:[Math.PI,0,0]},
                {type: "translate", position:[0,0,WALL_THICKNESS]},
              ],
              components: [
                printInfo.prints[0],
              ]
            },
            {
              position,
              code: `
              rotate([0,${port_angle},0])
              translate([0,0,${-top_thickness}])
              pillinder(${top_width}, ${top_radius}, ${top_thickness * 2});`
            },
            {
              type: "prefix",
              code: `
              module pillinder(width, radius, height) {
                hull() {
                  translate([width/2 - radius, 0, 0])
                  cylinder(h=height, r=radius, $fn=64);
                  translate([-width/2 + radius, 0, 0])
                  cylinder(h=height, r=radius, $fn=64);
                }
              }`
            }
          ]
        },
        {
          position,
          code: `
          {
            rotate([0,${port_angle},0])
            translate([0,0,${-top_thickness}])
            pillinder(${port_width}, ${port_radius}, ${top_thickness * 2});

            translate([0, 0, -10])
            cube([200, 200, 20], center=true);
          }`
        }
      ]
    }
  }

  EulerianPath(1)
}