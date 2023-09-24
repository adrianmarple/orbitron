
noncovergenceGuard = 1e4
async function EulerianPath(currentVertex, pathOverride) {
  if (pathOverride) {
    path = pathOverride
  }
  noncovergenceGuard -= 1
  if (noncovergenceGuard < 0) {
    path.length = 0
    noncovergenceGuard = 1e4
    console.error("Eulerian path did not converge.")
    return true
  }
  if (path.length >= edges.length) {
    return true
  }
  let edgesCopy = currentVertex.edges.slice()
  shuffle(edgesCopy)

  previousEdge = edges[path[path.length - 1]]
  function distance(edge) {
    let v0 = otherVertex(previousEdge, currentVertex).coordinates
    let v1 = currentVertex.coordinates
    let v2 = otherVertex(edge, currentVertex).coordinates

    if (!isWall) return d(v0, v2)

    let e0 = delta(v1, v0)
  	let e1 = delta(v2, v1)
    let angle = Math.abs(signedAngle(e1, e0))

    if (edge.isDupe != previousEdge.isDupe) {
      if (epsilonEquals(angle, Math.PI)) {
        angle = Math.PI/5 
      }
      angle = -angle + 1e6
    }
    return -angle
  }

  // Sort by straightest path
  edgesCopy.sort((a,b) => distance(b) - distance(a))

  for (let edge of edgesCopy) {
    if (path.includes(edge.index)) continue;

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
      let e0 = delta(v1, v0)
      let e1 = delta(v2, v1)
      let edgeAngle = Math.abs(signedAngle(e0, e1))
      if (edgeAngle < Math.PI/4) {
        path.pop()
        continue
      }
    }

    let nextVertex = otherVertex(edge, currentVertex)
    // await delay(10)
    let finished = await EulerianPath(nextVertex);
    if (finished) {
      return true
    } else {
      path.pop()
    }
  }
}

function startVertex() {
  if (path.length == 0) console.error("no path!")
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
  return otherVertex(edges[path[path.length - 1]], startVertex())
}

function remainingEdges(vertex) {
  return 
}

function isConnectedToStart(vertex) {
  let accessibleVertices = [vertex]
  let verticiesToProcess = [vertex]
  let start = startVertex(path)

  while (verticiesToProcess.length > 0) {
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
  let neighbors = []
  let coords = []
  let nextPixel = {}
  let uniqueToDupe = []
  let dupeToUniques = []
  let previousVertex = startVertex(path)

  let centerOffset = [0,0,0]
  if (centerOnExport) {
    centerOffset = center(true)
  }
  let resizeScale = 1
  if (resizeOnExport) {
    resizeScale = resize(true)
  }
  pixelDensity *= resizeScale

  for (let edgeIndex of path) {
    let edge = edges[edgeIndex]
    let nextVertex = otherVertex(edge, previousVertex)
    let v1 = previousVertex.ogCoords
    let v2 = nextVertex.ogCoords
    let edgeLength = d(v1,v2)
    for (let alpha = 0; true; alpha += pixelDensity) {
      if (epsilonEquals(edgeLength, alpha, 0.01)) break
      if (alpha > edgeLength) {
        console.error("Edge legnth not a integer multiple of pixel density")
        return
      }
      let newCoord = linearCombo(v2, v1, alpha/edgeLength)
      let dupeIndex = -1
      for (let i = 0; i < coords.length; i++) {
        let coord = coords[i]
        if (vectorEquals(coord, newCoord)) {
          dupeIndex = i
          break
        }
      }
      if (dupeIndex >= 0) {
        uniqueToDupe.push(dupeIndex)
      } else {
        uniqueToDupe.push(coords.length)
        coords.push(newCoord)
      }
    }

    previousVertex = nextVertex
  }

  let SIZE = coords.length
  for (let i = 0; i < SIZE; i++) {
    neighbors.push([])
    dupeToUniques.push([])
  }
  let previousIndex = uniqueToDupe[uniqueToDupe.length - 1]
  for (let i = 0; i < uniqueToDupe.length; i++) {
    let index = uniqueToDupe[i]
    if (!neighbors[index].includes(previousIndex))
      neighbors[index].push(previousIndex)
    if (!neighbors[previousIndex].includes(index))
      neighbors[previousIndex].push(index)
    previousIndex = index

    dupeToUniques[index].push(i)
  }

  for (let i = 0; i < coords.length; i++) {
    let local_neighbors = neighbors[i]
    for (let n of local_neighbors) {
      furthest_neighbor = null
      max_dist = 0
      for (let n2 of neighbors[n]) {
        let dist = d(coords[n2], coords[i])
        if (dist > max_dist) {
          max_dist = dist
          furthest_neighbor = n2
        }
      }
      nextPixel[`(${i}, ${n})`] = furthest_neighbor
    }
  }

  let info = {
    name,
    SIZE,
    RAW_SIZE: uniqueToDupe.length,
    isWall,
    coords,
    uniqueToDupe,
    dupeToUniques,
    neighbors,
    nextPixel,
    defaultPulseDirection: [0,1,0],
  }

  if (name == "rhombicosidodecahedron") {
    let antipodes = []
    for (let i = 0; i < coords.length; i++) {
      let coord = coords[i]
      for (let j = 0; j < coords.length; j++) {
        let coord2 = coords[j]
        if (epsilonEquals(d(coord, scale(coord2, -1)), 0)) {
          antipodes.push(j)
          break
        }
      }
      if (antipodes.length <= i) {
        antipodes.push(-1)
      }
    }
    info.antipodes = antipodes
  }

  if (!isWall) {
    let northPole = []
    let southPole = []
    let threshold = 0.94
    if (name == "helmet") {
      threshold = 0.92
    }
    for (var i = 0; i < coords.length; i++) {
      let val = coords[i][2]
      if (val > threshold) {
        northPole.push(i)
      }
      if (name == "helmet" && val < -0.6) {
        southPole.push(i)
      } else if (val < -threshold) {
        southPole.push(i)
      }
    }
    info.northPole = northPole
    info.northPole = southPole
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

  // Undo centering and resizing
  for (let vertex of verticies) {
    vertex.ogCoords = scale(vertex.ogCoords, 1/resizeScale)
    vertex.ogCoords = delta(vertex.ogCoords, centerOffset)
  }
  pixelDensity /= resizeScale

  return info
}

document.getElementById("download").addEventListener('click', function() {
  let fileContent = JSON.stringify(generatePixelInfo(), null, 2)
  let blob = new Blob([fileContent], { type: 'text/plain' })
  let a = document.createElement('a')
  a.download = name + '.json'
  a.href = window.URL.createObjectURL(blob)
  a.textContent = 'Download ready';
  a.style='display:none';
  a.click()
})
