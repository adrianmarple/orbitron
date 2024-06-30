
function epsilonEquals(a, b, epsilon=0.001) {
  return a - b < epsilon && b - a < epsilon
}
function vectorEquals(v1, v2, epsilon=0.001) {
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
function edgeDelta(edge) {
  return delta(edge.verticies[1].ogCoords, edge.verticies[0].ogCoords)
}
function edgeLength(edge) {
  return magnitude(edgeDelta(edge))
}
function delta(v1, v2) {
  return [v1[0] - v2[0], v1[1] - v2[1], v1[2] - v2[2]]
}

function project(v, scale) {
  const SCALE = 800 * scale
  let z = v[2] * scale + 15
  return [500 + v[0] * SCALE / z, 500 - v[1] * SCALE / z]
}

function fromMagAngle(mag, angle) { //angle is in deg
  return rotateZ([mag, 0, 0], angle / 180 * Math.PI)
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

function angle3D(v, w) {
  let ratio = dot(v, w) / magnitude(v) / magnitude(w)
  if (ratio <= -1) return Math.PI
  if (ratio >= 1) return 0
  return Math.acos(ratio)
}

function linearCombo(v1, v2, alpha) {
  return [
    v1[0] * alpha + v2[0] * (1 - alpha),
    v1[1] * alpha + v2[1] * (1 - alpha),
    v1[2] * alpha + v2[2] * (1 - alpha),
  ]
}

function proj(v1, v2) {
  return scale(v2, dot(v1,v2)/ dot(v2,v2))
}
function orthoProj(v1, v2) {
  return delta(v1, proj(v1,v2))
}

function isCoplanar(plain, v) {
  let v2 = delta(v, plain.offset)
  return epsilonEquals(dot(v2, plain.normal), 0)
}

function isAbovePlain(plain, v) {
  let v2 = delta(v, plain.offset)
  return dot(v2, plain.normal) > 0
}

function mirror(m, v, ignoreOffset) {
  let v2 = v
  if (!ignoreOffset) v2 = delta(v, m.offset)
  let newV = scale(proj(v2, m.normal), -1)
  newV = add(orthoProj(v2, m.normal), newV)
  if (!ignoreOffset) newV = add(newV, m.offset)
  return newV
}
function halfMirror(m, v) {
  let v2 = delta(v, m.offset)
  if (isAbovePlain(m, v))
    return mirror(m, v)
  else
    return v
}
function mirrorPlain(m, plain) {
  return {
    offset: mirror(m, plain.offset),
    normal: mirror(m, plain.normal, true),
  }
}

function intersection(plain, line) {
  let a = dot(delta(plain.offset, line.offset), plain.normal) / dot(line.direction, plain.normal)
  return add(line.offset, scale(line.direction, a))
}
