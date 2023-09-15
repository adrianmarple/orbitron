
function epsilonEquals(a, b, epsilon=0.1) {
  return a - b < epsilon && b - a < epsilon
}
function vectorEquals(v1, v2, epsilon=0.1) {
  return epsilonEquals(d(v1,v2), 0, epsilon)
}


function d(v1, v2) {
  let difference = delta(v1, v2);
  return Math.sqrt(difference[0] * difference[0] +
                   difference[1] * difference[1] +
                   difference[2] * difference[2])
}
function add(v1,v2) {
  return [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]]
}
function delta(v1, v2) {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]]
}

function project(v, scale) {
  const SCALE = 800 * scale
  let z = v[2] * scale + 15
  return [500 + v[0] * SCALE / z, 500 - v[1] * SCALE / z]
}

function translateAll(vector) {
  for (let vertex of verticies) {
    vertex.coordinates = add(vertex.coordinates, vector)
  }
}

function center(permanently) {
  let mins = [1e6, 1e6, 1e6]
  let maxes = [-1e6, -1e6, -1e6]
  
  for (let vertex of verticies) {
    let coord = vertex.coordinates
    for (let i = 0; i < 3; i++) {
      mins[i] = Math.min(mins[i], coord[i])
      maxes[i] = Math.max(maxes[i], coord[i])
    }
  }
  console.log(mins, maxes, scale(add(mins, maxes), -0.5))

  translateAll(scale(add(mins, maxes), -0.5))

  if (permanently) {
    for (let vertex of verticies) {
      vertex.ogCoords = scale(vertex.coordinates, 1)
    }
  }
}

function rotateXAll(theta) {
  for (let vertex of verticies) {
    vertex.coordinates = rotateX(vertex.coordinates, theta)
  }
}
function rotateYAll(theta) {
  for (let vertex of verticies) {
    vertex.coordinates = rotateY(vertex.coordinates, theta)
  }
}
function rotateZAll(theta) {
  for (let vertex of verticies) {
    vertex.coordinates = rotateZ(vertex.coordinates, theta)
  }
}

function rotateX(v, theta) {
  return [v[0],
          v[1] * Math.cos(theta) + v[2] * Math.sin(theta),
          -v[1] * Math.sin(theta) + v[2] * Math.cos(theta)]
}
function rotateY(v, theta) {
  return [v[0] * Math.cos(theta) + v[2] * Math.sin(theta),
          v[1],
          -v[0] * Math.sin(theta) + v[2] * Math.cos(theta)]
}
function rotateZ(v, theta) {
  return [v[0] * Math.cos(theta) + v[1] * Math.sin(theta),
          -v[0] * Math.sin(theta) + v[1] * Math.cos(theta),
          v[2]]
}

function scale(v, scalar) {
  return [v[0] * scalar, v[1] * scalar, v[2] * scalar]
}
function cross(v1, v2) {
  return [v1[1]*v2[2] - v1[2]*v2[1],
          v1[2]*v2[0] - v1[0]*v2[2],
          v1[0]*v2[1] - v1[1]*v2[0]]
}
function dot(v1, v2) {
  return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2]
}
function magnitude(v) {
  return Math.sqrt(dot(v, v))
}
function normalize(v) {
  return scale(v, 1/magnitude(v))
}

// Assume z coordinate is 0 or otherwise ignorable
function signedAngle(v, w) {
  return Math.atan2(w[1]*v[0] - w[0]*v[1], w[0]*v[0] + w[1]*v[1])
}

function linearCombo(v1, v2, alpha) {
  return [
    v1[0] * alpha + v2[0] * (1 - alpha),
    v1[1] * alpha + v2[1] * (1 - alpha),
    v1[2] * alpha + v2[2] * (1 - alpha),
  ]
}
