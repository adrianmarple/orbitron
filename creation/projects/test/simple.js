// SKIP
addButton("test/simple", function() {
  for (let i = -3; i <= 3; i++) {
    for (let j = -3; j <= 3; j++) {
      let manhattan = Math.abs(i) + Math.abs(j)
      if (manhattan > 1) {
        continue
      }
      addSquare([i,j,0])
    }
  }

  scale(4)
  console.log(edges.length)
  EulerianPath(verticies[1], [0])
})
