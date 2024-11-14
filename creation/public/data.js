
startMidwayDownFinalEdge = false

noncovergenceGuard = 1e4
async function EulerianPath(currentVertex, pathOverride) {
  for (let vertex of verticies) {
    if (!vertex.ogCoords.isValid()) {
      console.error("Bad vertex found. Abandining finding eulerian cycle.", vertex.ogCoords)
      return
    }
    if (vertex.edges.length % 2 == 1) {
      doubleEdges()
      break
    }
  }
  noncovergenceGuard = 1e4
  EulerianHelper(currentVertex, pathOverride)
}

async function EulerianHelper(currentVertex, pathOverride) {
  if (verticies.length <= 1) return
  if (typeof currentVertex == 'number') {
    path = [currentVertex]
    currentVertex = edges[currentVertex].verticies[pathOverride || 0]
  }
  else if (pathOverride) {
    path = pathOverride
  }
  noncovergenceGuard -= 1
  if (noncovergenceGuard < 0) {
    path.length = 0
    console.log("Eulerian path did not converge.")
    console.log("Edge count: " + edges.length)
    return true
  }
  if (path.length >= edges.length) {
    return true
  }
  let edgesCopy = currentVertex.edges.slice()
  shuffle(edgesCopy)

  previousEdge = edges[path.last()]
  p = sortOverride || potential
  function distance(edge) {
    let v0 = otherVertex(previousEdge, currentVertex).coordinates
    let v1 = currentVertex.coordinates
    let v2 = otherVertex(edge, currentVertex).coordinates
  
    let e0 = v1.sub(v0)
    let e1 = v2.sub(v1)
    let angle = e1.angleTo(e0)

    return p(edge, previousEdge, angle)
  }

  edgesCopy.sort((a,b) => distance(b) - distance(a))

  for (let edge of edgesCopy) {
    if (path.includes(edge.index)) continue

    path.push(edge.index);
    let remainingEdges = currentVertex.edges.filter(edge => !path.includes(edge.index))

    if (remainingEdges.length > 0 &&
        !isConnectedToStart(currentVertex)) {
      path.pop()
      continue
    }
    // Avoid a straight twist that is forced in a last pair of edges
    if (remainingEdges.length == 2 &&
        remainingEdges[0].isDupe != remainingEdges[1].isDupe) {
      let v0 = otherVertex(remainingEdges[0], currentVertex).coordinates
      let v1 = currentVertex.coordinates
      let v2 = otherVertex(remainingEdges[1], currentVertex).coordinates
      let e0 = v1.sub(v0)
      let e1 = v2.sub(v1)

      let edgeAngle = Math.abs(e0.angleTo(e1))
      if (edgeAngle < Math.PI/4) {
        path.pop()
        continue
      }
    }

    let nextVertex = otherVertex(edge, currentVertex)
    // await delay(20)
    let finished = await EulerianHelper(nextVertex);
    if (finished) {
      return true
    } else {
      path.pop()
    }
  }
}

function potential(edge, previousEdge, angle) {
  if (edge.isDupe != previousEdge.isDupe) {
    if (epsilonEquals(angle, Math.PI)) {
      angle = Math.PI/5 
    }
    angle = -angle + 1e6
  }
  return -angle
}

function startVertex() {
  if (path.length == 0) {
    console.log("no path!")
    return
  }
  let e0 = edges[path[0]]
  let e1 = edges[path[1]]
  let v = e0.verticies[0]
  if (e1.verticies[0] == v || e1.verticies[1] == v) {
    return e0.verticies[1]
  } else {
    return v
  }
}
function penultimateVertex() {
  return otherVertex(edges[path.last()], startVertex())
}

function remainingEdges(vertex) {
  return 
}

function isConnectedToStart(vertex) {
  let accessibleVertices = [vertex]
  let verticiesToProcess = [vertex]
  let start = startVertex(path)

  for (let i = 0; i < 1000; i++) {
    if (verticiesToProcess.length == 0) break
    let v = verticiesToProcess.pop()
    for (let edge of v.edges) {
      if (path.includes(edge.index)) continue
      let v2 = otherVertex(edge, v)
      if (v2 == start) return true
      if (accessibleVertices.includes(v2)) continue

      accessibleVertices.push(v2)
      verticiesToProcess.push(v2)
    }
  }
  return false
}

function otherVertex(edge, vertex) {
  let otherVertex = edge.verticies[0]
  if (otherVertex.index === vertex.index) {
    otherVertex = edge.verticies[1]
  }
  return otherVertex
}

function generatePixelInfo() {
  if (path.length == 0) {
    console.trace()
    return {}
  }
  let neighbors = []
  let coords = []
  let nextPixel = {}
  let uniqueToDupe = []
  let dupeToUniques = []
  let previousVertex = startVertex(path)
  let v0 = new Vector(NaN,NaN,NaN)

  let centerOffset = [0,0,0]
  if (centerOnExport) {
    centerOffset = center(true)
  }
  let resizeScale = 1
  if (resizeOnExport) {
    resizeScale = resize(true)
  }
  let rectifiedPixelDensity = pixelDensity * resizeScale

  let additionalNeighbors = []
  let vertexAdjacencies = []
  for (let _ of verticies) {
    vertexAdjacencies.push([])
  }

  let lastEdge = edges[path.last()]
  if (startMidwayDownFinalEdge) {
    previousVertex = otherVertex(lastEdge, previousVertex)
    path.unshift(path.last())
  }
  hasSeenLastEdge = false

  let alpha = ledAtVertex ? 0 : rectifiedPixelDensity/2
  for (let edgeIndex of path) {
    let edge = edges[edgeIndex]
    let nextVertex = otherVertex(edge, previousVertex)
    let v1 = previousVertex.ogCoords
    let v2 = nextVertex.ogCoords
    let e1 = v1.sub(v0)
    let e2 = v2.sub(v1)
    let edgeLength = e2.length()
    for (; true; alpha += rectifiedPixelDensity) {
      
      if (alpha > edgeLength - 0.005) {
        alpha -= edgeLength
        if (nextVertex.allowNonIntegerLength) break
        if (ledAtVertex && epsilonEquals(alpha, 0, 0.01)) {
          alpha = 0
          break
        }
        if (!ledAtVertex && epsilonEquals(alpha, rectifiedPixelDensity/2, 0.01)) {
          alpha = rectifiedPixelDensity/2
          break
        }

        console.log(alpha/resizeScale, edgeLength/resizeScale, pixelDensity)
        console.error("Edge length not a integer multiple of pixel density")
        return
      }
      
      if (startMidwayDownFinalEdge && edge == lastEdge) {
        if (!hasSeenLastEdge && alpha < edgeLength/2) continue
        if (hasSeenLastEdge && alpha >= edgeLength/2) continue
      }
      
      if (alpha > edgeLength) {
        console.log(alpha/resizeScale, edgeLength/resizeScale)
        console.error("Edge length not a integer multiple of pixel density")
        return
      }

      let newCoord = v1.lerp(v2, alpha/edgeLength)
      let dupeIndex = -1
      for (let i = 0; i < coords.length; i++) {
        let coord = coords[i]
        if (coord.equals(newCoord)) {
          dupeIndex = i
          break
        }
      }
      if (alpha == 0 && epsilonEquals(e1.dot(e2), -e1.length() * edgeLength)) {
        // Skip LED when doubling back and dupe exists
        if (dupeIndex > -1) {
          // Previous pixel should necessarily be unique
          additionalNeighbors.push([dupeIndex, coords.length-1])
        }
      }
      else if (dupeIndex >= 0) {
        uniqueToDupe.push(dupeIndex)
      } else {
        dupeIndex = coords.length
        uniqueToDupe.push(dupeIndex)
        coords.push(newCoord)
      }

      if (!ledAtVertex && epsilonEquals(rectifiedPixelDensity/2, alpha, 0.01)) {
        vertexAdjacencies[previousVertex.index].push(dupeIndex)
      }
      if (!ledAtVertex && epsilonEquals(edgeLength - rectifiedPixelDensity/2, alpha, 0.01)) {
        vertexAdjacencies[nextVertex.index].push(dupeIndex)
      }
    }
    v0 = previousVertex.ogCoords
    previousVertex = nextVertex
    if (edge == lastEdge) {
      hasSeenLastEdge = true
    }
  }
  if (startMidwayDownFinalEdge) {
    path.shift()
  }

  let SIZE = coords.length
  for (let i = 0; i < SIZE; i++) {
    neighbors.push([])
    dupeToUniques.push([])
  }
  let previousIndex = uniqueToDupe.last()
  for (let i = 0; i < uniqueToDupe.length; i++) {
    let index = uniqueToDupe[i]
    if (!neighbors[index].includes(previousIndex))
      neighbors[index].push(previousIndex)
    if (!neighbors[previousIndex].includes(index))
      neighbors[previousIndex].push(index)
    previousIndex = index

    dupeToUniques[index].push(i)
  }
  for (let [n1, n2] of additionalNeighbors) {
    neighbors[n1].push(n2)
    neighbors[n2].push(n1)
  }
  if (!ledAtVertex) {
    for (let adjacencies of vertexAdjacencies) {
      for (let n1 of adjacencies) {
        for (let n2 of adjacencies) {
          if (n1 == n2) continue
          if (neighbors[n1].includes(n2)) continue
          
          neighbors[n1].push(n2)
          neighbors[n2].push(n1)
        }
      }
    }
  }
  // There are cases where a pixel can be added as its own neighbor (from doubling back).
  // Remove these
  for (let i = 0; i < neighbors.length; i++) {
    neighbors[i] = neighbors[i].filter(n => n != i)
  }

  for (let i = 0; i < coords.length; i++) {
    let local_neighbors = neighbors[i]
    for (let n of local_neighbors) {
      furthest_neighbor = null
      max_dist = 0
      for (let n2 of neighbors[n]) {
        let dist = coords[n2].distanceTo(coords[i])
        if (dist > max_dist) {
          max_dist = dist
          furthest_neighbor = n2
        }
      }
      nextPixel[`(${i}, ${n})`] = furthest_neighbor
    }
  }

  let RAW_SIZE = uniqueToDupe.length
  console.log(RAW_SIZE, SIZE)

  let name = fullProjectName.split("/")[1]
  let info = {
    name,
    SIZE,
    RAW_SIZE,
    isWall,
    coords: coords.map(c => c.toArray()),
    uniqueToDupe,
    dupeToUniques,
    neighbors,
    nextPixel,
    defaultPulseDirection: [0,1,0],
  }

  if (!isWall) {
    minV = 0
    let northPole = []
    let southPole = []
    let threshold = 0.94
    if (name == "helmet") {
      threshold = 0.74
    }
    for (var i = 0; i < coords.length; i++) {
      let val = coords[i][2]
      if (val > threshold) {
        northPole.push(i)
      } else if (val < -threshold) {
        southPole.push(i)
      }
    }
    info.northPole = northPole
    info.southPole = southPole
  }

  switch (name) {
    case "rhombicosidodecahedron":
      info.initialPositions = [105,157,117,24,50,202]
      info.southerlyInitialPositions = [79,113,39,352,12,401]
      info.defaultPulseDirection = [0,0,1]
      break
    case "wall":
      info.initialPositions = [432,123,175,79,155,59]
      break
    case "helmet":
      info.initialPositions = [181,155,279,191,255,12]
      info.southerlyInitialPositions = [4,68,129,36,99,64]
      info.defaultPulseDirection = [0,0,1]
      break
  }

  dataPostProcessingFunction(info)

  // Undo centering and resizing
  for (let vertex of verticies) {
    vertex.ogCoords = vertex.ogCoords
        .scale(1/resizeScale)
        .sub(centerOffset)
  }

  return info
}

function connectPixels(info, i, j) {
  info.neighbors[i].push(j)
  info.neighbors[j].push(i)

  // Assumes connecting deadends and need to define nextPixels appropriately
  let n_i = info.neighbors[i][0]
  let n_j = info.neighbors[j][0]
  info.nextPixel[`(${n_i}, ${i})`] = j
  info.nextPixel[`(${n_j}, ${j})`] = i
  info.nextPixel[`(${i}, ${j})`] = n_j
  info.nextPixel[`(${j}, ${i})`] = n_i
}

function random() {
  let x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}
function shuffle(array) {
  let currentIndex = array.length, temporaryValue, randomIndex
  while (0 !== currentIndex) {
    randomIndex = Math.floor(random() * currentIndex)
    currentIndex -= 1
    temporaryValue = array[currentIndex]
    array[currentIndex] = array[randomIndex]
    array[randomIndex] = temporaryValue
  }
  return array
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Emergency one off manipulation
async function tweakJSON() {
  let name = "diamond"
  const text = await (await fetch(`${name}/${name}.json`)).text()
  let info = JSON.parse(text)
  let coords = info.coords
  for (let coord of coords) {
    coord[1] *= -1
  }
  let maxMag = 0
  for (let coord of coords) {
    maxMag = Math.max(maxMag, magnitude(coord))
  }
  for (let coord of coords) {
    coord[0] /= maxMag
    coord[1] /= maxMag
    coord[2] /= maxMag
  }
  let fileContent = JSON.stringify(info, null, 2)
  let blob = new Blob([fileContent], { type: 'text/plain' })
  let a = document.createElement('a')
  a.download = name + '.json'
  a.href = window.URL.createObjectURL(blob)
  a.textContent = 'Download ready'
  a.style='display:none'
  a.click()
}
// tweakJSON()
