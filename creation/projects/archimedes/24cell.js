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

  for (let i = 0; i < verticies4D.length; i++) {
    for (let j = i + 1; j < verticies4D.length; j++) {
      if (epsilonEquals(verticies4D[i].distanceTo(verticies4D[j]), minDist)) {
        addEdge(verticies[indexMap[i]], verticies[indexMap[j]])
      }
    }
  }

  // TODO connect vertex and edge antipodes
  for (let v1 of verticies) {
    for (let v2 of verticies) {
      if (v1.ogCoords.negate().equals(v2.ogCoords)) {
        v1.antipode = v2
      }
    }
  }
  for (let e1 of edges) {
    for (let e2 of edges) {
      if (e1.verticies[0].antipode == e2.verticies[0] &&
          e1.verticies[1].antipode == e2.verticies[1]) {
        e1.antipode = e2
      }
      if (e1.verticies[0].antipode == e2.verticies[1] &&
          e1.verticies[1].antipode == e2.verticies[0]) {
        e1.antipode = e2
      }
    }
  }

  let hamiltonianEdges = [edges[0].antipode, edges[0]]
  let previousVertex = edges[0].verticies[1]
  let hamiltonianVerticies = [...edges[0].verticies]
  let excludedEdges = []

  let count = 0

  let finalVertex = edges[0].verticies[0].antipode

  function hamiltonianHelper() {
    count += 1
    if (count > 1000000) {
      return true
    }
    let currentVertex = hamiltonianVerticies[hamiltonianVerticies.length - 1]
    
    let previousEdge = hamiltonianEdges[hamiltonianEdges.length - 1]
    currentVertex.edges.sort((e1, e2) => {
      a1 = previousEdge.toVector(previousVertex).angleTo(e1.toVector(previousVertex))
      a2 = previousEdge.toVector(previousVertex).angleTo(e2.toVector(previousVertex))
      return a1 - a2
    })
    for (let edge of currentVertex.edges) {
      if (excludedEdges.includes(edge)) {
        continue
      }
      let nextVertex = edge.otherVertex(currentVertex)
      if (nextVertex == finalVertex) {
        if (hamiltonianVerticies.length == verticies.length/2) {
          hamiltonianEdges.push(edge)
          hamiltonianEdges.push(edge.antipode)
          return true
        } else {
          continue
        }
      }
      hamiltonianEdges.push(edge)
      hamiltonianEdges.push(edge.antipode)
      hamiltonianVerticies.push(nextVertex)
      for (let edge of currentVertex.edges) {
        excludedEdges.push(edge.antipode)
        excludedEdges.push(edge)
      }
      if (hamiltonianHelper()) {
        return true
      }
      for (let _ of currentVertex.edges) {
        excludedEdges.pop()
        excludedEdges.pop()
      }
      hamiltonianVerticies.pop()
      hamiltonianEdges.pop()
      hamiltonianEdges.pop()
    }
    return false
  }
  hamiltonianHelper()
  // TODO cache result?
  console.log(hamiltonianVerticies.map(v => v.index))
  console.log(hamiltonianEdges.map(e => e.verticies[0].index + ", " + e.verticies[1].index))
  for (let edge of [...edges].reverse()) {
    if (!hamiltonianEdges.includes(edge)) {
      removeEdge(edge)
    }
  }

  let totalLength = 0
  for (let edge of edges) {
    totalLength += edge.length()
  }
  scale(150 / totalLength)


  zeroFoldAllEdges()
  EulerianPath(0)
}


// TODO add this to vector.js
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