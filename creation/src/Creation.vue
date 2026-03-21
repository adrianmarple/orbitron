<template>
<div id="background"></div>

<div id="meta-container">
  <div class="type-buttons">
    <div v-for="project in activeProjects" class="button project-row" @click="openProject(project)">
      <span>{{ project.shortName }}</span>
      <span class="skip-icon" @click.stop="toggleSkip(project)" title="Skip">⏭</span>
    </div>
    <div v-if="skippedProjects.length" class="skip-toggle" @click="showSkipped = !showSkipped">
      {{ showSkipped ? '▾' : '▸' }} Skipped
    </div>
    <template v-if="showSkipped">
      <div v-for="project in skippedProjects" class="button skipped project-row" @click="openProject(project)">
        <span>{{ project.shortName }}</span>
        <span class="skip-icon" @click.stop="toggleSkip(project)" title="Restore">↺</span>
      </div>
    </template>
  </div>
  <div class="actions">
    <div class="button" @click="toggleCoverMode">Toggle Cover Mode ({{ coverMode[0] }})</div>
    <div class="button" @click="advanceCoverIndex">Next Cover ({{ coverIndex }})</div>
    <div class="button" @click="downloadGitFiles">Create git files</div>
    <div class="button" @click="removeGitFiles">Remove git files</div>
    <div class="button" @click="genPrints">Generate Prints</div>
    <!-- <div class="button" @click="genModel('simple')">Simple 3D Model</div> -->
    <!-- <div class="button" @click="genModel('simplest')">Ultra Simple 3D Model</div> -->
    <div class="button" @click="genModel('parts')">3D Model with part IDs</div>
    <div class="button" @click="makeForArduino">Create Arudino file</div>
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

  <div class="left side-box"></div>
  <div id="container-wrapper">
    <div id="container">
      <div class="black-box" style="opacity: .999;"></div>
      <svg id="nav">
        <mask id="nav-mask" x="0" y="0" :width="width" height=100>
          <rect x=0 y=0 :width="width" height=100 fill="white"></rect>
          <text :x="navTextX" y=50 fill="black">(Lumatron creation)</text>
        </mask>
        <rect :width="width" height=100 mask="url(#nav-mask)" fill="var(--bg-color)"></rect>
      </svg>
    </div>
  </div>
  <div class="right side-box"></div>
</div>
</template>

<script>
export default {
  name: 'Creation',
  data() {
    return {
      innerWidth,
      renderInterval: null,
      currentProject: {name: ""},
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
      projects: [],
      showSkipped: false,
      skippedNames: JSON.parse(localStorage.getItem('skippedProjects') || '[]'),

      // Rendering
      zoom: 1,
      previousXY: null,
      isDragging: false,
      totalRotation: new THREE.Quaternion(),
      pathIndex: -1,
    }
  },
  created() {
    let self = this
    addEventListener('resize', () => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    })
  },
  mounted() {
    for (var setting of this.settings) {
      setting.value = localStorage.getItem(setting.name) || setting.value
      if (setting.type == "bool")
        setting.value = setting.value == "true"
      window[setting.name] = setting.value
    }
    this.fetchButtons()
    this.projectsInterval = setInterval(async () => {
      this.projects = await (await fetch("http://localhost:8000/projectlist.json")).json()
    }, 10000)

    let eventTypes = ['onmousedown', 'onmousemove', 'onmouseup', 'onkeydown', 'onwheel']
    for (let eventType of eventTypes) {
      document[eventType] = (e) => this[eventType](e)
    }
    this.renderInterval = setInterval(this.render, 30)
  },
  unmounted() {
    clearInterval(this.renderInterval)
    clearInterval(this.projectsInterval)
  },
  computed: {
    width() {
      return Math.min(700, this.innerWidth)
    },
    navTextX() {
      return 196 - "creation".length * 14
    },
    fullProjectName() {
      return this.currentProject.name
    },
    activeProjects() {
      return this.projects.filter(p => !this.skippedNames.includes(p.name))
    },
    skippedProjects() {
      return this.projects.filter(p => this.skippedNames.includes(p.name))
    },
  },
  methods: {
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

    toggleSkip(project) {
      const idx = this.skippedNames.indexOf(project.name)
      if (idx === -1) {
        this.skippedNames.push(project.name)
      } else {
        this.skippedNames.splice(idx, 1)
      }
      localStorage.setItem('skippedProjects', JSON.stringify(this.skippedNames))
    },

    updateSetting(setting) {
      localStorage.setItem(setting.name, setting.value)
      window[setting.name] = setting.value
      if (!["STARTING_PART_ID", "ENDING_PART_ID", "PROCESS_STOP"].includes(setting.name)) {
        this.openProject(this.currentProject)
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
    async openProject(project) {
      this.currentProject = project
      const name = project.name
      if (this.fullProjectName && this.fullProjectName != name) {
        this.setSetting("STARTING_PART_ID", 1)
        this.setSetting("ENDING_PART_ID", 0)
      }
      window.fullProjectName = name
      localStorage.setItem("currentproject", JSON.stringify(project))

      VERSION = project.version
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
      this.projects = await (await fetch("http://localhost:8000/projectlist.json")).json()
      let currentProject = null
      try {
        currentProject = JSON.parse(localStorage.getItem("currentproject"))
      } catch(_) {
        return
      }
      if (currentProject) {
        this.openProject(currentProject)
      }
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
      this.post({
        fullProjectName: this.fullProjectName,
        type: "cleanup",
      })
      console.log(`Cleaning up "${this.fullProjectName.split("/")[1]}" files`)
    },
    download(fileName, data) {
      console.log(`Downloading ${fileName}`, data)
      return this.post({
        type: "download",
        fileName,
        data,
      })
    },
    removeFile(fileName) {
      console.log(`Removing ${fileName}`)
      return this.post({
        type: "remove",
        fileName,
      })
    },

    async downloadGitFiles() {
      await this.downloadJSON()
      await this.genModel('simple')
      await this.genModel('simplest')
    },
    async downloadJSON() {
      let fileContent = JSON.stringify(generatePixelInfo(), null, 2)
      let fileName = this.fullProjectName + '.json'
      console.log(fileContent)
      if (versionAtLeast("1.0.1", VERSION)) {
        await this.download(fileName, fileContent)
      }
      console.log("Downloaded " + fileName)
    },
    async removeGitFiles() {
      this.removeFile(`../pixels/${this.fullProjectName}.json`)
      this.removeFile(`../stls/${this.fullProjectName}.stl`)
      this.removeFile(`../stls/${this.fullProjectName}_full.stl`)
    },
    genPrints() {
      let printInfo = createPrintInfo3D()
      printInfo.fullProjectName = fullProjectName
      this.post(printInfo)
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
      this.post(printInfo)
      console.log("Generating " + renderMode)
      generateManufacturingInfo() // Restore old svgs and such
    },

    makeForArduino() {
      let info = generatePixelInfo()
      let maxNeighbors = 0
      for (let ns of info.neighbors) {
        maxNeighbors = Math.max(maxNeighbors, ns.length)
      }
      let neighborsConverted = info.neighbors.map(neighbors => {
        let padded = []
        for (let i = 0; i < maxNeighbors; i++) {
          padded.push(i < neighbors.length ? neighbors[i] : 0xffff)
        }
        return padded
      })

      function convertToArduinoArrayString(array) {
        return JSON.stringify(array)
            .replaceAll('"', '')
            .replaceAll("[", "{")
            .replaceAll("]", "}")
      }

      let subname = this.fullProjectName.split("/").pop()
      console.log("Creating Arduino file for " + subname)
      this.post({
        type: "arduino",
        subname,
        SIZE: info.SIZE,
        RAW_SIZE: info.RAW_SIZE,
        maxNeighbors,
        dupeToUniques: convertToArduinoArrayString(info.dupeToUniques),
        neighbors: convertToArduinoArrayString(neighborsConverted),
        rawToUnique: convertToArduinoArrayString(info.uniqueToDupe),
        coords: convertToArduinoArrayString(info.coords),
      })
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
      this.totalRotation.premultiply(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          -ROTATION_SCALE * deltaY,
          -ROTATION_SCALE * deltaX,
          0, 'XYZ' )
      ))
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

      let dualIndexString = ""
      if (edge.dual) {
        dualIndexString = ", " + edge.dual.index
      }
      console.log(`Edge # ${edge.index}${dualIndexString}`)

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
      if (e.target.closest('.type-buttons')) return
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
        vertex.coordinates = vertex.ogCoords.applyQuaternion(this.totalRotation)
        maxMagnitude = Math.max(maxMagnitude, vertex.coordinates.length())
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
      if (showVertexNumbers) {
        for (let vertex of verticies) {
          let xy = vertex.coordinates.project(projScale, this.zoom)
          ctx.fillText(vertex.index, xy[0] + 4, xy[1] - 5)
        }
      }
      if (showEdgeNumbers) {
        for (let edge of edges) {
          if (edge.isDupe) return
          let center = edge.verticies[0].coordinates.add(edge.verticies[1].coordinates)
          center = center.scale(0.5)
          let xy = center.project(projScale, this.zoom)
          let text = edge.index + ""
          let len = parseFloat(edge.length().toFixed(2))
          text += " (" + len + ")"
          ctx.fillText(text, xy[0] - 2, xy[1] +4)
        }
      }
      if (window.pixelInfo && showPixelNumbers) {
        ctx.font = "8px Arial"
        for (let coord of pixelInfo.coords) {
          let xy = new Vector(...coord)
              .applyQuaternion(this.totalRotation)
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
@font-face {
  font-family: "Lumatron";
  font-display: auto;
  src: url('/barcade.otf');
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

.black-box {
  background-color: var(--bg-color);
  width: 100%;
  height: 100%;
}
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
#meta-container > .type-buttons {
  overflow-x: hidden;
}
#meta-container > .type-buttons .button {
  width: 200px;
  min-height: 33px;
}

.skip-toggle {
  font-size: 24px;
  color: white;
  cursor: pointer;
}
.button.skipped {
  background-color: #f5f5f5;
  color: #999;
}
.project-row {
  position: relative;
}
.skip-icon {
  position: absolute;
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
  font-size: 14px;
  opacity: 0.7;
  color: black;
  line-height: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 24px;
  height: 24px;
  background-color: white;
  border: 1px solid black;
  border-radius: 50%;
}
.skip-icon:hover {
  opacity: 1;
}
</style>
