
module.exports = () => {
  isWall = false
  
  let v0 = addVertex([0,4,0])
  let v1 = addVertex([0,0,0])
  let e = addEdge(v0, v1)
  e = extendAtAngle(e, -12, 4, true)
  e = extendAtAngle(e, -31, 8, false)

  // for (let i = 0; i < 50; i++) {
  //   let angle = 30// * (i%2==0 ? 1:-1)
  //   e = extendAtAngle(e, angle, 4, false)
  //   e = extendAtAngle(e, 2*angle * Math.cos(2*Math.PI * i/10), 4, true)
  // }
  for (let i = 0; i < 5; i++) {
    let angle = 60 * (i%2==0 ? 1:-1)
    e = extendAtAngle(e, angle, 12 - 2*i, false)
    e = extendAtAngle(e, angle/2, 11 - 2*i, true)
  }

  EulerianPath(0)
}