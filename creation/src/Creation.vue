<template>
<div class="type-buttons">
  <div v-for="button in buttons" class="button" @click="openProject(button)">
    {{ button.split("/")[1] }}
  </div>
</div>
<div class="actions">
  <div class="button" @click="toggleCoverMode">Toggle Cover Mode ({{ coverMode[0] }})</div>
  <div class="button" @click="advanceCoverIndex">Next Cover ({{ coverIndex }})</div>
  <div class="button" @click="downloadJSON">Download JSON</div>
  <div class="button" @click="genPrints">Generate Prints</div>
  <div class="button" @click="genModel">Full 3D Model</div>
  <div class="button" @click="cleanup">Cleanup Printer Files</div>
  <div class="button" @click="configure">Configure Default Orb</div>
</div>

<div id="settings">
  <div v-for="setting in settings">
    <div v-if="setting.type == 'bool'" @click="setting.value = !setting.value; updateSetting(setting)">
      <input type="checkbox" v-model="setting.value">
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

<div id="full-name">{{ fullProjectName }}</div>

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
      coverMode: "bottom",
      coverIndex: 0,
      settings: [
        {name: "showVertexNumbers", type: "bool"},
        {name: "showEdgeNumbers", type: "bool"},
        {name: "showPixelNumbers", type: "bool"},
        {name: "showLaserSVG", type: "bool"},
        {name: "showWallSVG", type: "bool"},
        {name: "generateWallNumbers", type: "bool"},
        {name: "noSupports", type: "bool"},
        {name: "onlyOneWall", type: "bool"},
        {name: "STARTING_PART_ID", type: "int", value: 0},
        {name: "ENDING_PART_ID", type: "int", value: 0},
        {name: "PROCESS_STOP", type: "select",
          options: [
            ["stl", "Generate .stl"],
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
      if (centerOnRender) {
        center()
      }
      generatePixelInfo()
      await generateManufacturingInfo()
      this.setCoverSVG()
      this.$forceUpdate()
    },
    async fetchButtons() {
      this.buttons = await (await fetch("http://localhost:8000/buttonlist.json")).json()
      this.openProject(localStorage.getItem("button"))
    },
    toggleCoverMode() {
      this.coverMode = this.coverMode == "top" ? "bottom" : "top"
      this.setCoverSVG()
    },
    advanceCoverIndex() {
      this.coverIndex = (this.coverIndex + 1) % covers[this.coverMode].length
      this.setCoverSVG()
    },
    setCoverSVG() {
      let coverInfo = covers[this.coverMode][this.coverIndex]
      if (!coverInfo) return
      cover.outerHTML = coverInfo.svg

      if (generateWallNumbers) {
        let scale = coverPrint3D ? 1 : MM_TO_96DPI
        let plain = plains[this.coverIndex]
        cover.querySelectorAll("text").forEach(elem => cover.removeChild(elem))
        for (let wallType of wallInfo) {
          let index = wallInfo.indexOf(wallType)
          wallType.id = index
          for (let edgeCenter of wallType.edgeCenters[plain]) {
            let txt = document.createElementNS("http://www.w3.org/2000/svg", "text")
            txt.setAttribute("x", edgeCenter.x * scale)
            txt.setAttribute("y", edgeCenter.y * scale)
            txt.innerHTML = "" + index
            cover.appendChild(txt)
          }
        }
      }
    },

    cleanup() {
      this.$root.post({
        fullProjectName: this.fullProjectName,
        type: "cleanup",
      })
      console.log(`Cleaning up "${this.fullProjectName.split("/")[1]}" files`)
    },
    download(fileName, data) {
      this.$root.post({
        type: "download",
        fileName,
        data,
      })
      console.log(`Downloading ${fileName}`, data)
    },

    downloadJSON() {
      let fileContent = JSON.stringify(generatePixelInfo(), null, 2)
      let fileName = this.fullProjectName + '.json'
      this.download(fileName, fileContent)
      console.log("Downloaded " + fileName)
    },
    genPrints() {
      let printInfo = createPrintInfo3D()
      printInfo.fullProjectName = fullProjectName
      this.$root.post(printInfo)
      console.log("Generating prints")
    },
    genModel() {
      let printInfo = createFullModel()
      printInfo.fullProjectName = fullProjectName
      this.$root.post(printInfo)
      console.log("Generating full")
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

#full-name {
  position: fixed;
  bottom: 100px;
  left: calc(50vw - 256px);
  font-size: 2rem;
  color: white;
  z-index: 1;
}
</style>
