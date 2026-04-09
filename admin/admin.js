
new Vue({
  el: '#app',
  data() {
    return {
      innerWidth,
      leftOpen: innerWidth >= 1100,
      rightOpen: innerWidth >= 1100,
      masterKey: "",
      showMasterKeyModal: false,
      masterKeyInput: "",
      commits: [],
      orbID: localStorage.getItem("orbID") || "demo",
      alias: null,
      serverOrbID: "demo",
      serverUrl: location.origin,
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
      historyIndex: -1,

      prefsBackup: null,
      calibratingPower: false,
      powerValue: 1,
      powerStep: 2,
      stepIncreasing: true,

      MAX_POWER_DRAW: false,
      MAX_AVG_PIXEL_BRIGHTNESS: false,
    }
  },

  computed: {
    width() {
      return Math.min(700, this.innerWidth)
    },
    navTextX() {
      const fontScale = Math.min(1, this.width / 500)
      return this.width / 2 - 224 * fontScale
    },
    navFontSize() {
      return (Math.min(6, this.width / 500 * 6)).toFixed(2) + 'em'
    },
    isLocal() {
      const h = location.hostname
      return h === 'localhost' || h === '127.0.0.1' ||
        h.startsWith('10.') || h.startsWith('192.168.') || h.startsWith('172.')
    },
    isNarrow() {
      return this.innerWidth < 1100
    },
    drawerOverlay() {
      return this.isNarrow && (this.leftOpen || this.rightOpen)
    },
  },

  async created() {
    let self = this

    addEventListener('resize', () => {
      self.innerWidth = innerWidth
      if (innerWidth < 1100) {
        self.leftOpen = false
        self.rightOpen = false
      } else {
        self.leftOpen = true
        self.rightOpen = true
      }
    })
    addEventListener('keydown', event => {
      if (event.key == 's' && (event.metaKey || event.ctrlKey)) {
        if (self.viewing == 'config') self.saveConfig()
        if (self.viewing == 'prefs') self.savePrefs()
        if (self.viewing == 'timing') self.saveTimingPrefs()
        event.preventDefault()
      }
    })

    if (location.protocol === 'http:') {
      try {
        this.masterKey = await (await fetch("http://localhost:8000/admin/masterkey")).text()
      } catch(_) {}
    }
    if (!this.masterKey) {
      this.masterKey = localStorage.getItem("masterKey") || ""
    }
    if (!this.masterKey) {
      this.masterKey = await this.promptMasterKey()
    }
    this.commits = await (await fetch("/admin/commits")).json()

    await this.getOrbInfo()
    this.infoInterval = setInterval(async function() {
      if (document.hasFocus()) {
        await self.getOrbInfo()
        await self.updateViewing()
        self.commits = await (await fetch("/admin/commits")).json()
      }
    }, 5000)
    await this.updateConfig()
    this.setOrb(this.orbID)

    this.viewing = localStorage.getItem("adminviewing") || this.viewing
  },

  beforeDestroy() {
    clearInterval(this.infoInterval)
  },

  watch: {
    orbID(val) { localStorage.setItem("orbID", val) },
    viewing(val) { localStorage.setItem("adminviewing", val) },
  },

  methods: {
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
      if (this.config.trim().startsWith('{')) {
        // Arduino: JSON config
        let cfg = JSON.parse(this.config)
        cfg.ORB_KEY = await this.getOrbKey(cfg.orbID)
        this.config = JSON.stringify(cfg, null, 2)
      } else {
        // Pi: JS module config
        let orbID = readFromConfig(this.config, 'ORB_ID')
        let orbKey = await this.getOrbKey(orbID)
        this.config = upsertKeyValueInConfig(this.config, 'ORB_KEY', orbKey, 'ORB_ID')
      }
    },

    async unlockOrb() {
      let command = 'sudo bash -c "echo pi:lumatron | chpasswd"'
      let response = await this.sendCommand({ type: "run", command })
      this.commandResponses += "% " + command + "\n" + (response.trim() || "(success)") + "\n"
      this.commandResponses += "Removing ORB_KEY from config.js\n"
      this.config = removeLineInConfig(this.config, "ORB_KEY")
      await this.saveConfig()
      this.commandResponses += "Successfully removed ORB_KEY\n"
    },

    async saveConfig(dontRestart) {
      await this.sendCommand({ type: "setconfig", data: this.config, dontRestart })
      this.idToConfig[this.orbID] = this.config
    },

    async savePrefs(dontRestart) {
      await this.sendCommand({ type: "setprefs", data: this.prefs, dontRestart })
      this.idToPrefs[this.orbID] = this.prefs
    },

    async saveTimingPrefs() {
      await this.sendCommand({ type: "settimingprefs", data: this.timingprefs })
      this.idToTimingPrefs[this.orbID] = this.timingprefs
    },

    async editAlias() {
      this.editingAlias = true
      this.newAlias = this.alias
      await this.$nextTick()
      let ta = document.querySelector(".names textarea")
      if (ta) ta.focus()
    },

    async saveAlias() {
      this.editingAlias = false
      this.newAlias = this.newAlias.toLowerCase()
      this.sendServerCommand({ type: "alias", id: this.orbID, alias: this.newAlias })
      this.alias = this.newAlias

      let serverConfig = this.idToConfig[this.serverOrbID]
      if (!serverConfig) {
        serverConfig = await this.sendCommand({ type: "getconfig" }, this.serverOrbID)
      }
      serverConfig = upsertKeyValueInConfig(serverConfig, `"${this.orbID}"`, this.newAlias, "ALIASES", 4)
      this.idToConfig[this.serverOrbID] = serverConfig
      await this.sendCommand({ type: "setconfig", data: serverConfig, dontRestart: true }, this.serverOrbID)
      await this.updateConfig()
    },

    async restartOrb() {
      await this.sendCommand({ type: "restart" })
    },

    async getOrbInfo() {
      let promises = []
      try {
        this.orbInfo = JSON.parse(await this.sendServerCommand({ type: "orblist" }))
        this.orbInfo = this.orbInfo.sort((a, b) => {
          let aName = a.alias != null ? a.alias : a.id
          let bName = b.alias != null ? b.alias : b.id
          return aName < bName ? -1 : 1
        })
        for (let orb of this.orbInfo) {
          promises.push(this.sendCommand({ type: "ip" }, orb.id).then(ip => {
            this.idToIP[orb.id] = ip
          }))
          promises.push(this.sendCommand({ type: "commit" }, orb.id).then(commit => {
            this.idToCommit[orb.id] = this.commits.indexOf(commit)
          }))
        }
      } catch(e) {}
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
      let newConfig = await this.sendCommand({ type: "getconfig" })
      if (previousValue != newConfig) {
        this.idToConfig[this.orbID] = newConfig
        this.config = newConfig
      }
      this.MAX_POWER_DRAW = this.config.includes("MAX_POWER_DRAW")
      this.MAX_AVG_PIXEL_BRIGHTNESS = this.config.includes("MAX_AVG_PIXEL_BRIGHTNESS")
    },

    async updatePrefs() {
      let previousValue = this.idToPrefs[this.orbID]
      this.idToPrefs[this.orbID] = await this.sendCommand({ type: "getprefs" })
      if (previousValue != this.idToPrefs[this.orbID]) {
        this.prefs = this.idToPrefs[this.orbID]
      }
    },

    async updateTimingPrefs() {
      let previousValue = this.idToTimingPrefs[this.orbID]
      this.idToTimingPrefs[this.orbID] = await this.sendCommand({ type: "gettimingprefs" })
      if (previousValue != this.idToTimingPrefs[this.orbID]) {
        this.timingprefs = this.idToTimingPrefs[this.orbID]
      }
    },

    async updateLog() {
      this.idToLog[this.orbID] = await this.sendCommand(
        { type: "getlog", daysAgo: this.logDaysAgo }, this.orbID)
      this.log = this.idToLog[this.orbID]
    },

    async viewBackups() {
      this.viewing = "backups"
      this.selectedBackup = null
      this.backupList = JSON.parse(await this.sendServerCommand({ type: "backuplist" }))
    },

    async restoreBackup() {
      await this.sendServerCommand({
        type: "restoreBackup",
        fileName: this.selectedBackup,
        orbID: this.orbID,
      })
      this.viewing = 'config'
    },

    async deleteBackup() {
      await this.sendServerCommand({ type: "deleteBackup", fileName: this.selectedBackup })
      let idx = this.backupList.indexOf(this.selectedBackup)
      if (idx >= 0) this.backupList.splice(idx, 1)
      this.selectedBackup = null
      this.deleteSelected = false
    },

    async manualBackup() {
      if (!this.manualBackupName) return
      if (this.backupList.includes(this.manualBackupName)) return
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
        this.command = this.historyIndex >= 0 ? this.commandHistory[this.historyIndex] : ""
      }
    },

    promptMasterKey() {
      this.masterKeyInput = ""
      this.showMasterKeyModal = true
      return new Promise(resolve => {
        this._masterKeyResolve = resolve
      })
    },

    submitMasterKey() {
      let key = this.masterKeyInput.trim()
      if (!key) return
      localStorage.setItem("masterKey", key)
      this.masterKey = key
      this.showMasterKeyModal = false
      this._masterKeyResolve(key)
    },

    sendServerCommand(command) {
      return this.sendCommand(command, this.serverOrbID, true)
    },

    async sendCommand(command, orbID, isServerCommand) {
      if (!orbID) orbID = this.orbID
      command.timestamp = Date.now()
      command = JSON.stringify(command)
      let hash = await sha256(command + await this.getOrbKey(orbID))
      let message = encodeURIComponent(command)
      let pathPrefix = isServerCommand ? "" : orbID + "/"
      let url = `${this.serverUrl}/${pathPrefix}admin?message=${message}&hash=${hash}`
      try {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 6000)
        return await (await fetch(url, { signal: controller.signal })).text()
      } catch(_) {
        return ""
      }
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
          update: { brightness: 234, idlePattern: "static", idleColor: "fixed", dimmer: 1 }
        }
      })
      this.sendPowerValue()
    },

    sendPowerValue() {
      let powerHex = this.powerValue.toString(16).padStart(2, '0')
      this.sendCommand({
        type: "python",
        content: {
          type: "prefs",
          update: { fixedColor: `#${powerHex}${powerHex}${powerHex}`, idlePattern: "static" }
        }
      })
    },

    async nextPowerValue(wasGood) {
      if ((this.powerStep == 1 && !this.stepIncreasing) || (wasGood && this.powerValue == 255)) {
        this.calibratingPower = false
        if (!wasGood) this.powerValue -= 1
        this.prefs = this.prefsBackup
        await this.savePrefs(true)
        this.config = upsertKeyValueInConfig(this.config, "MAX_AVG_PIXEL_BRIGHTNESS", this.powerValue)
        this.saveConfig()
        return
      }
      if (!wasGood) this.stepIncreasing = false
      if (this.stepIncreasing) {
        this.powerStep *= 2
      } else {
        this.powerStep /= 2
      }
      this.powerValue += this.powerStep * (wasGood ? 1 : -1)
      this.sendPowerValue()
    },
  },
})

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function base64(n) {
  let result = ''
  do {
    result = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'.charAt(n % 64) + result
    n = Math.floor(n / 64) - 1
  } while (n > -1)
  return result
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
  if (tabs == undefined) tabs = 2
  if (typeof value == "string") value = `"${value}"`
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
