// v1.0.1
module.exports = async () => {
  await addFromSVG("organic/snake2.svg")
  const parallelPairs = [
    [30,9],
    [32,7],
  ]
  integerizeCustom(parallelPairs)


  const spineWidths = [
    "skip",
    "skip", //[1.7,2.3],
    [2.7,3.3],
    [2.6,3.4],
    [2.8,3.2],
    [3.1,3.9],
    [3,4],
    [3,4],
    [3,4],
    [3,5],
    [3.4,4.6],
    [3.6,4.4],
    [4.5,3.5],
    [4.5,3.5],
    [4.6,3.4],
    [3.2,2.8],
  ]
  const n = spineWidths.length
  const start = verticies[20]
  const sides = start.edges.map(startEdge => {
    const side = []
    let prev = start
    let curr = startEdge.otherVertex(start)
    for (let i = 0; i < n; i++) {
      side.push(curr)
      const nextEdge = curr.edges.find(e => e.otherVertex(curr) !== prev)
      if (!nextEdge) break
      prev = curr
      curr = nextEdge.otherVertex(curr)
    }
    return side
  })

  const jogZ = Math.sqrt(3)
  // Shift selected vertices by jogZ
  for (const idx of [31, 32, 8, 9]) {
    verticies[idx].ogCoords = verticies[idx].ogCoords.add(new Vector(0, 0, -jogZ))
  }
  function addJog(edge, intersectionPlain) {
    let A = edge.verticies[0]
    let a = A.ogCoords
    let B = edge.verticies[1]
    let b = B.ogCoords
    if (a.z != 0) {
      let T = A
      let t = a
      A = B
      a = b
      B = T
      b = t
    }
    const deltaFlat = b.sub(a)
    deltaFlat.z = 0
    const dist = deltaFlat.length()

    let offset = dist/2
    if (intersectionPlain) {
      const intersection = intersectionPlain.intersection(new Line(a, deltaFlat))
      console.log(intersection)
      offset = a.sub(intersection).length()
    }
    const dirFlat = deltaFlat.normalize()
    const mid1 = a.add(dirFlat.scale(offset))
    const mid2 = b.sub(dirFlat.scale(dist - offset - 1))
    const M1 = addVertex(mid1)
    const M2 = addVertex(mid2)

    removeEdge(edge)
    addEdge(A, M1)
    addEdge(M1, M2)
    addEdge(M2, B)

    return new Plain(mid1, mid1.sub(mid2))
  }
  for (const [left, right] of parallelPairs.map(([l,r]) => [edges[l], edges[r]])) {
    const intersectionPlain = addJog(left)
    addJog(right, intersectionPlain)
  }

  for (let i = 0; i < n; i++) {
    if (spineWidths[i] == "skip") continue
    addTriangulation(sides[0][i], sides[1][i], ...spineWidths[i])
  }

  zeroFoldAllEdges()
  EulerianPath(0)
}

function integerizeCustom(parallelPairs = []) {
  let sortedVerticies = verticies.filter(v => v.ogCoords.y > -1e6).sort(vertexOrder)

  const parallelMap = {}
  for (let [a, b] of parallelPairs) {
    parallelMap[a] = b
    parallelMap[b] = a
  }
  console.log(parallelMap)
  const computedAngles = {}

  for (let v of sortedVerticies) {
    let lowerNeighbors = []
    for (let e of v.edges) {
      let v1 = e.otherVertex(v)
      if (sortedVerticies.indexOf(v1) < sortedVerticies.indexOf(v)) {
        lowerNeighbors.push(v1)
      }
    }

    let replacement = null
    if (lowerNeighbors.length == 0) {
      continue
    } else if (lowerNeighbors.length == 1) {
      let nCoords = lowerNeighbors[0].ogCoords
      let angle = v.ogCoords.sub(nCoords).signedAngle(RIGHT)

      const edgeIdx = v.edges.find(e => e.otherVertex(v) === lowerNeighbors[0]).index
      const partner = parallelMap[edgeIdx]
      if (partner !== undefined && partner in computedAngles) {
        angle = computedAngles[partner]
      }
      computedAngles[edgeIdx] = angle

      const dirVec = fromMagAngle(1, angle * 180 / Math.PI)
      const delta = v.ogCoords.sub(nCoords)
      let dist = Math.round(delta.dot(dirVec))
      let e = addLine(lowerNeighbors[0], dist, angle * 180 / Math.PI)
      replacement = e.otherVertex(lowerNeighbors[0])
    } else if (lowerNeighbors.length == 2) {
      let n0 = lowerNeighbors[0]
      let n1 = lowerNeighbors[1]
      if (n0.ogCoords.x > n1.ogCoords.x) { let t = n0; n0 = n1; n1 = t }
      let dist0 = Math.round(v.ogCoords.distanceTo(n0.ogCoords))
      let dist1 = Math.round(v.ogCoords.distanceTo(n1.ogCoords))
      let nDist = n0.ogCoords.distanceTo(n1.ogCoords)
      if (dist0 + dist1 < nDist) { dist0 += 1; dist1 += 1 }
      replacement = addTriangulation(n0, n1, dist1, dist0)
    } else {
      console.error("Topology not suitable for integerization: " + v.index)
      return
    }

    if (!!replacement && replacement != v) {
      removeVertex(replacement)
      v.ogCoords = replacement.ogCoords
    }
  }
}
