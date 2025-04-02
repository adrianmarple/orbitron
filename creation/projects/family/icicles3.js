// SKIP
module.exports = () => {
  setFor3DPrintedCovers()

  const topH = 4


  let v0 = addVertex([-3,-topH,0])
  let v1 = addVertex([1,-topH,0])
  let v2 = addVertex([3,-topH,0])
  let v3 = addVertex([-3,0,0])
  let v4 = addVertex([3,0,0])
  addEdge(v0,v3)
  addEdge(v1,v2)
  addEdge(v2,v4)
  addEdge(v3,v4)
 
  // let centerLengths = [4, 5, 6, 7, 8, 9]
  let topLengths = [4, 6, 8, 10, 12]
  let sideLengths = [4, 6, 8, 10, 12, 14, 16, 18]

  let left = []
  for (let i = 0; i < 5; i++) {
    left.push(addVertex([-2 - 6 * i, -topH, 0]))
  }
  // diamonds(left.reverse(), centerLengths, true, null, true)

  // diamonds([v0, v1], centerLengths, true)

  for (let length of topLengths) {
    [v0, v3] = addSquareulation(v0, v3, length, topH)
  }
  v0 = addLine(v0, 3, 180).verticies[1]
  v3 = addLine(v3, 3, 180).verticies[1]
  let base = corner(v0, v3, 4, 4)
  diamonds(base.reverse(), [...sideLengths], false, [FORWARD, UP])

  for (let length of topLengths) {
    [v4, v2] = addSquareulation(v4, v2, length, topH)
  }
  v2 = addLine(v2, 3, 0).verticies[1]
  v4 = addLine(v4, 3, 0).verticies[1]
  base = corner(v2, v4, 4, 4)
  console.log(base)
  diamonds(base.reverse(), [...sideLengths], false, [FORWARD, UP])

  zeroFoldAllEdges()
  center()
  EulerianPath(0)
}

function diamonds(base, lengths, handedness, basis, tapered) {
  if (base.length <= 1) return
  let length = lengths.shift()
  let newBase = []
  for (var i = 0; i < base.length - 1; i++) {
    newBase.push(addTriangulation(base[i+1], base[i], length, length, basis))
  }
  if (lengths.length == 0) return newBase

  let crossDelta = base[1].ogCoords.sub(base[0].ogCoords)

  console.log(tapered)
  if (!handedness || !tapered) {
    if (handedness) {
      let v = addVertex(newBase[newBase.length - 1].ogCoords.add(crossDelta))
      newBase.push(v)
      addEdge(base[base.length - 1], v)
    } else {
      let v = addVertex(newBase[0].ogCoords.sub(crossDelta))
      newBase.unshift(v)
      addEdge(base[0], v)
    }
  }

  diamonds(newBase, lengths, !handedness, basis, tapered)
}

function corner(v0, v1, width, depth) {
  let v0p = addVertex(v0.ogCoords.addScaledVector(FORWARD, width/2))
  addEdge(v0, v0p)
  let v1p = addVertex(v1.ogCoords.addScaledVector(FORWARD, -width/2))
  addEdge(v1, v1p)
  let y = Math.min(v0.ogCoords.y, v0.ogCoords.y) - depth
  v0 = addVertex([v0p.ogCoords.x, y, v0p.ogCoords.z])
  addEdge(v0, v0p)
  v1 = addVertex([v1p.ogCoords.x, y, v1p.ogCoords.z])
  addEdge(v1, v1p)
  return [v0, v1]
}

