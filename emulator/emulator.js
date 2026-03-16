
import * as THREE from "three"
import { RenderPass } from "https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/postprocessing/UnrealBloomPass.js"
import { EffectComposer } from "https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/postprocessing/EffectComposer.js"
import { STLLoader } from "https://cdn.jsdelivr.net/npm/three@latest/examples/jsm/loaders/STLLoader.js"


let DISABLE_WHEEL = false
let CAMERA_Z = 17
let CONTROLLER = "none"
let NO_HUD = false
let SHOWTEXT = false
let NO_AUTO_ROTATE = false
let NO_CENTROID = false

for (let param of new URLSearchParams(location.search)) {
  try {
    switch (param[0]) {
      case 'cameraz':
        CAMERA_Z = parseFloat(param[1])
        break
      case 'lumatroniframe':
        DISABLE_WHEEL = true
        NO_HUD = true
        NO_CENTROID = true
        NO_AUTO_ROTATE = true
        break
      case 'controller':
        if (param[1] == "none") {
          document.getElementById("controller").remove()
        }
        CONTROLLER = param[1]
        break
      case 'disablewheel':
        DISABLE_WHEEL = true
        break
      case 'nohud':
        NO_HUD = true
        break
      case 'showtext':
        SHOWTEXT = true
        break
      case 'noautorotate':
        NO_AUTO_ROTATE = true
        break
      case 'nocentroid':
        NO_CENTROID = true
        break
    }
  } catch(e) {
    console.error(e)
  }
}


function clamp(num, min, max){
  return Math.min(Math.max(num, min), max)
} 

function latlong(coord){
  return [Math.acos(coord.z), Math.atan2(coord.x, coord.y)]
}

window.addEventListener("resize", onResize, false)

function onResize(e) {
  window.location.reload()
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
let lastInteractionTime = 0

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

    if (e.type === "touchmove") {
      currentX = e.touches[0].clientX - initialX
      currentY = e.touches[0].clientY - initialY
    } else {
      currentX = e.clientX - initialX
      currentY = e.clientY - initialY
    }

    xOffset = currentY
    yOffset = currentX

    lastInteractionTime = Date.now()
  }
}

if (!DISABLE_WHEEL) {
  document.addEventListener("wheel", wheel, true)
}
function wheel(e) {
  let camera = app.$data.camera
  camera.position.z = clamp(camera.position.z + e.deltaY * 0.02, 8, 100)
}

let pathParts = location.pathname.split("/")
pathParts.shift()
pathParts.pop()
let orbID = pathParts.join("/")


var app = new Vue({
  el: "#app",
  data: {
    orbID,
    CONTROLLER,
    NO_HUD,
    SHOWTEXT,
    showController: CONTROLLER == "auto",
    followingPlayer:-1,
    pixelData:{},
    pixels:[],
    rawPixels:"",

    camera:{},
    leds: null,
    bloomPass: null,
    orbitronGroup:{},
    composer:{},

    viewToggle: false,

    ws:null,
    gameState:{},
    sounds:[],
    music:[],
    currentMusic:null,
    lastSoundAction:0,
    lastMusicAction:0,
    audioInitialized:false,
    musicReady:false,
    musicVolume: 50,
    sfxVolume: 50,

    previousText: "",
    previousScrollTime: 0,
    textIndex: 0,
  },
  async created() {
    let self = this
    fetch(`/${this.orbID}/pixels.json`).then(function(response){
      return response.json()
    }).then(function(json){
      self.pixelData = json
      self.init()
      self.animate()
    })

    window.addEventListener('message', function (e) {
      if (e.data.self !== undefined) {
        self.followingPlayer = e.data.self
        self.$forceUpdate()
      }
    }, false)


    document.addEventListener("keypress", ({code}) => {
      let self = this
      if (code == 'KeyP') {
        console.log(self.gameState.players[self.followingPlayer].position)
      }
    })

    let volume = localStorage.getItem('musicVolume')
    if (volume) {
      this.musicVolume = parseInt(volume)
    }
    volume = localStorage.getItem('sfxVolume')
    if (volume) {
      this.sfxVolume = parseInt(volume)
    }
  },
  watch: {
    viewToggle() {
      this.bloomPass.enabled = !this.viewToggle
      this.leds.visible = !this.viewToggle
      this.stlMesh.visible = this.viewToggle
    }
  },
  methods: {
    init() {
      // this.warmUpAudio()
      // this.warmUpMusic()
      const SCALE = 4.4
      let w = window.innerWidth
      let h = window.innerHeight
      const stlMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff })

      this.orbitronGroup = new THREE.Group()
      this.leds = new THREE.Group()
      let bgColor = new THREE.Color(0)
      let scene = new THREE.Scene()
      scene.background = bgColor

      this.camera = new THREE.PerspectiveCamera(50, w/h, 1, 10000)
      this.camera.position.z = CAMERA_Z
      scene.add(this.camera)

      let points = []
      this.pixels = []

      let maxMagnitude = 0
      for (let point of this.pixelData.coords) {
        let magnitude = new THREE.Vector3(point[0], point[1], point[2]).length()
        maxMagnitude = Math.max(maxMagnitude, magnitude)
      }
      let scale = 1.6 / (0.6 + maxMagnitude)
      let centroid = new THREE.Vector3(0,0,0)
      if (!NO_CENTROID) {
        for (let point of this.pixelData.coords) {
          point[0] *= scale
          point[1] *= scale
          point[2] *= -scale
          centroid.add(new THREE.Vector3(...point))
        }
      }
      centroid.multiplyScalar(1/this.pixelData.coords.length)
      for (let point of this.pixelData.coords) {
        point[0] -= centroid.x
        point[1] -= centroid.y
        point[2] -= centroid.z
      }

      // Light sources for the STL render
      const sun = new THREE.DirectionalLight(0xffffff, 1.5)
      sun.position.set(10, 10, 10).normalize()
      const ambient = new THREE.AmbientLight(0xffffff, 0.5)
      scene.add(sun)
      scene.add(ambient)

      // Load the STL file
      const loader = new STLLoader()

      let self = this
      function loadGeometry(geometry) {
        if (self.pixelData.stlScale) {
          geometry.translate(new THREE.Vector3(
            self.pixelData.centerOffset[0],
            self.pixelData.centerOffset[1],
            self.pixelData.centerOffset[2],
          ))
          let stlScale = scale * self.pixelData.stlScale * SCALE
          geometry.scale(stlScale, stlScale, stlScale)
          geometry.rotateX(-Math.PI/2)
          geometry.translate(centroid.multiplyScalar(SCALE).negate())
        }
        else {
          geometry.computeBoundingSphere()
          const r = geometry.boundingSphere.radius * 0.2 / scale
          geometry.rotateX(-Math.PI/2)
          geometry.translate(geometry.boundingSphere.center.negate())
          geometry.scale(1/r, 1/r, 1/r)
        }
        
        self.stlMesh = new THREE.Mesh(geometry, stlMaterial)
        self.stlMesh.visible = false
        self.orbitronGroup.add(self.stlMesh)
        // self.setRotation()
      }
      let path = "/stls/" + this.orbID.replace("+", "/")
      loader.load(path + "_full.stl", loadGeometry, undefined, _ => {
        // Fall back to ultra simple model
        loader.load(path + ".stl", loadGeometry, undefined, error => {
          console.error('An error happened while loading the STL file.', error)
        })
      })

      for (let index of this.pixelData.uniqueToDupe) {
        let point = this.pixelData.coords[index]
        let pixelGeometry = new THREE.SphereGeometry(0.01, 8, 8)
        let pixelMaterial = new THREE.MeshBasicMaterial({
          color: 0x999999
        })
        let pixel = new THREE.Mesh(pixelGeometry, pixelMaterial)
        pixel.translateX(point[0])
        pixel.translateY(point[1])
        pixel.translateZ(point[2])
        this.pixels.push(pixel)
        this.leds.add(pixel)
        points.push(new THREE.Vector3(...point))
      }


      this.leds.scale.set(SCALE, SCALE, SCALE)
      this.orbitronGroup.add(this.leds)
      //let axesHelper = new THREE.AxesHelper(5);
      //this.orbitronGroup.add(axesHelper)

      scene.add(this.orbitronGroup)

      //let axesHelper = new THREE.AxesHelper(5);
      //scene.add(axesHelper)

      const renderer = new THREE.WebGLRenderer({antialias: true })
      renderer.setSize(w, h)

      this.composer = new EffectComposer(renderer)
      this.composer.addPass(new RenderPass(scene, this.camera))

      document.getElementById("orb-canvas").appendChild(renderer.domElement)
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(256, 256), // Resolution
        5, // strength
        0, // radius
        0 // threshold
      )
      this.composer.addPass(this.bloomPass)
    },
    animate() {
      requestAnimationFrame(this.animate)
      this.startWebsocket()
      this.render()
    },
    render() {
      let rotationFactor = 200
      if(!this.pixelData.isWall && app.$data.followingPlayer >= 0){
        let rotation = this.orbitronGroup.rotation
        let player = this.gameState.players[this.followingPlayer]
        let uniquePosition = this.pixelData.dupeToUniques[player.position][0]
        let targetPixel = this.pixels[uniquePosition]
        let [lat,lon] = latlong(targetPixel.position.clone().normalize())
        let maxXOffset = 0.65
        let lerpFactor = 0.0175

        let xRotation = clamp(-lat + Math.PI/2,-maxXOffset,maxXOffset)
        let deltaX = (xRotation - rotation.x) * lerpFactor
        xRotation = rotation.x + deltaX
        xOffset = xRotation * rotationFactor // So rotation doesn't jump if you stop following

        let yRotation = lon - Math.PI
        let deltaY = (yRotation - rotation.y) % (Math.PI*2)
        if(deltaY < Math.PI) {
          deltaY = deltaY + Math.PI*2
        }
        if(deltaY > Math.PI) {
          deltaY = deltaY - Math.PI*2
        }
        deltaY = deltaY * lerpFactor
        yRotation = rotation.y + deltaY
        yOffset = yRotation * rotationFactor // So rotation doesn't jump if you stop following

        this.orbitronGroup.rotation.set(xRotation, yRotation,0)
      } else {
        if(north){
          moveVelocityX = moveVelocityX + acceleration
        }
        else if(south){
          moveVelocityX = moveVelocityX - acceleration
        }
        else if(east){
          moveVelocityY = moveVelocityY + acceleration
          lastInteractionTime = Date.now()
        }
        else if(west){
          moveVelocityY = moveVelocityY - acceleration
          lastInteractionTime = Date.now()
        }

        if (!NO_AUTO_ROTATE && lastInteractionTime + 10*1000 < Date.now()) {
          moveVelocityY = 2
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
        let xRotation = clamp(xOffset/rotationFactor,-maxXOffset,maxXOffset)
        let yRotation = yOffset/rotationFactor
        this.orbitronGroup.rotation.set(xRotation % (Math.PI*2),yRotation % (Math.PI*2),0)
      }

      if(this.rawPixels){
        let rp = pako.inflate(this.rawPixels, {to:'string'})
        for(let i = 0 ; i < this.pixels.length ; i++){
          let pixel = this.pixels[i]
          let j = i*6
          let color = `#${rp.slice(j+0,j+2)}${rp.slice(j+2,j+4)}${rp.slice(j+4,j+6)}`
          let c = new THREE.Color()
          if (color == "#000000") {
            c.setRGB(0.00005, 0.00005, 0.00005)
          } else {
            c.setStyle(color, THREE.LinearSRGBColorSpace)
          }
          c.multiplyScalar(2)
          c.setRGB(Math.pow(c.r,0.6), Math.pow(c.g, 0.6), Math.pow(c.b, 0.6))
          pixel.material.color = c
        }
      }

      this.composer.render()
      this.renderTextDisplay()
    },
    renderTextDisplay() {
      let textDisplay = document.getElementById("text-display")
      if (!textDisplay) return
      let currentText = this.gameState.currentText
      if (!currentText) {
        textDisplay.innerHTML = ""
        return
      }
      if (currentText != this.previousText) {
        textDisplay.innerHTML = currentText.slice(0,4)
        this.textIndex = 4
        this.previousText = currentText
        this.previousScrollTime = Date.now()
      }

      if (currentText.length <= 4) // Don't scroll if entire text can fit on display
        return
      if (Date.now() - this.previousScrollTime < 250)
        return

      let inner = textDisplay.innerHTML
      if (inner[0] == '&') {
        inner = inner.slice(6)
      } else {
        inner = inner.slice(1)
      }

      if (this.textIndex < currentText.length) {
        let chr = currentText[this.textIndex]
        if (chr == " ") chr = "&nbsp;"
        inner += chr
      }
      else {
        inner += "&nbsp;"
      }

      textDisplay.innerHTML = inner
      this.textIndex = (this.textIndex + 1) % (currentText.length + 3)
      this.previousScrollTime = Date.now()
    },
    startWebsocket() {
      if(this.ws) {
        return // Already trying to establish a connection
      }
      try {
        let protocolAndHost
        if (location.hostname == "localhost") {
          protocolAndHost = "ws://localhost" 
        } else {
          protocolAndHost = "wss://" + location.hostname
        }
        this.ws = new WebSocket(protocolAndHost + ":8888/" + this.orbID)
        this.ws.binaryType = "arraybuffer"
        let self = this
        this.ws.onmessage = event => {
          let data = event.data
          if(typeof data === "string"){
            try {
              self.gameState = JSON.parse(data)
            } catch(e) {
              console.error(e)
            }
          } else {
            self.rawPixels = event.data
          }
        }
        this.ws.onclose = _ => {
          console.log("CLOSE")
          self.ws = null
        }
        this.ws.onerror = event => {
          console.error("ERROR",event)
          self.ws = null
        }
      } catch(e) {
        console.error(e)
      }
    },
    hasConnected() {
      return !["$LOADING", "CONNECTING"].includes(this.gameState.currentText)
    },
    followPlayer(player, index) {
      if(this.followingPlayer == index){
        this.followingPlayer = -1
      } else {
        this.followingPlayer = index
      }
    },
  }
})
