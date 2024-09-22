<template>
<div class="type-buttons">
  <div v-for="orb in orbInfo" class="button orb" @click="setOrb(orb.id)">
    <div>{{ orb.alias ?? orb.id }}</div>
    <div class="right">
      <span v-if="idToIP[orb.id]">({{ idToIP[orb.id] }})</span>
      <div class="commit-status">
        <div v-if="idToCommit[orb.id] == undefined || idToCommit[orb.id] == -1" class="unknown">?</div>
        <div v-else-if="idToCommit[orb.id] == 0" class="ok">✓</div>
        <div v-else-if="idToCommit[orb.id] < 10" class="warning">{{ -idToCommit[orb.id] }}</div>
        <div v-else class="error">{{ -idToCommit[orb.id] }}</div>
      </div>
    </div>
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
  <div v-if="viewing=='timing'" class="button" @click="saveTimingPrefs">Save timingprefs.json
    <span v-if="timingprefs != idToTimingPrefs[orbID]">*</span>
  </div>
  <div style="display: flex">
    <div v-for="viewType in ['config', 'log']"
        class="button" :class="{ selected: viewing == viewType}"
        @click="setViewing(viewType)">
      {{ viewType }}
    </div>
  </div>
  <div style="display: flex">
    <div v-for="viewType in ['prefs', 'timing']"
        class="button" :class="{ selected: viewing == viewType}"
        @click="setViewing(viewType)">
      {{ viewType }}
    </div>
  </div>
  <div class="button" @click="viewBackups">All Backups</div>
  <div class="button" @click="genBoxTop">Generate Box Top</div>
  <div class="button" @click="restartOrb">Restart</div>
  <a :href="'https://my.lumatron.art/' + orbID" target="_blank"><div class="button">Controller</div></a>
</div>

<div class="names">
  {{ orbID }}
  <div>Alias:
    <span v-if="alias">{{alias}}</span>
    <span v-else>
      <textarea v-model="newAlias"></textarea>
      <div class="button" @click="saveAlias">Save</div>
    </span>
  </div>
</div>


<textarea v-if="viewing=='config'" class="main-text" v-model="config"></textarea>
<textarea v-if="viewing=='prefs'" class="main-text" v-model="prefs"></textarea>
<textarea v-if="viewing=='timing'" class="main-text" v-model="timingprefs"></textarea>
<textarea v-if="viewing=='log'" class="main-text" v-model="log" readonly></textarea>
<div v-if="viewing=='backups'" id="backups">
  <div class="list">
    <div v-for="fileName in backupList" class="backup"
      :class="{ selected: selectedBackup == fileName }"
      @click="selectedBackup = fileName">
      {{ fileName }}
    </div>
  </div>
  <div class="row">
    <div class="button" @click="restoreBackup">Restore Backup</div>
    <div class="button" @click="viewing = 'config'">Cancel</div>
  </div>
</div>
</template>

<script>
export default {
  name: 'Admin',
  data() {
    return {
      masterKey: "",
      commits: [],
      orbID: localStorage.getItem("orbID") || "demo",
      alias: null,
      serverOrbID: "demo",
      serverUrl: "https://my.lumatron.art",
      innerWidth,
      orbInfo: [],
      idToConfig: {},
      idToPrefs: {},
      idToTimingPrefs: {},
      idToLog: {},
      idToIP: {},
      idToCommit: {},
      config: "",
      prefs: "",
      timingprefs: "",
      log: "",
      viewing: "config",
      qrCode: null,
      newAlias: "",
      backupList: [],
      selectedBackup: null,
    }
  },
  async created() {
    if (location.href.includes("?local")) {
      this.serverOrbID = "dragonite"
      this.serverUrl = "http://localhost:1337"
      if (this.orbID == "demo") {
        this.orbID = "dragonite"
      }
    }
    let self = this
    addEventListener('resize', _ => {
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
        if (self.viewing == 'timing') {
          self.saveTimingPrefs()
        }
        event.preventDefault()
      }
    })

    this.masterKey = await (await fetch("http://localhost:8000/masterkey")).text()
    this.commits = await (await fetch("http://localhost:8000/commits")).json()
    this.updateConfig()

    await this.getOrbInfo()
    setInterval(async function() {
      self.getOrbInfo()
      if (self.viewing == "log") {
        self.updateLog()
      }
      self.commits = await (await fetch("http://localhost:8000/commits")).json()
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
      if (type == "timing") {
        await this.updateTimingPrefs()
      }
    },
    async setOrb(orbID) {
      this.orbID = orbID
      for (let orb of this.orbInfo) {
        if (orb.id == orbID) {
          this.alias = orb.alias
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
    async saveTimingPrefs() {
      await this.sendCommand({
        type: "settimingprefs",
        data: this.timingprefs,
      }, this.orbID)
      this.idToTimingPrefs[this.orbID] = this.timingprefs
    },
    async saveAlias() {
      this.sendServerCommand({
        type: "alias",
        id: this.orbID,
        alias: this.newAlias,
      })

      let serverConfig = this.idToConfig[this.serverOrbID]
      if (!serverConfig) {
        serverConfig = await this.sendCommand({type: "getconfig"}, this.serverOrbID)
      }
      serverConfig = upsertLineInConfig(serverConfig, `    "${this.orbID}": "${this.newAlias}",`, "ALIASES")
      this.idToConfig[this.serverOrbID] = serverConfig
      await this.sendCommand({
        type: "setconfig",
        data: serverConfig,
        dontRestart: true,
      }, this.serverOrbID)
      await this.updateConfig()
    },
    async restartOrb() {
      await this.sendCommand({ type: "restart" }, this.orbID)
    },
    async getOrbInfo() {
      try {
        this.orbInfo = JSON.parse(await this.sendServerCommand({type: "orblist"}))
        this.orbInfo = this.orbInfo.sort((a,b) => {
          let aName = a.alias ?? a.id
          let bName = b.alias ?? b.id
          return aName < bName ? -1 : 1
        })

        for (let orb of this.orbInfo) {
          this.sendCommand({type: "ip"}, orb.id).then(ip => {
            this.idToIP[orb.id] = ip
          })
          this.sendCommand({type: "commit"}, orb.id).then(commit => {
            this.idToCommit[orb.id] = this.commits.indexOf(commit)
          })
        }
      } catch {}
    },
    async updateConfig() {
      this.idToConfig[this.orbID] = await this.sendCommand({type: "getconfig"}, this.orbID)
      this.config = this.idToConfig[this.orbID]
    },
    async updatePrefs() {
      this.idToPrefs[this.orbID] = await this.sendCommand({type: "getprefs"}, this.orbID)
      this.prefs = this.idToPrefs[this.orbID]
    },
    async updateTimingPrefs() {
      this.idToTimingPrefs[this.orbID] = await this.sendCommand({type: "gettimingprefs"}, this.orbID)
      this.timingprefs = this.idToTimingPrefs[this.orbID]
    },
    async updateLog() {
      this.idToLog[this.orbID] = await this.sendCommand({type: "getlog"}, this.orbID)
      this.log = this.idToLog[this.orbID]
    },

    async viewBackups() {
      this.viewing = "backups"
      this.selectedBackup = null
      this.backupList = JSON.parse(await this.sendServerCommand({ type: "backuplist" }))
    },
    async restoreBackup() {
      let backup = await this.sendServerCommand({ type: "backup", fileName: this.selectedBackup })
      backup = JSON.parse(backup)
      await this.sendCommand({ type: "restoreFromBackup", backup }, this.orbID)
      this.viewing = 'config'
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
      try {
        let response =  await (await fetch(url)).text()
        setTimeout(this.getOrbIDs, 1000)
        return response
      } catch(_) {
        return ""
      }
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
      this.$root.post({
        fullProjectName: readFromConfig(this.config, 'PIXELS'),
        type: "qr",
        scale: 48.0 / this.qrSize,
        PROCESS_STOP,
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
#backups .list {
  height: calc(100vh - 180px);
  overflow-y: scroll;
  overflow-x: hidden;
}
#backups .row {
  display: flex;
  width: 100%;
  justify-content: space-around;
}
.backup {
  font-size: 2rem;
  cursor: pointer;
}
.backup.selected {
  background: white;
  color: black;
}

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
.orb.button .right {
  display: flex;
  align-items: center
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

.commit-status > div {
  border-radius: 50%;
  width: 26px;
  height: 26px;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 0.9em;
}
.commit-status .unknown {
  background-color: #00f;
}
.commit-status .ok {
  background-color: #4afa41;
}
.commit-status .warning {
  background-color: #ffe600;
}
.commit-status .error {
  background-color: #ff2600;
}

</style>
