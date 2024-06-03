<template>
<div id="background"></div>
  
<div id="type-buttons">
  <div v-for="id in orbIDs" class="button" @click="setOrb(id)">
    {{ id }}
  </div>
</div>
<div id="actions">
  <div class="button" @click="saveConfig">Save config.js
    <span v-if="config != idToConfig[orbID]">*</span>
  </div>
</div>

<div id="meta-container">
  <div class="left side-box"></div>
  <div id="container-wrapper">
    <div id="container">
      <div class="black-box">
        <textarea class="config" v-model="config"></textarea>
      </div>
      <svg id="nav">
        <mask id="nav-mask" x="0" y="0" :width="width" height=100>
          <rect x=0 y=0 :width="width" height=100 fill="white"></rect>
          <text x=225 y=50 fill="black">(Lumatron admin)</text>
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
export default {
  name: 'App',
  data() {
    return {
      masterKey: "",
      orbID: "Dragonite",
      serverOrbID: "Dragonite",
      serverUrl: "http://localhost:1337",
      // serverOrbID: "demo",
      // serverUrl: "https://my.lumatron.art",
      idToConfig: {},
      innerWidth,
      orbIDs: [],
      config: "",
    }
  },
  async created() {
    let self = this
    addEventListener('resize', (event) => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    })

    this.masterKey = await (await fetch("http://localhost:1337/masterkey")).text()
    this.getOrbIDs()
    setInterval(this.getOrbIDs, 10000)

    this.updateConfig()
  },
  computed: {
    async orbKey() {
      return this.getOrbKey(this.orbID)
    },
    width() {
      return Math.min(900, this.innerWidth)
    },
  },

  methods: {
    async getOrbKey(orbID) {
      return await sha256(orbID.toLowerCase() + this.masterKey)
    },
    setOrb(orbID) {
      this.orbID = orbID
      this.config = this.idToConfig[this.orbID]
      this.updateConfig()
    },
    saveConfig() {
      this.sendCommand({
        type: "setconfig",
        data: this.config,
      }, this.orbID)
    },
    async getOrbIDs() {
      this.orbIDs = JSON.parse(await this.sendServerCommand({type: "orblist"}))
    },
    async updateConfig() {
      this.idToConfig[this.orbID] = await this.sendCommand({type: "getconfig"}, this.orbID)
      this.config = this.idToConfig[this.orbID]
    },
    sendServerCommand(command) {
      return this.sendCommand(command, this.serverOrbID, true)
    },
    async sendCommand(command, orbID, isServerCommand) {
      command.timestamp = Date.now()
      command = JSON.stringify(command)
      let hash = await sha256(command + await this.getOrbKey(orbID))
      let message = encodeURIComponent(command)
      let pathPrefix = isServerCommand ? "" : orbID + "/"
      let url = `${this.serverUrl}/${pathPrefix}admin?message=${message}&hash=${hash}`
      let response =  await (await fetch(url)).text()
      return response
    },
  },
}

async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);                    
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
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
a {
  text-decoration: none;
}
a, a:visited {
  color: inherit;
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
  max-width: 900px;
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

.config {
  color: white;
  background-color: var(--bg-color);
  width: 100%;
  height: calc(100% - 24px);
  margin: 12px;
}

</style>
