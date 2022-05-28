var canPlayAudio = false

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

document.addEventListener("keydown", moveStart, false)
document.addEventListener("keyup", moveEnd, false)

function moveStart(e) {
  canPlayAudio = true
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
  canPlayAudio = true
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
  let camera = app.$data.camera
  camera.position.z = clamp(camera.position.z + e.deltaY * 0.02, 8, 100)
}

var app = new Vue({
  el: "#app",
  data: {
    followingPlayer:-1,
    pixelData:{},
    camera:{},
    orbitronGroup:{},
    pixels:[],
    rawPixels:"",
    composer:{},
    ws:null,
    gameState:{},
    sounds:[],
    music:[],
    currentMusic:null,
    lastSoundAction:0,
    lastMusicAction:0,
    audioInitialized:false,
    musicReady:false,
  },
  created() {
    let self = this
    fetch("/pixels.json").then(function(response){
      return response.json()
    }).then(function(json){
      self.pixelData = json
      self.init()
      self.animate()
    })
  },
  watch: {
  },
  methods: {
    init() {
      this.warmUpAudio()
      this.warmUpMusic()
      let w = window.innerWidth - 20
      let h = window.innerHeight - 20

      this.orbitronGroup = new THREE.Group()
      let subGroup = new THREE.Group()
      let bgColor = new THREE.Color(0)
      let stripColor = new THREE.Color(0x282828)
      let standColor = new THREE.Color(0x080808)
      let scene = new THREE.Scene()
      scene.background = bgColor

      this.camera = new THREE.PerspectiveCamera(50, w/h, 1, 10000)
      this.camera.position.z = 17
      scene.add(this.camera)

      let points = []
      this.pixels = []
      for (let point of this.pixelData.coordinates) {
        let pixelGeometry = new THREE.SphereGeometry(0.06, 8, 8)
        let pixelMaterial = new THREE.MeshBasicMaterial({
          color: 0x999999
        })
        let pixel = new THREE.Mesh(pixelGeometry, pixelMaterial)
        pixel.translateX(point[0])
        pixel.translateY(point[1])
        pixel.translateZ(point[2])
        this.pixels.push(pixel)
        subGroup.add(pixel)
        points.push(new THREE.Vector3(point[0], point[1], point[2]))
      }
      let start = this.pixelData.coordinates[0]
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
      this.orbitronGroup.add(subGroup)
      //let axesHelper = new THREE.AxesHelper(5);
      //this.orbitronGroup.add(axesHelper)

      let standGeometry = new THREE.CylinderGeometry( 0.75, 0.75, 1.5, 32 )
      let standMaterial = new THREE.MeshBasicMaterial( {color: standColor} )
      let stand = new THREE.Mesh( standGeometry, standMaterial )
      stand.translateY(-5)
      this.orbitronGroup.add(stand)


      scene.add(this.orbitronGroup)

      //let axesHelper = new THREE.AxesHelper(5);
      //scene.add(axesHelper)

      let renderer = new THREE.WebGLRenderer()
      renderer.setSize(w, h)

      this.composer = new THREE.EffectComposer(renderer)
      this.composer.addPass(new THREE.RenderPass(scene, this.camera))

      document.getElementById("orb-canvas").appendChild(renderer.domElement)
      const bloomPass = new THREE.UnrealBloomPass(
        resolution=new THREE.Vector2(256, 256),
        //strength=5,
        strength=3,
        radius=0,
        threshold=0
      )
      this.composer.addPass(bloomPass)
    },
    animate() {
      requestAnimationFrame(this.animate)
      this.startWebsocket()
      this.processAudio()
      this.render()
    },
    render() {
      if(app.$data.followingPlayer >= 0){
        let rotation = this.orbitronGroup.rotation
        let player = this.gameState.players[this.followingPlayer]
        let uniquePosition = this.pixelData.unique_to_dupes[player.position][0]
        let targetPixel = this.pixels[uniquePosition]
        let [lat,lon] = latlong(targetPixel.position.clone().normalize())
        let maxXOffset = 0.65
        let lerpFactor = 0.0125
        let xRotation = clamp(-lat + Math.PI/2,-maxXOffset,maxXOffset)
        let yRotation = lon - Math.PI
        let deltaX = (xRotation - rotation.x) * lerpFactor
        let deltaY = yRotation - rotation.y
        if(Math.abs(deltaY) > Math.PI){
          if(deltaY < 0){
            deltaY = deltaY + Math.PI*2
          }else{
            deltaY = deltaY - Math.PI*2
          }
        }
        deltaY = deltaY * lerpFactor
        this.orbitronGroup.rotation.set((rotation.x + deltaX) % (Math.PI*2),(rotation.y + deltaY) % (Math.PI*2),0)
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
        this.orbitronGroup.rotation.set(xRotation % (Math.PI*2),yRotation % (Math.PI*2),0)
      }
      if(this.rawPixels){
        let rp = pako.inflate(this.rawPixels, {to:'string'})
        for(let i = 0 ; i < this.pixels.length ; i++){
          let pixel = this.pixels[i]
          let j = i*6
          let color = `#${rp.slice(j+2,j+4)}${rp.slice(j+0,j+2)}${rp.slice(j+4,j+6)}`
          let c = new THREE.Color()
          c.setStyle(color, THREE.LinearSRGBColorSpace)
          c.multiplyScalar(5)
          pixel.material.color = c
        }
      }

      this.composer.render()
    },
    startWebsocket() {
      if(this.ws) {
        return // Already trying to establish a connection
      }
      try {
        this.ws = new WebSocket(`ws://${window.location.hostname}:8888`)
        this.ws.binaryType = "arraybuffer"
        let self = this
        this.ws.onmessage = event => {
          let data = event.data
          if(typeof data === "string"){
            try {
              self.gameState = JSON.parse(data)
            } catch(e) {
              console.log(e)
            }
          } else {
            self.rawPixels = event.data
          }
        }
        this.ws.onclose = event => {
          console.log("CLOSE")
          self.ws = null
        }
        this.ws.onerror = event => {
          console.error("ERROR",event)
          self.ws = null
        }
      } catch(e) {
        console.log(e)
      }
    },
    followPlayer(player, index) {
      if(this.followingPlayer == index){
        this.followingPlayer = -1
      } else {
        this.followingPlayer = index
      }
    },
    warmUpAudio() {
      let names = ["kick.wav", "placeBomb.wav", "hurt.wav", "death.wav", "explosion.wav"]

      for (let name of names) {
        let wrapper = new SoundWrapper(name)
        this.sounds[wrapper.name] = wrapper
      }
    },
    warmUpMusic() {
      let music = [
        new MusicWrapper("battle1.ogg",false,"battle1Loop.ogg"),
        new MusicWrapper("dm1.ogg",false,"dm1Loop.ogg"),
        new MusicWrapper("snekBattle.ogg"), 
        new MusicWrapper("waiting.ogg", true), 
        new MusicWrapper("victory.ogg")
      ]

      for (let m of music) {
        this.music[m.name] = m
      }
    },
    processAudio() {
      if(!canPlayAudio) return
      let soundActions = this.gameState.soundActions
      if(soundActions) {
        for(actionString of soundActions){
          let actionData = actionString.split(";")
          let timestamp = parseFloat(actionData[0])
          if(timestamp > this.lastSoundAction){
            this.lastSoundAction = timestamp
            if(this.audioInitialized){
              let action = actionData[1]
              let name = actionData[2]
              if(action === "_play") {
                this.sounds[name].play()
              } else if(action === "_stop") {
                this.sounds[name].stop()
              }
            }
          }
        }
      }

      if(!this.musicReady) {
        let ready = true
        for(music of this.music) {
          ready = ready && music.isReady()
        }
        this.musicReady = ready
      }
      let musicActions = this.gameState.musicActions
      if(this.musicReady && musicActions) {
        for(actionString of musicActions){
          let actionData = actionString.split(";")
          let timestamp = parseFloat(actionData[0])
          if(timestamp > this.lastMusicAction){
            this.lastMusicAction = timestamp
            let action = actionData[1]
            let name = actionData[2]
            if(name === "any"){
              name = this.currentMusic
            }
            if(!name){
              continue
            }
            if(action === "_play") {
              if(this.currentMusic) {
                this.music[this.currentMusic].stop()
              }
              this.currentMusic = name
              this.music[name].play()
            } else if(action === "_delayed_play") {
              let delay = actionData[3]
              let self = this
              setTimeout(function(){
                if(self.currentMusic) {
                  self.music[this.currentMusic].stop()
                }
                self.currentMusic = name
                self.music[name].play()
              }, delay)
            } else if(action === "_stop") {
              this.music[name].stop()
              if(this.currentMusic === name) {
                this.currentMusic = null
              }
            } else if(action === "_fadeout") {
              if(!this.audioInitialized){
                this.music[name].stop()
                if(this.currentMusic === name){
                  this.currentMusic = null
                }
              } else {
                let duration = actionData[3]
                let music = this.music[name]
                music.fadeOut(duration)
                if(this.currentMusic === name) {
                  this.currentMusic = null
                }
              }
            } else if(action === "_set_volume") {
              this.music[name].setVolume(actionData[3])
            }
          }
        }
        this.audioInitialized = musicActions.length > 0
      }
    },
  }
})

class SoundWrapper {
  constructor(file) {
    let name = file.slice(0,-4)
    let audio = document.createElement('audio')
    audio.src = "audio/" + file
    audio.id = "audio-" + name
    //audio.clientWidth = 0
    //audio.clientHeight = 0
    document.getElementById("audio-root").appendChild(audio)
    this.audio = audio
    this.name = name
    this.file = file
  }

  play(){
    this.audio.pause()
    this.audio.currentTime = 0
    let self = this
    this.audio.play().catch(function(e){
      console.log(e,self)
    })
  }
}

class MusicWrapper {
  constructor(file, loop, vampFile){
    let name = file.slice(0,-4)
    let audio = document.createElement('audio')
    audio.src = "audio/" + file
    audio.id = "audio-" + name
    audio.loop = loop
    //audio.clientWidth = 0
    //audio.clientHeight = 0
    document.getElementById("audio-root").appendChild(audio)
    audio.addEventListener("ended", this._onEnd)
    let self = this
    audio.addEventListener('canplay', (event) => {
      self.canPlay = true
    });
    this.audio = audio
    this.name = name
    this.file = file
    if(vampFile) {
      this.vampFile = vampFile
      let vampName = vampFile.slice(0,-4)
      let vamp = document.createElement('audio')
      vamp.src = "audio/" + vampFile
      vamp.id = "audio-" + vampName
      vamp.loop = true
      //vamp.clientWidth = 0
      //vamp.clientHeight = 0
      document.getElementById("audio-root").appendChild(vamp)
      this.vamp = vamp
    }
    this.playing = false
    this.vampPlaying = false
    this.fadingOut = false
  }

  play() {
    this.audio.volume = 1.0
    if(not this.isPlaying()){
      this.stop()
      let self = this
      this.audio.play().catch(function(e){
        console.log(e,self)
      })
    }
    this.playing = true
    this.fadingOut = false
    this.onFadeout = null
  }

  isPlaying() {
    return this.playing || this.vampPlaying
  }

  stop() {
    this.audio.pause()
    this.audio.currentTime = 0
    if(this.vamp) {
      this.vamp.pause()
      this.vamp.currentTime = 0
    }
    this.playing = false
    this.vampPlaying = false
    this.fadingOut = false
    this.onFadeout = null
  }

  _onEnd() {
    if(this.vamp){
      this.vamp.volume = 1.0
      this.vamp.play()
      this.vampPlaying = true
    } else {
      this.playing = false
    }
  }

  getVolume() {
    if(this.vampPlaying) {
      return this.vamp.volume
    } else {
      return this.audio.volume
    }
  }

  setVolume(v) {
    let val = clamp(v,0.0,1.0)
    if(this.vampPlaying) {
      this.vamp.volume = val
    } else {
      this.audio.volume = val
    }
  }

  fadeOut(duration) {
    if(this.isPlaying()) {
      this.fadingOut = true
      let self = this
      let startVol = this.getVolume()
      let fadeOutStart = Date.now()
      let tick = 16
      let fadeOut = function() {
        if(self.fadingOut){
          let vol = startVol - startVol*(Date.now() - fadeOutStart)/duration
          self.setVolume(vol)
          if(self.getVolume() > 0) {
            setTimeout(fadeOut,tick)
          } else {
            if(self.onFadeout)  {
              self.onFadeout()
              self.onFadeout = null
            }
            self.stop()
          }
        }
      }
      setTimeout(fadeOut,tick)

    }
  }

  isReady() {
    return this.canPlay
  }
}
