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
  <div v-if="viewing=='config'" class="button" @click="setViewing('log')">View Log</div>
  <div v-if="viewing=='log'" class="button" @click="setViewing('config')">View Config</div>
  <div class="button" @click="restartOrb">Restart</div>
  <a :href="'https://my.lumatron.art/' + orbID" target="_blank"><div class="button">Controller</div></a>
</div>


<textarea v-if="viewing=='config'" class="main-text" v-model="config"></textarea>
<textarea v-if="viewing=='log'" class="main-text" v-model="log" readonly></textarea>
</template>

<script>
export default {
  name: 'Admin',
  data() {
    return {
      masterKey: "",
      orbID: localStorage.getItem("orbID") || "demo",
      serverOrbID: "demo",
      serverUrl: "https://my.lumatron.art",
      innerWidth,
      orbInfo: [],
      idToConfig: {},
      idToLog: {},
      idToIP: {},
      config: "",
      log: "",
      viewing: "config",
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
        event.preventDefault()
      }
    })

    this.masterKey = await (await fetch("http://localhost:8000/masterkey")).text()
    this.getOrbInfo()
    setInterval(function() {
      self.getOrbInfo()
      if (self.viewing == "log") {
        self.updateLog()
      }
    }, 5000)

    this.updateConfig()
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
      this.config = upsertInConfig(this.config, 'PIXELS', fullProjectName, "ORB_KEY")
      await this.saveConfig()
    },

    genOrbID() {
      let orbID = createRandomID()
      this.config = upsertInConfig(this.config, 'ORB_ID', orbID, "exports")
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
    },
    async setOrb(orbID) {
      this.orbID = orbID
      this.config = this.idToConfig[this.orbID]
      await this.setViewing("config")
    },
    async setOrbKey() {
      let IDmatch = this.config.match(/\'?\"?ORB_ID\'?\"?\s*:\s*[\'\"](.*)[\'\"],/)
      let orbID = IDmatch[1]
      let orbKey = await this.getOrbKey(orbID)
      this.config = upsertInConfig(this.config, 'ORB_KEY', orbKey, 'ORB_ID')
    },
    async saveConfig() {
      await this.sendCommand({
        type: "setconfig",
        data: this.config,
      }, this.orbID)
      this.idToConfig[this.orbID] = this.config
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

function createRandomID() {
  return base64(Math.floor(Math.random() * 0xffffffffffff)).slice(-7)
}

function upsertInConfig(config, key, value, after) {
  let newLine = `  ${key}: "${value}",`
  let match = config.match(new RegExp(`.*${key}.*`))
  if (match) {
    config = config.replace(match[0], newLine)
    return config
  }

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

</style>
