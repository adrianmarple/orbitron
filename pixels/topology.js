
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
    if (epsilonEquals(d(existingVertex.coordinates, coordinates), 0)) {
      return existingVertex
    }
  }
  let ogCoords = scale(coordinates, 1) // copy
  let vertex = {
    index: verticies.length,
    edges: [],
    coordinates,
    ogCoords,
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


function removeEdge(edge) {
  if (!edges) return
  remove(edges, edge)
  for (let vertex of edge.verticies) {
    remove(vertex.edges, edge)
    if (vertex.edges.length == 0) {
      remove(verticies, vertex)
      for (let i = 0; i < verticies.length; i++) {
        verticies[i].index = i
      }
    }
  }
  for (let i = 0; i < edges.length; i++) {
    edges[i].index = i
  }
}
function remove(array, element)  {
  let index = array.indexOf(element)
  if (index >= 0) {
    array.splice(index, 1)
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
}

async function addSquaresFromPixels(halfTime, skips) {
  // if (!src) src = imageUrl
  let ctx = await getImageContext(imageUrl)
  for (let x = 0; x < ctx.canvas.width; x++) {
    for (let y = 0; y < ctx.canvas.height; y++) {
      let pixel = ctx.getImageData(x, y, 1, 1).data
      if (isFilledPixel(pixel)) {
        addSquare([x,-y,0])
      }
    }
  }

  if (halfTime) {
    for (let x = 0; x < ctx.canvas.width - 1; x += 2) {
      if (skips && skips.x.includes(x)) x += 1
      for (let y = 0; y < ctx.canvas.height; y++) {
        let pixel1 = ctx.getImageData(x, y, 1, 1).data
        let pixel2 = ctx.getImageData(x+1, y, 1, 1).data
        if (isFilledPixel(pixel1) && isFilledPixel(pixel2)) {
          removeEdge(findEdgeFromCenter([x+0.5, -y, 0]))
        }
      }
    }
    for (let y = 0; y < ctx.canvas.width - 1; y += 2) {
      if (skips && skips.y.includes(y)) y += 1
      for (let x = 0; x < ctx.canvas.height; x++) {
        let pixel1 = ctx.getImageData(x, y, 1, 1).data
        let pixel2 = ctx.getImageData(x, y+1, 1, 1).data
        if (isFilledPixel(pixel1) && isFilledPixel(pixel2)) {
          removeEdge(findEdgeFromCenter([x, -(y+0.5), 0]))
        }
      }
    }
  }

  center()
}

function isFilledPixel(pixel) {
  // very dark red component & not transparent
  return pixel[0] < 10 && pixel[3] > 0
}
