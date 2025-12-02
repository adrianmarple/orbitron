
class Vertex {
  constructor(coordinates) {
    this.ogCoords = coordinates
    this.plains = [currentPlain]
    this.edges = []
    this.index = verticies.length
    this.folds = {}
  }

  addLine(vector) {
    if (!vector.isVector) {
      vector = new Vector(...vector)
    }
    return addLine(this, vector).verticies[1]
  }

  remove() {
    removeVertex(this)
  }
  addPlain(plain) {
    if (this.ogCoords.isCoplanar(plain)) {
      this.plains.push(plain)
      if (!plains.includes(plain)) {
        addPlain(plain)
      }
    } else {
      console.error("Vertex not coplanar with plain", plain, this)
    }
  }
  
  getPlainThatContains(vector) {
    for (let plain of this.plains) {
      if (vector.isCoplanar(plain)) {
        return plain
      }
    }
    return null
  }

  edgeInDirection(direction) {
    direction = direction.normalize()
    for (let edge of this.edges) {
      if (edge.isDupe) continue

      let other = edge.otherVertex(this)
      let edgeDirection = other.ogCoords.sub(this.ogCoords).normalize()
      if (direction.equals(edgeDirection)) {
        return edge
      }
    }
    return null
  }
  leftmostEdge(direction) {
    let minAngle = 7
    let leftmost = null
    for (let edge of this.edges) {
      let a = edge.toVector(this).signedAngle(direction)
      if (!epsilonEquals(a, -Math.PI) && a < minAngle) {
        minAngle = a
        leftmost = edge
      }
    }
    return leftmost
  }
  getEdge(otherVertex) {
    for (let edge of this.edges) {
      if (edge.verticies.includes(otherVertex)) {
        return edge
      }
    }
  }

  arrangeEdgesAndSetNegations() {
  }

  fold(edge, isOutgoing) {
    if (!this.negations) {
      this.negations = { [this.plains[0].index]: 1 }
      for (let plain of this.plains) {
        let index = plain.index
        this.negations[index] = 1
        for (let edge of this.edges) {
          let d = plain.normal.dot(edge.toVector(this, true))
          if (!epsilonEquals(d, 0)) {
            this.negations[index] = Math.sign(d)
            break
          }
        }
        if (this.plains[0].normal.negate().equals(plain.normal)) {
          this.negations[index] = this.negations[this.plains[0].index] * -1
        }
      }
    }
    let name = this.subEdgeName(edge, isOutgoing)
    if (!this.folds[name]) {
      // this.folds[name] = new Fold(this, edge, isOutgoing)
      let fold = new Fold(this, edge, isOutgoing)
      this.folds[fold.edge0.index + "bottom1"] = fold
      this.folds[fold.edge0.index + "top1"] = fold
      this.folds[fold.edge1.index + "bottom2"] = fold
      this.folds[fold.edge1.index + "top2"] = fold
    } else {
      // let oldFold = this.folds[name]
      // let newFold = new Fold(this, edge, isOutgoing)
      // let fields = ["edge0", "edge1", "dihedralAngle", "angleOfIncidence", "aoiComplement"]
      // for (let field of fields) {
      //   if (typeof oldFold[field] == "number" && !epsilonEquals(oldFold[field], newFold[field])) {
      //     console.log(oldFold)
      //     console.log(newFold)
      //     break
      //   }
      //   if (typeof oldFold[field] == "object" && oldFold[field] != newFold[field]) {
      //     console.log(oldFold)
      //     console.log(newFold)
      //     break
      //   }
      // }
      // if (oldFold.wall.leftVertex != newFold.wall.leftVertex) {
      //   console.log(oldFold)
      //   console.log(newFold)
      // }
    }
    return this.folds[name]
  }

  negation(thing) {
    if (!thing.isPlain) { //Assume edge
      thing = thing.commonPlain()  
    }
    return this.negations[thing.index]
  }
  correctedNormal(thing) {
    if (!thing.isPlain) { //Assume edge
      thing = thing.commonPlain()  
    }
    let normal = thing.normal
    if (this.negations[thing.index] == -1) {
      normal = normal.negate()
    }
    return normal
  }

  nextEdge(edge, flip) {
    let plain = edge.commonPlain()
    if (flip) {
      plain = plain.otherSide()
    }
    let e = edge.toVector(this, true)

    let minAngle = 4
    let bestEdge = null
    for (let otherEdge of this.edges) {
      if (otherEdge == edge || otherEdge.isDupe) continue
      e0 = otherEdge.toVector(this, true)
      let angle = e.signedAngle(e0)
      if (angle < minAngle) {
        minAngle = angle
        bestEdge = otherEdge
      }
    }
    return bestEdge
  }

  subEdgeName(edge, isOutgoing, isBottom=IS_BOTTOM) {
    let negation = this.negation(edge)
    if (negation == -1) {
      isOutgoing = !isOutgoing
    }
    let type = isOutgoing ? 1 : 2
    let coverType = isBottom == (negation == 1) ? "bottom" : "top"
    return `${edge.index}${coverType}${type}`
  }
  oldFold() {
    if (!this._oldFold) {
      this._oldFold = new OldFold(this)
    }
    return this._oldFold
  }
}

class Edge {
  constructor(vertex1, vertex2) {
    this.index = edges.length
    this.verticies = [vertex1, vertex2]
  }

  clone() {
    return new Edge(this.verticies[0], this.verticies[1])
  }

  delta() {
    return this.verticies[1].ogCoords.sub(this.verticies[0].ogCoords)
  }
  length() {
    return this.delta().length()
  }
  commonPlain() {
    for (let candidate of this.verticies[0].plains) {
      if (this.verticies[1].plains.includes(candidate)) {
        return candidate
      }
    }
    return null
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
  otherVertex(vertex) {
    let otherVertex = this.verticies[0]
    if (otherVertex.index === vertex.index) {
      otherVertex = this.verticies[1]
    }
    return otherVertex
  }
  toVector(fromVertex, useOogIfAvailable) {
    let toVertex = this.otherVertex(fromVertex)
    let end, start
    if (useOogIfAvailable) {
      end = toVertex.oogCoords || toVertex.ogCoords
      start = fromVertex.oogCoords || fromVertex.ogCoords
    } else {
      end = toVertex.ogCoords
      start = fromVertex.ogCoords
    }
    return end.sub(start)
  }

  split(distance) {
    return splitEdge(this, distance)
  }
}

class Fold {
  constructor(vertex, edge, isOutgoing) {
    this.vertex = vertex
    let flip = vertex.negation(edge) == -1
    this.info = "" + vertex.edges.indexOf(edge) + isOutgoing + flip
    if (flip) {
      isOutgoing = !isOutgoing
    }
    if (isOutgoing) {
      this.edge0 = edge
      this.edge1 = vertex.nextEdge(edge, flip)
    }
    else {
      this.edge1 = edge
      this.edge0 = vertex.nextEdge(edge, flip == false) // TODO flip if IS_BOTTOM (or something like that)
    }

    let n0 = this.vertex.correctedNormal(this.edge0)
    let n1 = this.vertex.correctedNormal(this.edge1)

    if (this.vertex.deadendPlain) { // Should only happen right now with zero-folds
      this.deadendNormal = this.vertex.deadendPlain.normal
    } else {
      this.deadendNormal = n0.sub(n1)
    }
    this.dihedralAngle = n0.angleTo(n1)

    let crease = this.edge0.commonPlain().intersection(this.deadendPlain())
    if (crease.direction.dot(n0.cross(n1)) < 0) {
      crease.direction = crease.direction.negate()
    }
    let aoi = this.edge0.toVector(vertex, true).angleTo(crease.direction)
    if (aoi < 0) aoi += Math.PI
    if (aoi > Math.PI) aoi -= Math.PI
    this.angleOfIncidence = Math.PI - aoi
    this.aoiComplement = Math.PI/2 - this.angleOfIncidence

    this.wall = {
      isFoldWall: true,
      vertex,
      dihedralAngle: this.dihedralAngle,
      angleOfIncidence: this.angleOfIncidence,
      aoiComplement: this.aoiComplement,
      leftVertex: this.edge0.otherVertex(vertex),
      rightVertex: this.edge1.otherVertex(vertex),
      extraLEDSupportOffset: 0,
    }
    this.infoAdded = []
  }

  deadendPlain() { // Done this way so vertex coords can move
    return new Plain(this.vertex.oogCoords || this.vertex.ogCoords, this.deadendNormal)
  }

  getCoverInfo(edge, isOutgoing, R) {
    let plain = edge.commonPlain()
    let negation = this.vertex.negation(plain)
    let dihedralAngle = this.dihedralAngle * negation

    let plainTranslationValue = CHANNEL_DEPTH/2
    plainTranslationValue += IS_BOTTOM == (dihedralAngle < 0) ? 0 : THICKNESS + EXTRA_COVER_THICKNESS
    plainTranslationValue *= IS_BOTTOM ? 1 : -1
    let line = new Line(this.vertex.ogCoords, edge.toVector(this.vertex))
      .translate(FORWARD.scale(plainTranslationValue))
    let deadendPlain = this.deadendPlain().rotateAndScale(R, PIXEL_DISTANCE)
    let aoiComplement = this.aoiComplement * negation *
        (isOutgoing ? 1:-1) * (plain == this.edge0.commonPlain() ? 1:-1)
    let angleOfIncidence = Math.PI/2 - aoiComplement
    let info = {
      deadendPlain,
      line,
      dihedralAngle,
      aoiComplement,
      angleOfIncidence,
      plainTranslationValue
    }
    return info
  }

  addFoldWallInfo(params) {
    let { plain, edge, isOutgoing, wallLength, angle, lengthOffset, edgeLength,
      worldPlacementOperations, extraLEDSupportOffset } = params

    this.infoAdded.push(this.vertex.subEdgeName(edge, isOutgoing))
    // console.log(this.infoAdded)

    let negation = this.vertex.negation(plain)
    if (negation == -1) {
      isOutgoing = !isOutgoing
      worldPlacementOperations[2].angle = Math.PI
      lengthOffset *= -1
    }
    let type = isOutgoing ? 1 : 2
    let coverType = IS_BOTTOM == (negation == 1) ? "bottom" : "top"
    this.wall["miterAngle" + type] = angle
    this.wall["edgeLength" + type] = edgeLength
    this.wall["lengthOffset" + type] = -lengthOffset
    this.wall[coverType + "Length" + type] = wallLength
    this.wall["worldPlacementOperations" + type] = worldPlacementOperations
    this.wall.extraLEDSupportOffset = extraLEDSupportOffset // I think this should always be 0
    if (extraLEDSupportOffset != 0) {
      console.error("extraLEDSupportOffset not 0")
    }
  }
}

class OldFold {
  // Assumes vertex with two edges and two plains
  constructor(vertex) {
    this.vertex = vertex
    
    let vertex0 = vertex.edges[0].otherVertex(vertex)
    let vertex1 = vertex.edges[1].otherVertex(vertex)
    let e0 = vertex.edges[0].toVector(vertex, true)
    let e1 = vertex.edges[1].toVector(vertex, true)
    let n0, n1
    this.plainToIndex = {}
    this.negations = [1, 1]
    if (epsilonEquals(vertex.plains[0].normal.dot(e0), 0)) {
      n0 = vertex.plains[0].normal
      n1 = vertex.plains[1].normal
      this.plainToIndex[vertex.plains[0].index] = 0
      this.plainToIndex[vertex.plains[1].index] = 1
    } else {
      n0 = vertex.plains[1].normal
      n1 = vertex.plains[0].normal
      this.plainToIndex[vertex.plains[0].index] = 1
      this.plainToIndex[vertex.plains[1].index] = 0
    }
    if (n0.dot(e1) < -0.001) {
      n0 = n0.negate()
      this.negations[0] = -1
    }
    if (n1.dot(e0) < -0.001) {
      n1 = n1.negate()
      this.negations[1] = -1
    }
    if (n0.negate().equals(n1)) {
      n1 = n1.negate()
      this.negations[1] = -1
    }

    if (this.vertex.deadendPlain) {
      this.deadendNormal = this.vertex.deadendPlain.normal
    } else {
      this.deadendNormal = n0.sub(n1)
    }
    this.dihedralAngle = n0.angleTo(n1)

    let crease = vertex.plains[0].intersection(this.deadendPlain())
    if (crease.direction.dot(n0.cross(n1)) < 0) {
      crease.direction = crease.direction.negate()
    }
    let aoi = e1.angleTo(crease.direction)
    if (aoi < 0) aoi += Math.PI
    if (aoi > Math.PI) aoi -= Math.PI
    this.angleOfIncidence = aoi
    this.aoiComplement = Math.PI/2 - aoi

    this.foldWalls = [{
      isFoldWall: true,
      vertex,
      dihedralAngle: this.dihedralAngle,
      angleOfIncidence: aoi,
      aoiComplement: this.aoiComplement,
      leftVertex: vertex1,
      rightVertex: vertex0,
      extraLEDSupportOffset: 0,
    }]
    this.foldWalls.push({...this.foldWalls[0]})
    this.foldWalls[1].aoiComplement *= -1
    this.foldWalls[1].angleOfIncidence = Math.PI/2 - this.foldWalls[1].aoiComplement
    this.foldWalls[1].leftVertex = vertex0
    this.foldWalls[1].rightVertex = vertex1
  }

  deadendPlain() { // Done this way so vertex coords can move
    return new Plain(this.vertex.oogCoords || this.vertex.ogCoords, this.deadendNormal)
  }

  getCoverInfo(plain, isOutgoing) {
    let index = this.plainToIndex[plain.index]
    let info = {
      deadendPlain: this.deadendPlain(),
      dihedralAngle: this.dihedralAngle * this.negations[index],
      aoiComplement: this.aoiComplement * this.negations[index] *
        (isOutgoing ? 1:-1) * (index == 0 ? -1:1),
    }
    info.angleOfIncidence = Math.PI/2 - info.aoiComplement
    return info
  }

  getWall(plain, isOutgoing) {
    let foldWallIndex = this.plainToIndex[plain.index]
    if (isOutgoing) {
      foldWallIndex = 1 - foldWallIndex
    }
    return this.foldWalls[foldWallIndex]
  }

  addFoldWallInfo(params) {
    let { plain, isOutgoing, wallLength, angle, lengthOffset, edgeLength,
      worldPlacementOperations, extraLEDSupportOffset } = params

    let index = this.plainToIndex[plain.index]
    if (this.negations[index] == -1) {
      isOutgoing = !isOutgoing
      worldPlacementOperations[2].angle = Math.PI
      lengthOffset *= -1
    }
    let type = isOutgoing ? 1 : 2
    let foldWallIndex = index
    if (isOutgoing) {
      foldWallIndex = 1 - foldWallIndex
    }
    let coverType = IS_BOTTOM == (this.negations[index] == 1) ? "bottom" : "top"
    let foldWall = this.foldWalls[foldWallIndex]
    foldWall["miterAngle" + type] = angle
    foldWall["edgeLength" + type] = edgeLength
    foldWall["lengthOffset" + type] = -lengthOffset
    foldWall[coverType + "Length" + type] = wallLength
    foldWall["worldPlacementOperations" + type] = worldPlacementOperations
    foldWall.extraLEDSupportOffset = extraLEDSupportOffset // I think this should always be 0
    if (extraLEDSupportOffset != 0) {
      console.error("extraLEDSupportOffset not 0")
    }
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
    if (existingVertex.ogCoords.equals(coordinates)) {
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
function removeEdges(...edges) {
  edges = edges.map(e => resolveEdge(e))
  edges = edges.sort((a,b) => b.index-a.index)
  for (let e of edges) {
    removeEdge(e)
  }
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
  let previousVertex = addVertex(points.last().add(center))
  for (let point of points) {
    let vertex = addVertex(point.add(center))
    newEdges.push(addEdge(previousVertex, vertex))
    previousVertex = vertex
  }
  return newEdges
}

function addRhombus(edgeLength, center, angle) {
  angle = angle || Math.PI/2
  let rhombVerticies = []
  rhombVerticies.push(addVertex(center.add(new Vector(Math.cos(angle/2)*edgeLength, 0, 0))))
  rhombVerticies.push(addVertex(center.add(new Vector(0, -Math.sin(angle/2)*edgeLength, 0))))
  rhombVerticies.push(addVertex(center.add(new Vector(-Math.cos(angle/2)*edgeLength, 0, 0))))
  rhombVerticies.push(addVertex(center.add(new Vector(0, Math.sin(angle/2)*edgeLength, 0))))

  for (let i = 0; i < 4; i++) {
    addEdge(rhombVerticies[i], rhombVerticies[(i+1)%4])
  }
  return rhombVerticies
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
    var edgeCenter = edge.verticies[0].ogCoords
        .add(edge.verticies[1].ogCoords)
        .multiplyScalar(0.5)
    if (vectorEquals(edgeCenter, center)) {
      return edge
    }
  }
  return null
}


function addLine(vertex, length, angle) {
  let vector = length
  if (typeof(length) == "number") {
    vector = fromMagAngle(length, angle)
  }
  vertex = resolveVertex(vertex)
  let coords = vertex.ogCoords.add(vector)
  let newVertex = addVertex(coords)
  return addEdge(vertex, newVertex)
}

function extendAtAngle(edge, angle, length, bendPlain, reverse) {
  angle = angle * Math.PI / 180
  let vertex = edge.verticies[reverse ? 0 : 1]
  let direction = edge.delta().normalize()
  if (reverse) {
    direction = direction.negate()
  }
  let plain = vertex.plains[0]
  let axis = plain.normal
  if (bendPlain) {
    axis = axis.cross(direction)
  }
  let newDelta = direction.applyAxisAngle(axis, angle).scale(length)
  let newVertex = addVertex(vertex.ogCoords.add(newDelta))

  let newPlain = plain
  if (bendPlain) {
    newPlain = new Plain(vertex.ogCoords, plain.normal.applyAxisAngle(axis, angle))
    vertex.plains.push(newPlain)
    plains.push(newPlain)
  }
  newVertex.plains = [newPlain]
  return addEdge(vertex, newVertex)
}

// Based on Futurologist's answer from https://math.stackexchange.com/questions/2228018/how-to-calculate-the-third-point-if-two-points-and-all-distances-between-the-poi
// Assumes z coordinate is always 0
function addTriangulation(v1, v2, a, b, basis) {
  v1 = resolveVertex(v1)
  v2 = resolveVertex(v2)

  if (!b) b = a
  if (!basis) basis = [RIGHT, UP, FORWARD]
  if (!basis[2]) basis[2] = basis[0].cross(basis[1])

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
  // let x = A.x + (c*c + b*b - a*a)/(2*c*c) * AtoB.x - 2*s*AtoB.y/(c*c)
  // let y = A.y + (c*c + b*b - a*a)/(2*c*c) * AtoB.y + 2*s*AtoB.x/(c*c)

  // let v = addVertex(new Vector(x,y,0))

  let d0 = (c*c + b*b - a*a)/(2*c*c) * AtoB.dot(basis[0]) - 2*s*AtoB.dot(basis[1])/(c*c)
  let d1 = (c*c + b*b - a*a)/(2*c*c) * AtoB.dot(basis[1]) + 2*s*AtoB.dot(basis[0])/(c*c)
  let v = addVertex(A.addScaledVector(basis[0], d0).addScaledVector(basis[1], d1))

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
  newVertex.plains = [edge.commonPlain()]
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

function edgeCleanup(dontDoubleEdges) {
  // First check if there are any edges with two fold verticies so they can be split
  for (let edge of [...edges]) {
    if (edge.verticies[0].plains.length == 2 && edge.verticies[1].plains.length == 2) {
      let newVertex = edge.split(edge.length()/2)
      newVertex.dontMergeEdges = true
    }
  }

  for (let edge of [...edges]) {
    let maxLength = MAX_WALL_LENGTH
    // if (edge.verticies[0].plains.length == 2 || edge.verticies[1].plains.length == 2) {
    //   maxLength = MAX_FOLD_WALL_LENGTH
    // }
    let isDeadend0 = edge.verticies[0].edges.length == 1
    let isDeadend1 = edge.verticies[1].edges.length == 1
    let splitCount = edge.length() * PIXEL_DISTANCE / maxLength
    if (isDeadend0) {
      splitCount += 0.5
    }
    if (isDeadend1) {
      splitCount += 0.5
    }
    splitCount = Math.floor(splitCount)
    let denom = splitCount+1
    if (isDeadend0) {
      denom -= 0.5
    }
    if (isDeadend1) {
      denom -= 0.5
    }
    let newLength = edge.length() / denom
    for (let i = 0; i < splitCount; i++) {
      if (isDeadend1 && i == 0) {
        edge.split(-newLength/2)
      } else {
        edge.split(-newLength)
      }
    }
  }

  if (!dontDoubleEdges) {
    for (let vertex of verticies) {
      if (vertex.edges.length % 2 == 1) {
        doubleEdges()
        break
      }
    }
  }
}

function doubleEdges() {
  for (let edge of [...edges]) {
    var edgeCopy = edge.clone()
    for (let v of edge.verticies) {
      v.edges.push(edgeCopy)
    }
    edgeCopy.index = edges.length
    edgeCopy.isDupe = true
    edgeCopy.dual = edge
    edge.dual = edgeCopy
    edges.push(edgeCopy)
  }
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
      let e1 = v0.sub(edge1.otherVertex(vertex).ogCoords)
      for (let edge2 of vertex.edges) {
        if (edge1 == edge2) continue
        let e2 = v0.sub(edge2.otherVertex(vertex).ogCoords)
        if (!epsilonEquals(e1.signedAngle(e2), 0)) continue

        if (e2.length() < e1.length()) {
          let t = edge1
          edge1 = edge2
          edge2 = t
        }
        vertex1 = edge1.otherVertex(vertex)
        edge2.verticies.push(vertex1)
        vertex1.edges.push(edge2)
        remove(vertex.edges, edge2)
        remove(edge2.verticies, vertex)
      }
    }
  }
}

function vertexOrder(a,b) {
  return (a.ogCoords.y - b.ogCoords.y) * 1000000 + (a.ogCoords.x - b.ogCoords.x)
}
function integerize(startingThreshold) {
  if (startingThreshold == undefined) {
    startingThreshold = -1e6
  }
  let sortedVerticies = verticies.filter(v => v.ogCoords.y > startingThreshold).sort(vertexOrder)

  for (let v of sortedVerticies) {
    let lowerNeighbors = []
    for (let e of v.edges) {
      let v1 = e.otherVertex(v)
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
      replacement = e.otherVertex(lowerNeighbors[0])
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


// Assume z = 0 for now
// From https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
function edgeIntersection(edge1, edge2) {
  let epsilon = 1e-3
  let x1 = edge1.verticies[0].ogCoords.x
  let y1 = edge1.verticies[0].ogCoords.y
  let x2 = edge1.verticies[1].ogCoords.x
  let y2 = edge1.verticies[1].ogCoords.y
  let x3 = edge2.verticies[0].ogCoords.x
  let y3 = edge2.verticies[0].ogCoords.y
  let x4 = edge2.verticies[1].ogCoords.x
  let y4 = edge2.verticies[1].ogCoords.y

  let t = ((x1-x3)*(y3-y4) - (y1-y3)*(x3-x4)) / ((x1-x2)*(y3-y4) - (y1-y2)*(x3-x4))
  if (t < epsilon || t > 1-epsilon || isNaN(t)) return null
  let u = -((x1-x2)*(y1-y3) - (y1-y2)*(x1-x3)) / ((x1-x2)*(y3-y4) - (y1-y2)*(x3-x4))
  if (u < epsilon || u > 1-epsilon || isNaN(u)) return null

  return new Vector(x1 + t*(x2-x1), y1 + t*(y2-y1), 0)
}
function cleanupIntersectingEdges() {
  for (let i = 0; i < edges.length; i++) {
    let edge1 = edges[i]
    for (let j = i+1; j < edges.length; j++) {
      let edge2 = edges[j]
      let intersection = edgeIntersection(edge1, edge2)
      if (intersection) {
        splitEdge(edge1, edge1.verticies[0].ogCoords.distanceTo(intersection))
        splitEdge(edge2, edge2.verticies[0].ogCoords.distanceTo(intersection))
      }
    }
  }

}


function addPlain(plain) {
  plain.index = plains.length
  plains.push(plain)
}
function mergePlains(plain0, plain1) {
  if (plain0 == plain1) return
  if (!plain0.isCoplanar(plain1)) {
    console.error("Trying to merge non-coplanar plains", plain0, plain1)
    return
  }
  for (let vertex of verticies) {
    for (let i = 0; i < vertex.plains.length; i++) {
      if (vertex.plains[i] == plain1) {
        vertex.plains[i] = plain0
      }
    }
  }
  plains.remove(plain1)
  let indexMapping = {}
  for (let i = 0; i < plains.length; i++) {
    indexMapping[plains[i].index] = i
    plains[i].index = i
  }
  indexMapping[plain1.index] = plain0.index

}

function origami(foldPlain) {
  let newPlain, mirrorPlain

  let isSplit = epsilonEquals(currentPlain.normal.dot(foldPlain.normal), 0)
  if (isSplit) {
    newPlain = currentPlain.clone()
  } else {
    let mirrorPlainOffset = currentPlain.intersection(foldPlain).offset
    let mirrorPlainNormal = currentPlain.normal.orthoProj(foldPlain.normal)
    mirrorPlain = new Plain(mirrorPlainOffset, mirrorPlainNormal)
    newPlain = currentPlain.mirror(mirrorPlain)
  }

  addPlain(newPlain)
  // Add new verticies along edges that have been folded
  for (let edge of [...edges]) {
    if (edge.commonPlain() != currentPlain) continue
    if (edge.verticies[0].ogCoords.isCoplanar(foldPlain)) continue
    if (edge.verticies[1].ogCoords.isCoplanar(foldPlain)) continue
    
    if (edge.verticies[0].ogCoords.isAbovePlain(foldPlain) !=
        edge.verticies[1].ogCoords.isAbovePlain(foldPlain)) {

      let newVertexCoords = foldPlain.intersection(edge.toLine())
      let newVertex = addVertex(newVertexCoords)
      addEdge(newVertex, edge.verticies[0])
      addEdge(newVertex, edge.verticies[1])
      removeEdge(edge)
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
      }
    }
  }
  return newPlain
}

function zeroFoldAllEdges(linearStartingVertex) {
  edgeCleanup(true)

  plains.length = 0

  oneEdgeVertecies = []
  twoEdgeVertecies = []
  threePlusEdgeVertecies = []
  for (let vertex of verticies) {
    vertex.plains = []
    if (vertex.edges.length == 1) {
      oneEdgeVertecies.push(vertex)
    }
    else if (vertex.edges.length == 2) {
      twoEdgeVertecies.push(vertex)
    }
    else {
      threePlusEdgeVertecies.push(vertex)
      addSelfPlain(vertex)
    }
  }

  function addSelfPlain(vertex) {
    let e0 = vertex.edges[0].toVector(vertex)
    let e1 = vertex.edges[1].toVector(vertex)
    let v = vertex.ogCoords
    let normal = e0.cross(e1)
    if (normal.equals(ZERO)) { // e1 and e2 are colinear
      if (vertex.edges.length > 2) {
        normal = vertex.edges[0].toVector(vertex).cross(vertex.edges[2].toVector(vertex))
      } else {
        // Default to plain pointing away from origin (mainly used for Hamiltonian solids)
        // Then try up then forward
        let n_v = v.orthoProj(e0)
        let n_UP = UP.orthoProj(e0)
        let n_FORWARD = FORWARD.orthoProj(e0)
        if (!n_v.equals(ZERO)) {
          normal = n_v
        } else if (!n_UP.equals(ZERO)) {
          normal = n_UP
        } else {
          normal = n_FORWARD
        }
      }
    }
    if (normal.dot(FORWARD) < 0) {
      normal = normal.negate()
    }
    normal = normal.normalize()

    for (let i = 2; i < vertex.edges.length; i++) {
      let n2 = vertex.edges[0].toVector(vertex).cross(vertex.edges[i].toVector(vertex)).normalize()
      if (!n2.equals(ZERO) && !normal.plusMinusEquals(n2)) {
        console.error("vertex edges not coplanar", normal, n2)
      }
    }
    vertex.addPlain(new Plain(v, normal))
  }

  if (linearStartingVertex) {
    let vertex = resolveVertex(linearStartingVertex)
    addSelfPlain(vertex)
    twoEdgeVertecies.remove(vertex)
  }
  else if (threePlusEdgeVertecies.length == 0) {
    // Topology is line or circle. So just pick an arbitrary non-colinear 2 edge vertex and set its plain
    for (let vertex of twoEdgeVertecies) {
      if (!ZERO.equals(vertex.edges[0].toVector(vertex).cross(vertex.edges[1].toVector(vertex)))) {
        addSelfPlain(vertex)
        twoEdgeVertecies.remove(vertex)
        break
      }
    }
  }

  let c = 0
  while (twoEdgeVertecies.length > 0) {
    c++;
    if (c > 1000) break;
    let vertex = twoEdgeVertecies.shift()
    let v0 = vertex.edges[0].otherVertex(vertex)
    let v1 = vertex.edges[1].otherVertex(vertex)
    let e0 = v0.ogCoords.sub(vertex.ogCoords)
    let e1 = v1.ogCoords.sub(vertex.ogCoords)
    let normal = e0.cross(e1).normalize()
    if (v0.plains.length > 0 && v1.plains.length > 0) {
      let plain0 = v0.getPlainThatContains(vertex.ogCoords)
      let plain1 = v1.getPlainThatContains(vertex.ogCoords)
      vertex.addPlain(plain0.clone())
      if (!plain0.isCoplanar(plain1)) {
        vertex.addPlain(plain1.clone())
      }
      continue
    }
    if (v1.plains.length > 0) {
      let t = v0
      v0 = v1
      v1 = t
    }
    if (v0.plains.length > 0) {
      let plain0 = v0.getPlainThatContains(vertex.ogCoords)
      vertex.addPlain(plain0.clone())
      if (normal.equals(ZERO) || plain0.normal.plusMinusEquals(normal)) {
        continue
      }
      let mirror = new Plain(vertex.ogCoords, e0.normalize().sub(e1.normalize()))
      vertex.addPlain(plain0.mirror(mirror))
      if (twoEdgeVertecies.includes(v1)) {
        twoEdgeVertecies.remove(v1)
        twoEdgeVertecies.unshift(v1)
      }
      continue
    }

    twoEdgeVertecies.push(vertex)
  }

  for (let vertex of oneEdgeVertecies) {
    let v0 = vertex.edges[0].otherVertex(vertex)
    for (let plain of v0.plains) {
      if (vertex.ogCoords.isCoplanar(plain)) {
        vertex.addPlain(plain)
        break
      }
    }
  }

  let edgesToZeroFold = []
  for (let edge of [...edges]) {
    let lengthThreshold = ZERO_FOLD_LENGTH_THRESHOLD
    if (edge.verticies[0].plains.length > 1 || edge.verticies[1].plains.length > 1) {
      lengthThreshold *= 2
    }
    
    if (edge.length() > lengthThreshold) {
      // zeroFold(edge)
      edgesToZeroFold.push(edge)
      continue
    }
    
    for (let plain0 of edge.verticies[0].plains) {
      for (let plain1 of edge.verticies[1].plains) {
        if (plain0.isCoplanar(plain1)) {
          mergePlains(plain0, plain1)
          break
        }
      }
    }
  }
  for (let edge of edgesToZeroFold) {
    let shouldZeroFold = true
    for (let plain0 of edge.verticies[0].plains) {
      for (let plain1 of edge.verticies[1].plains) {
        if (plain0 == plain1) {
          shouldZeroFold = false
        }
      }
    }
    if (shouldZeroFold) {
      zeroFold(edge)
    }
  }

  for (let plain of plains) {
    if (plain.normal.dot(plain.offset.sub(CENTER)) < 0) {
      plain.normal = plain.normal.negate()
    }
  }
}
function zeroFold(edge) {
  let plain0 = null
  let plain1 = null
  for (let p0 of edge.verticies[0].plains) {
    for (let p1 of edge.verticies[1].plains) {
      if (p0.isCoplanar(p1)) {
        plain0 = p0
        plain1 = p1
        break
      }
    }
  }
  if (plain0 == null) {
    console.log(edge)
    return
  }
  let foldNormal = edge.verticies[0].ogCoords.sub(edge.verticies[1].ogCoords)
  let newVertex = splitEdge(edge, edge.length()/2)
  newVertex.deadendPlain = new Plain(newVertex.ogCoords, foldNormal)
  newVertex.plains = []
  newVertex.addPlain(plain0)
  newVertex.addPlain(plain1)
}
