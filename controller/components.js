
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
  props: ['title', 'min', 'max'],
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
    <div>{{title}}:</div>
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
  props: ['title'],
  data() {
    return { value: [0,0,0] }
  },
  mounted() {
    this.updateFromPrefs()
  },
  computed: {
    name() { return this.$vnode.key },
  },
  watch: {
    "$root.prefs": function() { this.updateFromPrefs() },
    value: {
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
      this.value = result ? {
        red: parseInt(result[1], 16),
        green: parseInt(result[2], 16),
        blue: parseInt(result[3], 16)
      } : [0,0,0]
    },
  },
  template: `
<span style="width: 100%;" v-if="!$root.exclude[name]">
<div v-if="title" class="horiz-box">{{title}}</div>
<div class="color-component"
  v-for="component in ['red','green','blue']">
  <div class="label">
    <div>{{component[0]}}:{{value[component]}}</div>
  </div>
  <div class="slider-container" :class="[component]">
    <input type="range" min="0" max="255" class="slider""
      v-model="value[component]"></input>
    <div class="left" :style="{ background: component, width: (100 / 255.0 * value[component]) + '%'}"></div>
    <div class="right" :style="{ width: (100 - 100 / 255.0 * value[component]) + '%'}"></div>
  </div
</div>
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
