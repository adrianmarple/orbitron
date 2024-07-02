module.exports = async () => {
  await addFromSVG("organic/tree.svg")
  integerize()

  origami(new Plain(
    new Vector(0, -35, 0),
    new Vector(0, 1, 1)
  ))

  EulerianPath(0)
}
