// v1.0.1
module.exports = async () => {
  await addFromSVG("organic/snake3.svg")
  scale(1.2)
  integerize()

  zeroFoldAllEdges()
  EulerianPath(0)
}
