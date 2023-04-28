
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
let CHANNEL_DEPTH = 8
let HEIGHT = CHANNEL_DEPTH + BOTTOM_THICKNESS + TOP_THICKNESS
let NOTCH_DEPTH = 6
let FASTENER_DEPTH = NOTCH_DEPTH + 3

let WOOD_KERF = 0.16
let ACRYLIC_KERF = 0.1
let KERF = 0.1 // Good for acrylic NOTE!: Machine kerf was set to 0.025


const MM_TO_96DPI = 3.77952755906

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
KERF *= MM_TO_96DPI


let SIDE_NOTCH = true
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
// let wall2 = wall.cloneNode(true)
// document.body.appendChild(wall2)
// wall2.setAttribute("id", "wall2")
// let wall3 = wall.cloneNode(true)
// document.body.appendChild(wall3)
// wall3.setAttribute("id", "wall3")

const cover = document.createElement("svg")
document.body.appendChild(cover)
cover.outerHTML = `
<svg id="cover" width=1000 height=1000 viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path stroke="#808080"/>
</svg>`


document.getElementById("download").addEventListener('click', function() {
  if (isWall) {
    createWallSVG("wall", false, false)
    downloadSVGAsText("wall", "wall short-short")
    createWallSVG("wall", false, true)
    downloadSVGAsText("wall", "wall short-long")
    createWallSVG("wall", true, false)
    downloadSVGAsText("wall", "wall long-short")
    createWallSVG("wall", true, true)
    downloadSVGAsText("wall", "wall long-long")

    createWallSVG("wall", EDGE_LENGTH - CHANNEL_WIDTH)
    downloadSVGAsText("wall", "wall short/short")
    createWallSVG("wall", EDGE_LENGTH + WALL_THICKNESS)
    downloadSVGAsText("wall", "wall short/long")
    createWallSVG("wall", EDGE_LENGTH + CHANNEL_WIDTH + 2*WALL_THICKNESS)
    downloadSVGAsText("wall", "wall long/long")

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
      createCoverSVG()
      createWallSVG("wall", false, true)
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
  let completedPaths = []

  function addDirectedEdge(v0, v1) {
  	let sum = 0
  	for (let path of paths) {
  		sum += path.length - 1
  	}
  	let e1 = delta(v0.ogCoords, v1.ogCoords)

  	let newPath = null
  	let joined = false

  	for (var path of paths) {
  	  if (path[path.length - 1] != v0) continue

  	  let e0 = delta(path[path.length-1].ogCoords, path[path.length-2].ogCoords)
  	  if (e0[0]*e1[1] - e0[1]*e1[0] > 0.001) { // Left turn
  	  	path.push(v1)
  	  	newPath = path
	  	if (newPath[0].index == newPath[newPath.length - 1].index) {
	  	  completedPaths.push(newPath);
	  	  paths.splice(paths.indexOf(newPath), 1)
	  	  return
	  	}
	  	joined = true
	  	break
  	  }
  	}
  	if (!joined) {
  	  newPath = [v0, v1]
  	  paths.push(newPath)
  	}

  	for (var path of paths) {
  	  if (path[0] != v1) continue

  	  e0 = delta(path[0].ogCoords, path[1].ogCoords)
  	  if (e0[0]*e1[1] - e0[1]*e1[0] > 0.001) { // Left turn
	  	paths.splice(paths.indexOf(path), 1)
	  	newPath.pop()
	  	for (let v of path) {
	  	  newPath.push(v)
	  	}
	  	if (newPath[0].index == newPath[newPath.length - 1].index) {
	  	  completedPaths.push(newPath);
	  	  paths.splice(paths.indexOf(newPath), 1)
	  	  return
	  	}
	  	break
  	  }
  	}
  }

  for (let edge of edges) {
  	addDirectedEdge(edge.verticies[0], edge.verticies[1])
  	addDirectedEdge(edge.verticies[1], edge.verticies[0])
  }

  // This bit should join all the non-squares together
  let endVertexToPath = {}
  for (let path of paths) {
  	endVertexToPath[path[path.length - 1].index] = path
  }
  for (let path of paths) {
  	if (path[0] == path[path.length - 1]) {
  	  completedPaths.push(path);
  	  continue
  	}
  	let precedingPath = endVertexToPath[path[0].index]
  	precedingPath.pop()
  	for (let v of path) {
  	  precedingPath.push(v)
  	}
  	endVertexToPath[precedingPath[precedingPath.length - 1].index] = precedingPath
  }

  var offsetX = 0;
  var offsetY = 0;
  for (let v of verticies) {
  	offsetX = Math.min(offsetX, v.ogCoords[0])
  	offsetY = Math.min(offsetY, v.ogCoords[1])
  }
  var offset = [-offsetX + 0.1, -offsetY + 0.1, 0]
  var unitDist = d(completedPaths[0][0].ogCoords, completedPaths[0][1].ogCoords)

  let totalPathString = ""
  for (let path of completedPaths) {
  	path.pop()
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
        let w = (CHANNEL_WIDTH/2 + WALL_THICKNESS + BORDER) * (e0[0]*e1[1] - e0[1]*e1[0])
        pathString += pointsToSVGString([[w,w]], [e0, e1], v1)
        continue
      }

      let points = []
      if (LENGTHWISE_NOTCH) {
        points = [[EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + WALL_THICKNESS)],
          [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + 2*KERF)]]
      }
      if (sign > 0.01) {
        points = points.concat([
          [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + 2*KERF],
          [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + WALL_THICKNESS],
          [CHANNEL_WIDTH/2 + FASTENER_DEPTH, CHANNEL_WIDTH/2 + WALL_THICKNESS],
        ])
      } else {
        points = points.concat([
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - 2*KERF],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
          [-CHANNEL_WIDTH/2 + FASTENER_DEPTH - WALL_THICKNESS, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
          [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS*1.5, -CHANNEL_WIDTH/2 - WALL_THICKNESS - FASTENER_DEPTH + NOTCH_DEPTH],
          [ -CHANNEL_WIDTH/2 - WALL_THICKNESS,  -CHANNEL_WIDTH/2 - WALL_THICKNESS],
        ])
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
      for (let i = 0; i <= path.length; i++) { // 1 Extra to handle joining start and end
        let v0 = scale(add(path[i % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)
        let v1 = scale(add(path[(i+1) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)
        let v2 = scale(add(path[(i+2) % path.length].ogCoords, offset), EDGE_LENGTH / unitDist)

        let e0 = normalize(delta(v0, v1))
        let e1 = normalize(delta(v2, v1))

        let sign = e0[0]*e1[1] - e0[1]*e1[0]

        if (i > 0) {
          let endString = ""
          if (LENGTHWISE_NOTCH) {
            endString = pointsToSVGString([
              [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + WALL_THICKNESS)],
              [EDGE_LENGTH/2 - NOTCH_DEPTH/2 + KERF, sign * (CHANNEL_WIDTH/2 + 2*KERF)],
            ], [e0, e1], v1)
            endString = "M" + endString.substring(1)
          }

          if (sign > 0.01) {
            endString += pointsToSVGString([
              [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + 2*KERF],
              [CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF, CHANNEL_WIDTH/2 + WALL_THICKNESS],
            ], [e0, e1], v1)
          } else {
            endString += pointsToSVGString([
              [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - 2*KERF],
              [-CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF, -CHANNEL_WIDTH/2 - WALL_THICKNESS],
            ], [e0, e1], v1)
          }
          totalPathString += endString + "Z "
        }
        if (i < path.length) {
          let startString = ""
          if (sign > 0.01) {
            startString = pointsToSVGString([
              [CHANNEL_WIDTH/2 + WALL_THICKNESS, CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF],
              [CHANNEL_WIDTH/2 + 2*KERF,         CHANNEL_WIDTH/2 + NOTCH_DEPTH + KERF],
            ], [e0, e1], v1)
          } else {
            startString = pointsToSVGString([
              [-CHANNEL_WIDTH/2 - WALL_THICKNESS, -CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF],
              [-CHANNEL_WIDTH/2 - 2*KERF,         -CHANNEL_WIDTH/2 + NOTCH_DEPTH - WALL_THICKNESS + KERF],
            ], [e0, e1], v1)
          }
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

function pointsToSVGString(points, basis, offset, flip) {
  let s = ""
  for (let point of points) {
  	let truePoint = add(scale(basis[0], point[0]), scale(basis[1], point[1]))
  	truePoint = add(truePoint, offset)
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
