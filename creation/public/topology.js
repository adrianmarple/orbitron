
function addSquare(center, edgeLengths) {
  return addPolygon(4, center, edgeLengths)
}
function addDodecagon(center, edgeLengths) {
  return addPolygon(12, center, edgeLengths)
}
function addPolygon(sideCount, center, edgeLengths) {
  if (!edgeLengths) {
    edgeLengths = [1]
  }
  if (typeof edgeLengths == "number") {
    edgeLengths = [edgeLengths]
  }

  let newEdges = []
  let edgeVector = [1,0,0]
  let point = [0,0,0]
  let points = []
  for (let i = 0; i < sideCount; i++) {
    edgeVector = normalize(edgeVector)
    edgeVector = scale(edgeVector, edgeLengths[i%edgeLengths.length]) 
    point = add(point, edgeVector)
    points.push(point)
    edgeVector = rotateZ(edgeVector, Math.PI*2 / sideCount)
  }

  let average = [0,0,0]
  for (let point of points) {
    average = add(average, point)
  }
  average = scale(average, 1.0/points.length)
  center = delta(center, average)
  let previousVertex = addVertex(add(points[points.length - 1], center))
  for (let point of points) {
    let vertex = addVertex(add(point, center))
    newEdges.push(addEdge(previousVertex, vertex))
    previousVertex = vertex
  }
  return newEdges
}

function extrudePolygon(startingEdge, sideCount, edgeLengths, negate) {
  let newEdges = [startingEdge]
  let vertex = startingEdge.verticies[0]
  let edgeVector = delta(vertex.coordinates, startingEdge.verticies[1].coordinates)
  if (!edgeLengths) {
    edgeLengths = [magnitude(edgeVector)]
  }
  if (!epsilonEquals(edgeLengths[0], magnitude(edgeVector))) {
    console.error("First edge length must match extrusion edge.")
    return
  }
  if (negate) {
    edgeVector = scale(edgeVector, -1)
    vertex = startingEdge.verticies[1]
  }
  for (let i = 1; i < sideCount; i++) {
    edgeVector = rotateZ(edgeVector, Math.PI*2 / sideCount)
    edgeVector = normalize(edgeVector)
    edgeVector = scale(edgeVector, edgeLengths[i%edgeLengths.length]) 
    newVertex = addVertex(add(vertex.coordinates, edgeVector))
    newEdges.push(addEdge(vertex, newVertex))
    vertex = newVertex
  }
  return newEdges
}

function addPlusMinusVertex(vertex) {
  for (let i0 = -1; i0 <= 1; i0 += 2) {
    for (let i1 = -1; i1 <= 1; i1 += 2) {
      for (let i2 = -1; i2 <= 1; i2 += 2) {
        addVertex([i0 * vertex[0], i1 * vertex[1], i2 * vertex[2]]);
      }
    }
  }
}
function addVertex(coordinates) {
  for (let existingVertex of verticies) {
    if (vectorEquals(existingVertex.coordinates, coordinates)) {
      return existingVertex
    }
  }
  let ogCoords = scale(coordinates, 1) // copy
  coordinates = scale(coordinates, 1) // copy
  if (!isCoplanar(currentPlain, coordinates)) {
    console.error("Vertex not coplanar with plain", currentPlain, coordinates)
  }
  let vertex = {
    index: verticies.length,
    edges: [],
    coordinates,
    ogCoords,
    plains: [currentPlain],
  }
  verticies.push(vertex)
  return vertex
}

function addEdge(vertex1, vertex2) {
  var edgeCenter = scale(add(vertex1.coordinates, vertex2.coordinates), .5)
  for (let center of edgeCentersBlacklist) {
    if (vectorEquals(edgeCenter, center)) {
      return
    }
  }

  for (let existingEdge of edges) {
    if (existingEdge.verticies[0] == vertex1 && existingEdge.verticies[1] == vertex2) {
      return existingEdge
    }
    if (existingEdge.verticies[1] == vertex1 && existingEdge.verticies[0] == vertex2) {
      return existingEdge
    }
  }
  let edge = {
    index: edges.length,
    verticies: [vertex1, vertex2],
  }
  edges.push(edge)
  vertex1.edges.push(edge)
  vertex2.edges.push(edge)
  return edge
}

function findEdgeFromCenter(center) {
  for (let edge of edges) {
    var edgeCenter = scale(
      add(edge.verticies[0].coordinates,
          edge.verticies[1].coordinates),
      .5)
    if (vectorEquals(edgeCenter, center)) {
      return edge
    }
  }
  return null
}


function addLine(vertex, length, angle) {
  if (typeof vertex == "number") {
    vertex = verticies[vertex]
  }
  let coords = add(vertex.ogCoords, fromMagAngle(length, angle))
  let newVertex = addVertex(coords)
  return addEdge(vertex, newVertex)
}

// Based on Futurologist's answer from https://math.stackexchange.com/questions/2228018/how-to-calculate-the-third-point-if-two-points-and-all-distances-between-the-poi
// Assumes z coordinate is always 0
function addTriangulation(v1, v2, a, b) {
  if (typeof v1 == "number") {
    v1 = verticies[v1]
  }
  if (typeof v2 == "number") {
    v2 = verticies[v2]
  }
  if (!b) b = a
  let A = v1.coordinates
  let B = v2.coordinates
  let c = d(A,B)
  let AtoB = delta(B,A)
  s = Math.sqrt((a+b+c)*(a+b-c)*(a-b+c)*(-a+b+c)) / 4
  x = A[0] + (c*c + b*b - a*a)/(2*c*c) * AtoB[0] - 2*s*AtoB[1]/(c*c)
  y = A[1] + (c*c + b*b - a*a)/(2*c*c) * AtoB[1] + 2*s*AtoB[0]/(c*c)

  v = addVertex([x,y,0])
  addEdge(v1,v)
  addEdge(v,v2)

  return v
}
// Assumes z coordinate is always 0
function addSquareulation(v1, v2, a, b) {
  let A = v1.coordinates
  let B = v2.coordinates
  let AtoB = delta(B,A)
  let c = magnitude(AtoB)
  let b0 = scale(AtoB, 1/c)
  let b1 = cross([0,0,1], b0)
  let x = (c - b) / 2
  let theta = Math.acos(x/a)
  let y = Math.sin(theta) * a
  let C = add(A, scale(b0, x))
  C = add(C, scale(b1, y))
  let D = add(B, scale(b0, -x))
  D = add(D, scale(b1, y))

  v3 = addVertex(C)
  v4 = addVertex(D)
  addEdge(v1,v3)
  addEdge(v3,v4)
  addEdge(v4,v2)

  return [v3,v4]
}

function splitEdge(edge, distance) {
  let delta = edgeDelta(edge)
  if (distance < 0) {
    distance = magnitude(delta) + distance
  }
  delta = normalize(delta)
  delta = scale(delta, distance)
  let coords = add(edge.verticies[0].ogCoords, delta)
  let newVertex = addVertex(coords)
  let v1 = edge.verticies[1]
  v1.edges.splice(v1.edges.indexOf(edge), 1)
  edge.verticies[1] = newVertex
  newVertex.edges.push(edge)
  addEdge(newVertex, v1)
  return newVertex
}


function removeVertex(vertex) {
  if (!verticies) return
  if (typeof vertex == "number") {
    vertex = verticies[vertex]
  }
  remove(verticies, vertex)
  for (let edge of [...vertex.edges]) {
    removeEdge(edge)
  }
  resetInidices()
}
function removeEdge(edge) {
  if (!edges) return
  if (typeof edge == "number") {
    edge = edges[edge]
  }
  remove(edges, edge)
  for (let vertex of edge.verticies) {
    remove(vertex.edges, edge)
    if (vertex.edges.length == 0) {
      remove(verticies, vertex)
    }
  }
  resetInidices()
}
function remove(array, element)  {
  let index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
  }
}

function resetInidices() {
  for (let i = 0; i < verticies.length; i++) {
    verticies[i].index = i
  }
  for (let i = 0; i < edges.length; i++) {
    edges[i].index = i
  }
}

function doubleEdges() {
  for (let edge of edges.slice()) {
    var edgeCopy = {...edge}
    for (let v of edge.verticies) {
      v.edges.push(edgeCopy)
    }
    edgeCopy.index = edges.length
    edgeCopy.isDupe = true
    edges.push(edgeCopy)
  }

  EDGES_DOUBLED = true
}

async function addFromSVG(src) {
  imageUrl = src || imageUrl
  fullUrl = "http://localhost:8000/projects/" + imageUrl
  const text = await (await fetch(fullUrl)).text()
  const svg = new DOMParser().parseFromString(text, "image/svg+xml")
  coords = [0,0,0]
  let previousVertex = null
  for (let path of svg.querySelectorAll("path")) {
    path = path.getAttribute("d")
    for (let match of path.matchAll(/[MLHVlhv][\d\s\.]+/g)) {
      let edgeString = match[0]
      let commandChar = edgeString[0]
      numbers = edgeString.slice(1).split(" ").map(x => parseFloat(x))
      switch (commandChar) {
        case "M":
          coords[0] = numbers[0]
          coords[1] = -numbers[1]
          previousVertex = addVertex(coords)
          break
        case "L":
          coords[0] = numbers[0]
          coords[1] = -numbers[1]
          vert = addVertex(coords)
          addEdge(previousVertex, vert)
          previousVertex = vert
          break
        case "H":
          coords[0] = numbers[0]
          vert = addVertex(coords)
          addEdge(previousVertex, vert)
          previousVertex = vert
          break
        case "V":
          coords[1] = -numbers[0]
          vert = addVertex(coords)
          addEdge(previousVertex, vert)
          previousVertex = vert
          break
      }
    }
  }

  for (let vertex of verticies) {
    let v0 = vertex.ogCoords
    for (let edge1 of vertex.edges) {
      let e1 = delta(v0, otherVertex(edge1, vertex).ogCoords)
      for (let edge2 of vertex.edges) {
        if (edge1 == edge2) continue
        let e2 = delta(v0, otherVertex(edge2, vertex).ogCoords)
        if (!epsilonEquals(signedAngle(e1, e2), 0)) continue

        if (magnitude(e2) < magnitude(e1)) {
          let t = edge1
          edge1 = edge2
          edge2 = t
        }
        vertex1 = otherVertex(edge1, vertex)
        edge2.verticies.push(vertex1)
        vertex1.edges.push(edge2)
        remove(vertex.edges, edge2)
        remove(edge2.verticies, vertex)
      }
    }
  }
}

function vertexOrder(a,b) {
  return (a.coordinates[1] - b.coordinates[1]) * 1000000 + (a.coordinates[0] - b.coordinates[0])
}
function integerize() {
  let sortedVerticies = [...verticies].sort(vertexOrder)

  for (let v of sortedVerticies) {
    let lowerNeighbors = []
    for (let e of v.edges) {
      let v1 = otherVertex(e, v)
      if (sortedVerticies.indexOf(v1) < sortedVerticies.indexOf(v)) {
        lowerNeighbors.push(v1)
      }
    }

    let replacement = null
    if (lowerNeighbors.length == 0) {
      continue
    } else if (lowerNeighbors.length == 1) {
      let nCoords = lowerNeighbors[0].ogCoords
      let angle = signedAngle(delta(v.ogCoords, nCoords), RIGHT)
      let dist = Math.round(d(v.ogCoords, nCoords))
      let e = addLine(lowerNeighbors[0], dist, angle*180/Math.PI)
      replacement = otherVertex(e, lowerNeighbors[0])
    } else if (lowerNeighbors.length == 2) {
      let n0 = lowerNeighbors[0]
      let n1 = lowerNeighbors[1]
      if (n0.ogCoords[0] > n1.ogCoords[0]) {
        let t = n0
        n0 = n1
        n1 = t
      }
      let dist0 = Math.round(d(v.ogCoords, n0.ogCoords))
      let dist1 = Math.round(d(v.ogCoords, n1.ogCoords))
      replacement = addTriangulation(n0, n1, dist1, dist0)
    } else {
      console.error("Topology not suitable for integerization")
      return
    }
    if (replacement != v) {
      removeVertex(replacement)
      v.ogCoords = replacement.ogCoords
      v.coordinates = replacement.coordinates
    }
  }
}

async function addSquaresFromPixels(src) {
  console.log("No longer supported. Use addFromSVG instead.")
  return
  imageUrl = src || imageUrl

  let ctx = await getImageContext(imageUrl)
  for (let x = 0; x < ctx.canvas.width; x++) {
    for (let y = 0; y < ctx.canvas.height; y++) {
      let pixel = ctx.getImageData(x, y, 1, 1).data
      if (isFilledPixel(pixel)) {
        addSquare([x,-y,0])
      }
    }
  }
  center()
}

function isFilledPixel(pixel) {
  // very dark red component & not transparent
  return pixel[0] < 10 && pixel[3] > 0
}


urlToContext = {}
async function getImageContext(src) {
  if (!src) src = imageUrl
  if (!src) return null
  if (urlToContext[src]) return urlToContext[src]

  let img = new Image()
  img.src = "http://localhost:8000/projects/" + src
  console.log(img.src)
  await new Promise(resolve => img.onload = resolve)
  let canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  let ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  try {
    ctx.getImageData(0, 0, canvas.width, canvas.height).data
  } catch (e) {
    console.error(":(")
    return null
  }
  urlToContext[src] = ctx
  return ctx
}


function translateAll(vector) {
  for (let vertex of verticies) {
    vertex.coordinates = add(vertex.coordinates, vector)
  }
}
function center(permanently) {
  let attribute = permanently ? "ogCoords" : "coordinates"

  let mins = [1e6, 1e6, 1e6]
  let maxes = [-1e6, -1e6, -1e6]
  
  for (let vertex of verticies) {
    let coord = vertex[attribute]
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], coord[i])
      maxes[i] = Math.max(maxes[i], coord[i])
    }
  }
  let offset = scale(add(mins, maxes), -0.5)
  for (let vertex of verticies) {
    vertex[attribute] = add(vertex[attribute], offset)
  }
  return offset
}
function resize(permanently) {
  let attribute = permanently ? "ogCoords" : "coordinates"

  let maxMagnitude = 0
  
  for (let vertex of verticies) {
    let mag = magnitude(vertex[attribute])
    maxMagnitude = Math.max(maxMagnitude, mag)
  }
  for (let vertex of verticies) {
    vertex[attribute] = scale(vertex[attribute], 1/maxMagnitude)
  }
  return 1/maxMagnitude
}

function rotateXAll(theta, permanently) {
  rotateAll(rotateX, theta, permanently)
}
function rotateYAll(theta, permanently) {
  rotateAll(rotateY, theta, permanently)
}
function rotateZAll(theta, permanently) {
  rotateAll(rotateZ, theta, permanently)
}

function rotateAll(func, theta, permanently) {
  for (let vertex of verticies) {
    vertex.coordinates = func(vertex.coordinates, theta)
    if (permanently) {
      vertex.ogCoords = func(vertex.ogCoords, theta)
    }
  }
}

function lineFromEdge(edge) {
  return {
    offset: edge.verticies[0].ogCoords,
    direction: delta(edge.verticies[1].ogCoords, edge.verticies[0].ogCoords),
  }
}

function origami(foldPlain) {
  let newPlain = mirrorPlain(foldPlain, currentPlain)
  plains.push(newPlain)
  for (let edge of [...edges]) {
    if (isAbovePlain(foldPlain, edge.verticies[0].ogCoords) !=
        isAbovePlain(foldPlain, edge.verticies[1].ogCoords)) {
      removeEdge(edge)
      let newVertexCoords = intersection(foldPlain, lineFromEdge(edge))
      let newVertex = addVertex(newVertexCoords)
      newVertex.allowNonIntegerLength = true
      addEdge(newVertex, edge.verticies[0])
      addEdge(newVertex, edge.verticies[1])
    }
  }
  for (let vertex of verticies) {
    if (!vertex.plains.includes(currentPlain)) continue
    
    vertex.ogCoords = halfMirror(foldPlain, vertex.ogCoords)
    vertex.coordinates = vertex.ogCoords

    vertex.plains.push(newPlain)
    let newPlains = []
    for (let plain of vertex.plains) {
      if (isCoplanar(plain, vertex.ogCoords)) {
        newPlains.push(plain)
      }
    }
    vertex.plains = newPlains
  }
  return newPlain
}
