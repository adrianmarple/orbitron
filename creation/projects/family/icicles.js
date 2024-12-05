
module.exports = () => {
  setFor3DPrintedCovers()
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
  let startPoint = new Vector(0,0,0)
  let v0 = addVertex(startPoint)

  // console.log(addLine(v0, 10, 90).verticies[1])
  // origami(new Plain(
  //   new Vector(0, -7, 0),
  //   new Vector(0, -1, -1)
  // ))
  // origami(new Plain(
  //   new Vector(0, -3, 0),
  //   new Vector(0, 1, 1)
  // ))
  // console.log(plains[0].normal)
  // console.log(plains[1].normal)
  // console.log(plains[2].normal)

  let previousPlain = new Plain(startPoint, FORWARD)
  let previousEdge = addLine(v0, 3, 90)
  let previousVertex = previousEdge.otherVertex(v0)
  for (let i = 0; i < 2; i++) {
    // let targetPoint = DOWN.scale(i * (3 + Math.log(i/2+1)/2) + 7)
    //   .add(FORWARD.scale(2 * (MAX - i/2)/MAX).rotate(UP, i+1))
    let targetPoint = new Vector(0, -8, 3)
    if (i == 1) {
      targetPoint = new Vector(2, -10, 2)
    }

    let diff = targetPoint.sub(previousVertex.ogCoords)
    diff = diff.scale(Math.round(diff.length()) / diff.length())
    let actualPoint = previousVertex.ogCoords.add(diff)
    let newVertex = addVertex(actualPoint)

    let foldNormal = diff.normalize().add(previousEdge.toVector(previousVertex).normalize())
    foldNormal = foldNormal.negate()

    let foldPlain = new Plain(previousVertex.ogCoords, foldNormal)

    let newPlain = previousPlain.mirror(foldPlain)

    addPlain(newPlain)
    newVertex.plains = [newPlain]
    previousVertex.plains.push(newPlain)
    previousPlain = newPlain

    previousEdge = addEdge(previousVertex, newVertex)
    previousVertex = newVertex
  }
  console.log(plains[0].normal)
  console.log(plains[1].normal)
  console.log(plains[2].normal)

  // const MAX = 10

  // let startPoint = new Vector(0,0,2)
  // let v0 = addVertex(startPoint)

  // let previousPlain = new Plain(startPoint, FORWARD)
  // let previousEdge = addLine(v0, 4, 45)
  // let previousVertex = previousEdge.otherVertex(v0)
  // for (let i = 0; i < 2; i++) {
  //   let targetPoint = DOWN.scale(i * (3 + Math.log(i/2+1)/2) + 7)
  //     .add(FORWARD.scale(2 * (MAX - i/2)/MAX).rotate(UP, i+1))

  //   let diff = targetPoint.sub(previousVertex.ogCoords)
  //   // console.log(Math.round(diff.length()))
  //   diff = diff.scale(Math.round(diff.length()) / diff.length())
  //   let actualPoint = previousVertex.ogCoords.add(diff)
  //   let newVertex = addVertex(actualPoint)

  //   let foldNormal = diff.normalize().add(previousEdge.toVector(previousVertex).normalize())
  //   let foldPlain = new Plain(previousVertex.ogCoords, foldNormal)

  //   let newPlain = previousPlain.mirror(foldPlain)

  //   addPlain(newPlain)
  //   // previousPlain.folds[newPlain.index] = foldPlain
  //   // newPlain.folds[previousPlain.index] = foldPlain
  //   newVertex.plains = [newPlain]
  //   previousVertex.plains.push(newPlain)
  //   previousPlain = newPlain

  //   previousEdge = addEdge(previousVertex, newVertex)
  //   previousVertex = newVertex
  // }

  EulerianPath(0)
}