
a = 9
b = 7
c = 6
e = 10
f = 6
g = 18
h = 15
j = 16
k = 3
l = 28

// a = 5
// b = 4
// c = 4
// e = 7
// f = 4
// g = 14
// h = 10
// j = 12
// k = 2
// l = 11


addButton("de Ruyter Crest", () => {
  name = "deruyter"

  for (let i = 0; i < 4; i++) {
    addVertex(rotateZ([0,a,0], i * Math.PI/2))
  }
  for (let i = 0; i < 4; i++) {
    let v1 = verticies[i]
    let v2 = verticies[(i+1) % 4]
    addTriangulation(v1, v2, b)
  }
  let octEdges = [...edges]
  console.log(edges)

  // let octEdges = addPolygon(8, [0,0,0], 8)
  // rotateZAll(Math.PI / 8, true)

  let addedVerticies = []
  for (let i = 0; i < octEdges.length; i++) {
    let edge = octEdges[i]
    let v1 = edge.verticies[0]
    let v2 = edge.verticies[1]
    let v = addTriangulation(v1, v2, c)
    addedVerticies.push(v)
  }
  
  let moreVerticies = []
  for (let i = 1; i < addedVerticies.length; i += 2) {
    let v1 = addedVerticies[i]
    let v2 = addedVerticies[(i+1) % addedVerticies.length]
    let [v3,v4] = addSquareulation(v1, v2, e, f)
    addTriangulation(v3,v4, g)
    let v5 = addTriangulation(v1,v3, h,j)
    let v6 = addTriangulation(v4,v2, j,h)
    moreVerticies.push(v5)
    moreVerticies.push(v6)
  }
  for (let i = 1; i < moreVerticies.length; i += 2) {
    let v1 = moreVerticies[i]
    let v2 = moreVerticies[(i+1) % moreVerticies.length]
    
    addTriangulation(v1, v2, k)
    addTriangulation(v1, v2, l)
  }
  
  EulerianPath(36)
})
