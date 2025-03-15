module.exports = () => {
  setFor3DPrintedCovers()
  pixelDensity = 0.5
  cat5FoldWallIndex = 3
  NO_EMBOSSING = true


  printPostProcessingFunction = printInfo => {
    printInfo.prints = [
      printInfo.prints[0],
      printInfo.prints[1].components[0],
      printInfo.prints[4],
      printInfo.prints[5],
    ]
    printInfo.prints[0].suffix = "bottom"
    printInfo.prints[1].suffix = "top"
    printInfo.prints[2].suffix = "square_wall"
    printInfo.prints[3].suffix = "hex_wall"

    h = 44
    printInfo.prints.push({
      type: "difference",
      suffix: "top_with_column",
      components: [
        {
          type: "union",
          operations: [{
            type: "mirror",
            normal: [0,0,1],
          }],
          components: [
            printInfo.prints[1],
            {
              position: [0, 0, 0-h],
              code: `
              cylinder(h=${h}, r=7.5, $fn=64);`
            },
          ]
        },
        {
          position: [0, 0, -3],
          code: `
          cylinder(h=${h+10}, r=6.1, $fn=64);`
        },
      ]
    })
  }

  // TODO
  // + convert to "printPostProcessingFunction"
  // - copy a top cover and add the column alterations (and add 14mm to column height vs pervious alteration)
  // - add and test usb-c port to power core (center with centor of a hexagon)

  isWall = false // To avoid non-coplanar errors
  for (let permutation of permutations([2/3, 1/3, 0])) {
    addPlusMinusVertex(permutation)
  }

  let minDist = 1e6
  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      minDist = Math.min(minDist, verticies[i].ogCoords.distanceTo(verticies[j].ogCoords))
    }
  }
  scale(1/minDist, true)

  for (let i = 0; i < verticies.length; i++) {
    for (let j = i + 1; j < verticies.length; j++) {
      if (epsilonEquals(verticies[i].ogCoords.distanceTo(verticies[j].ogCoords), 1)) {
        addEdge(verticies[i], verticies[j])
      }
    }
  }

  let a = edges[0].verticies[0].ogCoords.angleTo(edges[0].verticies[1].ogCoords)
  let x = verticies[0].ogCoords.length()
  let s = 1 / (Math.tan(a/2) * x)
  let h = s*x / Math.cos(a/2)
  scale(s, true)

  plains = []
  for (let vertex of verticies) {
    vertex.plains = []
    let plain = new Plain(vertex.ogCoords, vertex.ogCoords)
    addPlain(plain)
    vertex.addPlain(plain)
  }
  
  for (let edge of [...edges]) {
    let plain0 = edge.verticies[0].plains[0]
    let plain1 = edge.verticies[1].plains[0]
    let foldNormal = edge.verticies[0].ogCoords.sub(edge.verticies[1].ogCoords)
    let newVertex = splitEdge(edge, edge.length()/2)
    newVertex.ogCoords = newVertex.ogCoords.normalize().scale(h)
    let fold = new Plain(newVertex.ogCoords, foldNormal)
    plain0.folds[plain1.index] = fold
    plain1.folds[plain0.index] = fold
    newVertex.plains = []
    newVertex.addPlain(plain0)
    newVertex.addPlain(plain1)
  }

  for (let vertex of verticies) {
    vertex.coordinates = vertex.ogCoords
  }
  isWall = true

  EulerianPath(1,1)
}