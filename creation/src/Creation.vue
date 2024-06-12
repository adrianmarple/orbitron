<template>
<div class="type-buttons">
  <div v-for="button in buttons" class="button" @click="openProject(button)">
    {{ button.split("/")[1] }}
  </div>
</div>
<div class="actions">
  <div class="button" @click="downloadJSON">Download JSON</div>
  <div class="button" @click="downloadCover(false)">Download Top SVG</div>
  <div class="button" @click="downloadCover(true)">Download Bottom SVG</div>
  <div class="button" @click="genWalls">Generate Walls</div>
  <div class="button" @click="genBoxTop">Generate Box Top</div>
  <div class="button" @click="cleanup">Cleanup Printer Files</div>
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
  <div>ORB ID
    <textarea v-model="orbID"></textarea>
  </div>
</div>

<canvas width="1000" height="1000"></canvas>
<svg id="wall" class="laser" width=1000 height=100 viewBox="0 0 1000 100" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path stroke="#808080"/>
</svg>
<svg id="cover" class="laser" width=1000 height=1000 viewBox="0 0 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scaleY(-1)">
  <path stroke="#808080"/>
</svg>
</template>

<script>
export default {
  name: 'Creation',
  data() {
    return {
      innerWidth,
      mode: "creation",
      settings: [
        {name: "showVertexNumbers", type: "bool"},
        {name: "showEdgeNumbers", type: "bool"},
        {name: "showLaserSVG", type: "bool"},
        {name: "showWallSVG", type: "bool"},
        {name: "generateWallNumbers", type: "bool"},
        {name: "noInputShaper", type: "bool"},
        {name: "onlyOneWall", type: "bool"},
        {name: "STARTING_WALL_INDEX", type: "int", value: 0},
        {name: "PROCESS_STOP", type: "select",
          options: [
            ["scad", "Make OpenScade file"],
            ["stl", "Generate .stl"], 
            ["bgcode", "Generate gcode"],
            ["upload", "Upload gcode"],
          ],
          value: "upload",
        },
      ],
      buttons: [],
      qrCode: null,
      orbIDs: {},
      orbID: "",
    }
  },
  created() {
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
      data: "https://my.lumatron.art/",
      dotsOptions: { type: "rounded" },
      cornersSquareOptions: { type: "extra-rounded" },
      qrOptions: { errorCorrectionLevel: "L" },
    })
    this.fetchButtons()
  },
  watch: {
    orbID(val) {
        this.orbIDs[this.fullProjectName] = val
        localStorage.setItem("ID:" + this.fullProjectName, val)
    },
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
      this.openProject(this.fullProjectName)
    },
    async openProject(name) {
      window.fullProjectName = name
      this.fullProjectName = name
      this.orbID = this.orbIDs[this.fullProjectName] || ""
      localStorage.setItem("button", name)
      reset()
      await require("../projects/" + name + ".js")()
      generatePixelInfo()
      await generateManufacturingInfo()
      let qrUrl = 'https://my.lumatron.art/' + this.orbID
      this.qrSize = (qrUrl.length <= 32 ? 25 : 29) * 20
      this.qrCode.update({
        width: this.qrSize,
        height: this.qrSize,
        data: qrUrl
      })
    },
    async fetchButtons() {
      this.buttons = await (await fetch("/buttonlist.json")).json()
      for (let button of this.buttons) {
        this.orbIDs[button] = localStorage.getItem("ID:" + button) || ""
      }
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
    cleanup() {
      this.push({
        fullProjectName: this.fullProjectName,
        type: "cleanup",
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
      let body = createPrintInfo()
      body.fullProjectName = fullProjectName
      this.push(body)
      console.log("Generating gcode")
    },
    async genBoxTop() {
      let data = await blobToBase64(await this.qrCode.getRawData())
      this.push({
        fullProjectName: this.fullProjectName,
        type: "qr",
        scale: 48.0 / this.qrSize,
        PROCESS_STOP,
        PETG: true,
        data,
      })
    },
    downloadJSON() {
      let fileContent = JSON.stringify(generatePixelInfo(), null, 2)
      let fileName = this.fullProjectName + '.json'
      this.download(fileName, fileContent)
      console.log("Downloaded " + fileName)
    },
    async downloadCover(isBottom) {
      window.IS_BOTTOM = isBottom
      window.KERF = isBottom ? BOTTOM_KERF : TOP_KERF
      await createCoverSVG()
      let elem = document.getElementById("cover")
      elem.style.display = "block"
      this.download(`${this.fullProjectName} ${isBottom ? "bottom":"top"}.svg`, elem.outerHTML)
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

canvas {
  width: 100vh;
  max-width:  100vw;
  height: 100vh;
  max-height: 100vw;
  margin: 0;
  position: absolute;
  pointer-events: none;
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
#settings textarea {
  margin-left: 12px;
  font-size: 1em;
  width: 200px;
  resize: none;
  overflow: hidden;
}

#wall, #cover {
  position: absolute;
  pointer-events: none;
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
