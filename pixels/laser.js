
// TODO
// x (togglable) side notches in walls
// x wood kerf vs acrylic/top kerf
// x create separate svgs for bottom and top (with different kerfs)
// x (togglable) lengthwise notches (mostly for double length)
// x (togglable) above separate for top and bottom

let BOTTOM_THICKNESS = 5.2
let TOP_THICKNESS = 2.9
let WALL_THICKNESS = 2.35
let BORDER = 5
let DEFAULT_PIXEL_DIST = 16.6
let PIXEL_DISTANCE = DEFAULT_PIXEL_DIST
let EDGE_LENGTH = 4 * PIXEL_DISTANCE
let CHANNEL_WIDTH = 12
let CHANNEL_DEPTH = 10
let HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
let NOTCH_DEPTH = 6
let FASTENER_DEPTH = NOTCH_DEPTH + 3

let WOOD_KERF = 0.16
let ACRYLIC_KERF = -0.02
let KERF = ACRYLIC_KERF


let MM_TO_96DPI = 3.77952755906
// MM_TO_96DPI = 1

BOTTOM_THICKNESS *= MM_TO_96DPI
TOP_THICKNESS *= MM_TO_96DPI
WALL_THICKNESS *= MM_TO_96DPI
BORDER *= MM_TO_96DPI
DEFAULT_PIXEL_DIST *= MM_TO_96DPI
PIXEL_DISTANCE *= MM_TO_96DPI
EDGE_LENGTH *= MM_TO_96DPI
CHANNEL_WIDTH *= MM_TO_96DPI
CHANNEL_DEPTH *= MM_TO_96DPI
HEIGHT *= MM_TO_96DPI
NOTCH_DEPTH *= MM_TO_96DPI
FASTENER_DEPTH *= MM_TO_96DPI
WOOD_KERF *= MM_TO_96DPI
ACRYLIC_KERF *= MM_TO_96DPI
KERF *= MM_TO_96DPI


let SIDE_NOTCH = false
let BOTTOM_NOTCH = true
let TOP_NOTCH = false
let LENGTHWISE_NOTCH = true
let SPECIAL_BORDERS = true

const svgStyle = document.createElement("style")
document.head.appendChild(svgStyle)
svgStyle.innerHTML = `
svg {
  position: absolute;
  top: 20px;
  left: 20px;
}
#cover {
  top: 30px
}
`

let wall = document.createElement("svg")
document.body.appendChild(wall)
wall.outerHTML = `
<svg id="wall" width=1000 height=100 viewBox="0 0 1000 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path stroke="#808080"/>
</svg>`
wall = document.getElementById("wall")

let cover = document.createElement("svg")
document.body.appendChild(cover)
cover.outerHTML = `
<svg id="cover" width=1000 height=1000 viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path stroke="#808080"/>
</svg>`
cover = document.getElementById("cover")


document.getElementById("download").addEventListener('click', function() {
  if (isWall) {
    // createWallSVG("wall", false, false)
    // downloadSVGAsText("wall", "wall short-short")
    // createWallSVG("wall", false, true)
    // downloadSVGAsText("wall", "wall short-long")
    // createWallSVG("wall", true, false)
    // downloadSVGAsText("wall", "wall long-short")
    // createWallSVG("wall", true, true)
    // downloadSVGAsText("wall", "wall long-long")

    // SPECIAL_BORDERS = false
    LENGTHWISE_NOTCH = TOP_NOTCH
    KERF = ACRYLIC_KERF
    createCoverSVG()
    downloadSVGAsText("cover", "top")
    // SPECIAL_BORDERS = true
    LENGTHWISE_NOTCH = BOTTOM_NOTCH
    KERF = WOOD_KERF
    createCoverSVG()
    downloadSVGAsText("cover", "bottom")
  }
})

document.querySelectorAll(".button").forEach(elem => elem.addEventListener('click', function() {
  setTimeout(() => {
    if (isWall) {
      // createCoverSVG()
      // createWallSVG("wall", false, true)
    } else {
      document.querySelectorAll("path").forEach(path => path.setAttribute('d', ""))
    }
  }, 1)
}))

function createWallSVG(id, isLongA, isLongB) {
  let lengthA = EDGE_LENGTH/2 - CHANNEL_WIDTH/2
  if (isLongA) lengthA += CHANNEL_WIDTH + WALL_THICKNESS
  let lengthB = EDGE_LENGTH/2 - CHANNEL_WIDTH/2
  if (isLongB) lengthB += CHANNEL_WIDTH + WALL_THICKNESS

  let path = `M0 ${BOTTOM_THICKNESS + CHANNEL_DEPTH}
  	h${NOTCH_DEPTH}
  	v${TOP_THICKNESS}`

  if (TOP_NOTCH) {
    path += `
    h${lengthA - 1.5*NOTCH_DEPTH}
    v${-TOP_THICKNESS}
    h${NOTCH_DEPTH}
    v${TOP_THICKNESS}
    h${lengthB - 1.5*NOTCH_DEPTH}`
  } else {
    path += `h${lengthA + lengthB - 2*NOTCH_DEPTH}`
  }
  	
  path += `
  	v${-TOP_THICKNESS}
  	h${NOTCH_DEPTH - WALL_THICKNESS}`

  if (SIDE_NOTCH) {
    path += `v${-CHANNEL_DEPTH/3}
    h${WALL_THICKNESS}
    v${-CHANNEL_DEPTH/3}
    h${-WALL_THICKNESS}
    v${-CHANNEL_DEPTH/3}`
  } else {
    path += `v${-CHANNEL_DEPTH}`
  }

  path += `
  	h${-(NOTCH_DEPTH - WALL_THICKNESS)}
  	v${-BOTTOM_THICKNESS}`


  if (BOTTOM_NOTCH) {
    path += `
    h${-lengthB + 1.5*NOTCH_DEPTH}
    v${BOTTOM_THICKNESS}
    h${-NOTCH_DEPTH}
    v${-BOTTOM_THICKNESS}
    h${-lengthA + 1.5*NOTCH_DEPTH}`
  } else {
    path += `h${2*NOTCH_DEPTH - lengthA - lengthB}`
  }

  path += `
  	v${BOTTOM_THICKNESS}
  	h${-NOTCH_DEPTH}`

  if (SIDE_NOTCH) {
    path += `
    v${CHANNEL_DEPTH/3}
    h${WALL_THICKNESS}
    v${CHANNEL_DEPTH/3}
    h${-WALL_THICKNESS}
    Z`
  } else {
    path += "Z"
  }
  document.querySelector(`#${id} path`).setAttribute("d", path)
}

function createCoverSVG() {
  let paths = []
  let directedEdges = []
  for (let edge of edges) {
    directedEdges.push([edge.verticies[0], edge.verticies[1]])
    directedEdges.push([edge.verticies[1], edge.verticies[0]])
  }

  while (directedEdges.length > 0) {
    let lastEdge = directedEdges.pop()
    let path = [...lastEdge]

    while (path[0] != path[path.length - 1]) {
      let e0 = delta(path[path.length-1].ogCoords, path[path.length-2].ogCoords)
      let leftmostTurn = null
      let maxCrossFactor = -1e6
      for (let dEdge of directedEdges) {
        let [v0, v1] = dEdge
        if (path[path.length - 1] != v0) continue
        if (path[path.length - 2] == v1) continue

        let e1 = delta(v0.ogCoords, v1.ogCoords)

        let crossFactor = e0[0]*e1[1] - e0[1]*e1[0]
        if (crossFactor > maxCrossFactor) {
          maxCrossFactor = crossFactor
          leftmostTurn = dEdge
        }
      }
      if (leftmostTurn == null) {
        console.error("Path deadend!")
        break
      }
      directedEdges.splice(directedEdges.indexOf(leftmostTurn), 1)
      path.push(leftmostTurn[1])
    }
    paths.push(path)
  }


  var offsetX = 0;
  var offsetY = 0;
  for (let v of verticies) {
  	offsetX = Math.min(offsetX, v.ogCoords[0])
  	offsetY = Math.min(offsetY, v.ogCoords[1])
  }
  var offset = [-offsetX + 0.1, -offsetY + 0.1, 0]
  var unitDist = d(paths[0][0].ogCoords, paths[0][1].ogCoords)

  let totalPathString = ""
  for (let path of paths) {
  	path.pop() // Remove duplicated first/last vertex
  	let pathString = ""

    let isBorder = SPECIAL_BORDERS && path.length > 4

   	for (let i = 0; i < path.length; i++) {
  	  let v0 = scale(add(path[i].ogCoords, offset), EDGE_LENGTH / unitDist)
  	  let v1 = scale(add(path[(i+1) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)
  	  let v2 = scale(add(path[(i+2) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)

  	  let e0 = normalize(delta(v0, v1))
  	  let e1 = normalize(delta(v2, v1))

      let sign = e0[0]*e1[1] - e0[1]*e1[0]

      if (isBorder) {
        if (sign*sign > 0.1) {
          let w = (CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER) * sign
          pathString += pointsToSVGString([[w,w]], [e0, e1], v1)
        }
        continue
      }

      let points = []
      if (LENGTHWISE_NOTCH) {
        points = [[EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + WALL_THICKNESS)],
          [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + 2*KERF)]]
      }
      if (sign > 0.01) { // left
        points = points.concat([
          [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + 2*KERF],
          [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + WALL_THICKNESS],
          [CHANNEL_WIDTH/2 + FASTENER_DEPTH, CHANNEL_WIDTH/2 + WALL_THICKNESS],
        ])
      } else if (sign < -0.01) { // right
        points = points.concat([
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - 2*KERF],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
          [-CHANNEL_WIDTH/2 + FASTENER_DEPTH - WALL_THICKNESS, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*1.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
          [ -CHANNEL_WIDTH/2 - WALL_THICKNESS,  -CHANNEL_WIDTH/2 - WALL_THICKNESS],
        ])
      } else { // straight
        // TODO maybe
      }

      pathString += pointsToSVGString(points, [e0, e1], v1, true)

  	  // if (e0[0]*e1[1] - e0[1]*e1[0] > 0.01) {
      //   pathString += pointsToSVGString([
      //     [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + 2*KERF],
      //     [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + WALL_THICKNESS],
      //     [CHANNEL_WIDTH/2 + FASTENER_DEPTH, CHANNEL_WIDTH/2 + WALL_THICKNESS],
      //   ], [e0, e1], v1, true)
      // } else {
      //   pathString += pointsToSVGString([
      //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - 2*KERF],
      //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
      //     [-CHANNEL_WIDTH/2 + FASTENER_DEPTH - WALL_THICKNESS, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
      //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
      //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*1.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
      //     [ -CHANNEL_WIDTH/2 - WALL_THICKNESS,  -CHANNEL_WIDTH/2 - WALL_THICKNESS],
      //   ], [e0, e1], v1, true)
      // }
  	}
  	pathString = "M" + pathString.substring(1) + "Z "
  	totalPathString += pathString

    if (isBorder) {
      const shortSigma = CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF
      const longSigma = -CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF

      for (let i = 0; i <= path.length; i++) { // 1 Extra to handle joining start and end
        let v0 = scale(add(path[i % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)
        let v1 = scale(add(path[(i+1) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)
        let v2 = scale(add(path[(i+2) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)

        let e0 = normalize(delta(v0, v1))
        let e1 = normalize(delta(v2, v1))

        let sign = e0[0]*e1[1] - e0[1]*e1[0]
        let isStraight = false
        if (sign*sign < 1e-5) {
          e1 = cross(e0, [0,0,1])
          sign = -1
          isStraight = true
        }

        let sigma = sign > 0.1 ? shortSigma : longSigma;

        if (i > 0) {
          let endString = ""
          if (LENGTHWISE_NOTCH) {
            endString = pointsToSVGString([
              [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + WALL_THICKNESS)],
              [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + 2*KERF)],
            ], [e0, e1], v1)
            endString = "M" + endString.substring(1)
          }

          endString += pointsToSVGString([
              [sigma, CHANNEL_WIDTH/2 + 2*KERF],
              [sigma, CHANNEL_WIDTH/2 + WALL_THICKNESS],
            ], [e0, scale(e1, sign)], v1)

          // if (sign > 0.01) {
          //   endString += pointsToSVGString([
          //     [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + 2*KERF],
          //     [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + WALL_THICKNESS],
          //   ], [e0, e1], v1)
          // } else {
          //   endString += pointsToSVGString([
          //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - 2*KERF],
          //     [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
          //   ], [e0, e1], v1)
          // }
          totalPathString += endString + "Z "
        }
        if (i < path.length) {
          if (isStraight) {
            let t = e0
            e0 = scale(e1,-1)
            e1 = scale(t,-1)
            sign *= -1
            sigma = shortSigma
          }
          let startString = ""
          startString = pointsToSVGString([
            [CHANNEL_WIDTH/2 + WALL_THICKNESS, sigma],
            [CHANNEL_WIDTH/2 + 2*KERF,         sigma],
          ], [scale(e0, sign), e1], v1)

          startString = "M" + startString.substring(1)

          if (LENGTHWISE_NOTCH) {
            startString += pointsToSVGString([
              [sign * (CHANNEL_WIDTH/2 + 2*KERF),         EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF],
              [sign * (CHANNEL_WIDTH/2 + WALL_THICKNESS), EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF],
            ], [e0, e1], v1)
            startString += " Z"
          }
          totalPathString += startString
        }
      }
    }
  }
  document.querySelector("#cover path").setAttribute("d", totalPathString)
}

let maxX = 0
let maxY = 0

function pointsToSVGString(points, basis, offset, flip) {
  let s = ""
  for (let point of points) {
  	let truePoint = add(scale(basis[0], point[0]), scale(basis[1], point[1]))
  	truePoint = add(truePoint, offset)
    if (truePoint[0] > maxX || truePoint[1] > maxY) {
      maxX = Math.ceil(Math.max(maxX, truePoint[0])) + 10
      maxY = Math.ceil(Math.max(maxY, truePoint[1])) + 10
      cover.setAttribute("width", maxX)
      cover.setAttribute("height", maxY)
      cover.setAttribute("viewBox", `0 0 ${maxX} ${maxY}`)
    }
  	s += `L${truePoint[0]} ${truePoint[1]} `
  }
  if (flip) {
    s += pointsToSVGString(points.reverse(), basis.reverse(), offset)
  }
  return s
}

function printPath(path) {
  	console.log("path", path.length)
  	for (let vertex of path) {
  	  console.log(vertex.index)
  	}
}

function downloadSVGAsText(id, name) {
  if (!name) name = id;
  let fileContent = document.getElementById(id).outerHTML
  let blob = new Blob([fileContent], { type: 'text/plain' })
  let a = document.createElement('a')
  a.download = name + '.svg'
  a.href = window.URL.createObjectURL(blob)
  a.textContent = 'Download ready';
  a.style='display:none';
  a.click()
}
