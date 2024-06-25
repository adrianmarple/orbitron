module.exports = async () => {

  await addFromSVG("organic/tree.svg")
  integerize()

  doubleEdges()
  center()
  EulerianPath(0)
}
