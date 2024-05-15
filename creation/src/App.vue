<template>


<div id="type-buttons">
  <div v-for="button in buttons" class="button" @click="openProject(button)">
    {{ button.split("/")[1] }}
  </div>
</div>
<div id="actions">
  <div class="button" @click="downloadJSON">Download JSON</div>
  <div class="button" @click="downloadCover(false)">Download Top SVG</div>
  <div class="button" @click="downloadCover(true)">Download Bottom SVG</div>
  <div class="button" @click="genWalls">Generate Walls</div>
  <div class="button" @click="genBoxTop">Generate Box Top</div>
</div>

<div id="settings">
  <div v-for="setting in settings">
    <div v-if="setting.type == 'bool'">
      <input type="checkbox" @change="updateSetting(setting)"
          v-model="setting.value">
      {{ setting.name }}
    </div>
    <div v-if="setting.type == 'int'">
      <input type="number" @change="updateSetting(setting)"
          v-model="setting.value">
      {{ setting.name }}
    </div>
    <div v-if="setting.type == 'select'">
      <select @change="updateSetting(setting)" v-model="setting.value">
        <option v-for="option in setting.options"
            :value="option[0]">
          {{ option[1] }}
        </option>
      </select>
    </div>
  </div>
  <span>
</span>
</div>

<div id="background"></div>

<div id="meta-container">
  <div class="left side-box"></div>
  <div id="container-wrapper">
    <div id="container">
      <div class="black-box"></div>
      <svg id="nav">
        <mask id="nav-mask" x="0" y="0" :width="width" height=100>
          <rect x=0 y=0 :width="width" height=100 fill="white"></rect>
          <text x=86 y=50 fill="black">(Lumatron creation)</text>
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
  <div id="bottom"></div>
</div>
</template>

<script>
import QRCodeStyling from 'qr-code-styling'

export default {
  name: 'App',
  data() {
    return {
      innerWidth,
      settings: [
        {name: "showVertexNumbers", type: "bool"},
        {name: "showEdgeNumbers", type: "bool"},
        {name: "showLaserSVG", type: "bool"},
        {name: "showWallSVG", type: "bool"},
        {name: "generateWallNumbers", type: "bool"},
        {name: "useMINI", type: "bool"},
        {name: "noInputShaper", type: "bool"},
        {name: "onlyOneWall", type: "bool"},
        {name: "STARTING_WALL_INDEX", type: "int", value: 0},
        {name: "PROCESS_STOP", type: "select",
          options: [
            ["scad", "Make OpenScade file"],
            ["stl", "Generate .stl"], 
            ["bgcode", "Generate .bgcode"],
            ["upload", "Upload .bgcode"],
          ],
          value: "upload",
        },
      ],
      buttons: [],
      qrCode: null,
    }
  },
  created() {
    let self = this
    addEventListener('resize', (event) => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    });

    for (var setting of this.settings) {
      setting.value = localStorage.getItem(setting.name) || setting.value
      if (setting.type == "bool")
        setting.value = setting.value == "true"
      window[setting.name] = setting.value
    }

    this.qrCode = new QRCodeStyling({
      width: 25 * 20,
      height: 25 * 20,
      margin: 0,
      type: "svg",
      data: "https://a.lumatron.art/",
      dotsOptions: { type: "rounded" },
      cornersSquareOptions: { type: "extra-rounded" },
      qrOptions: { errorCorrectionLevel: "L" },
    })
    this.fetchButtons()
  },
  computed: {
    width() {
      return Math.min(700, this.innerWidth)
    },
  },
  methods: {
    updateSetting(setting) {
      localStorage.setItem(setting.name, setting.value)
      window[setting.name] = setting.value
      this.openProject(fullProjectName)
    },
    async openProject(name) {
      window.fullProjectName = name
      localStorage.setItem("button", name)
      reset()
      await require("../projects/" + name + ".js")()
      generatePixelInfo()
      await generateManufacturingInfo()
      window.orbID = window.orbID || name.split("/")[1]
      let qrUrl = 'https://a.lumatron.art/' + orbID
      this.qrSize = (qrUrl.length <= 32 ? 25 : 29) * 20
      this.qrCode.update({
        width: this.qrSize,
        height: this.qrSize,
        data: qrUrl
      })
    },
    async fetchButtons() {
      this.buttons = await (await fetch("/buttonlist.json")).json()
      // for (let url of this.buttons) {
      //   require("../projects/" + url + ".js")
      // }
      
      this.openProject(localStorage.getItem("button"))
    },

    push(bodyJSON) {
      fetch("http://localhost:8000/", {
        method: "POST",
        mode: 'no-cors',
        body: JSON.stringify(bodyJSON),
        headers: {
          "Content-type": "application/json; charset=UTF-8"
        }
      })
    },
    download(fileName, data) {
      this.push({
        type: "download",
        fileName,
        data,
      })
      console.log(`Downloading ${fileName}`, data)
    },
    genWalls() {
      let wall = document.getElementById("wall")
      wall.style.display = "block"
      this.push(createPrintInfo())
      console.log("Generating gcode")
    },
    async genBoxTop() {
      let data = await blobToBase64(await this.qrCode.getRawData())
      this.push({
        fullProjectName,
        type: "qr",
        scale: 48.0 / this.qrSize,
        data
      })
    },
    downloadJSON() {
      let fileContent = JSON.stringify(generatePixelInfo(), null, 2)
      let fileName = fullProjectName + '.json'
      this.download(fileName, fileContent)
      console.log("Downloaded " + fileName)
    },
    async downloadCover(isBottom) {
      window.IS_BOTTOM = isBottom
      window.KERF = isBottom ? BOTTOM_KERF : TOP_KERF
      await createCoverSVG()
      let elem = document.getElementById("cover")
      elem.style.display = "block"
      this.download(`${fullProjectName} ${isBottom ? "bottom":"top"}.svg`, elem.outerHTML)
    },
  },
}

function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(",")[1])
    reader.readAsDataURL(blob)
  })
}
</script>

<style>
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
#app {
  overflow:hidden;
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


canvas {
  width: 100vh;
  max-width:  100vw;
  height: 100vh;
  max-height: 100vw;
  margin: 0;
  position: absolute;
}
.button {
  z-index: 1;
  padding: 10px 20px;
  margin: 8px;
  font-size: 24px;
  border: 1px solid black;
  border-radius: 12px;
  background-color: white;
  cursor: pointer;
}
#type-buttons {
  position: fixed;
  right:  24px;
  top: 24px;
  z-index: 1;
  display: flex;
  flex-direction: column;
}
#actions {
  z-index: 10;
  position: fixed;
  left:  24px;
  bottom: 24px;
}

#settings {
  position: fixed;
  left:  24px;
  top: 24px;
  z-index: 10;
  height: 144px;
  display: grid;
  grid-template-rows: repeat(4, 32px);
  grid-auto-flow: column;
  color: white;
}
#settings > div {
  display: flex;
  font-size: 24px;
  cursor: pointer;
}
#settings input[type="checkbox"] {
  width: 1em;
  margin-left: 12px;
}
#settings input[type="number"] {
  width: 3em;
  margin: 0 12px;
}



#nav {
  width: 100%;
  display: flex;
  height: 100px;
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
  position: fixed;
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
}

#container {
  width: 100%;
  max-width: 100vw;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #f5f5f5;
  font-weight: 700;
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

#wall, #cover {
  position: absolute;
  top: 0;
  left: 0;
}
#cover text {
  font-size: 20px;
  fill: white;
  transform-box: fill-box;
  transform: scaleY(-1) translate(-5px, -29px);
}
#wall {
  top: 160px;
}
</style>
