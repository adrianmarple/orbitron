
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
  props: ['title'],
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
  <span>{{title}}</span>
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
    return { value: "#000" }
  },
  mounted() {
    this.value = this.$root.prefs[this.name]
  },
  computed: {
    name() { return this.$vnode.key },
  },
  template: `
<span style="width: 100%;" v-if="!$root.exclude[name]">
<div class="row filled" >
<div v-if="title" style="display: flex">
  {{title}}:
  <help v-if="help" :message="help"/>
</div>
<input type="color" v-model="$root.prefs[name]">
</span>
`})

Vue.component('dropdown', {
  props: ['title', 'options', 'path'],
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
  // Not that the actual dropdown html is in controller.html with id select-items
  template: `
<div class="dropdown-container horiz-box" v-if="!$root.exclude[name]"
  :class="{ 'top-padded': title }"
  style="align-items: center">
  <div v-if="title" style="margin-right: 2rem">{{title}}:</div>
  <div class="custom-select" @blur="close">
    <div class="selection" @click="opened">
      {{ toDisplay(selection) }}
    </div>
  </div>
</div>`})

Vue.component('vector', {
  props: ['title', 'normalize'],
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
    name() { return this.$vnode.key },
  },
  watch: {
    "$root.prefs": function() { this.updateFromPrefs() },
    value() {
      let angle = -this.value.angle
      let mag = this.value.magnitude
      let xOffset = (Math.cos(angle) - 1) * mag * 15/2
      let yOffset = Math.sin(angle) * mag * 15/2
      this.style = {
        transform: `
          translateX(${xOffset}rem)
          translateY(${yOffset}rem)
          rotate(${angle}rad)`,
        width: `${mag * 15}rem`,
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
  <span>
    <div class="horiz-box row" style="margin-bottom:0;">{{title}}:</div>
    <div class="vector" v-if="!$root.exclude[name]"
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
  </span>
  <div class="side"></div>
</div>
`})


Vue.component('stlviewer', {
  props: ['file'],
  watch: {
    file() {
      this.load()
    }
  },
  mounted() {
    this.load()
  },
  methods: {
    load() {
      if (!this.file) return
  
      console.log(this.file)
      this.$el.innerHTML = ""

      // Create a scene, camera, and renderer
      const scene = new THREE.Scene()
      const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000)
      const renderer = new THREE.WebGLRenderer()
      let boundingRect = this.$el.getBoundingClientRect()
      renderer.setSize(boundingRect.width, boundingRect.height)
      renderer.domElement.style.zIndex = -1
      this.$el.appendChild(renderer.domElement)
  
      // Add a light sources
      const sun = new THREE.DirectionalLight(0xffffff, 1.5)
      sun.position.set(10, 10, 10).normalize()
      const ambient = new THREE.AmbientLight(0xffffff, 0.4)
      scene.add(sun)
      scene.add(ambient)
  
      // Load the STL file
      const loader = new STLLoader();
      let mesh = null;
      loader.load("stls/" + this.file + ".stl", function (geometry) {
        geometry.center()
        geometry.computeBoundingSphere()
        const r = geometry.boundingSphere.radius
        geometry.scale(1/r, 1/r, 1/r)
        
        const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
        mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)
      }, undefined, function (error) {
          console.error('An error happened while loading the STL file.', error)
      })
  
      // Position the camera
      camera.position.z = 1.6
  
      // Animate the scene
      function animate() {
        requestAnimationFrame(animate)
        if (mesh) {
          mesh.rotation.y += 0.007
        }
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
            fill="var(--bg-color)">
      </rect>

      <image :x="(w-imageWidth)/2" :y="(h-imageWidth)/2" :width="imageWidth" :height="imageWidth"
          :href="imageUrlW" fill="white"></image>
    </svg>
  </div>
</template>`})
