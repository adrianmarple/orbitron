// SKIP
module.exports = () => {
  pixelDensity = 0.25

  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      let manhattan = Math.abs(i) + Math.abs(j)
      if (manhattan > 6) {
        continue
      }
      if (manhattan < 3) {
        continue
      }

      addSquare([i,j,0])
    }
  }

  console.log(edges.length)

  // WARNING: this produces a different path from what's on my wall!
  EulerianPath(verticies[1], [0])

  rotateZAll(Math.PI/2)
  for (let vertex of verticies) {
    vertex.coordinates[1] *= -1
    vertex.ogCoords = vertex.coordinates.clone()
  }
}