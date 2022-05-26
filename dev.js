var pixelData, camera, renderer, orbitronGroup, pixels, rawPixels, composer, ws, gameState

fetch("/pixels.json").then(function(response){
  return response.json()
}).then(function(json){
  pixelData = json
  init()
  startWebsocket()
  animate()
})

function clamp(num, min, max){
  return Math.min(Math.max(num, min), max)
} 

function init() {
  orbitronGroup = new THREE.Group()
  let subGroup = new THREE.Group()
  let bgColor = new THREE.Color(0)
  let stripColor = new THREE.Color(0x282828)
  let standColor = new THREE.Color(0x080808)
  let scene = new THREE.Scene()
  scene.background = bgColor

  camera = new THREE.PerspectiveCamera(50, 1, 1, 10000)
  camera.position.z = 17
  scene.add(camera)

  let points = []
  pixels = []
  for (let point of pixelData.coordinates) {
    let pixelGeometry = new THREE.SphereGeometry(0.06, 8, 8)
    let pixelMaterial = new THREE.MeshBasicMaterial({
      color: 0x999999
    })
    let pixel = new THREE.Mesh(pixelGeometry, pixelMaterial)
    pixel.translateX(point[0])
    pixel.translateY(point[1])
    pixel.translateZ(point[2])
    pixels.push(pixel)
    subGroup.add(pixel)
    points.push(new THREE.Vector3(point[0], point[1], point[2]))
  }
  let start = pixelData.coordinates[0]
  points.push(new THREE.Vector3(start[0], start[1], start[2]))
  let lineMaterial = new THREE.LineBasicMaterial({
    color: stripColor,
  })
  let lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
  let line = new THREE.Line(lineGeometry, lineMaterial)
  subGroup.add(line)

  let innerSphereGeometry = new THREE.SphereGeometry( 4.25, 32, 16 )
  let innerSphereMaterial = new THREE.MeshBasicMaterial( { color: bgColor } )
  innerSphereMaterial.transparent = true
  innerSphereMaterial.opacity = 0.8
  let innerSphere = new THREE.Mesh( innerSphereGeometry, innerSphereMaterial )
  subGroup.add(innerSphere)
  subGroup.rotation.set(-Math.PI/2,0,0)
  orbitronGroup.add(subGroup)
  //let axesHelper = new THREE.AxesHelper(5);
  //orbitronGroup.add(axesHelper)

  let standGeometry = new THREE.CylinderGeometry( 0.75, 0.75, 1.5, 32 )
  let standMaterial = new THREE.MeshBasicMaterial( {color: standColor} )
  let stand = new THREE.Mesh( standGeometry, standMaterial )
  stand.translateY(-5)
  orbitronGroup.add(stand)


  scene.add(orbitronGroup)

  //let axesHelper = new THREE.AxesHelper(5);
  //scene.add(axesHelper)

  renderer = new THREE.WebGLRenderer()
  onResize()

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

function latlong(coord){
  return [Math.acos(coord.z), Math.atan2(coord.x, coord.y)]
}

function render() {
  if(app.$data.followingPlayer >= 0){
    let player = gameState.players[app.$data.followingPlayer]
    let uniquePosition = pixelData.unique_to_dupes[player.position][0]
    let targetPixel = pixels[uniquePosition]
    let [lat,lon] = latlong(targetPixel.position.clone().normalize())
    let maxXOffset = 0.65
    let xRotation = clamp(-lat + Math.PI/2,-maxXOffset,maxXOffset)
    let yRotation = lon + Math.PI
    //TODO lerp rotation
    orbitronGroup.rotation.set(xRotation,yRotation,0)
    /*
    let targetPos = new THREE.Vector3()
    targetPixel.getWorldPosition(targetPos)
    targetPos.normalize()
    let cameraPos = new THREE.Vector3()
    camera.getWorldPosition(cameraPos)
    cameraPos.normalize()
    let quat = new THREE.Quaternion()
    quat.setFromUnitVectors(targetPos, cameraPos)
    //quat.slerpQuaternions(new THREE.Quaternion().identity(), quat, 0.2)
    let multipliedQuat = quat.multiply(orbQuat)
    orbitronGroup.setRotationFromQuaternion()
    */
  } else {
    if(north){
      moveVelocityX = moveVelocityX + acceleration
    }
    if(south){
      moveVelocityX = moveVelocityX - acceleration
    }
    if(east){
      moveVelocityY = moveVelocityY + acceleration
    }
    if(west){
      moveVelocityY = moveVelocityY - acceleration
    }
    moveVelocityX = clamp(moveVelocityX * exponentialFactor, -maxVelocityX, maxVelocityX)
    moveVelocityY = clamp(moveVelocityY * exponentialFactor, -maxVelocityY, maxVelocityY)
    yOffset += moveVelocityY
    xOffset += moveVelocityX
    let maxXOffset = 0.65*200
    if(xOffset > maxXOffset){
      moveVelocityX = 0
      xOffset = maxXOffset
    }else if(xOffset < -maxXOffset){
      moveVelocityX = 0
      xOffset = -maxXOffset
    }
    let rotationFactor = 200
    let xRotation = clamp(xOffset/rotationFactor,-maxXOffset,maxXOffset)
    let yRotation = yOffset/rotationFactor
    orbitronGroup.rotation.set(xRotation,yRotation,0)
  }
  if(rawPixels){
    let rp = pako.inflate(rawPixels, {to:'string'})
    for(let i = 0 ; i < pixels.length ; i++){
      let pixel = pixels[i]
      let j = i*6
      let color = `#${rp.slice(j+2,j+4)}${rp.slice(j+0,j+2)}${rp.slice(j+4,j+6)}`
      let c = new THREE.Color()
      c.setStyle(color, THREE.LinearSRGBColorSpace)
      c.multiplyScalar(5)
      pixel.material.color = c
    }
  }

  composer.render()
}

window.addEventListener("resize", onResize, false)

function onResize(e) {
  let w = window.innerWidth - 20
  let h = window.innerHeight - 20
  renderer.setSize(w, h)
  camera.aspect = w/h
  camera.updateProjectionMatrix()
}

var moveVelocityX = 0
var moveVelocityY = 0
var maxVelocityY = 10
var maxVelocityX = 8
var acceleration = 3
var exponentialFactor = 0.7
var west = false
var east = false
var north = false
var south = false

document.addEventListener("keydown", moveStart, false)
document.addEventListener("keyup", moveEnd, false)

function moveStart(e) {
  let k = e.key
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
  let k = e.key
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
    initialX = e.touches[0].clientX - yOffset
    initialY = e.touches[0].clientY - xOffset
  } else {
    initialX = e.clientX - yOffset
    initialY = e.clientY - xOffset
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

    xOffset = currentY
    yOffset = currentX

  }
}

function wheel(e) {
  camera.position.z = clamp(camera.position.z + e.deltaY * 0.02, 8, 100)
}

function startWebsocket() {
  if(ws) {
    return // Already trying to establish a connection
  }
  ws = new WebSocket(`ws://${window.location.hostname}:8888`)
  ws.binaryType = "arraybuffer"
  ws.onmessage = event => {
    let data = event.data
    if(typeof data === "string"){
      try {
        gameState = JSON.parse(data)
        app.$data.players = gameState.players
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

var app = new Vue({
  el: "#app",
  data: {
    players:[],
    followingPlayer:-1
  },
  watch: {
    gameState:{
      handler(val) {
        console.log("GAME STATE", val)
        this.players = val
      },
    }
  },
  methods: {
    followPlayer(player, index) {
      if(this.followingPlayer == index){
        this.followingPlayer = -1
      } else {
        this.followingPlayer = index
      }
    }
  },
})
