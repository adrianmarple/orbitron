module.exports = async () => {
  await addFromSVG("organic/tree.svg")
  integerize()

  console.log(verticies[0].ogCoords)

  origami({
    offset: new Vector(0, -35, 0),
    normal: new Vector(0, 1, 1),
  })

  EulerianPath(0)
}
