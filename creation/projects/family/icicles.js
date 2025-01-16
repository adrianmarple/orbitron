
module.exports = () => {
  setFor3DPrintedCovers()

  let v0 = addVertex(new Vector(0,0,0))
  spiral(v0, 29, true)

  let v1 = addVertex(new Vector(16,0,0))
  addEdge(v0,v1)
  spiral(v1, 12)

  let v2 = addVertex(new Vector(54,0,0))
  addEdge(v2,v1)
  spiral(v2, 8)

  let v3 = addVertex(new Vector(110,0,0))
  addEdge(v2,v3)
  spiral(v3, 39)

  let v4 = addVertex(new Vector(146,0,0))
  addEdge(v4,v3)
  // spiral(v4, 14, true)

  EulerianPath(0)
}

function spiral(v0, count, clampX) {
  let previousPlain = new Plain(v0.ogCoords, FORWARD)
  let previousEdge = addLine(v0, 3, 90)
  let previousVertex = previousEdge.otherVertex(v0)
  for (let i = 0; i < count; i++) {
    let targetPoint = v0.ogCoords.add(DOWN.scale(i * (3 + Math.log(i/2+1)/2) + 7))
      .add(FORWARD.scale(2 * (count - i/2)/count).rotate(UP, i+1))

    if (clampX) {
      targetPoint.x = v0.ogCoords.x
    }

    let diff = targetPoint.sub(previousVertex.ogCoords)
    diff = diff.scale(Math.round(diff.length()) / diff.length())
    let actualPoint = previousVertex.ogCoords.add(diff)
    let newVertex = addVertex(actualPoint)
    // let newVertex = addVertex(targetPoint)

    let foldNormal = diff.normalize().add(previousEdge.toVector(previousVertex).negate().normalize())
    let foldPlain = new Plain(previousVertex.ogCoords, foldNormal)

    let mirrorPlainOffset = previousPlain.intersection(foldPlain).offset
    let mirrorPlainNormal = previousPlain.normal.orthoProj(foldPlain.normal)
    mirrorPlain = new Plain(mirrorPlainOffset, mirrorPlainNormal)
    let newPlain = previousPlain.mirror(mirrorPlain)

    addPlain(newPlain)
    newVertex.plains = [newPlain]
    previousVertex.plains.push(newPlain)
    previousPlain = newPlain

    previousEdge = addEdge(previousVertex, newVertex)
    previousVertex = newVertex
  }

}
