var LoadingBall = (function() {

let TAU = Math.PI * 2
let PHI = 2 / (Math.sqrt(5) - 1)
let h = 1 / PHI
let ZERO = {x: 0, y: 0, z: 0}
let SIZE = 3
let Z_OFFSET = 10

let ROTATION_SPEED = 0.1 // In hertz
let EXPANSION_SPEED_RATIO = 3

let icosahedron = getAllFaces(dodecahedralPoints(), icosahedralPoints())
let dodecahedron = getAllFaces(icosahedralPoints(), dodecahedralPoints())


let canvas, ctx
let canvasSize


setInterval(() => {
  canvas = document.getElementById("loading-ball")
  if (!canvas) return

  canvasSize = canvas.width
  ctx = canvas.getContext("2d")
  render()
}, 30)


function render() {
  let angle = TAU * ROTATION_SPEED * Date.now() / 1000
  let cos = Math.cos(angle * EXPANSION_SPEED_RATIO)

  let polyhedron
  if (cos > 0) {
    polyhedron = icosahedron
  } else {
    polyhedron = dodecahedron
  }

  ctx.clearRect(0, 0, canvasSize, canvasSize)
  for (let face of polyhedron) {
    face.rotatedCenter = rotateY(face.center, angle)
  }

  polyhedron.sort((face1, face2) => {
    return face2.rotatedCenter.z - face1.rotatedCenter.z
  })

  for (let face of polyhedron) {
    renderFace(face, angle)
  }
}

function renderFace(face, angle) {
  ctx.beginPath()
  let expansionAngle = angle * EXPANSION_SPEED_RATIO
  let faceCenterAngle = Math.acos(face.center.x, face.center.z)
  if (face.center.z < 0) {
    faceCenterAngle = TAU - faceCenterAngle
  }

  let colorPhase = ((angle - faceCenterAngle) / TAU) % 1
  let sin = Math.sin(expansionAngle)
  let cos = Math.cos(expansionAngle)
  let facePhase = sin * sin
  if (cos > 0) {
    let hue = 300 + 60*(Math.sin(colorPhase * TAU))
    ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${(1 - facePhase)*0.3})`
    ctx.strokeStyle = `hsla(${hue}, 100%, 75%, 1)`
  } else {
    ctx.fillStyle = `rgba(255, 255, 255, ${(1 - facePhase)*0.3})`
    ctx.strokeStyle = "white"
  }
  ctx.lineWidth = 2.5
  // let c
  // if (cos > 0) {
  //   c = 0.7565 * facePhase
  //   ctx.fillStyle = "hsla(" + (colorPhase * 360) + ", 100%, 75%, " + (1 - facePhase) + ")"
  // } else {
  //   c = 0.262 * facePhase
  //   ctx.fillStyle = "rgba(200, 200, 200, " + (1 - facePhase) + ")"
  // }
  // ctx.strokeStyle = "black"

  let c
  if (cos > 0) {
    c = 0.7565 * facePhase
  } else {
    c = 0.262 * facePhase
  }

  let faceAngle = facePhase * TAU / (2 * face.vertices.length)
  let modifiedPoint = add(face.vertices[face.vertices.length - 1], scale(face.center, c))
  modifiedPoint = rotate(modifiedPoint, face.center, faceAngle)
  let firstCoordinate = pointToCoordinates(modifiedPoint, angle)
  ctx.moveTo(firstCoordinate.x, firstCoordinate.y)

  let minX = -1e6
  let maxX = 1e6
  for (let j in face.vertices) {
    modifiedPoint = add(face.vertices[j], scale(face.center, c))
    modifiedPoint = rotate(modifiedPoint, face.center, faceAngle)
    let coordinate = pointToCoordinates(modifiedPoint, angle)
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
  let points = []
  mergePoints(points, plusMinusPoints(normalize({x: 0, y: 1, z: PHI})))
  mergePoints(points, plusMinusPoints(normalize({x: 1, y: PHI, z: 0})))
  mergePoints(points, plusMinusPoints(normalize({x: PHI, y: 0, z: 1})))
  return points
}

function dodecahedralPoints() {
  let points = []
  mergePoints(points, plusMinusPoints(normalize({x: 1, y: 1, z: 1})))
  mergePoints(points, plusMinusPoints(normalize({x: 0, y: 1+h, z: 1-h*h})))
  mergePoints(points, plusMinusPoints(normalize({x: 1+h, y: 1-h*h, z: 0})))
  mergePoints(points, plusMinusPoints(normalize({x: 1-h*h, y: 0, z: 1+h})))
  return points
}

function mergePoints(points, pointsToAdd) {
  for (let i in pointsToAdd) {
    let pointToAdd = pointsToAdd[i]
    let isNewPoint = true
    for (let j in points) {
      let point = points[j]
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
  let faceToVertexSqDist = minSquareDistance(faceCenters[0], vertices)
  let edgeSqDist = minSquareDistance(vertices[0], vertices)
  let edgeDist = Math.sqrt(edgeSqDist)

  let faces = []
  for (let i in faceCenters) {
    let faceCenter = faceCenters[i]
    let face = {
      center: faceCenter,
    }
    let faceVertices = []
    for (let j in vertices) {
      let vertex = vertices[j]
      let sqDist = squareDistance(faceCenter, vertex)
      // Avoid absolute value since sqDist shouldn't be less than faceToVertexSqDist.
      if (sqDist - faceToVertexSqDist < 0.01) {
        faceVertices.push(vertex)
      }
    }

    face.vertices = [faceVertices.shift()]
    let lastVertex = face.vertices[0]
    while (faceVertices.length) {
      if (faceVertices.length == 0) {
        break
      }
      let vertex = faceVertices.shift()
      let sqDist = squareDistance(lastVertex, vertex)
      // Avoid absolute value since sqDist shouldn't be less than edgeSqDist.
      if (sqDist - edgeSqDist < 0.01) {
        face.vertices.push(vertex)
        lastVertex = vertex
      } else {
        faceVertices.push(vertex)
      }
    }

    for (let j in face.vertices) {
      face.vertices[j] = scale(face.vertices[j], 1 / edgeDist)
    }

    faces.push(face)
  }

  return faces
}

function minSquareDistance(point, otherPoints) {
  let bestSqDist = 1e6
  for (let i in otherPoints) {
    let otherPoint = otherPoints[i]
    sqDist = squareDistance(point, otherPoint)
    if (sqDist > 0.01) { // Omit a repeat of point.
      bestSqDist = Math.min(sqDist, bestSqDist)
    }
  }
  return bestSqDist
}


function rotatePoints(points, axis, angle) {
  let rotatedPoints = []
  for (let i in points) {
    rotatedPoints.push(rotate(points[i], axis, angle))
  }
  return rotatedPoints
}

function rotate(point, axis, angle) {
  // Assume axis is of unit length.
  let c = Math.cos(angle)
  let s = Math.sin(angle)
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
  let c = Math.cos(angle)
  let s = Math.sin(angle)
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
  let magnitude = Math.sqrt(squareDistance(point, ZERO))
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
})();