
class Vector extends THREE.Vector3 {
  isVector = true

  applyMatrix(m) {
    return this.applyMatrix3(m)
  }
  scale(s) {
    return this.multiplyScalar(s)
  }
  proj(v) {
    return this.projectOnVector(v)
  }
  orthoProj(v) {
    return this.sub(this.proj(v))
  }
  equals(v, epsilon=0.001) {
    return epsilonEquals(this.distanceTo(v), 0, epsilon)
  }

  project(scale) {
    const SCALE = 800 * scale
    let z = this.z * scale + 15
    return [500 + this.x * SCALE / z, 500 - this.y * SCALE / z]
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
// Reference for THREE.js Vector3: https://threejs.org/docs/#api/en/math/Vector3.projectOnVector
let methodsToValuize = [
  "add", "addScaledVector", "applyAxisAngle", "applyMatrix3", "cross", "divideScalar", "lerp",
  "min", "max", "multiplyScalar", "negate", "normalize", "projectOnVector", "sub",
]
for (let method of methodsToValuize) {
  Vector.prototype[method] = function(...args) {
    return THREE.Vector3.prototype[method].apply(this.clone(), args)
  }
}

// https://threejs.org/docs/?q=matri#api/en/math/Matrix4
class Matrix extends THREE.Matrix3 {
  add(m) {
    for (let i = 0; i < 9; i++) {
      this.elements[i] += m.elements[i]
    }
    return this
  }
  divideScalar(s) {
    return this.multiplyScalar(1/s)
  }
}

class Plain {
  constructor(offset, normal) {
    this.offset = offset
    this.normal = normal.normalize()
  }

  mirror(mirror) {
    return new Plain(
      this.offset.mirror(mirror),
      this.normal.mirror(mirror, true),
    )
  }
  translate(v) {
    return new Plain(this.offset.add(v), this.normal)
  }
  rotate(rotationMatrix) {
    return new Plain(
      this.offset.applyMatrix(rotationMatrix),
      this.normal.applyMatrix(rotationMatrix),
    )
  }

  intersection(line) {
    let a = this.offset.sub(line.offset).dot(this.normal) / line.direction.dot(this.normal)
    return line.offset.addScaledVector(line.direction, a)
  }
}

class Line {
  constructor(offset, direction) {
    this.offset = offset
    this.direction = direction.normalize()
  }

  translate(v) {
    return new Line(this.offset.add(v), this.direction)
  }
  rotate(rotationMatrix) {
    return new Line(
      this.offset.applyMatrix(rotationMatrix),
      this.direction.applyMatrix(rotationMatrix),
    )
  }

  intersection(plain) {
    return plain.intersection(this)
  }
}


function epsilonEquals(a, b, epsilon=0.001) {
  return a - b < epsilon && b - a < epsilon
}
function fromMagAngle(mag, angle) { //angle is in deg
  return new Vector(mag, 0, 0).applyAxisAngle(BACKWARD, angle / 180 * Math.PI)
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

DEFAULT_PLAIN = new Plain(ZERO, FORWARD)
