// v1.0.1
module.exports = () => {
  // PRINT_WALL_HALVES_SEPARATELY = true
  let EDGE_LENGTH = 6

  addPlusMinusVertex([1,1,1])
  for (let permutation of evenPermutations([PHI, 1/PHI, 0])) {
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

  rotateZAll((180 - 116.565)/2 * Math.PI/180)
  rotateYAll(-54 * Math.PI/180)
  rotateXAll(-(180 - 116.565)/2 * Math.PI/180 + Math.PI)

  // Find Hamiltonian cycle (bias towards less sharp path)
  let hamiltonianEdges = [edges[0]]
  let previousVertex = edges[0].verticies[1]
  let hamiltonianVerticies = [...edges[0].verticies]
  let excludedEdges = []

  let count = 0

  let finalVertex = edges[0].verticies[0]

  function hamiltonianHelper() {
    count += 1
    if (count > 10000) {
      return true
    }
    let currentVertex = hamiltonianVerticies[hamiltonianVerticies.length - 1]
    
    let previousEdge = hamiltonianEdges[hamiltonianEdges.length - 1]
    currentVertex.edges.sort((e1, e2) => {
      a1 = previousEdge.toVector(previousVertex).angleTo(e1.toVector(previousVertex))
      a2 = previousEdge.toVector(previousVertex).angleTo(e2.toVector(previousVertex))
      return a1 - a2
    })
    for (let edge of currentVertex.edges) {
      if (excludedEdges.includes(edge)) {
        continue
      }
      let nextVertex = edge.otherVertex(currentVertex)
      if (nextVertex == finalVertex) {
        if (hamiltonianVerticies.length == verticies.length) {
          hamiltonianEdges.push(edge)
          return true
        } else {
          continue
        }
      }
      hamiltonianEdges.push(edge)
      hamiltonianVerticies.push(nextVertex)
      for (let edge of currentVertex.edges) {
        excludedEdges.push(edge)
      }
      if (hamiltonianHelper()) {
        return true
      }
      for (let _ of currentVertex.edges) {
        excludedEdges.pop()
      }
      hamiltonianVerticies.pop()
      hamiltonianEdges.pop()
    }
    return false
  }
  
  hamiltonianHelper()

  for (let edge of [...edges].reverse()) {
    if (!hamiltonianEdges.includes(edge)) {
      removeEdge(edge)
    }
  }


  printPostProcessingFunction = printInfo => {
    let h = 30
    let pipe_r = 8.0

    let sphere_r = 75
    let sphere_offset = verticies[20].ogCoords.length() * PIXEL_DISTANCE - CHANNEL_DEPTH/2 - THICKNESS - EXTRA_COVER_THICKNESS
    console.log(sphere_offset - sphere_r)

    let poleInsertionIndex = -1
    for (let i = 0; i < printInfo.prints.length; i++) {
      if (printInfo.prints[i].suffix == "3b") {
        poleInsertionIndex = i
        break
      }
    }
    if (poleInsertionIndex < 0) {
      return
    }
    printInfo.prints[poleInsertionIndex] = {
      type: "difference",
      suffix: "3b",
      components: [
        {
          type: "union",
          operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
          components: [
            printInfo.prints[poleInsertionIndex],
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
    printInfo.prints[poleInsertionIndex+1] = {
      type: "union",
      suffix: "3t",
      operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
      components: [
        printInfo.prints[poleInsertionIndex+1],
        {
          operations: [{ type: "rotate", vector: [Math.PI,0,0],}],
          code: `
          difference() {
            union() {
              cylinder(h=${sphere_offset - sphere_r}, d=10);
              translate([0,0,${sphere_offset}])
              sphere(r=${sphere_r + 2});
            }

            translate([0,0,${sphere_offset}])
            sphere(r=${sphere_r}, $fn=256);

            difference() {
              translate([0,0,${sphere_offset}])
              cube([${2*sphere_r+8},${2*sphere_r+8},${2*sphere_r+8}], center=true);

              cylinder(h=100, r=15);
            }
          }`
        },
      ]
    }
    cleanForFlip(printInfo.prints[poleInsertionIndex])
    cleanForFlip(printInfo.prints[poleInsertionIndex+1])
  }

  splitEdge(0, EDGE_LENGTH/2)
  zeroFoldAllEdges({linearStartingVertex: verticies.length - 1})
  strongCovers.push({plain: verticies[20].plains[0], isBottom: true})
  edgeCleanup()
  doubleEdges()
  EulerianPath(0)
}
