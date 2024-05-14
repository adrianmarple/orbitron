// SKIP
module.exports = () => {
  ledAtVertex = false

  let v0 = addVertex([0,0,0])
  for (let i = 1; i <= 6; i++) {
    let v1 = addVertex([i * 7, 0, 0])
    addSquareulation(v0, v1, 37, 1)
    v0 = v1
  }

  center()

  EulerianPath(17)
}