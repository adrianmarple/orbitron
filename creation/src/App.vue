<template>


<div id="background"></div>

<div id="meta-container">
  <div :class="{ hidden: mode != 'creation' }">
    <Creation></Creation>
  </div>
  <div class="left side-box"></div>
  <div id="container-wrapper">
    <div id="container">
      <div class="black-box">
        <div class="filler" :class="{ hidden: mode != 'admin' }">
          <Admin ref="admin"></Admin>
        </div>
      </div>
      <svg id="nav" @click="toggleMode">
        <mask id="nav-mask" x="0" y="0" :width="width" height=100>
          <rect x=0 y=0 :width="width" height=100 fill="white"></rect>
          <text :x="navTextX" y=50 fill="black">(Lumatron {{ mode }})</text>
        </mask>
        <rect :width="width"
              height=100
              mask="url(#nav-mask)"
              fill="var(--bg-color)">
        </rect>
      </svg>
    </div>
  </div>
  <div class="right side-box"></div>
</div>
</template>

<script>
import Admin from "@/Admin"
import Creation from "@/Creation"

export default {
  name: 'App',
  components: {
    Creation,
    Admin,
  },
  data() {
    return {
      innerWidth,
      mode: localStorage.getItem("mode") || "creation",
    }
  },
  created() {
    let self = this
    addEventListener('resize', (event) => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    })
  },
  computed: {
    width() {
      return Math.min(700, this.innerWidth)
    },
    navTextX() {
      return 196 - this.mode.length * 14
    }
  },
  methods: {
    toggleMode() {
      if (this.mode == 'creation') {
        this.mode = 'admin'
      } else {
        this.mode = 'creation'
      }
      localStorage.setItem("mode", this.mode)
    },
    post(bodyJSON) {
      return fetch("http://localhost:8000/", {
        method: "POST",
        mode: 'no-cors',
        body: JSON.stringify(bodyJSON),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })
    },
  },
}
</script>

<style>
.hidden {
  display: none;
}

@font-face {
  font-family: "Lumatron";
  font-display: auto;
  src: url('/barcade.otf');
}
@font-face {
  font-family: "Heading";
  font-display: auto;
  src: url('/Kanit-Light.ttf');
}

html, body, #app {
  width: 100%;
  min-height: 100vh;
}
body {
  margin: 0;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: flex;
  flex-direction: column;
  align-items: center;
  --bg-color: #080808;
}
a {
  text-decoration: none;
}
a, a:visited {
  color: inherit;
}

h1 {
  font-family: Heading;
  font-size: 2.5rem;
  width: 100%;
  padding: 0 42px;
  box-sizing: border-box;
  text-align: center;
  filter: drop-shadow(white 0 0 5px);
}

@keyframes animatedBackground {
  from { background-position: 0 0; }
  to { background-position: max(100vw, 100vh) max(100vw, 100vh); }
}
#background {
  position: fixed;
  left: 0;
  top: 0;
  z-index: -10;
  font-size: max(100vw, 100vh);
  width: 1em;
  height: 1em;
  background-image: repeating-linear-gradient(
      -45deg,
      #00f 0,
      #a0a 12.5%,
      #f00 25%,
      #a0a 37.5%,
      #00f 50%,
      #a0a 62.5%,
      #f00 75%,
      #a0a 87.5%,
      #00f 100%
    );
  animation: animatedBackground 20s linear infinite;
}

.filler {
  width: 100%;
  height: 100%;
}

.button {
  z-index: 1;
  padding: 10px 20px;
  margin: 6px 2px;
  font-size: 24px;
  border: 1px solid black;
  border-radius: 12px;
  background-color: white;
  color: #333;
  cursor: pointer;
}
.button.disabled {
  background-color: #ccc;
  color: #666;
  pointer-events: none;
}

.type-buttons {
  position: fixed;
  right:  24px;
  top: 24px;
  z-index: 9;
  display: flex;
  flex-direction: column;
  height: 95vh;
  overflow-y: scroll;
}
.actions {
  z-index: 10;
  position: fixed;
  left:  24px;
  bottom: 24px;
}

#nav {
  width: 100%;
  display: flex;
  height: 100px;
  cursor: pointer;
  font-weight: 700;
}
#nav text {
  font-size: 6em;
  font-family: Lumatron;
}

#meta-container {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
}

.side-box {
  width: calc(50% - 300px);
  min-width: 50px;
  height: 100vh;
  z-index: -1;
  position: fixed;
}
.left.side-box {
  left: -50px;
  background-image: linear-gradient(to right, rgba(8,8,8,0.9) 0, var(--bg-color) 80%);
}
.right.side-box {
  right: -50px;
  background-image: linear-gradient(to left, rgba(8,8,8,0.9) 0, var(--bg-color) 80%);
}

#container-wrapper {
  max-width: 700px;
  width: 100vw;
  display: grid;
  grid-template-rows: 1fr auto;
  min-height: 100vh;
  position: fixed;
}

#container {
  width: 100%;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #f5f5f5;
  font-size: .5em;
  letter-spacing: 0.1em;
}

.positioner {
  position: relative;
}

.black-box {
  background-color: var(--bg-color);
  width: 100%;
  height: 100%;
}
.horiz-box {
  background-color: var(--bg-color);
  width: 100%;
  min-height: 12px;
  display: flex;
  justify-content: center;
}

.xtall {
  min-height: 300px;
}
.tall {
  min-height: 100px;
}
.medium {
  min-height: 32px;
}

.fancy-box {
  margin: 2px;
  width: calc(100% - 4px);
  background-color: var(--bg-color);
  transition: color .5s cubic-bezier(.08,.59,.29,.99),
    background-color .5s cubic-bezier(.08,.59,.29,.99);
}
a > .fancy-box:hover, a.fancy-box:hover {
  background-color: rgba(0,0,0,0.7);
  color: white;
}
.fancy-box img {
  width: 90%;
  padding: 0 5%;
}

.fancy-divider {
  width: 100%;
  height: 2px;
  border: 10px solid black; 
  box-sizing: border-box;
}
</style>
