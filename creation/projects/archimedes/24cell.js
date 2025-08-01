module.exports = () => {
  setFor3DPrintedCovers()

  let verticies4D = []

  permutations4 = [
    [0,1,2,3],
    [0,1,3,2],
    [0,2,1,3],
    [0,2,3,1],
    [0,3,2,1],
    [0,3,1,2],
    [1,0,2,3],
    [1,0,3,2],
    [1,2,0,3],
    [1,2,3,0],
    [1,3,2,0],
    [1,3,0,2],
    [2,1,0,3],
    [2,1,3,0],
    [2,0,1,3],
    [2,0,3,1],
    [2,3,0,1],
    [2,3,1,0],
    [3,1,2,0],
    [3,1,0,2],
    [3,2,1,0],
    [3,2,0,1],
    [3,0,2,1],
    [3,0,1,2],
  ]

  for (let permutation of permutations4) {
    verticies4D.push(new Vector4(1,1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(1,-1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(-1,1,0,0).swizzle(permutation))
    verticies4D.push(new Vector4(-1,-1,0,0).swizzle(permutation))
  }

  let indexMap = {}
  for (let i = 0; i < verticies4D.length; i++) {
    let v = addVertex(verticies4D[i].project(1.5))
    indexMap[i] = v.index
  }

  let minDist = 1e6
  for (let i = 0; i < verticies4D.length; i++) {
    for (let j = i + 1; j < verticies4D.length; j++) {
      let dist = verticies4D[i].distanceTo(verticies4D[j])
      if (!epsilonEquals(dist, 0)) {
        minDist = Math.min(minDist, dist)
      }
    }
  }
  console.log(minDist)

  for (let i = 0; i < verticies4D.length; i++) {
    for (let j = i + 1; j < verticies4D.length; j++) {
      if (epsilonEquals(verticies4D[i].distanceTo(verticies4D[j]), minDist)) {
        addEdge(verticies[indexMap[i]], verticies[indexMap[j]])
      }
    }
  }

  // TODO prune graph to (symmetric) Hamiltonian cycle
  // TODO resize so cycle has integer length

  // zeroFoldAllEdges()
  // EulerianPath(verticies[0],[0])
}


class Vector4 extends THREE.Vector4 {
  isVector = true

  toArray() {
    return [this.x, this.y, this.z, this.w]
  }

  swizzle(permutation) {
    return new Vector4(
      this.getComponent(permutation[0]),
      this.getComponent(permutation[1]),
      this.getComponent(permutation[2]),
      this.getComponent(permutation[3]))
  }

  isValid() {
    return this.x < 1e6 && this.x > -1e6 &&
      this.y < 1e6 && this.y > -1e6 &&
      this.z < 1e6 && this.z > -1e6 &&
      this.w < 1e6 && this.w > -1e6
  }

  distanceTo(v) {
    return this.sub(v).length()
  }

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
  plusMinusEquals(v, epsilon=0.001) {
    return this.equals(v, epsilon) || this.equals(v.negate(), epsilon)
  }

  project(wOffset) {
    let w = this.w + wOffset
    return new Vector(this.x/w, this.y/w, this.z/w)
  }
}
// Reference for THREE.js Vector3: https://threejs.org/docs/#api/en/math/Vector3
let methodsToValuize = [
  "add", "addScaledVector", "applyMatrix4", "divideScalar", "lerp",
  "min", "max", "multiplyScalar", "negate", "normalize", "projectOnVector", "sub",
]
for (let method of methodsToValuize) {
  Vector4.prototype[method] = function(...args) {
    return THREE.Vector4.prototype[method].apply(this.clone(), args)
  }
}