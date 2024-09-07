
class Vertex {
  constructor(coordinates) {
    if (isWall && !coordinates.isCoplanar(currentPlain)) {
      console.error("Vertex not coplanar with plain", currentPlain, coordinates)
    }
    this.coordinates = coordinates
    this.ogCoords = coordinates.clone()
    this.plains = [currentPlain]
    this.edges = []
    this.index = verticies.length
  }

  remove() {
    removeVertex(this)
  }
  addPlain(plain) {
    if (this.ogCoords.isCoplanar(plain)) {
      this.plains.push(plain)
    } else {
      console.error("Vertex not coplanar with plain", plain, this.ogCoords)
    }
  }
}

class Edge {
  constructor(vertex1, vertex2) {
    this.index = edges.length
    this.verticies = [vertex1, vertex2]
  }

  delta() {
    return this.verticies[1].ogCoords.sub(this.verticies[0].ogCoords)
  }
  length() {
    return this.delta().length()
  }
  toLine() {
    return new Line(
      this.verticies[0].ogCoords,
      this.delta(),
    )
  }
  
  remove() {
    removeEdge(this)
  }
}

function resolveVertex(vertex) {
  if (typeof(vertex) == "number") {
    return verticies[vertex]
  } else {
    return vertex
  }
}
function resolveEdge(edge) {
  if (typeof(edge) == "number") {
    return edges[edge]
  } else {
    return edge
  }
}

function addVertex(coordinates) {
  if (!coordinates.isVector) {
    coordinates = new Vector(...coordinates)
  }
  if (!coordinates.isValid()) return null

  for (let existingVertex of verticies) {
    if (existingVertex.coordinates.equals(coordinates)) {
      return existingVertex
    }
  }
  let vertex = new Vertex(coordinates)
  verticies.push(vertex)
  return vertex
}

function addEdge(vertex1, vertex2) {
  vertex1 = resolveVertex(vertex1)
  vertex2 = resolveVertex(vertex2)
  if (!vertex1 || !vertex2) return null

  var edgeCenter = vertex1.coordinates.add(vertex2.coordinates).multiplyScalar(.5)
  for (let center of edgeCentersBlacklist) {
    if (vectorEquals(edgeCenter, center)) {
      return null
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
  let edge = new Edge(vertex1, vertex2)
  edges.push(edge)
  vertex1.edges.push(edge)
  vertex2.edges.push(edge)
  return edge
}

function removeVertex(vertex) {
  if (!verticies || !vertex) return
  vertex = resolveVertex(vertex)
  remove(verticies, vertex)
  for (let edge of [...vertex.edges]) {
    removeEdge(edge)
  }
  resetInidices()
}
function removeEdge(edge) {
  if (!edges || edge == undefined || edge == null) return
  edge = resolveEdge(edge)
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

function addSquare(center, edgeLengths) {
  return addPolygon(4, center, edgeLengths)
}
function addDodecagon(center, edgeLengths) {
  return addPolygon(12, center, edgeLengths)
}
function addPolygon(sideCount, center, edgeLengths) {
  if (!center.isVector) {
    center = new Vector(...center)
  }
  if (!edgeLengths) {
    edgeLengths = [1]
  }
  if (typeof edgeLengths == "number") {
    edgeLengths = [edgeLengths]
  }

  let newEdges = []
  let edgeVector = RIGHT
  let point = ZERO
  let points = []
  for (let i = 0; i < sideCount; i++) {
    edgeVector = edgeVector.normalize()
    point = point.addScaledVector(edgeVector, edgeLengths[i%edgeLengths.length])
    points.push(point)
    edgeVector = edgeVector.applyAxisAngle(BACKWARD, Math.PI*2 / sideCount)
  }

  let average = ZERO
  for (let point of points) {
    average = average.add(point)
  }
  average = average.divideScalar(points.length)
  center = center.sub(average)
  let previousVertex = addVertex(points[points.length - 1].add(center))
  for (let point of points) {
    let vertex = addVertex(point.add(center))
    newEdges.push(addEdge(previousVertex, vertex))
    previousVertex = vertex
  }
  return newEdges
}

function extrudePolygon(startingEdge, sideCount, edgeLengths, negate) {
  startingEdge = resolveEdge(startingEdge)
  let newEdges = [startingEdge]
  let vertex = startingEdge.verticies[0]
  let edgeVector = vertex.ogCoords.sub(startingEdge.verticies[1].ogCoords)
  if (!edgeLengths) {
    edgeLengths = [edgeVector.length()]
  }
  if (!epsilonEquals(edgeLengths[0], edgeVector.length())) {
    console.error("First edge length must match extrusion edge.")
    return
  }
  if (negate) {
    edgeVector = edgeVector.negate()
    vertex = startingEdge.verticies[1]
  }
  for (let i = 1; i < sideCount; i++) {
    edgeVector = edgeVector.applyAxisAngle(BACKWARD, Math.PI*2 / sideCount)
    edgeVector = edgeVector.normalize()
    edgeVector = edgeVector.scale(edgeLengths[i%edgeLengths.length])
    newVertex = addVertex(vertex.ogCoords.add(edgeVector))
    newEdges.push(addEdge(vertex, newVertex))
    vertex = newVertex
  }
  return newEdges
}

function evenPermutations(coords) {
  return [
    coords,
    [coords[1], coords[2], coords[0]],
    [coords[2], coords[0], coords[1]],
  ]
}
function permutations(coords) {
  return [
    coords,
    [coords[1], coords[2], coords[0]],
    [coords[2], coords[0], coords[1]],
    [coords[2], coords[1], coords[0]],
    [coords[1], coords[0], coords[2]],
    [coords[0], coords[2], coords[1]],
  ]
}

function addPlusMinusVertex(coords) {
  for (let i0 = -1; i0 <= 1; i0 += 2) {
    for (let i1 = -1; i1 <= 1; i1 += 2) {
      for (let i2 = -1; i2 <= 1; i2 += 2) {
        addVertex(new Vector(i0 * coords[0], i1 * coords[1], i2 * coords[2]));
      }
    }
  }
}

function findEdgeFromCenter(center) {
  for (let edge of edges) {
    var edgeCenter = edge.verticies[0].coordinates
        .add(edge.verticies[1].coordinates)
        .multiplyScalar(0.5)
    if (vectorEquals(edgeCenter, center)) {
      return edge
    }
  }
  return null
}


function addLine(vertex, length, angle) {
  vertex = resolveVertex(vertex)
  let coords = vertex.ogCoords.add(fromMagAngle(length, angle))
  let newVertex = addVertex(coords)
  return addEdge(vertex, newVertex)
}

// Based on Futurologist's answer from https://math.stackexchange.com/questions/2228018/how-to-calculate-the-third-point-if-two-points-and-all-distances-between-the-poi
// Assumes z coordinate is always 0
function addTriangulation(v1, v2, a, b) {
  v1 = resolveVertex(v1)
  v2 = resolveVertex(v2)

  if (!b) b = a
  let A = v1.ogCoords
  let B = v2.ogCoords
  let c = A.distanceTo(B)
  let AtoB = B.sub(A)
  let s = (a+b+c)*(a+b-c)*(a-b+c)*(-a+b+c)
  if (s < 0) {
    console.error("Lengths inconsistent for triangulation", a,b,c)
    return null
  }
  s = Math.sqrt(s) / 4
  x = A.x + (c*c + b*b - a*a)/(2*c*c) * AtoB.x - 2*s*AtoB.y/(c*c)
  y = A.y + (c*c + b*b - a*a)/(2*c*c) * AtoB.y + 2*s*AtoB.x/(c*c)

  v = addVertex(new Vector(x,y,0))
  addEdge(v1,v)
  addEdge(v,v2)

  return v
}
// Assumes z coordinate is always 0
function addSquareulation(v1, v2, a, b) {
  v1 = resolveVertex(v1)
  v2 = resolveVertex(v2)

  let A = v1.ogCoords
  let B = v2.ogCoords
  let AtoB = B.sub(A)
  let c = AtoB.length()
  let b0 = AtoB.divideScalar(c)
  let b1 = FORWARD.cross(b0)
  let x = (c - b) / 2
  let theta = Math.acos(x/a)
  let y = Math.sin(theta) * a
  let C = A.addScaledVector(b0, x)
  C = C.addScaledVector(b1, y)
  let D = B.addScaledVector(b0, -x)
  D = D.addScaledVector(b1, y)

  v3 = addVertex(C)
  v4 = addVertex(D)
  addEdge(v1,v3)
  addEdge(v3,v4)
  addEdge(v4,v2)

  return [v3,v4]
}

function splitEdge(edge, distance) {
  edge = resolveEdge(edge)
  let delta = edge.delta()
  if (distance < 0) {
    distance = delta.length() + distance
  }
  delta = delta.normalize()
  delta = delta.multiplyScalar(distance)
  let coords = edge.verticies[0].ogCoords.add(delta)
  let newVertex = addVertex(coords)
  let v1 = edge.verticies[1]
  v1.edges.splice(v1.edges.indexOf(edge), 1)
  edge.verticies[1] = newVertex
  newVertex.edges.push(edge)
  addEdge(newVertex, v1)
  return newVertex
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
      let e1 = v0.sub(otherVertex(edge1, vertex).ogCoords)
      for (let edge2 of vertex.edges) {
        if (edge1 == edge2) continue
        let e2 = v0.sub(otherVertex(edge2, vertex).ogCoords)
        if (!epsilonEquals(e1.signedAngle(e2), 0)) continue

        if (e2.length() < e1.length()) {
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
  return (a.coordinates.y - b.coordinates.y) * 1000000 + (a.coordinates.x - b.coordinates.x)
}
function integerize(startingThreshold) {
  if (startingThreshold == undefined) {
    startingThreshold = -1e6
  }
  let sortedVerticies = verticies.filter(v => v.ogCoords.y > startingThreshold).sort(vertexOrder)

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
      let angle = v.ogCoords.sub(nCoords).signedAngle(RIGHT)
      let dist = Math.round(v.ogCoords.distanceTo(nCoords))
      let e = addLine(lowerNeighbors[0], dist, angle*180/Math.PI)
      replacement = otherVertex(e, lowerNeighbors[0])
    } else if (lowerNeighbors.length == 2) {
      let n0 = lowerNeighbors[0]
      let n1 = lowerNeighbors[1]
      if (n0.ogCoords.x > n1.ogCoords.x) {
        let t = n0
        n0 = n1
        n1 = t
      }
      let dist0 = Math.round(v.ogCoords.distanceTo(n0.ogCoords))
      let dist1 = Math.round(v.ogCoords.distanceTo(n1.ogCoords))
      let nDist = n0.ogCoords.distanceTo(n1.ogCoords)
      if (dist0 + dist1 < nDist) {
        dist0 += 1
        dist1 += 1
      }
      replacement = addTriangulation(n0, n1, dist1, dist0)
    } else {
      console.error("Topology not suitable for integerization: " + v.index)
      return
    }
    if (!!replacement && replacement != v) {
      removeVertex(replacement)
      v.ogCoords = replacement.ogCoords
      v.coordinates = replacement.coordinates
    }
  }
}

let urlToPixels = {}
async function getPixels() {
  if (urlToPixels[imageUrl]) return urlToPixels[imageUrl]
  fullUrl = "http://localhost:8000/projects/" + imageUrl
  const pixels = await (await fetch(fullUrl)).json()
  urlToPixels[imageUrl] = pixels
  return pixels
}
async function addSquaresFromPixels(src) {
  imageUrl = src || imageUrl
  imageUrl = imageUrl.replace(".png", ".pixels")
  let pixels = await getPixels()

  for (let x = 0; x < pixels.shape[0]; x++) {
    for (let y = 0; y < pixels.shape[1]; y++) {
      let offset = x * pixels.stride[0] + y * pixels.stride[1]
      let r = pixels.data[offset]
      let a = pixels.data[offset + 3]
      if (r < 10 && a > 0) {
        addSquare([x,-y,0])
      }
    }
  }
  center()
}


function addPlain(plain) {
  plain.index = plains.length
  plains.push(plain)
}

function origami(foldPlain) {
  let mirrorPlainOffset = currentPlain.intersection(foldPlain).offset
  let mirrorPlainNormal = currentPlain.normal.orthoProj(foldPlain.normal)

  let newPlain
  let mirrorPlain = null
  let isSplit = mirrorPlainNormal.equals(ZERO)

  if (isSplit) {
    newPlain = currentPlain.clone()
  } else {
    mirrorPlain = new Plain(mirrorPlainOffset, mirrorPlainNormal)
    newPlain = currentPlain.mirror(mirrorPlain)
  }

  addPlain(newPlain)
  currentPlain.folds[newPlain.index] = foldPlain
  newPlain.folds[currentPlain.index] = foldPlain

  // Add new verticies along edges that have been folded
  for (let edge of [...edges]) {
    if (edge.verticies[0].ogCoords.isAbovePlain(foldPlain) !=
        edge.verticies[1].ogCoords.isAbovePlain(foldPlain)) {
      removeEdge(edge)
      let newVertexCoords = foldPlain.intersection(edge.toLine())
      let newVertex = addVertex(newVertexCoords)
      newVertex.allowNonIntegerLength = true
      addEdge(newVertex, edge.verticies[0])
      addEdge(newVertex, edge.verticies[1])
    }
  }
  
  for (let vertex of verticies) {
    if (!vertex.plains.includes(currentPlain)) continue

    if (vertex.ogCoords.isCoplanar(foldPlain)) {
      vertex.plains.push(newPlain)
    }
    else if (vertex.ogCoords.isAbovePlain(foldPlain)) {
      vertex.plains.remove(currentPlain)
      vertex.plains.push(newPlain)
      if (!isSplit) {
        vertex.ogCoords = vertex.ogCoords.mirror(mirrorPlain)
        vertex.coordinates = vertex.ogCoords
      }
    }
  }
  return newPlain
}
