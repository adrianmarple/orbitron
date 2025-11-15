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
  <div class="button" :class="{ selected: viewing == 'command'}"
      @click="setViewing('command')">
    Issue Commands
  </div>
  <div class="button" @click="viewBackups">All Backups</div>
  <div class="button" @click="genBoxTop">Generate Box Top</div>
  <div class="button" @click="showCalibration">Power Calibration</div>
  <div class="button" @click="restartOrb">Restart</div>
  <a :href="'https://my.lumatron.art/' + orbID" target="_blank"><div class="button">Controller</div></a>
</div>

<div class="names">
  {{ orbID }}
  <div @blur="editingAlias = false">Alias:
    <span v-if="alias && !editingAlias" @click="editAlias">{{alias}}</span>
    <span v-else>
      <textarea v-model="newAlias"></textarea>
      <div class="button" @click="saveAlias">Save</div>
    </span>
  </div>
</div>


<textarea v-if="viewing=='config'" class="main-text" v-model="config"></textarea>
<textarea v-if="viewing=='prefs'" class="main-text" v-model="prefs"></textarea>
<textarea v-if="viewing=='timing'" class="main-text" v-model="timingprefs"></textarea>
<div v-if="viewing=='log'" class="main-text">
  <textarea v-if="viewing=='log'" class="main-text" v-model="log" readonly></textarea>
  <div class="row">
    <div class="back button" @click="logDaysAgo += 1; updateLog()">Back</div>
    <div style="font-size: 2rem; margin: 0.5rem 2rem;">{{ logDaysAgo }}</div>
    <div class="back button" @click="logDaysAgo -= 1; updateLog()" :class="{disabled: logDaysAgo <= 0}">Forward</div>
    <div class="back button" @click="logDaysAgo = 0; updateLog()">FF</div>
  </div>
</div>
<div v-if="viewing=='command'" class="main-text">
  <textarea class="main-text" v-model="commandResponses" readonly></textarea>
  <textarea class="command-prompt" v-model="command" @keydown="onCommandKeydown"></textarea>
</div>
<div v-if="viewing=='backups'" id="backups">
  <div class="list">
    <div v-for="fileName in backupList" class="backup"
      :class="{ selected: selectedBackup == fileName }"
      @click="selectedBackup = fileName; deleteSelected = false">
      {{ fileName }}
      <div class="button" @click.stop="selectedBackup = fileName; deleteSelected = true">Delete</div>
    </div>
  </div>
  <div class="row">
    <div v-if="deleteSelected" class="button" @click="deleteBackup">Delete Backup</div>
    <div v-else class="button" :class="{ disabled: !selectedBackup }" @click="restoreBackup">Restore Backup</div>
    <div class="button" @click="viewing = 'config'; deleteSelected=false">Cancel</div>
  </div>
  <div class="row text-with-button">
    <textarea v-model="manualBackupName"></textarea>
    <div class="button" :class="{ disabled: !manualBackupName }" @click="manualBackup">Manual Backup</div>
  </div>
</div>
<div v-if="viewing=='calibration'" id="calibration">
  <div v-if="MAX_POWER_DRAW">MAX_POWER_DRAW present</div>
  <div v-if="MAX_AVG_PIXEL_BRIGHTNESS">MAX_AVG_PIXEL_BRIGHTNESS present</div>
  <div  v-if="MAX_POWER_DRAW || MAX_AVG_PIXEL_BRIGHTNESS"  class="row">
    <div class="button" @click="clearMaxes">Clear Maxes</div>
  </div>
  <div v-if="calibratingPower" class="row">
    <div class="button" @click="nextPowerValue(true)">Good 👍</div>
    <div class="button" @click="nextPowerValue(false)">Too Bright!</div>
  </div>
  <div v-else class="row">
    <div class="button" @click="startPowerCalibration">Start Power Calibration</div>
  </div>
</div>
</template>

<script>
import { MAX_AVG_PIXEL_BRIGHTNESS, MAX_POWER_DRAW } from '../../config';

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
      logDaysAgo: 0,
      viewing: "config",
      qrCode: null,
      newAlias: "",
      editingAlias: false,
      infoInterval: null,

      backupList: [],
      selectedBackup: null,
      deleteSelected: false,
      manualBackupName: "",

      commandResponses: " ",
      command: "",
      commandHistory: [],

      prefsBackup: null,
      calibratingPower: false,
      powerValue: 1,
      powerStep: 2,
      stepIncreasing: true,
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

    await this.getOrbInfo()
    this.infoInterval = setInterval(async function() {
      if (document.hasFocus() && self.$root.mode == 'admin') {
        await self.getOrbInfo()
        await self.updateViewing()
        self.commits = await (await fetch("http://localhost:8000/commits")).json()
      }
    }, 5000)
    await this.updateConfig()
    this.setOrb(this.orbID)

    this.viewing = localStorage.getItem("adminviewing") || this.viewing

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
  unmounted() {
    clearInterval(this.infoInterval)
  },
  watch: {
    orbID() {
      localStorage.setItem("orbID", this.orbID)
    },
    viewing() {
      localStorage.setItem("adminviewing", this.viewing)
    },
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
      await this.genOrbID()
      this.config = upsertKeyValueInConfig(this.config, 'PIXELS', fullProjectName, "ORB_KEY")
      await this.saveConfig()
    },

    async genOrbID() {
      let orbID = createRandomID()
      this.config = upsertKeyValueInConfig(this.config, 'ORB_ID', orbID, "exports")
      await this.setOrbKey()
    },
    async getOrbKey(orbID) {
      return await sha256(orbID.toLowerCase() + this.masterKey)
    },
    async setViewing(type) {
      this.viewing = type
      this.updateViewing()
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
      this.commandResponses = " "
      this.log = ""
      this.prefs = ""
      this.timingprefs = ""
      this.config = this.idToConfig[this.orbID]
      this.logDaysAgo = 0
      this.calibratingPower = false
      if (this.prefsBackup) {
        this.prefs = this.prefsBackup
        await this.savePrefs()
      }
      this.prefsBackup = null
      this.updateViewing()
    },
    async setOrbKey() {
      let orbID = readFromConfig(this.config, 'ORB_ID')
      let orbKey = await this.getOrbKey(orbID)
      this.config = upsertKeyValueInConfig(this.config, 'ORB_KEY', orbKey, 'ORB_ID')
    },
    async saveConfig(dontRestart) {
      await this.sendCommand({
        type: "setconfig",
        data: this.config,
        dontRestart
      })
      this.idToConfig[this.orbID] = this.config
    },
    async savePrefs(dontRestart) {
      await this.sendCommand({
        type: "setprefs",
        data: this.prefs,
        dontRestart,
      })
      this.idToPrefs[this.orbID] = this.prefs
    },
    async saveTimingPrefs() {
      await this.sendCommand({
        type: "settimingprefs",
        data: this.timingprefs,
      })
      this.idToTimingPrefs[this.orbID] = this.timingprefs
    },

    async editAlias() {
      this.editingAlias = true
      this.newAlias = this.alias
      await this.$forceUpdate()
      document.querySelector(".names textarea").focus()
    },
    async saveAlias() {
      this.editingAlias = false
      this.newAlias = this.newAlias.toLowerCase()
      this.sendServerCommand({
        type: "alias",
        id: this.orbID,
        alias: this.newAlias,
      })
      this.alias = this.newAlias

      let serverConfig = this.idToConfig[this.serverOrbID]
      if (!serverConfig) {
        serverConfig = await this.sendCommand({type: "getconfig"}, this.serverOrbID)
      }
      serverConfig = upsertKeyValueInConfig(serverConfig,
        `"${this.orbID}"`,
        this.newAlias,
        "ALIASES",
        4)
      this.idToConfig[this.serverOrbID] = serverConfig
      await this.sendCommand({
        type: "setconfig",
        data: serverConfig,
        dontRestart: true,
      }, this.serverOrbID)
      await this.updateConfig()
    },

    async restartOrb() {
      await this.sendCommand({ type: "restart" })
    },
    async getOrbInfo() {
      let promises = []
      try {
        this.orbInfo = JSON.parse(await this.sendServerCommand({type: "orblist"}))
        this.orbInfo = this.orbInfo.sort((a,b) => {
          let aName = a.alias ?? a.id
          let bName = b.alias ?? b.id
          return aName < bName ? -1 : 1
        })

        for (let orb of this.orbInfo) {
          promises.push(this.sendCommand({type: "ip"}, orb.id).then(ip => {
            this.idToIP[orb.id] = ip
          }))
          promises.push(this.sendCommand({type: "commit"}, orb.id).then(commit => {
            this.idToCommit[orb.id] = this.commits.indexOf(commit)
          }))
        }
      } catch {}
      await Promise.all(promises)
    },
    async updateViewing() {
      if (this.viewing == 'config' || this.viewing == 'calibration') {
        await this.updateConfig()
      } else if (this.viewing == 'log') {
        await this.updateLog()
      } else if (this.viewing == 'prefs') {
        await this.updatePrefs()
      } else if (this.viewing == 'timing') {
        await this.updateTimingPrefs()
      }
    },
    async updateConfig() {
      let previousValue = this.idToConfig[this.orbID]
      let newConfig = await this.sendCommand({type: "getconfig"})
      if (newConfig.indexOf("module.exports") == -1) {
        return
      }
      if (previousValue != newConfig) {
        this.idToConfig[this.orbID] = newConfig
        this.config = newConfig
      }
      this.MAX_POWER_DRAW = this.config.includes("MAX_POWER_DRAW")
      this.MAX_AVG_PIXEL_BRIGHTNESS = this.config.includes("MAX_AVG_PIXEL_BRIGHTNESS")
    },
    async updatePrefs() {
      let previousValue = this.idToPrefs[this.orbID]
      this.idToPrefs[this.orbID] = await this.sendCommand({type: "getprefs"})
      if (previousValue != this.idToPrefs[this.orbID]) {
        this.prefs = this.idToPrefs[this.orbID]
      }
    },
    async updateTimingPrefs() {
      let previousValue = this.idToTimingPrefs[this.orbID]
      this.idToTimingPrefs[this.orbID] = await this.sendCommand({type: "gettimingprefs"})
      if (previousValue != this.idToTimingPrefs[this.orbID]) {
        this.timingprefs = this.idToTimingPrefs[this.orbID]
      }
    },
    async updateLog() {
      this.idToLog[this.orbID] = await this.sendCommand(
        {type: "getlog", daysAgo:  this.logDaysAgo}, this.orbID)
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
    async deleteBackup() {
      await this.sendServerCommand({ type: "deleteBackup", fileName: this.selectedBackup })
      this.backupList.remove(this.selectedBackup)
      this.selectedBackup = null
      this.deleteSelected = false
    },
    async manualBackup() {
      if (this.manualBackupName == "") {
        console.error("Can't name backup the empty string.")
        return
      }
      if (this.backupList.includes(this.manualBackupName)) {
        console.error(`Backup with name ${this.manualBackupName} already exists`)
        return
      }
      await this.sendCommand({ type: "manualBackup", nameOverride: this.manualBackupName })
      this.backupList.push(this.manualBackupName + ".bak")
    },

    async onCommandKeydown(event) {
      if (event.key == "Enter") {
        this.commandHistory.unshift(this.command)
        let response = await this.sendCommand({ type: "run", command: this.command })
        this.commandResponses += "% " + this.command + response
        this.command = ""
        this.historyIndex = -1
      }
      if (event.key == "ArrowUp" && this.historyIndex < this.commandHistory.length) {
        this.historyIndex += 1
        this.command = this.commandHistory[this.historyIndex]
      }
      if (event.key == "ArrowDown" && this.historyIndex >= 0) {
        this.historyIndex -= 1
        if (this.historyIndex >= 0) {
          this.command = this.commandHistory[this.historyIndex]
        } else {
          this.command = ""
        }
      }
    },
    sendServerCommand(command) {
      return this.sendCommand(command, this.serverOrbID, true)
    },
    async sendCommand(command, orbID, isServerCommand) {
      if (!orbID) {
        orbID = this.orbID
      }
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
      // qrUrl += "?m" // For QR that mirrors x input, for one side of a two sided box
      // qrUrl = "https://marplebot.com/link"
      // qrUrl = "WIFI:S:Charizard_5G;T:WPA;P:fireblast;;"
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
        PROCESS_STOP: "upload",
        PETG: true,
        data,
      })
    },

    showCalibration() {
      this.viewing = "calibration"
      this.updateConfig()
    },
    clearMaxes() {
      this.config = removeLineInConfig(this.config, "MAX_POWER_DRAW")
      this.config = removeLineInConfig(this.config, "MAX_AVG_PIXEL_BRIGHTNESS")
      this.saveConfig()
    },
    async startPowerCalibration() {
      await this.updatePrefs()
      this.prefsBackup = this.prefs
      this.calibratingPower = true
      this.powerValue = 1
      this.powerStep = 1
      this.stepIncreasing = true
      this.sendCommand({
        type: "python",
        content: {
          type: "prefs",
          update: {
            brightness: 234,
            idlePattern: "static",
            idleColor: "fixed",
            dimmer: 1,
          }
        }
      })
      this.sendPowerValue()
    },
    sendPowerValue() {
      let powerHex = this.powerValue.toString(16)
      if (powerHex.length < 2) {
        powerHex = "0" + powerHex
      }
      this.sendCommand({
        type: "python",
        content: {
          type: "prefs",
          update: {
            fixedColor: `#${powerHex}${powerHex}${powerHex}`,
            idlePattern: "static",
          }
        }
      })
    },
    async nextPowerValue(wasGood) {
      if ((this.powerStep == 1 && !this.stepIncreasing) ||
          (wasGood && this.powerValue == 255)) {

        this.calibratingPower = false
        if (!wasGood) {
          this.powerValue -= 1
        }
        this.prefs = this.prefsBackup
        await this.savePrefs(true) // dontRestart
        this.config = upsertKeyValueInConfig(this.config, "MAX_AVG_PIXEL_BRIGHTNESS", this.powerValue)
        this.saveConfig()
        return
      }
      if (!wasGood) {
        this.stepIncreasing = false
      }
      if (this.stepIncreasing) {
        this.powerStep *= 2
      } else {
        this.powerStep /= 2
      }
      this.powerValue += this.powerStep * (wasGood ? 1 : -1)
      this.sendPowerValue()
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
function upsertKeyValueInConfig(config, key, value, after, tabs) {
  if (tabs == undefined) {
    tabs = 2
  }
  if (typeof value == "string") {
    value = `"${value}"`
  }
  let newLine = `${" ".repeat(tabs)}${key}: ${value},`
  let match = config.match(new RegExp(`.*${key}.*`))
  if (match) {
    config = config.replace(match[0], newLine)
    return config
  }
  return insertLineInConfig(config, newLine, after)
}
function insertLineInConfig(config, newLine, after) {
  if (after) {
    config = config.replace(new RegExp(`.*${after}.*`), "$&\n" + newLine)
  } else {
    config = config.replace(/^\}/m, newLine + "\n$&")
  }
  return config
}
function removeLineInConfig(config, key) {
  return config.replace(new RegExp(`.*${key}.*\n`), "")
}
</script>

<style>
#backups .list {
  height: calc(100vh - 240px);
  overflow-y: scroll;
  overflow-x: hidden;
}
.row {
  display: flex;
  width: 100%;
  justify-content: space-around;
  align-items: center;
}
#backups .text-with-button textarea {
  font-size: 24px;
  height: 32px;
  width: 460px;
}

.backup {
  font-size: 2rem;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.backup.selected {
  background: white;
  color: black;
}

.backup .button {
  padding: 2px 6px;
  font-size: 20px;
  margin: 0 4px 0;
  border-radius: 2px;
}

.main-text {
  color: white;
  background-color: var(--bg-color);
  width: 100%;
  height: calc(100% - 24px);
  margin: 12px;
  display: flex;
  flex-direction: column;
}
.command-prompt {
  background-color: var(--bg-color);
  color: white;
  width: 100%;
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

#calibration {
  padding-top: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  font-size: 1.2rem;
}
#calibration .row {
  margin-bottom: 2rem;
}

</style>
