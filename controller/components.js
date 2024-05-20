
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
<div class="pure-material-checkbox" @click="$root.prefs[name] = !$root.prefs[name]">
  <input type="checkbox" v-model="$root.prefs[name]">
  <div class="checkbox">
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
  props: ['title', 'options', 'selection'],
  data() {
    return { open: false }
  },
  computed: {
    name() { return this.$vnode.key },
  },
  methods: {
    opened() {
      this.open = true
      setTimeout(() => {
        document.addEventListener('click', this.close)
      }, 100)
    },
    close() {
      this.open = false
      document.removeEventListener('click', this.close)
    },
    clicked(value) {
      this.$root.prefs[this.name] = value
    },
    toDisplay(value) {
      for (let [v, display] of this.options) {
        if (v == value) return display
      }
      return value
    },
  },
  template: `
<div class="dropdown-container horiz-box" v-if="!$root.exclude[name]"
  style="align-items: center">
  <div style="margin-right: 2rem">{{title}}:</div>
  <div class="custom-select" @blur="close">
    <div class="selection" :class="{ open: open }" @click="opened">
      {{ toDisplay(selection) }}
    </div>
    <div class="items" :class="{ selectHide: !open }">
      <div
        v-for="[value, display] of options"
        :value="value"
        :key="value"
        :class="{ checked: value == selection }"
        @click="clicked(value)"
      >
        {{ display }}
      </div>
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
<span>
  <div class="row" style="margin-bottom:0;">{{title}}:</div>
  <div class="vector" v-if="!$root.exclude[name]"
      @mousedown="startMove"
      @mousemove="onMove"
      @mouseup="endMove"
      @mouseleave="endMove"
      @touchstart="startMove($event.targetTouches[0])"
      @touchmove="onMove($event.targetTouches[0])"
      @touchend="endMove">
    <div class="shaft" :style="style">
      <div class="tip"></div>
    </div>
  </div>
</span>
`})




Vue.component('Icon', {
  props: ['image', 'w', 'h', 'selected'],
  computed: {
    imageUrl() { return `/controller/${this.image}.svg` },
    imageWidth() { return 0.6 * Math.min(this.w, this.h) }
  },
  template: `
<template>
  <div class="icon" :class="{ selected }" @click="$emit('click')">
    <svg :width="w" :height="h">
      <mask :id="image" x="0" y="0" :width="w" :height="h" color="black">
        <rect x=0 y=0 :width="w" :height="h" fill="white"></rect>
        <image :x="(w-imageWidth)/2" :y="(h-imageWidth)/2" :width="imageWidth" :height="imageWidth"
            :href="imageUrl"></image>
      </mask>
      <rect class="main-rect"
            :width="w"
            :height="h"
            :mask="'url(#' + image + ')'"
            fill="var(--bg-color)">
      </rect>

      <image :x="(w-imageWidth)/2" :y="(h-imageWidth)/2" :width="imageWidth" :height="imageWidth"
          :href="imageUrl" fill="white"></image>
    </svg>
  </div>
</template>`})
