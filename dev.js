var data, camera, scene, renderer, group, pixels, ws, rawPixels, gameState, composer

fetch("/pixels.json").then(function(response){
  return response.json()
}).then(function(json){
  data = json
  init()
  startWebsocket()
  animate()
})

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max)
} 



function init() {

  group = new THREE.Group()
  scene = new THREE.Scene()
  bgColor = new THREE.Color(0)
  stripColor = new THREE.Color(0x282828)
  standColor = new THREE.Color(0x080808)
  scene.background = bgColor

  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 10000)
  camera.position.z = 17
  scene.add(camera)
  var points = []
  pixels = []
  for (var point of data.coordinates) {
    var cgeometry = new THREE.SphereGeometry(0.06, 8, 8)
    cgeometry.translate(point[0], point[1], point[2])
    var cmaterial = new THREE.MeshBasicMaterial({
      color: 0x999999
    })
    var cube = new THREE.Mesh(cgeometry, cmaterial)
    pixels.push(cube)
    group.add(cube)
    points.push(new THREE.Vector3(point[0], point[1], point[2]))
  }
  var start = data.coordinates[0]
  points.push(new THREE.Vector3(start[0], start[1], start[2]))
  var material = new THREE.LineBasicMaterial({
    color: stripColor,
  })
  var geometry = new THREE.BufferGeometry().setFromPoints(points)
  var line = new THREE.Line(geometry, material)
  group.add(line)

  var cygeometry = new THREE.CylinderGeometry( 0.75, 0.75, 1.5, 32 )
  cygeometry.rotateX(Math.PI/2)
  cygeometry.translate(0,0,-5)
  var cymaterial = new THREE.MeshBasicMaterial( {color: standColor} )
  var cylinder = new THREE.Mesh( cygeometry, cymaterial )
  group.add( cylinder )

  var sgeometry = new THREE.SphereGeometry( 4.25, 32, 16 )
  var smaterial = new THREE.MeshBasicMaterial( { color: bgColor } )
  var sphere = new THREE.Mesh( sgeometry, smaterial )
  smaterial.transparent = true
  smaterial.opacity = 0.8
  group.add( sphere )

  scene.add(group)

  renderer = new THREE.WebGLRenderer()
  renderer.setSize(window.innerWidth-20, window.innerHeight-20)

  composer = new THREE.EffectComposer(renderer)
  composer.addPass(new THREE.RenderPass(scene, camera))

  document.body.appendChild(renderer.domElement)
  const bloomPass = new THREE.UnrealBloomPass(
      resolution=new THREE.Vector2(256, 256),
      strength=3,
      radius=0,
      threshold=0
  )
  composer.addPass(bloomPass)

}

function animate() {

  requestAnimationFrame(animate)
  render()

}

function render() {
  if(north){
    moveVelocityY = moveVelocityY + acceleration
  }
  if(south){
    moveVelocityY = moveVelocityY - acceleration
  }
  if(east){
    moveVelocityX = moveVelocityX - acceleration
  }
  if(west){
    moveVelocityX = moveVelocityX + acceleration
  }
  moveVelocityX = clamp(moveVelocityX * exponentialFactor, -maxVelocityX, maxVelocityX)
  moveVelocityY = clamp(moveVelocityY * exponentialFactor, -maxVelocityY, maxVelocityY)
  yOffset += moveVelocityY
  xOffset += moveVelocityX
  var maxYOffset = 0.65*200
  if(yOffset > maxYOffset){
    moveVelocityY = 0
    yOffset = maxYOffset
  }else if(yOffset < -maxYOffset){
    moveVelocityY = 0
    yOffset = -maxYOffset
  }
  var rotationFactor = 200
  var yRotation = clamp(yOffset/rotationFactor,-maxYOffset,maxYOffset)
  var xRotation = xOffset/rotationFactor
  group.rotation.set(yRotation-Math.PI/2,0,xRotation)
  if(rawPixels){
    var rp = pako.inflate(rawPixels, {to:'string'})
    for(let i = 0 ; i < pixels.length ; i++){
      var pixel = pixels[i]
      var j = i*6
      var color = `#${rp.slice(j+2,j+4)}${rp.slice(j+0,j+2)}${rp.slice(j+4,j+6)}`
      let c = new THREE.Color()
      c.setStyle(color, THREE.LinearSRGBColorSpace)
      c.multiplyScalar(5)
      pixel.material.color = c
    }
  }

  composer.render()
}

var moveVelocityX = 0
var moveVelocityY = 0
var maxVelocityX = 10
var maxVelocityY = 8
var acceleration = 3
var exponentialFactor = 0.7
var west = false
var east = false
var north = false
var south = false

document.addEventListener("keydown", moveStart, false)
document.addEventListener("keyup", moveEnd, false)

function moveStart(e) {
  var k = e.key
  if(k === "w" || k === "ArrowUp"){
    north = true
  }else if(k === "s" || k === "ArrowDown"){
    south = true
  }else if(k === "d" || k === "ArrowRight"){
    east = true
  }else if(k === "a" || k === "ArrowLeft"){
    west = true
  }
}

function moveEnd(e) {
   var k = e.key
  if(k === "w" || k === "ArrowUp"){
    north = false
  }else if(k === "s" || k === "ArrowDown"){
    south = false
  }else if(k === "d" || k === "ArrowRight"){
    east = false
  }else if(k === "a" || k === "ArrowLeft"){
    west = false
  }
}

var active = false
var currentX
var currentY
var initialX
var initialY
var xOffset = 0
var yOffset = 0

document.addEventListener("mousedown", dragStart, false)
document.addEventListener("mouseup", dragEnd, false)
document.addEventListener("mousemove", drag, false)
document.addEventListener("wheel", wheel, true)

function dragStart(e) {
  if (e.type === "touchstart") {
    initialX = e.touches[0].clientX - xOffset
    initialY = e.touches[0].clientY - yOffset
  } else {
    initialX = e.clientX - xOffset
    initialY = e.clientY - yOffset
  }

  active = true
}

function dragEnd(e) {
  initialX = currentX
  initialY = currentY

  active = false
}

function drag(e) {
  if (active) {

    e.preventDefault()

    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX - initialX
      currentY = e.touches[0].clientY - initialY
    } else {
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
    }

    xOffset = currentX
    yOffset = currentY

  }
}

function wheel(e) {
  e.preventDefault()
  camera.position.z = clamp(camera.position.z + e.deltaY * 0.02, 8, 100)
}

function startWebsocket() {
  if(ws) {
    return // Already trying to establish a connection
  }
  ws = new WebSocket(`ws://${window.location.hostname}:8888`)
  ws.binaryType = "arraybuffer"
  ws.onmessage = event => {
    var data = event.data
    if(typeof data === "string"){
      try {
        console.log(data)
        //gameState = JSON.parse(data)
        //console.log(gameState)
      } catch(e) {
        console.log(e)
      }
    } else {
      rawPixels = event.data
    }
  }
  ws.onclose = event => {
    console.log("CLOSE")
    ws = null
  }
  ws.onerror = event => {
    console.error("ERROR",event)
    ws = null
  }
}

