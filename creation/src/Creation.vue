<template>
<div class="type-buttons">
  <div v-for="button in buttons" class="button" @click="openProject(button)">
    {{ button.split("/")[1] }}
  </div>
</div>
<div class="actions">
  <div class="button" @click="toggleCoverMode">Toggle Cover Mode ({{ coverMode[0] }})</div>
  <div class="button" @click="advanceCoverIndex">Next Cover ({{ coverIndex }})</div>
  <div class="button" @click="downloadGitFiles">Create git files</div>
  <div class="button" @click="removeGitFiles">Remove git files</div>
  <!-- <div class="button" @click="downloadJSON">Download JSON</div> -->
  <div class="button" @click="genPrints">Generate Prints</div>
  <!-- <div class="button" @click="genModel('simple')">Simple 3D Model</div> -->
  <!-- <div class="button" @click="genModel('simplest')">Ultra Simple 3D Model</div> -->
  <div class="button" @click="genModel('parts')">3D Model with part IDs</div>
  <div class="button" @click="cleanup">Cleanup Printer Files</div>
  <!-- <div class="button" @click="configure">Configure Default Orb</div> -->
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
<svg id="cover" class="laser" width=0 height=0 viewBox="-1000 -1000 1000 1000" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: scaleY(-1)">
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
      fullProjectName: "",
      coverMode: "bottom",
      coverIndex: 0,
      settings: [
        {name: "showVertexNumbers", type: "bool"},
        {name: "showEdgeNumbers", type: "bool"},
        {name: "showPixelNumbers", type: "bool"},
        {name: "showLaserSVG", type: "bool"},
        // {name: "showWallSVG", type: "bool"},
        {name: "STARTING_PART_ID", type: "int", value: 1},
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

      // Rendering
      zoom: 1,
      previousXY: null,
      isDragging: false,
      pathIndex: -1,
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

    let eventTypes = ['onmousedown', 'onmousemove', 'onmouseup', 'onkeydown', 'onwheel']
    for (let eventType of eventTypes) {
      document[eventType] = (e) => {
        if (this.$root.mode == 'creation') {
          this[eventType](e)
        } else {
          this.isDragging = false
          this.previousXY = null
        }

      }
    }
    setInterval(this.render, 30)
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
      if (!["STARTING_PART_ID", "ENDING_PART_ID", "PROCESS_STOP"].includes(setting.name)) {
        this.openProject(this.fullProjectName)
      }
    },
    setSetting(name, value) {
      for (let setting of this.settings) {
        if (setting.name == name) {
          setting.value = value
          this.updateSetting(setting, true)
          break
        }
      }
    },
    async openProject(name) {
      if (this.fullProjectName && this.fullProjectName != name) {
        this.setSetting("STARTING_PART_ID", 1)
        this.setSetting("ENDING_PART_ID", 0)
      }
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
    },

    cleanup() {
      this.$root.post({
        fullProjectName: this.fullProjectName,
        type: "cleanup",
      })
      console.log(`Cleaning up "${this.fullProjectName.split("/")[1]}" files`)
    },
    download(fileName, data) {
      console.log(`Downloading ${fileName}`, data)
      return this.$root.post({
        type: "download",
        fileName,
        data,
      })
    },
    removeFile(fileName) {
      console.log(`Removing ${fileName}`)
      return this.$root.post({
        type: "remove",
        fileName,
      })
    },

    async downloadGitFiles() {
      this.downloadJSON()
      await this.genModel('simple')
      await this.genModel('simplest')
    },
    async removeGitFiles() {
      this.removeFile(`../pixels/${this.fullProjectName}.json`)
      this.removeFile(`../stls/${this.fullProjectName}.stl`)
      this.removeFile(`../stls/${this.fullProjectName}_full.stl`)
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
    async genModel(renderMode) {
      let oldMode = RENDER_MODE
      RENDER_MODE = renderMode
      await generateManufacturingInfo()
      let printInfo = createFullModel()
      printInfo.prints[0].suffix = "_" + renderMode
      
      if (renderMode == "simple" || renderMode == "simplest") {
        let oldDepth = CHANNEL_DEPTH
        let oldThickness = THICKNESS
        let oldBorder = BORDER
        CHANNEL_DEPTH = -CHANNEL_DEPTH - 2*THICKNESS
        THICKNESS += oldDepth + THICKNESS
        BORDER = 0
        COVER_TYPES = ["top"]
        await generateManufacturingInfo()
        let corePrintInfo = createFullModel()
        printInfo.prints[0].components = [
          ... (renderMode == "simple" ? printInfo.prints[0].components : []),
          ...corePrintInfo.prints[0].components
        ]
        CHANNEL_DEPTH = oldDepth
        THICKNESS = oldThickness
        BORDER = oldBorder
        COVER_TYPES = ["top", "bottom"]
        
        printInfo.additionalSavePath = "../stls"
        if (renderMode == "simple") {
          printInfo.additionalSavePathSuffix = "_full"
        }
      }
      RENDER_MODE = oldMode
      printInfo.fullProjectName = fullProjectName
      this.$root.post(printInfo)
      console.log("Generating " + renderMode)
      generateManufacturingInfo() // Restore old svgs and such
    },

    configure() {
      this.$root.$refs.admin.configureDefault(this.fullProjectName)
      this.$root.toggleMode()
    },

    onmousedown(e) {
      this.isDragging = true
      this.previousXY = [e.clientX, e.clientY]
    },
    onmousemove(e) {
      if (!this.isDragging || !this.previousXY) return
      const ROTATION_SCALE = 0.01

      let newXY = [e.clientX, e.clientY]
      let deltaX = newXY[0] - this.previousXY[0]
      let deltaY = newXY[1] - this.previousXY[1]
      rotateXAll(-ROTATION_SCALE * deltaY)
      rotateYAll(-ROTATION_SCALE * deltaX)
      this.previousXY = newXY
    },
    onmouseup() {
      this.isDragging = false
      this.previousXY = null
    },
    onkeydown(e) {
      if (e.which === 39 || e.which === 38) {
        this.pathIndex += 1
      }
      else if (e.which === 37 || e.which === 40) {
        this.pathIndex -= 1
      }
      else {
        return
      }
      let edge = edges[path[this.pathIndex-1]]
      if (!edge) return
      
      if (edge.isDupe) {
        edge = edge.dual
      }

      console.log(`Edge # ${edge.index}, ${edge.dual.index}`)

      console.log("  associated walls: " + edgeToWalls[edge.index].map(wall => wall.partID))
      if (this.pathIndex >= 0) {
        let distanceFromBeginning = 0
        for (let i = 0; i < this.pathIndex; i++) {
          distanceFromBeginning += edges[path[i]].length()
        }
        distanceFromBeginning = parseFloat(distanceFromBeginning.toFixed(2))
        console.log("  distance from beginning: " + distanceFromBeginning)
      }
    },
    onwheel(e) {
      this.zoom *= Math.exp(-e.deltaY * 0.001)
    },

    render() {
      let c = document.querySelector("canvas")
      if (!c) return
      let ctx = c.getContext("2d")
      ctx.clearRect(0, 0, 1000, 1000)

      let subPath = null
      if (path) {
        subPath = path.slice(0, this.pathIndex)
      }

      let maxMagnitude = 0
      for (let vertex of verticies) {
        let point = vertex.coordinates
        maxMagnitude = Math.max(maxMagnitude, point.length())
      }
      let projScale = 8 / (0.6 + maxMagnitude)

      let edgesCopy = edges.slice()
      edgesCopy.sort((a, b) => {
        let pathFactor = 0
        if (path) {
          pathFactor = subPath.includes(a.index) ? 0.1 : 0
          pathFactor += a.isDupe ? 0.01 : 0
          pathFactor -= subPath.includes(b.index) ? 0.1 : 0
          pathFactor -= b.isDupe ? 0.01 : 0
        }
        return pathFactor + b.verticies[0].coordinates[2] - a.verticies[0].coordinates[2]
      })
      for (let edge of edgesCopy) {
        let xy0 = edge.verticies[0].coordinates.project(projScale, this.zoom)
        let xy1 = edge.verticies[1].coordinates.project(projScale, this.zoom)
        let z = edge.verticies[0].coordinates.z*projScale + 15
        ctx.beginPath()

        let alpha = 4/z
        if (subPath && subPath.includes(edge.index)) {
          ctx.strokeStyle = `rgba(255,255,255,${alpha * 2})`
          if (edge.isDupe) {
            ctx.strokeStyle = `rgba(215,255,255,${alpha * 1.2})`
          }
        } else {
          ctx.strokeStyle = `rgba(255,25,255,${alpha})`
        }
        ctx.lineWidth = this.zoom * 100 / (z + 10)
        ctx.moveTo(xy0[0], xy0[1])
        ctx.lineTo(xy1[0], xy1[1])
        ctx.closePath()
        ctx.stroke()
      }

      ctx.fillStyle = "#f06"
      ctx.font = "10px Arial"
      for (let vertex of verticies) {
        let xy = vertex.coordinates.project(projScale, this.zoom)
        if (showVertexNumbers) {
          ctx.fillText(vertex.index, xy[0] + 4, xy[1] - 5)
        }
      }
      for (let edge of edges) {
        let center = edge.verticies[0].coordinates.add(edge.verticies[1].coordinates)
        center = center.scale(0.5)
        let xy = center.project(projScale, this.zoom)
        if (showEdgeNumbers && !edge.isDupe) {
          let text = edge.index + ""
          let len = parseFloat(edge.length().toFixed(2))
          text += " (" + len + ")"
          // if (window.edgeToWalls && window.edgeToWalls[edge.index]) {
          //   text += " ("
          //   for (let wall of window.edgeToWalls[edge.index]) {
          //     text += wall.partID + " "
          //   }
          //   text += ")"
          // }
          ctx.fillText(text, xy[0] - 2, xy[1] +4)
        }
      }
      if (window.pixelInfo && showPixelNumbers) {
        ctx.font = "8px Arial"
        for (let coord of pixelInfo.coords) {
          let xy = new Vector(...coord)
              .scale(1/pixelToGraphSpace.resizeScale)
              .project(projScale, this.zoom)
          ctx.fillText(pixelInfo.coords.indexOf(coord), xy[0] + 2, xy[1] - 2)
        }
      }

      let cover = document.getElementById("cover")
      if (cover) {
        cover.style.display = window.showLaserSVG && isWall ? "block" : "none"
      }
      let wallElem = document.getElementById("wall")
      if (wallElem) {
        wallElem.style.display = window.showWallSVG && isWall ? "block" : "none"
      }
    }
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
