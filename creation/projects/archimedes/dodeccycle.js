module.exports = () => {
  setFor3DPrintedCovers()
  PRINT_WALL_HALVES_SEPARATELY = false
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
    let r_in = 8.0
    let r_out = r_in + 1.4
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
          operations: [{
            type: "mirror",
            normal: [0,0,1],
          }],
          components: [
            printInfo.prints[poleInsertionIndex],
            {
              position: [0, 0, 0-h],
              code: `
              cylinder(h=${h}, r=${r_out}, $fn=64);`
            },
          ]
        },
        {
          position: [0, 0, -3],
          code: `
          cylinder(h=${h+10}, r=${r_in}, $fn=64);`
        },
      ]
    }
  }

  splitEdge(0, EDGE_LENGTH/2)
  zeroFoldAllEdges(20)
  edgeCleanup()
  doubleEdges()
  EulerianPath(0)
}
