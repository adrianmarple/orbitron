module.exports = async () => {
  await addFromSVG("organic/tree.svg")
  integerize()

  console.log(verticies[0].ogCoords)

  origami({
    offset: [0, -35, 0],
    normal: [0, 1, 1],
  })

  doubleEdges()
  center()
  EulerianPath(0)
}
