
var TAU = Math.PI * 2
var PHI = 2 / (Math.sqrt(5) - 1)
var h = 1 / PHI
var ZERO = {x: 0, y: 0, z: 0}
var Y_AXIS = {x: 0, y: 1, z: 0}
var SIZE = 3
var Z_OFFSET = 10

var ROTATION_SPEED = 0.08 // In hertz
var EXPANSION_SPEED_RATIO = 3

var cyclePosition = 0

var points = []

var icosahedron = getAllFaces(dodecahedralPoints(), icosahedralPoints())
var dodecahedron = getAllFaces(icosahedralPoints(), dodecahedralPoints())


var canvas, ctx
var canvasSize


setInterval(() => {
  canvas = document.getElementById("loading-ball")
  if (!canvas) return

  canvasSize = canvas.width
  ctx = canvas.getContext("2d")
  render()
}, 30)

function renderPoints(points) {
  ctx.clearRect(0, 0, canvasSize, canvasSize)
  for (var i in points) {
    var location = project(points[i])
    ctx.beginPath()
    ctx.arc(location.x, location.y, 2, 0, 2*Math.PI)
    ctx.stroke()
  }
}

function render() {
  var angle = TAU * ROTATION_SPEED * Date.now() / 1000
  var cos = Math.cos(angle * EXPANSION_SPEED_RATIO)

  var polyhedron
  if (cos > 0) {
    polyhedron = icosahedron
  } else {
    polyhedron = dodecahedron
  }

  ctx.clearRect(0, 0, canvasSize, canvasSize)
  for (var i in polyhedron) {
    polyhedron[i].rotatedCenter = rotateY(polyhedron[i].center, angle)
  }

  polyhedron.sort((face1, face2) => {
    return face2.rotatedCenter.z - face1.rotatedCenter.z
  })

  for (var i in polyhedron) {
    renderFace(polyhedron[i], angle)
  }
}

function renderFace(face, angle) {
  ctx.beginPath()
  var expansionAngle = angle * EXPANSION_SPEED_RATIO
  var faceCenterAngle = Math.acos(face.center.x, face.center.z)
  if (face.center.z < 0) {
    faceCenterAngle = TAU - faceCenterAngle
  }

  // var colorPhase = ((1.123 * angle - faceCenterAngle) / TAU) % 1
  var colorPhase = ((angle - faceCenterAngle) / TAU) % 1
  var sin = Math.sin(expansionAngle)
  var cos = Math.cos(expansionAngle)
  var facePhase = sin * sin
  if (cos > 0) {
    var c = 0.7565 * facePhase
    ctx.fillStyle = "hsla(" + (colorPhase * 360) + ", 100%, 75%, " + (1 - facePhase) + ")"
  } else {
    var c = 0.262 * facePhase
    ctx.fillStyle = "rgba(200, 200, 200, " + (1 - facePhase) + ")"
  }
  var faceAngle = facePhase * TAU / (2 * face.vertices.length)
  ctx.strokeStyle = "black"

  var modifiedPoint = add(face.vertices[face.vertices.length - 1], scale(face.center, c))
  modifiedPoint = rotate(modifiedPoint, face.center, faceAngle)
  var firstCoordinate = pointToCoordinates(modifiedPoint, angle)
  ctx.moveTo(firstCoordinate.x, firstCoordinate.y)

  var minX = -1e6
  var maxX = 1e6
  for (var j in face.vertices) {
    modifiedPoint = add(face.vertices[j], scale(face.center, c))
    modifiedPoint = rotate(modifiedPoint, face.center, faceAngle)
    var coordinate = pointToCoordinates(modifiedPoint, angle)
    ctx.lineTo(coordinate.x, coordinate.y)
    minX = Math.min(minX, coordinate.x)
    maxX = Math.min(maxX, coordinate.x)
  }
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}
function pointToCoordinates(point, angle) {
  return project(rotateY(point, angle))
}


function icosahedralPoints() {
  var points = []
  mergePoints(points, plusMinusPoints(normalize({x: 0, y: 1, z: PHI})))
  mergePoints(points, plusMinusPoints(normalize({x: 1, y: PHI, z: 0})))
  mergePoints(points, plusMinusPoints(normalize({x: PHI, y: 0, z: 1})))
  return points
}

function dodecahedralPoints() {
  var points = []
  mergePoints(points, plusMinusPoints(normalize({x: 1, y: 1, z: 1})))
  mergePoints(points, plusMinusPoints(normalize({x: 0, y: 1+h, z: 1-h*h})))
  mergePoints(points, plusMinusPoints(normalize({x: 1+h, y: 1-h*h, z: 0})))
  mergePoints(points, plusMinusPoints(normalize({x: 1-h*h, y: 0, z: 1+h})))
  return points
}

function mergePoints(points, pointsToAdd) {
  for (var i in pointsToAdd) {
    var pointToAdd = pointsToAdd[i]
    var isNewPoint = true
    for (var j in points) {
      var point = points[j]
      if (squareDistance(point, pointToAdd) < 0.1) {
        isNewPoint = false
        break
      }
    }
    if (isNewPoint) {
      points.push(pointToAdd)
    }
  }
}

function plusMinusPoints(point) {
  return [
    {x: point.x, y: point.y, z: point.z},
    {x: -point.x, y: point.y, z: point.z},
    {x: point.x, y: -point.y, z: point.z},
    {x: -point.x, y: -point.y, z: point.z},
    {x: point.x, y: point.y, z: -point.z},
    {x: -point.x, y: point.y, z: -point.z},
    {x: point.x, y: -point.y, z: -point.z},
    {x: -point.x, y: -point.y, z: -point.z},
  ]
}

function getAllFaces(faceCenters, vertices) {
  var faceToVertexSqDist = minSquareDistance(faceCenters[0], vertices)
  var edgeSqDist = minSquareDistance(vertices[0], vertices)
  var edgeDist = Math.sqrt(edgeSqDist)

  var faces = []
  for (var i in faceCenters) {
    var faceCenter = faceCenters[i]
    var face = {
      center: faceCenter,
    }
    var faceVertices = []
    for (var j in vertices) {
      var vertex = vertices[j]
      var sqDist = squareDistance(faceCenter, vertex)
      // Avoid absolute value since sqDist shouldn't be less than faceToVertexSqDist.
      if (sqDist - faceToVertexSqDist < 0.01) {
        faceVertices.push(vertex)
      }
    }

    face.vertices = [faceVertices.shift()]
    var lastVertex = face.vertices[0]
    while (faceVertices.length) {
      if (faceVertices.length == 0) {
        break
      }
      var vertex = faceVertices.shift()
      var sqDist = squareDistance(lastVertex, vertex)
      // Avoid absolute value since sqDist shouldn't be less than edgeSqDist.
      if (sqDist - edgeSqDist < 0.01) {
        face.vertices.push(vertex)
        lastVertex = vertex
      } else {
        faceVertices.push(vertex)
      }
    }

    for (var j in face.vertices) {
      face.vertices[j] = scale(face.vertices[j], 1 / edgeDist)
    }

    faces.push(face)
  }

  return faces
}

function minSquareDistance(point, otherPoints) {
  var bestSqDist = 1e6
  for (var i in otherPoints) {
    var otherPoint = otherPoints[i]
    sqDist = squareDistance(point, otherPoint)
    if (sqDist > 0.01) { // Omit a repeat of point.
      bestSqDist = Math.min(sqDist, bestSqDist)
    }
  }
  return bestSqDist
}


function rotatePoints(points, axis, angle) {
  var rotatedPoints = []
  for (var i in points) {
    rotatedPoints.push(rotate(points[i], axis, angle))
  }
  return rotatedPoints
}

function rotate(point, axis, angle) {
  // Assume axis is of unit length.
  var c = Math.cos(angle)
  var s = Math.sin(angle)
  return {
    x: (        c + axis.x*axis.x*(1 - c)) * point.x +
       ( axis.z*s + axis.x*axis.y*(1 - c)) * point.y +
       (-axis.y*s + axis.x*axis.z*(1 - c)) * point.z,
    y: (        c + axis.y*axis.y*(1 - c)) * point.y +
       ( axis.x*s + axis.y*axis.z*(1 - c)) * point.z +
       (-axis.z*s + axis.y*axis.x*(1 - c)) * point.x,
    z: (        c + axis.z*axis.z*(1 - c)) * point.z +
       ( axis.y*s + axis.z*axis.x*(1 - c)) * point.x +
       (-axis.x*s + axis.z*axis.y*(1 - c)) * point.y,
  }
}
function rotateY(point, angle) {
  var c = Math.cos(angle)
  var s = Math.sin(angle)
  return {
    x: c * point.x - s * point.z,
    y: point.y,
    z: s * point.x + c * point.z,
  }
}

function scale(p, c) {
  return {
    x: p.x * c,
    y: p.y * c,
    z: p.z * c,
  }
}

function add(p1, p2) {
  return {
    x: p1.x + p2.x,
    y: p1.y + p2.y,
    z: p1.z + p2.z,
  }
}

function project(point) {
  return {
    x: canvasSize * (0.5 + SIZE * point.x / (point.z + Z_OFFSET)),
    y: canvasSize * (0.5 + SIZE * point.y / (point.z + Z_OFFSET)),
  }
}

function normalize(point) {
  var magnitude = Math.sqrt(squareDistance(point, ZERO))
  return {
    x: point.x / magnitude,
    y: point.y / magnitude,
    z: point.z / magnitude,
  }
}

function squareDistance(p1, p2) {
  return (p1.x - p2.x) * (p1.x - p2.x) +
         (p1.y - p2.y) * (p1.y - p2.y) +
         (p1.z - p2.z) * (p1.z - p2.z)
}
