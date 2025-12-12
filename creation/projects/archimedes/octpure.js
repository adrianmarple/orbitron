// SKI
module.exports = () => {
  NO_EMBOSSING = true
  const EDGE_LENGTH = 6

  for (let permutation of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    addPlusMinusVertex(permutation)
  }

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

  // Definitely not generalizible
  let vertex0 = verticies[5]
  let v0 = vertex0.ogCoords
  let faceCenter = getFaceCenter(vertex0, vertex0.edges[3].otherVertex(vertex0))
  let faceH = faceCenter.length() * PIXEL_DISTANCE
  let faceR = faceCenter.sub(v0).length() * PIXEL_DISTANCE

  console.log(faceCenter)

  let captureWall = 2
  let innerR = Math.round(faceR - 16)
  console.log(innerR - 4)
  let slope = faceH / faceR
  let lowR = innerR + captureWall / slope
  let highR = innerR - captureWall / slope
  let slopeAngle = -Math.atan(slope) * 180/Math.PI
  let sectorAngle = 120

  let edge0 = vertex0.edges[3]
  let edge1 = vertex0.nextEdge(edge0)
  let plain0 = Plain.fromPoints(ZERO, edge0.verticies[0].ogCoords, edge0.verticies[1].ogCoords)
  // This offset is arbitrary and I'm not sure what should be done instead
  plain0 = plain0.translate(plain0.normal.scale(-CHANNEL_WIDTH/3/PIXEL_DISTANCE))
  let plain1 = Plain.fromPoints(ZERO, edge1.verticies[0].ogCoords, edge1.verticies[1].ogCoords)
  plain1 = plain1.translate(plain1.normal.scale(CHANNEL_WIDTH/3/PIXEL_DISTANCE))
  facePlain = Plain.fromPoints(vertex0.ogCoords,
    edge0.otherVertex(vertex0).ogCoords,
    edge1.otherVertex(vertex0).ogCoords)

  let wallOrigin = plain0.intersection(plain1).intersection(facePlain)
  let vertexOffset = wallOrigin.sub(v0).scale(PIXEL_DISTANCE)
  vertexOffset.y *= -1
  vertexOffset = vertexOffset.swizzle("yzx")


  rotateZAll(Math.PI * 5/4)
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

  function getFaceCenter(vertex0, nextVertex) {
    let faceVerticies = [vertex0]
    let prevEdge = vertex0.getEdge(nextVertex)
    while (nextVertex != vertex0) {
      faceVerticies.push(nextVertex)
      prevEdge = nextVertex.nextEdge(prevEdge)
      nextVertex = prevEdge.otherVertex(nextVertex)
    }
    let faceCenter = ZERO
    for (let vertex of faceVerticies) {
      faceCenter = faceCenter.add(vertex.ogCoords)
    }
    return faceCenter.scale(1/faceVerticies.length)
  }

  printPostProcessingFunction = printInfo => {
    let h = 30
    let pipe_r = 8.0

    printInfo.prints = [
      printInfo.prints[0],
      printInfo.prints[2],
      printInfo.prints[3],
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
          translate([${vertexOffset.toArray()}])
          rotate([${slopeAngle},-135,0])
          translate([0, ${faceR}, 0])
          rotate([0,0,-90])
          difference() {
            translate([0,0, ${-captureWall}])
            cylinder(h=${2*captureWall}, r1=${lowR}, r2=${highR}, $fn=3);
          
            cylinder(h=${1}, r=${innerR-4}, $fn=3, center=true);

            translate([0,0, ${-captureWall} - 1])
            cylinder(h=100, r=${innerR-7}, $fn=3, center=true);
            
            translate([0,0, ${-captureWall} - 1])
            linear_extrude(100)
            polygon(sectorPoints);
          }`
        },
      ]
    }
    printInfo.prints[1].suffix = "bottom"
    printInfo.prints[2].suffix = "top"
    printInfo.prints[3] = {
      type: "difference",
      suffix: "bottom(with cuff)",
      components: [
        {
          type: "union",
          operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
          components: [
            printInfo.prints[1],
            {
              type: "prefix",
              code: `
              use <SOURCE_FOLDER/scad/pipe.scad>`
            },
            {
              operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
              code: `
              outer_cuff(${pipe_r});`
            },
          ]
        },
        {
          position: [0, 0, -3],
          code: `
          cylinder(h=${h+10}, r=${pipe_r}, $fn=64);`
        },
      ]
    }
  }

  edgeCleanup()
  doubleEdges()
  EulerianPath(0)
}