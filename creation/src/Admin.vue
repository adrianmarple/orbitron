<template>
<div class="type-buttons">
  <div v-for="orb in orbInfo" class="button orb" @click="setOrb(orb.id)">
    {{ orb.aliases[0] ?? orb.id }}
    <span v-if="idToIP[orb.id]">({{ idToIP[orb.id] }})</span>
  </div>
</div>
<div class="actions">
  <div v-if="viewing=='config'" class="button" @click="genOrbID">Generate ORB_ID</div>
  <div v-if="viewing=='config'" class="button" @click="setOrbKey">Set ORB_KEY</div>
  <div v-if="viewing=='config'" class="button" @click="saveConfig">Save config.js
    <span v-if="config != idToConfig[orbID]">*</span>
  </div>
  <div v-if="viewing=='prefs'" class="button" @click="savePrefs">Save prefs.json
    <span v-if="prefs != idToPrefs[orbID]">*</span>
  </div>
  <div style="display: flex">
    <div v-for="viewType in ['config', 'prefs', 'log']"
        class="button" :class="{ selected: viewing == viewType}"
        @click="setViewing(viewType)">
      {{ viewType }} 
    </div>
  </div>
  <div class="button" @click="genBoxTop">Generate Box Top</div>
  <div class="button" @click="restartOrb">Restart</div>
  <a :href="'https://my.lumatron.art/' + orbID" target="_blank"><div class="button">Controller</div></a>
</div>

<div class="names">
  {{ orbID }}
  <div>Alias:
    <span v-if="aliases.length > 0">{{aliases[0]}}</span>
    <span v-else>
      <textarea v-model="newAlias"></textarea>
      <div class="button" @click="saveAlias">Save</div>
    </span>
  </div>
</div>


<textarea v-if="viewing=='config'" class="main-text" v-model="config"></textarea>
<textarea v-if="viewing=='prefs'" class="main-text" v-model="prefs"></textarea>
<textarea v-if="viewing=='log'" class="main-text" v-model="log" readonly></textarea>
</template>

<script>
export default {
  name: 'Admin',
  data() {
    return {
      masterKey: "",
      orbID: localStorage.getItem("orbID") || "demo",
      aliases: [],
      serverOrbID: "demo",
      serverUrl: "https://my.lumatron.art",
      innerWidth,
      orbInfo: [],
      idToConfig: {},
      idToPrefs: {},
      idToLog: {},
      idToIP: {},
      config: "",
      prefs: "test",
      log: "",
      viewing: "config",
      qrCode: null,
      newAlias: "",
    }
  },
  async created() {
    if (location.href.includes("?local")) {
      this.serverOrbID = "Dragonite"
      this.serverUrl = "http://localhost:1337"
    }
    let self = this
    addEventListener('resize', event => {
      self.innerWidth = innerWidth
      self.$forceUpdate()
    })

    addEventListener('keydown', event => {
      if (event.key == 's' && (event.metaKey || event.ctrlKey)) {
        if (self.viewing == 'config') {
          self.saveConfig()
        }
        if (self.viewing == 'prefs') {
          self.savePrefs()
        }
        event.preventDefault()
      }
    })

    this.masterKey = await (await fetch("http://localhost:8000/masterkey")).text()
    this.updateConfig()

    await this.getOrbInfo()
    setInterval(function() {
      self.getOrbInfo()
      if (self.viewing == "log") {
        self.updateLog()
      }
    }, 5000)
    this.setOrb(this.orbID)


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
  },
  watch: {
    orbID() {
      localStorage.setItem("orbID", this.orbID)
    }
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
    async configureDefault(fullProjectName) {
      await this.setOrb("default")
      this.genOrbID()
      await this.setOrbKey()
      this.config = upsertKeyValueInConfig(this.config, 'PIXELS', fullProjectName, "ORB_KEY")
      await this.saveConfig()
    },

    genOrbID() {
      let orbID = createRandomID()
      this.config = upsertKeyValueInConfig(this.config, 'ORB_ID', orbID, "exports")
    },
    async getOrbKey(orbID) {
      return await sha256(orbID.toLowerCase() + this.masterKey)
    },
    async setViewing(type) {
      this.viewing = type
      if (type == "log") {
        await this.updateLog()
      }
      if (type == "config") {
        await this.updateConfig()
      }
      if (type == "prefs") {
        await this.updatePrefs()
      }
    },
    async setOrb(orbID) {
      this.orbID = orbID
      this.aliases = []
      for (let orb of this.orbInfo) {
        if (orb.id == orbID) {
          this.aliases = orb.aliases
          break
        }
      }
      this.newAlias = ""
      this.config = this.idToConfig[this.orbID]
      await this.setViewing("config")
    },
    async setOrbKey() {
      let orbID = readFromConfig(this.config, 'ORB_ID')
      let orbKey = await this.getOrbKey(orbID)
      this.config = upsertKeyValueInConfig(this.config, 'ORB_KEY', orbKey, 'ORB_ID')
    },
    async saveConfig() {
      await this.sendCommand({
        type: "setconfig",
        data: this.config,
      }, this.orbID)
      this.idToConfig[this.orbID] = this.config
    },
    async savePrefs() {
      await this.sendCommand({
        type: "setprefs",
        data: this.prefs,
      }, this.orbID)
      this.idToPrefs[this.orbID] = this.prefs
    },
    async saveAlias() {
      let serverConfig = this.idToConfig[this.serverOrbID]
      if (!serverConfig) {
        serverConfig = await this.sendCommand({type: "getconfig"}, this.serverOrbID)
      }
      serverConfig = upsertLineInConfig(serverConfig, `    ${this.newAlias}: "${this.orbID}",`, "ALIASES")
      this.idToConfig[this.serverOrbID] = serverConfig
      await this.sendCommand({
        type: "setconfig",
        data: serverConfig,
      }, this.serverOrbID)
    },
    async restartOrb() {
      await this.sendCommand({ type: "restart" }, this.orbID)
    },
    async getOrbInfo() {
      try {
        this.orbInfo = JSON.parse(await this.sendServerCommand({type: "orblist"}))
        this.orbInfo = this.orbInfo.sort((a,b) => {
          let aName = a.aliases[0] ?? a.id
          let bName = b.aliases[0] ?? b.id
          return aName < bName ? -1 : 1
        })

        for (let orb of this.orbInfo) {
          if (!this.idToIP[orb.id]) {
            this.getIPAddress(orb.id)
          }
        }
      } catch {}
    },
    async getIPAddress(orbID) {
      this.idToIP[orbID] = await this.sendCommand({type: "ip"}, orbID)
    },
    async updateConfig() {
      this.idToConfig[this.orbID] = await this.sendCommand({type: "getconfig"}, this.orbID)
      this.config = this.idToConfig[this.orbID]
    },
    async updatePrefs() {
      this.idToPrefs[this.orbID] = await this.sendCommand({type: "getprefs"}, this.orbID)
      this.prefs = this.idToPrefs[this.orbID]
    },
    async updateLog() {
      this.idToLog[this.orbID] = await this.sendCommand({type: "getlog"}, this.orbID)
      this.log = this.idToLog[this.orbID]
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
      setTimeout(this.getOrbIDs, 1000)
      return response
    },
    async genBoxTop() {
      let qrUrl = 'https://my.lumatron.art/' + this.orbID
      this.qrSize = (qrUrl.length <= 32 ? 25 : 29) * 20
      this.qrCode.update({
        width: this.qrSize,
        height: this.qrSize,
        data: qrUrl
      })
      let data = await blobToBase64(await this.qrCode.getRawData())
      this.$root.push({
        fullProjectName: readFromConfig(this.config, 'PIXELS'),
        type: "qr",
        scale: 48.0 / this.qrSize,
        PROCESS_STOP: "upload", //PROCESS_STOP,
        PETG: true,
        data,
      })
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
function base64(n) {
  let result = ''
  do {
    result = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.charAt(n % 64) + result
    n = Math.floor(n / 64) - 1
  } while(n > -1)
  return result
}
function blobToBase64(blob) {
  return new Promise((resolve, _) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result.split(",")[1])
    reader.readAsDataURL(blob)
  })
}

function createRandomID() {
  return base64(Math.floor(Math.random() * 0xffffffffffff)).slice(-7)
}

function readFromConfig(config, key) {
  let regex = new RegExp(`\\'?\\"?${key}\\'?\\"?\\s*:\\s*[\\'\\"](.*)[\\'\\"],`)
  let match = config.match(regex)
  return match[1]
}
function upsertKeyValueInConfig(config, key, value, after) {
  let newLine = `  ${key}: "${value}",`
  let match = config.match(new RegExp(`.*${key}.*`))
  if (match) {
    config = config.replace(match[0], newLine)
    return config
  }
  return upsertLineInConfig(config, newLine, after)
}
function upsertLineInConfig(config, newLine, after) {
  if (after) {
    config = config.replace(new RegExp(`.*${after}.*`), "$&\n" + newLine)
  } else {
    config = config.replace(/^\}/m, newLine + "\n$&")
  }
  return config
}
</script>

<style>

.main-text {
  color: white;
  background-color: var(--bg-color);
  width: 100%;
  height: calc(100% - 24px);
  margin: 12px;
}

.orb.button {
  display: flex;
  justify-content: space-between;
}

.names {
  z-index: 10;
  position: fixed;
  left:  24px;
  top: 24px;
  font-size: 2rem;
}
.names textarea {
  color: white;
  background-color: var(--bg-color);
  font-size: 1.5rem;
  height: 32px;
}
.names .button {
  width: 56px;
}

</style>
