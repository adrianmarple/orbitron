
module.exports = () => {
  setFor3DPrintedCovers()

  const MAX = 10
  let startPoint = new Vector(0,0,0)
  let v0 = addVertex(startPoint)

  let previousPlain = new Plain(startPoint, FORWARD)
  let previousEdge = addLine(v0, 3, 90)
  let previousVertex = previousEdge.otherVertex(v0)
  for (let i = 0; i < 7; i++) {
    let targetPoint = DOWN.scale(i * (3 + Math.log(i/2+1)/2) + 7)
      .add(FORWARD.scale(2 * (MAX - i/2)/MAX).rotate(UP, i+1))

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

  EulerianPath(0)
}