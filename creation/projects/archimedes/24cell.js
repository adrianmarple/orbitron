module.exports = () => {
  setFor3DPrintedCovers()

  let verticies4D = []

  permutations4 = [
    [0,1,2,3],
    [0,1,3,2],
    [0,2,1,3],
    [0,2,3,1],
    [0,3,2,1],
    [0,3,1,2],
    [1,0,2,3],
    [1,0,3,2],
    [1,2,0,3],
    [1,2,3,0],
    [1,3,2,0],
    [1,3,0,2],
    [2,1,0,3],
    [2,1,3,0],
    [2,0,1,3],
    [2,0,3,1],
    [2,3,0,1],
    [2,3,1,0],
    [3,1,2,0],
    [3,1,0,2],
    [3,2,1,0],
    [3,2,0,1],
    [3,0,2,1],
    [3,0,1,2],
  ]

  // Add all verticies
  for (let permutation of permutations4) {
    verticies4D.push(new Vector4(1,1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(1,-1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(-1,1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(-1,-1,0,0).swizzle(permutation))
  }

  let indexMap = {}
  for (let i = 0; i < verticies4D.length; i++) {
    let v = addVertex(verticies4D[i].project(1.5))
    indexMap[i] = v.index
  }

  // Connect all verticies that are closest non-zero distance
  let minDist = 1e6
  for (let i = 0; i < verticies4D.length; i++) {
    for (let j = i + 1; j < verticies4D.length; j++) {
      let dist = verticies4D[i].distanceTo(verticies4D[j])
      if (!epsilonEquals(dist, 0)) {
        minDist = Math.min(minDist, dist)
      }
    }
  }

  for (let i = 0; i < verticies4D.length; i++) {
    for (let j = i + 1; j < verticies4D.length; j++) {
      if (epsilonEquals(verticies4D[i].distanceTo(verticies4D[j]), minDist)) {
        addEdge(verticies[indexMap[i]], verticies[indexMap[j]])
      }
    }
  }

  // Track vertex and edge antipodes
  for (let v1 of verticies) {
    for (let v2 of verticies) {
      if (v1.ogCoords.negate().equals(v2.ogCoords)) {
        v1.antipode = v2
      }
    }
  }
  for (let e1 of edges) {
    for (let e2 of edges) {
      if (e1.verticies[0].antipode == e2.verticies[0] &&
          e1.verticies[1].antipode == e2.verticies[1]) {
        e1.antipode = e2
      }
      if (e1.verticies[0].antipode == e2.verticies[1] &&
          e1.verticies[1].antipode == e2.verticies[0]) {
        e1.antipode = e2
      }
    }
  }

  // Find Hamiltonian cycle (bias towards less sharp path)
  let hamiltonianEdges = [edges[0].antipode, edges[0]]
  let previousVertex = edges[0].verticies[1]
  let hamiltonianVerticies = [...edges[0].verticies]
  let excludedEdges = []

  let count = 0

  let finalVertex = edges[0].verticies[0].antipode

  function hamiltonianHelper() {
    count += 1
    if (count > 1000000) {
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
        if (hamiltonianVerticies.length == verticies.length/2) {
          hamiltonianEdges.push(edge)
          hamiltonianEdges.push(edge.antipode)
          return true
        } else {
          continue
        }
      }
      hamiltonianEdges.push(edge)
      hamiltonianEdges.push(edge.antipode)
      hamiltonianVerticies.push(nextVertex)
      for (let edge of currentVertex.edges) {
        excludedEdges.push(edge.antipode)
        excludedEdges.push(edge)
      }
      if (hamiltonianHelper()) {
        return true
      }
      for (let _ of currentVertex.edges) {
        excludedEdges.pop()
        excludedEdges.pop()
      }
      hamiltonianVerticies.pop()
      hamiltonianEdges.pop()
      hamiltonianEdges.pop()
    }
    return false
  }
  let hamiltonianEdgeIndiciesRaw = localStorage.getItem("hamiltonianEdgeIndicies")
  if (hamiltonianEdgeIndiciesRaw) {
    hamiltonianEdges = JSON.parse(hamiltonianEdgeIndiciesRaw).map(i => edges[i])
  } else {
    hamiltonianHelper()
    localStorage.setItem("hamiltonianEdgeIndicies",
      JSON.stringify(hamiltonianEdges.map(e => e.index)))
  }


  for (let edge of [...edges].reverse()) {
    if (!hamiltonianEdges.includes(edge)) {
      removeEdge(edge)
    }
  }

  let totalLength = 0
  for (let edge of edges) {
    totalLength += edge.length()
  }
  console.log(200 / totalLength)
  scale(200 / totalLength)

  splitEdge(17, edges[17].length() * 0.3)
  splitEdge(21, edges[21].length() * 0.3)

  splitEdge(23, -edges[23].length() * 0.35)
  splitEdge(22, -edges[22].length() * 0.35)

  zeroFoldAllEdges()
  //TODO doubleEdges()
  EulerianPath(0)
}
