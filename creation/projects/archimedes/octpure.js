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
  scale(EDGE_LENGTH)

  rotateZAll(Math.PI * 5/4)

  printPostProcessingFunction = printInfo => {
    let h = 30
    let pipe_r = 8.0
    
    printInfo.prints = [
      printInfo.prints[0],
      printInfo.prints[2],
      printInfo.prints[3],
    ]
    console.log(printInfo.prints)
    printInfo.prints[0].suffix = "wall"
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