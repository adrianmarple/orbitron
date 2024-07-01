
class Vector {
  isVector = true
  constructor(coords, y, z) {
    if (typeof(coords) == "number") {
      this.coords = new THREE.Vector3(coords, y, z)
    }
    else if (!coords.isVector3) {
      this.coords = new THREE.Vector3(coords[0], coords[1], coords[2])
    }
    else {
      this.coords = coords
    }
    this.x = this.coords.x
    this.y = this.coords.y
    this.z = this.coords.z
  }

  // Wrapper functions to make it imitate a value type struct
  // Reference for THREE.js Vector3:
  //   https://threejs.org/docs/#api/en/math/Vector3.projectOnVector
  add(v) {
    return new Vector(this.coords.clone().add(v.coords))
  }
  addScaledVector(v,s) {
    return new Vector(this.coords.clone().addScaledVector(v.coords,s))
  }
  applyAxisAngle(axis, angle) {
    return new Vector(this.coords.clone().applyAxisAngle(axis, angle))
  }
  applyMatrix3(m) {
    return new Vector(this.coords.clone().applyMatrix3(m))
  }
  angleTo(v) {
    return this.coords.angleTo(v.coords)
  }
  clone() {
    return new Vector(this.coords)
  }
  cross(v) {
    return new Vector(this.coords.clone().cross(v.coords))
  }
  distanceTo(v) {
    return this.coords.distanceTo(v.coords)
  }
  distanceToSquared(v) {
    return this.coords.distanceToSquared(v.coords)
  }
  divideScalar(s) {
    return new Vector(this.coords.clone().divideScalar(s))
  }
  dot(v) {
    return this.coords.dot(v.coords)
  }
  length() {
    return this.coords.length()
  }
  lengthSq() {
    return this.coords.lengthSq()
  }
  lerp(v, alpha) {
    return new Vector(this.coords.clone().lerp(v.coords, alpha))
  }
  max(v) {
    return new Vector(this.coords.clone().max(v))
  }
  min(v) {
    return new Vector(this.coords.clone().min(v))
  }
  multiplyScalar(s) {
    return new Vector(this.coords.clone().multiplyScalar(s))
  }
  negate() {
    return new Vector(this.coords.clone().negate())
  }
  normalize() {
    return new Vector(this.coords.clone().normalize())
  }
  sub(v) {
    return new Vector(this.coords.clone().sub(v.coords))
  }


  equals(v, epsilon=0.001) {
    return epsilonEquals(this.coords.distanceTo(v), 0, epsilon)
  }
  scale(s) {
    return this.multiplyScalar(s)
  }
  proj(v) {
    return new Vector(this.coords.clone().projectOnVector(v.coords))
  }
  orthoProj(v) {
    return this.sub(this.proj(v))
  }

  project(scale) {
    const SCALE = 800 * scale
    let z = this.coords.z * scale + 15
    return [500 + this.coords.x * SCALE / z, 500 - this.coords.y * SCALE / z]
  }
  // Assume z coordinate is 0 or otherwise ignorable
  signedAngle(v) {
    return Math.atan2(v.y*this.x - v.x*this.y, v.x*this.x + v.y*this.y)
  }

  isCoplanar(plain) {
    let v2 = this.sub(plain.offset)
    return epsilonEquals(v2.dot(plain.normal), 0)
  }
  isAbovePlain(plain) {
    let v2 = this.sub(plain.offset)
    return v2.dot(plain.normal) > 0
  }

  mirror(m, ignoreOffset) {
    let v2 = this
    if (!ignoreOffset) v2 = this.sub(m.offset)
    let newV = v2.proj(m.normal).multiplyScalar(-1)
    newV = v2.orthoProj(m.normal).add(newV)
    if (!ignoreOffset) newV = newV.add(m.offset)
    return newV
  }
  halfMirror(m) {
    if (this.isAbovePlain(m))
      return this.mirror(m)
    else
      return this
  }
}

class Plain {

}


function epsilonEquals(a, b, epsilon=0.001) {
  return a - b < epsilon && b - a < epsilon
}
function fromMagAngle(mag, angle) { //angle is in deg
  return new Vector(mag, 0, 0).applyAxisAngle(BACKWARD, angle / 180 * Math.PI)
}


function edgeDelta(edge) {
  return edge.verticies[1].ogCoords.sub(edge.verticies[0].ogCoords)
}
function edgeLength(edge) {
  return edgeDelta(edge).length()
}
function lineFromEdge(edge) {
  return {
    offset: edge.verticies[0].ogCoords,
    direction: edgeDelta(edge),
  }
}

function mirrorPlain(mirror, plain) {
  return {
    offset: plain.offset.mirror(mirror),
    normal: plain.normal.mirror(mirror, true),
  }
}

function intersection(plain, line) {
  let a = plain.offset.sub(line.offset).dot(plain.normal) / line.direction.dot(plain.normal)
  return line.offset.addScaledVector(line.direction, a)
}


// Operations on all verticies

function translateAll(vector) {
  for (let vertex of verticies) {
    vertex.coordinates = vertex.coordinates.add(vector)
  }
}
function center(permanently) {
  let attribute = permanently ? "ogCoords" : "coordinates"

  let mins = new Vector(1e6, 1e6, 1e6)
  let maxes = new Vector(-1e6, -1e6, -1e6)
  
  for (let vertex of verticies) {
    let coords = vertex[attribute]
    mins = mins.min(coords)
    maxes = maxes.max(coords)
  }
  let offset = mins.add(maxes).multiplyScalar(-0.5)
  for (let vertex of verticies) {
    vertex[attribute] = vertex[attribute].add(offset)
  }
  return offset
}
function resize(permanently) {
  let attribute = permanently ? "ogCoords" : "coordinates"

  let maxMagnitude = 0
  
  for (let vertex of verticies) {
    let mag = vertex[attribute].length()
    maxMagnitude = Math.max(maxMagnitude, mag)
  }
  for (let vertex of verticies) {
    vertex[attribute] = vertex[attribute].divideScalar(maxMagnitude)
  }
  return 1/maxMagnitude
}

function rotateXAll(theta, permanently) {
  rotateAll(RIGHT, theta, permanently)
}
function rotateYAll(theta, permanently) {
  rotateAll(UP, theta, permanently)
}
function rotateZAll(theta, permanently) {
  rotateAll(FORWARD, theta, permanently)
}

function rotateAll(direction, theta, permanently) {
  for (let vertex of verticies) {
    vertex.coordinates = vertex.coordinates.applyAxisAngle(direction, theta)
    if (permanently) {
      vertex.ogCoords = vertex.ogCoords.applyAxisAngle(direction, theta)
    }
  }
}


ZERO = new Vector(0,0,0)
RIGHT = new Vector(1,0,0)
LEFT = new Vector(-1,0,0)
UP = new Vector(0,1,0)
DOWN = new Vector(0,-1,0)
FORWARD = new Vector(0,0,1)
BACKWARD = new Vector(0,0,-1)

DEFAULT_PLAIN = {
  offset: ZERO,
  normal: FORWARD,
}
