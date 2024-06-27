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
  <div class="button" @click="cleanup">Cleanup Printer Files</div>
  <div class="button" @click="configure">Configure Default Orb</div>
</div>

<div id="settings">
  <div v-for="setting in settings">
    <div v-if="setting.type == 'bool'" @click="setting.value = !setting.value; updateSetting(setting)">
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
</div>

<canvas id="path" width="1000" height="1000"></canvas>
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
    }
  },
  created() {
    for (var setting of this.settings) {
      setting.value = localStorage.getItem(setting.name) || setting.value
      if (setting.type == "bool")
        setting.value = setting.value == "true"
      window[setting.name] = setting.value
    }
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
      this.openProject(this.fullProjectName)
    },
    async openProject(name) {
      window.fullProjectName = name
      this.fullProjectName = name
      localStorage.setItem("button", name)
      reset()
      await require("../projects/" + name + ".js")()
      generatePixelInfo()
      await generateManufacturingInfo()
    },
    async fetchButtons() {
      this.buttons = await (await fetch("/buttonlist.json")).json()
      this.openProject(localStorage.getItem("button"))
    },

    cleanup() {
      this.$root.push({
        fullProjectName: this.fullProjectName,
        type: "cleanup",
      })
    },
    download(fileName, data) {
      this.$root.push({
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
      this.$root.push(body)
      console.log("Generating gcode")
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

    configure() {
      this.$root.$refs.admin.configureDefault(this.fullProjectName)
      this.$root.toggleMode()
    },
  },
}
</script>

<style>

#path {
  padding: 0 calc(50vw - 50vh);
  left: 0;
  width: 100vh;
  max-width:  100vw;
  height: 100vh;
  max-height: 100vw;
  position: absolute;
  pointer-events: none;
  z-index: 1;
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
  z-index: 1;
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
