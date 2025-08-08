
import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

Vue.component('help', {
  props: ['message'],
  template: `
    <span class="help" @click="$root.helpMessage = message">
      <span>?</span>
    </span>
`})


Vue.component('number', {
  props: ['title'],
  computed: {
    name() { return this.$vnode.key },
  },
  template: `
<div class="row horiz-box" v-if="!$root.exclude[name]">
  {{title}}:
  <input type="number" v-model="$root.prefs[name]">
  </input>
</div>
`})

Vue.component('boolean', {
  props: ['title', 'help'],
  computed: {
    name() { return this.$vnode.key },
  },
  template: `
<div class="pure-material-checkbox">
  <input type="checkbox" v-model="$root.prefs[name]">
  <div class="checkbox" @click="$root.prefs[name] = !$root.prefs[name]">
    <div class="inner">
      <div class="checkmark"></div>
    </div>
  </div>
  <span>
    <div style="display: flex">
      {{title}}
      <help v-if="help" :message="help"/>
    </div>
  </span>
</div>
`})

Vue.component('slider', {
  props: ['title', 'min', 'max', 'help'],
  data() { return { value: 0 }},
  watch: {  
    "$root.prefs": function() { this.value = this.$root.prefs[this.name] },
    value() { this.$root.prefs[this.name] = this.value },
  },
  mounted() { this.value = this.$root.prefs[this.name] },
  computed: {
    trueMin() { return this.min || 0 },
    trueMax() { return this.max || 100 },
    percent() { return 100 * (this.value - this.trueMin) / (this.trueMax - this.trueMin) },
    name() { return this.$vnode.key },
  },
  template: `
<div class="slider-container" v-if="!$root.exclude[name]">
  <div class="label horiz-box">
    <div style="display: flex">
      {{title}}:
      <help v-if="help" :message="help"/>
    </div>
    <div>{{value}}</div>
  </div>
  <input type="range" :min="trueMin" :max="trueMax" class="slider"
      v-model="value">
  </input>
  <div class="left white" :style="{ width: percent + '%'}"></div>
  <div class="right" :style="{ width: (100 - percent) + '%'}"></div>
</div>
`})

Vue.component('color', {
  props: ['title', 'help'],
  data() {
    return {
      value: "#000",
      vector: {red:0, blue:0, green:0},
    }
  },
  mounted() {
    this.value = this.$root.prefs[this.name]
    this.updateFromPrefs()
  },
  computed: {
    name() { return this.$vnode.key },
  },
  watch: {
    "$root.prefs": function() { this.updateFromPrefs() },
    vector: {
      handler: function({red, green, blue}) {
        this.$root.prefs[this.name] = "#" + (1 << 24 | red << 16 | green << 8 | blue).toString(16).slice(1)
      },
      deep: true,
    },
  },
  methods: {
    updateFromPrefs() {
      let hex = this.$root.prefs[this.name]
      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      this.vector = result ? {
        red: parseInt(result[1], 16),
        green: parseInt(result[2], 16),
        blue: parseInt(result[3], 16)
      } : [0,0,0]
    },
  },
  template: `
<span style="width: 100%;" v-if="!$root.exclude[name]">
<span v-if="$root.browser == 'Firefox' && $root.os == 'Android'">
  <div v-if="title" class="horiz-box">{{title}}</div>
  <div class="color-component"
    v-for="component in ['red','green','blue']">
    <div class="label">
      <div>{{component[0]}}:{{vector[component]}}</div>
    </div>
    <div class="slider-container" :class="[component]">
      <input type="range" min="0" max="255" class="slider""
        v-model="vector[component]"></input>
      <div class="left" :style="{ background: component, width: (100 / 255.0 * vector[component]) + '%'}"></div>
      <div class="right" :style="{ width: (100 - 100 / 255.0 * vector[component]) + '%'}"></div>
    </div
  </div>
</span>
<span v-else>
  <div class="row filled" >
  <div v-if="title" style="display: flex">
    {{title}}:
    <help v-if="help" :message="help"/>
  </div>
  <input type="color" v-model="$root.prefs[name]">
</span>
</span>
`})

Vue.component('dropdown', {
  props: ['title', 'options', 'path', 'help'],
  data() {
    return { open: false }
  },
  computed: {
    name() { return this.$vnode.key },
    selection() {
      if (this.path) {
        let end = this.path.pop()
        let obj = this.$root.prefs
        for (let key of this.path) {
          obj = obj[key]
        }
        this.path.push(end)
        return obj[end]
      } else {
        return this.$root.prefs[this.name]
      }
    },
    selectionIndex() {
      for (let i = 0; i < this.options.length; i++) {
        if (this.selection == this.options[i][0]) {
          return i
        }
      }
      return 0
    },
  },
  methods: {
    opened() {
      if (this.$root.activeDropdown) {
        this.$root.activeDropdown.close()
      }

      let box = this.$el.querySelector(".selection").getBoundingClientRect()
      let optionHeight = 4.3 * this.$root.rem
      let height = this.options.length * optionHeight + 0.2*this.$root.rem
      let maxHeight = window.innerHeight
      height = Math.min(height, maxHeight)
      let top = box.top - this.selectionIndex * optionHeight
      top = Math.max(top, 0)
      if (top + height > maxHeight) {
        top = maxHeight - height
      } 
      this.$root.activeDropdown = {
        options: this.options,
        selection: this.selection,
        clicked: this.clicked,
        style: {
          top: top + "px",
          // height: height + "px",
          left: box.left + "px",
          width: box.width + "px",
        },
      }
      this.open = true
      setTimeout(() => {
        document.addEventListener('click', this.close)
      }, 100)
    },
    close() {
      if (!this.open) return // Avoid double calling
      this.$root.activeDropdown = null
      this.open = false
      document.removeEventListener('click', this.close)
    },
    clicked(value) {
      if (this.path) {
        let end = this.path.pop()
        let obj = this.$root.prefs
        for (let key of this.path) {
          obj = obj[key]
        }
        obj[end] = value
        this.path.push(end)
      } else {
        this.$root.prefs[this.name] = value
      }
      this.$emit("changed")
    },
    toDisplay(value) {
      for (let [v, display] of this.options) {
        if (v == value) return display
      }
      return value
    },
  },
  // Note that the actual dropdown html is in controller.html with id select-items
  template: `
<div class="dropdown-container horiz-box" v-if="!$root.exclude[name]"
  :class="{ 'top-padded': title }"
  style="align-items: center">
  <div style="display: flex;">
    <div v-if="title">{{title}}:</div>
    <help v-if="help" :message="help"/>
  </div>
  <div class="custom-select" @blur="close">
    <div class="selection" @click="opened">
      {{ toDisplay(selection) }}
    </div>
  </div>
</div>`})

Vue.component('vector', {
  props: ['title', 'size', 'help'],
  template: `
<vector2 v-if='$root.orbInfo.isFlat'
    :title='title'
    :help='help'
    :normalize='true'
    :size="size"
    :name="$vnode.key">
</vector2>
<vector3 v-else
    :title='title'
    :help='help'
    :size="size"
    :name="$vnode.key">
</vector3>`
})

Vue.component('vector2', {
  props: ['title', 'normalize', 'size', 'name', 'help'],
  data() {
    return {
      isMoving: false,
      style: {},
      value: { angle: 0, magnitude: 0 },
    }
  },
  mounted() {
    this.updateFromPrefs()
  },
  computed: {
    halfWidth() {
      return (this.size ?? 1) * 15
    }
  },
  watch: {
    "$root.prefs": function() { this.updateFromPrefs() },
    value() {
      let angle = -this.value.angle
      let mag = this.value.magnitude
      let xOffset = (Math.cos(angle) - 1) * mag * this.halfWidth/2
      let yOffset = Math.sin(angle) * mag * this.halfWidth/2
      this.style = {
        transform: `
          translateX(${xOffset}rem)
          translateY(${yOffset}rem)
          rotate(${angle}rad)`,
        width: `${mag * this.halfWidth}rem`,
        width: `${mag * this.halfWidth}rem`,
      }
    },
  },
  methods: {
    updateFromPrefs() {
      let v = this.$root.prefs[this.name].split(",").map(x => parseFloat(x))
      this.value = this.vectorToPolar(v)
    },
    startMove(event) {
      this.isMoving = true
      this.onMove(event)
    },
    endMove() {
      this.isMoving = false
    },
    onMove(event) {
      if (!this.isMoving) return
      let rect = this.$el.getBoundingClientRect()
      let x = (event.clientX - rect.x) / rect.width
      x = 2*x - 1
      let y = (event.clientY - rect.y) / rect.height
      y = -2*y + 1
      if (Math.abs(x) > 1 || Math.abs(y) > 1) {
        return
      }
      if (this.normalize) {
        let magnitude = Math.sqrt(x*x + y*y)
        if (magnitude > 0) {
          x /= magnitude
          y /= magnitude
        }
      }
      this.value = this.vectorToPolar([x,y])
      this.$root.prefs[this.name] = `${x},${y},0`
    },
    vectorToPolar(v) {
      return {
        angle: Math.atan2(v[1], v[0]),
        magnitude: Math.sqrt(v[0]*v[0] + v[1]*v[1])
      }
    },
  },
  template: `
<div class="vector-wrapper">
  <div class="side"></div>
  <div>
    <div class="horiz-box" style="margin-bottom:0; justify-content: left;">
      {{title}}:
      <help v-if="help" :message="help"/>
    </div>
    <div class="vector" v-if="!$root.exclude[name]"
        :style="{ width: (halfWidth*2) + 'rem', height: (halfWidth*2) + 'rem', padding: halfWidth + 'rem' }"
        @mousedown="startMove"
        @mousemove="onMove"
        @mouseup="endMove"
        @mouseleave="endMove"
        @touchstart="startMove($event.targetTouches[0])"
        @touchmove="onMove($event.targetTouches[0])"
        @touchend="endMove">
      <div class="scrim"></div>
      <div class="shaft" :style="style">
        <div class="tip"></div>
      </div>
    </div>
  </div>
  <div class="side"></div>
</div>
`})


Vue.component('vector3', {
  props: ['title', 'size', 'name', 'help'],
  data() {
    return {
      renderer: null,
      pointer: null,
      stlMesh: null,
      theta: 0,
      sigma: 0,
      start: null,
    }
  },
  watch: {
    "$root.prefs": function () { this.updateFromPrefs() },
  },
  mounted() {
    this.load()
    this.updateFromPrefs()
    window.addEventListener('resize', this.resize)
  },
  unmounted() {
    window.removeEventListener('resize', this.resize)
  },
  computed: {
    halfWidth() {
      return (this.size ?? 1) * 15
    },
    threeEl() {
      return this.$el.querySelector(".stl-wrapper")
    },
  },
  methods: {
    resize() {
      if (!this.renderer) return
      let boundingRect = this.threeEl.getBoundingClientRect()
      this.renderer.setSize(
        boundingRect.width - this.$root.rem,
        boundingRect.height - this.$root.rem)
    },
    load() {
      this.threeEl.innerHTML = ""

      // Create a scene, camera, and renderer
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
      const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true })
      const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
      const arrowMaterial = new THREE.MeshStandardMaterial({ color: 0x212121 })
      const pointerMaterial = new THREE.MeshStandardMaterial({
        color: 0x212121,
        transparent: true,
        opacity: 0.33
      })
      this.renderer = renderer
      renderer.setClearColor(0x333333, 0.5)
      this.resize()
      renderer.domElement.style.zIndex = -1
      this.threeEl.appendChild(renderer.domElement)
  
      // Add a light sources
      const sun = new THREE.DirectionalLight(0xffffff, 1.8)
      sun.position.set(10, 10, 10).normalize()
      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      scene.add(sun)
      scene.add(ambient)
  
      // Load the STL file
      const loader = new STLLoader()

      let self = this
      function loadGeometry(geometry) {
        let vertices = geometry.attributes.position.array
        let centroid = new THREE.Vector3(0,0,0)
        for (let i = 0; i < geometry.attributes.position.count; i++) {
          centroid.add(new THREE.Vector3(vertices[3*i], vertices[3*i + 1], vertices[3*i + 2]))
        }
        centroid.divideScalar(geometry.attributes.position.count)
        geometry.translate(centroid.negate())
        
        geometry.computeBoundingSphere()
        const r = geometry.boundingSphere.radius
        geometry.scale(1/r, 1/r, 1/r)
        geometry.rotateX(-Math.PI / 2)
        
        self.stlMesh = new THREE.Mesh(geometry, material)
        scene.add(self.stlMesh)
        self.setRotation()
      }

      loader.load("stls/" + this.$root.orbInfo.topology + ".stl", loadGeometry, undefined, _ => {
        // Assume stl file just doesn't exist
        loader.load("stls/default.stl", loadGeometry, undefined, error => {
          console.error('An error happened while loading the STL file.', error)
        })
      })

      // Axes and vector geometry for pointer
      const r = 0.02
      const l = 1.2
      const xRingGeometry = new THREE.TorusGeometry(l, r, 128)
      const xRing = new THREE.Mesh(xRingGeometry, pointerMaterial)
      const yRingGeometry = new THREE.TorusGeometry(l, r, 128)
      yRingGeometry.rotateX(-Math.PI / 2)
      const yRing = new THREE.Mesh(yRingGeometry, pointerMaterial)
      const zRingGeometry = new THREE.TorusGeometry(l, r, 128)
      zRingGeometry.rotateY(-Math.PI / 2)
      const zRing = new THREE.Mesh(zRingGeometry, pointerMaterial)

      const shaftGeometry = new THREE.CylinderGeometry(r, r, 2*l)
      shaftGeometry.rotateZ(-Math.PI / 2)
      const shaft = new THREE.Mesh(shaftGeometry, arrowMaterial)
      const arrowGeometry = new THREE.ConeGeometry(0.055, 0.2, 64)
      arrowGeometry.rotateZ(-Math.PI / 2)
      arrowGeometry.translate(l, 0, 0)
      const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial)

      this.pointer = new THREE.Group()
      this.pointer.add(xRing)
      this.pointer.add(yRing)
      this.pointer.add(zRing)
      this.pointer.add(shaft)
      this.pointer.add(arrow)
      scene.add(this.pointer)
  
      // Position the this.camera
      camera.position.z = 3
  
      function animate() {
        requestAnimationFrame(animate)
        renderer.setClearColor(0x333333, 0.5)
        renderer.render(scene, camera)
      }
      animate()
    },
    setRotation() {
      if (!this.stlMesh) return
      this.pointer.rotation.set(0, 0, 0)
      this.stlMesh.rotation.set(0, 0, 0)
      this.pointer.rotateY(this.theta/2)
      this.stlMesh.rotateY(-this.theta/2)
      this.pointer.rotateZ(-this.sigma * 0.9)
      this.stlMesh.rotateZ(this.sigma * 0.1)
    },
    updateFromPrefs() {
      let v = this.$root.prefs[this.name].split(",").map(x => parseFloat(x))
      this.theta = Math.atan2(v[0], v[2])
      this.sigma = -Math.atan(v[1] / Math.sqrt(v[0]*v[0] + v[2]*v[2]))
      if (this.theta < 0) {
        this.theta += Math.PI*4
      } else {
        this.theta += Math.PI*2
      }
      this.setRotation()
    },
    startMove(event) {
      this.start = {x: event.clientX, y: event.clientY}
    },
    endMove() {
      this.start = null
    },
    onMove(event) {
      if (!this.start) return
      let rect = this.threeEl.getBoundingClientRect()
      let deltaTheta = (event.clientX - this.start.x) / rect.width * 5
      let deltaSigma = (event.clientY - this.start.y) / rect.height * 2.5
      if (this.theta < Math.PI*2) {
        deltaSigma *= -1
      }
      this.start = {x: event.clientX, y: event.clientY}

      // Save as double polar?
      this.theta += deltaTheta
      if (this.theta > Math.PI*4) {
        this.theta -= Math.PI*4
      }
      if (this.theta < 0) {
        this.theta += Math.PI*4
      }
      this.sigma += deltaSigma
      this.sigma = Math.min(this.sigma, Math.PI/2)
      this.sigma = Math.max(this.sigma, -Math.PI/2)

      this.setRotation()

      let z = Math.cos(this.sigma) * Math.cos(this.theta)
      let x = Math.cos(this.sigma) * Math.sin(this.theta)
      let y = Math.sin(-this.sigma)
      this.$root.prefs[this.name] = `${x},${y},${z}`
    },
    vectorToPolar(v) {
      return {
        angle: Math.atan2(v[1], v[0]),
        magnitude: Math.sqrt(v[0]*v[0] + v[1]*v[1])
      }
    },
  },
  template: `
<div class="vector-wrapper">
  <div class="side"></div>
  <span>
    <div class="horiz-box" style="margin-bottom:0; justify-content: left;">
      {{title}}:
      <help v-if="help" :message="help"/>
    </div>
    <div class="stl-wrapper"
        :style="{ width: (halfWidth*2) + 'rem', height: (halfWidth*2) + 'rem' }"
        @mousedown="startMove"
        @mousemove="onMove"
        @mouseup="endMove"
        @mouseleave="endMove"
        @touchstart="startMove($event.targetTouches[0])"
        @touchmove="onMove($event.targetTouches[0])"
        @touchend="endMove"
    ></div>
  </span>
  <div class="side"></div>
</div>`})

Vue.component('stlviewer', {
  props: ['info'],
  data() {
    return {
      renderer: null,
    }
  },
  watch: {
    "info.topology": function() {
      this.load()
    },
    "$root.registeredIDs": function() {
      this.resize()
    },
  },
  mounted() {
    this.load()
    window.addEventListener('resize', this.resize)
  },
  unmounted() {
    window.removeEventListener('resize', this.resize)
  },
  methods: {
    resize() {
      if (!this.renderer) return
      let boundingRect = this.$el.getBoundingClientRect()
      this.renderer.setSize(boundingRect.width, boundingRect.height)
    },
    load() {
      if (!this.info.topology) return
  
      this.$el.innerHTML = ""

      // Create a scene, camera, and renderer
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true })
      this.renderer = renderer
      renderer.setClearColor(0x333333, 0.5)
      this.resize()
      renderer.domElement.style.zIndex = -1
      this.$el.appendChild(renderer.domElement)
  
      // Add a light sources
      const sun = new THREE.DirectionalLight(0xffffff, 1.8)
      sun.position.set(10, 10, 10).normalize()
      const ambient = new THREE.AmbientLight(0xffffff, 0.7)
      scene.add(sun)
      scene.add(ambient)
  
      // Load the STL file
      const loader = new STLLoader()
      let mesh = null

      function loadGeometry(geometry) {
        let vertices = geometry.attributes.position.array
        let centroid = new THREE.Vector3(0,0,0)
        for (let i = 0; i < geometry.attributes.position.count; i++) {
          centroid.add(new THREE.Vector3(vertices[3*i], vertices[3*i + 1], vertices[3*i + 2]))
        }
        centroid.divideScalar(geometry.attributes.position.count)
        geometry.translate(centroid.negate())
        
        geometry.computeBoundingSphere()
        const r = geometry.boundingSphere.radius
        geometry.scale(1/r, 1/r, 1/r)
        geometry.rotateX(-Math.PI / 2)
        
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
        mesh = new THREE.Mesh(geometry, material)
        mesh.rotation.y = Math.random() * Math.PI * 2
        scene.add(mesh)
      }

      loader.load("stls/" + this.info.topology + ".stl", loadGeometry, undefined, _ => {
        // Assume stl file just doesn't exist
        loader.load("stls/default.stl", loadGeometry, undefined, error => {
          console.error('An error happened while loading the STL file.', error)
        })
      })
  
      // Position the camera
      camera.position.z = 2.1
  
      // Animate the scene
      let self = this
      function animate() {
        requestAnimationFrame(animate)
        if (mesh && self.info.isCurrentlyConnected) {
          mesh.rotation.y += 0.007
          mesh.rotation.z = Math.sin(Date.now() / 5000) * 0.1
        }
        renderer.setClearColor(0x333333, self.info.isCurrentlyConnected ? 0.5 : 0.9)
        renderer.render(scene, camera)
      }
      animate();
    }
  },
  template: `
<template>
  <div class="stl-wrapper" style="width: 100%; height: 100%"></div>
</template>`})

Vue.component('Icon', {
  props: ['image', 'w', 'h', 'selected'],
  computed: {
    imageUrlW() { return `/controller/images/${this.image}_white.svg` },
    imageUrlB() { return `/controller/images/${this.image}_black.svg` },
    imageWidth() { return 0.6 * Math.min(this.w, this.h) }
  },
  template: `
<template>
  <div class="icon" :class="{ selected }" @click="$emit('click')">
    <svg :width="w" :height="h">
      <mask :id="image" x="0" y="0" :width="w" :height="h" color="black">
        <rect x=0 y=0 :width="w" :height="h" fill="white"></rect>
        <image :x="(w-imageWidth)/2" :y="(h-imageWidth)/2" :width="imageWidth" :height="imageWidth"
            :href="imageUrlB"></image>
      </mask>
      <rect class="main-rect"
            :width="w"
            :height="h"
            :mask="'url(#' + image + ')'"
            fill="#080808">
      </rect>

      <image :x="(w-imageWidth)/2" :y="(h-imageWidth)/2" :width="imageWidth" :height="imageWidth"
          :href="imageUrlW" fill="white"></image>
    </svg>
  </div>
</template>`})
