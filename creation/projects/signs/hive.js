// SKIP
module.exports = async () => {

  await addFromSVG("signs/hive.svg")
  addTriangulation(verticies[46], verticies[44], 16)

  scale(0.5)
  EulerianPath(11)
}
