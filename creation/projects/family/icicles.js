
module.exports = () => {
  
  // let v0 = addVertex([0,4,0])
  // let v1 = addVertex([0,0,0])
  // let e = addEdge(v0, v1)
  // e = extendAtAngle(e, -12, 4, true)
  // e = extendAtAngle(e, -31, 8, false)

  // for (let i = 0; i < 5; i++) {
  //   let angle = 60 * (i%2==0 ? 1:-1)
  //   e = extendAtAngle(e, angle, 12 - 2*i, false)
  //   e = extendAtAngle(e, angle/2, 11 - 2*i, true)
  // }
  const MAX = 10

  let startPoint = new Vector(0,0,2)
  let v0 = addVertex(startPoint)

  let previousPlain = new Plain(startPoint, FORWARD)
  let previousEdge = addLine(v0, 4, 45)
  let previousVertex = previousEdge.otherVertex(v0)
  for (let i = 0; i < 2; i++) {
    let targetPoint = DOWN.scale(i * (3 + Math.log(i/2+1)/2) + 7)
      .add(FORWARD.scale(2 * (MAX - i/2)/MAX).rotate(UP, i+1))

    let diff = targetPoint.sub(previousVertex.ogCoords)
    // console.log(Math.round(diff.length()))
    diff = diff.scale(Math.round(diff.length()) / diff.length())
    let actualPoint = previousVertex.ogCoords.add(diff)
    let newVertex = addVertex(actualPoint)

    let foldNormal = diff.normalize().add(previousEdge.toVector(previousVertex).normalize())
    let foldPlain = new Plain(previousVertex.ogCoords, foldNormal)

    let newPlain = previousPlain.mirror(foldPlain)
    console.log(previousVertex.ogCoords.isCoplanar(newPlain))
    console.log(newVertex.ogCoords.isCoplanar(newPlain))
    console.log(diff)
    console.log(previousPlain, newPlain, foldPlain)
    console.log(previousPlain.normal.angleTo(newPlain.normal) * 180/Math.PI)
    addPlain(newPlain)
    // previousPlain.folds[newPlain.index] = foldPlain
    // newPlain.folds[previousPlain.index] = foldPlain
    newVertex.plains = [newPlain]
    previousVertex.plains.push(newPlain)
    previousPlain = newPlain

    previousEdge = addEdge(previousVertex, newVertex)
    previousVertex = newVertex
  }

  EulerianPath(0)
}