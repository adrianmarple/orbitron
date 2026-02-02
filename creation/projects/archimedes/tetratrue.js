// SKI
module.exports = () => {
  NO_EMBOSSING = true
  const EDGE_LENGTH = 10

  addVertex([1,1,1])
  addVertex([-1,1,-1])
  addVertex([-1,-1,1])
  addVertex([1,-1,-1])

  let minDist = 1e6
  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      minDist = Math.min(minDist, verticies[i].ogCoords.distanceTo(verticies[j].ogCoords))
    }
  }
  scale(1/minDist)

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(verticies[i].ogCoords.distanceTo(verticies[j].ogCoords), 1)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }

  scale(EDGE_LENGTH)


  for (let vertex of verticies) {
    vertex.plains = []
  }
  for (let edge of edges) {
    let v0 = edge.verticies[0]
    let v1 = edge.verticies[1]
    let center = v0.ogCoords.add(v1.ogCoords).scale(0.5)
    let plain = new Plain(center, center)
    v0.addPlain(plain)
    v1.addPlain(plain)
  }

  rotateXAll(Math.PI)


  printPostProcessingFunction = printInfo => {
    let h = 30
    let pipe_r = 8.0

    let vertex = verticies[0]
    let edge0 = vertex.edges[0]
    let edge1 = vertex.nextEdge(edge0)
    let vertex0 = edge0.otherVertex(vertex)
    let vertex1 = edge1.otherVertex(vertex)
    let v = vertex.ogCoords
    let v0 = vertex0.ogCoords
    let v1 = vertex1.ogCoords

    let wallAngle = v.cross(edge0.toVector(vertex)).normalize().angleTo(
      v.cross(edge1.toVector(vertex)).normalize())



    let plain0 = Plain.fromPoints(ZERO, v, v0)
    plain0 = plain0.translate(plain0.normal.scale(-CHANNEL_WIDTH/2/PIXEL_DISTANCE))
    let plain1 = Plain.fromPoints(ZERO, v, v1)
    plain1 = plain1.translate(plain1.normal.scale(CHANNEL_WIDTH/2/PIXEL_DISTANCE))
    facePlain = Plain.fromPoints(v, v0, v1)
    let faceCenter = facePlain.offset

    let wallOrigin = plain0.intersection(plain1).intersection(facePlain)
    let dotCheck = wallOrigin.sub(v).normalize().dot(faceCenter.sub(v).normalize())
    if (!epsilonEquals(dotCheck, 1)) {
      console.log("Face center, vertex, and wallOrigin not colinear", dotCheck, faceCenter, v, wallOrigin)
    }
    let vertexOffset = wallOrigin.sub(v).scale(PIXEL_DISTANCE)
    let y = vertexOffset.dot(v.normalize())
    let xz = vertexOffset.orthoProj(v).length()
    let localOffset = [-xz * Math.cos(wallAngle/2), y, -xz * Math.sin(wallAngle/2)]
    vertexOffset = vertexOffset.swizzle("yzx")

    let faceH = faceCenter.length() * PIXEL_DISTANCE
    let faceR = faceCenter.sub(v).length() * PIXEL_DISTANCE
    // Not sure how to find this programmatically. Faster to just manually binary search for now
    let trueR = faceCenter.sub(wallOrigin).length() * PIXEL_DISTANCE + 15.12

    let innerR = Math.round(trueR - 6)
    let glassR = innerR - 4
    let glassT = 1.5
    let captureWall = glassT/2 + 1.5
    console.log(`Polygon width ${glassR * 2}`)
    let slope = faceH / faceR
    let lowR = innerR + captureWall / slope
    let highR = innerR - captureWall / slope
    let slopeAngle = -Math.atan(slope) * 180/Math.PI
    let sectorAngle = 120

    let highOverhang = 6
    let lowOverhang = 4.8

    function bracketCode(open) {
      return `
          sectorPoints = concat([[0, 0]],
              [for(a = [${sectorAngle/2} : 10 : 360 - ${sectorAngle/2}]) 
                  [100 * cos(a), 100 * sin(a)]
              ]
          );
          //translate([${localOffset}])
          rotate([${slopeAngle},-90-${wallAngle/2*180/Math.PI},0])
          translate([0, ${trueR}, 0])
          rotate([0,0,-90])
          difference() {
            translate([0,0, ${-captureWall}])
            cylinder(h=${2*captureWall}, r1=${lowR}, r2=${highR}, $fn=3);
          
            cylinder(h=${glassT}, r=${glassR+0.5}, $fn=3, center=true);
            if (${open}) {
              translate([0,0, ${-captureWall}])
              cylinder(h=${captureWall}, r=${glassR+0.5}, $fn=3);
            }

            cylinder(h=100, r=${glassR - lowOverhang}, $fn=3);
            translate([0,0, ${-captureWall} - 1])
            cylinder(h=${captureWall} + 1, r=${glassR - highOverhang}, $fn=3);
            
            translate([0,0, ${-captureWall} - 1])
            linear_extrude(100)
            polygon(sectorPoints);
          }`
    }

    printInfo.prints = [
      printInfo.prints[0],
      printInfo.prints[2],
      printInfo.prints[3],
      printInfo.prints[2],
      {
        type: "union",
        suffix: "wall_open",
        components: [
          printInfo.prints[0],
          {
            code: bracketCode(true)
          },
        ]
      }
    ]
    printInfo.prints[0] = {
      type: "union",
      suffix: "wall",
      components: [
        printInfo.prints[0],
        {
          code: `
          sectorPoints = concat([[0, 0]],
              [for(a = [${sectorAngle/2} : 10 : 360 - ${sectorAngle/2}]) 
                  [100 * cos(a), 100 * sin(a)]
              ]
          );
          //translate([${localOffset}])
          rotate([${slopeAngle},-90-${wallAngle/2*180/Math.PI},0])
          translate([0, ${trueR}, 0])
          rotate([0,0,-90])
          difference() {
            translate([0,0, ${-captureWall}])
            cylinder(h=${2*captureWall}, r1=${lowR}, r2=${highR}, $fn=3);
          
            cylinder(h=${glassT}, r=${glassR+0.5}, $fn=3, center=true);

            cylinder(h=100, r=${glassR - lowOverhang}, $fn=3);
            translate([0,0, ${-captureWall} - 1])
            cylinder(h=${captureWall} + 1, r=${glassR - highOverhang}, $fn=3);
            
            translate([0,0, ${-captureWall} - 1])
            linear_extrude(100)
            polygon(sectorPoints);
          }`
        },
      ]
    }
    printInfo.prints[0].suffix = "wall"
    printInfo.prints[1].suffix = "bottom"
    printInfo.prints[2].suffix = "top"
    printInfo.prints[3] = {
      type: "difference",
      suffix: "bottom_with_hole",
      components: [
        printInfo.prints[1],
        {
          position: [0, 0, -1],
          code: `
          cylinder(h=${5}, r=${5.2}, $fn=64);`
        },
      ]
    }
    // printInfo.prints[5] = {
    //   suffix: "stencil",
    //   code: `
    //   cylinder(h=1, r=${glassR}, $fn=3, center=true);`
    // }
  }

  edgeCleanup()
  EulerianPath(0)
}