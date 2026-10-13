
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
      // Most recent first. Kept so orbs still on an old master key can be migrated.
      previousMasterKeys: loadPreviousMasterKeys(),
      // Master key each orb is known to accept, when it isn't the current one
      orbMasterKeys: {},
      showSettings: false,
      newMasterKeyInput: "",
      masterKeyMessage: "",
      settingAllOrbKeys: false,
      orbKeyResults: "",
      versions: {},
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
      viewingErrorLog: false,
      viewing: "config",
      infoInterval: null,

      backupList: [],
      selectedBackup: null,
      deleteSelected: false,
      manualBackupName: "",
      backupFileView: null,
      backupFileContents: "",

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
    selectedResetReason() {
      return this.orbInfo.find(orb => orb.id == this.orbID)?.resetReason
    },
    // Present only while an automated calibration is in flight; it survives the
    // reboots because the orb reports it on every reconnect.
    powerCalibration() {
      return this.orbInfo.find(orb => orb.id == this.orbID)?.powerCalibration
    },
    // The orb keeps reporting the block after it finishes so the result is visible,
    // so a search in flight is `active`, not merely the block being present.
    autoCalibrating() {
      return !!this.powerCalibration?.active
    },
    autoCalibrationResult() {
      return this.powerCalibration?.result
    },
    // A run that never tripped a reset found no ceiling, so nothing was capped.
    autoCalibrationFoundNoLimit() {
      return (this.autoCalibrationResult || "").startsWith("no limit")
    },
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
    isArduino() {
      return (this.config || '').trim().startsWith('{')
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

    this.masterKey = localStorage.getItem("masterKey") || ""
    if (!this.masterKey) {
      this.masterKey = await this.promptMasterKey()
    }
    this.versions = await (await fetch("/admin/versions")).json()
    // Older relays don't report it; theirs is "demo"
    this.serverOrbID = this.versions.serverOrbID || this.serverOrbID

    // The relay checks server commands like the orb list against its own ORB_KEY, so if the
    // current master key is rejected, find the one it's still on
    if (!await this.getOrbInfo()) {
      await this.learnOrbMasterKey(this.serverOrbID)
      await this.getOrbInfo()
    }
    let pollCount = 0
    this.infoInterval = setInterval(async function() {
      if (document.hasFocus()) {
        self.versions = await (await fetch("/admin/versions")).json()
        await self.getOrbInfo()
        // Refresh version/IP for all known orbs every 30s (every 6th poll)
        if (pollCount++ % 6 === 0) {
          for (let orb of self.orbInfo) self.fetchOrbVersionAndIP(orb)
        }
        await self.updateViewing()
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
    formatTime(iso) {
      if (!iso) return ""
      return new Date(iso).toLocaleString()
    },

    async genOrbID() {
      let orbID = createRandomID()
      this.config = upsertKeyValueInConfig(this.config, 'ORB_ID', orbID, "exports")
      await this.setOrbKey()
    },

    async getOrbKey(orbID, masterKey) {
      return await sha256(orbID.toLowerCase() + (masterKey || this.masterKey))
    },

    focusCommandPrompt() {
      this.$nextTick(() => {
        let el = document.querySelector(".command-prompt")
        if (el) el.focus()
      })
    },

    async setViewing(type) {
      this.viewing = type
      this.updateViewing()
      if (type == "command") this.focusCommandPrompt()
    },

    async setOrb(orbID) {
      this.orbID = orbID
      for (let orb of this.orbInfo) {
        if (orb.id == orbID) {
          this.alias = orb.alias
          break
        }
      }
      if (this.viewing == "command") this.focusCommandPrompt()
      this.commandResponses = " "
      this.log = ""
      this.prefs = ""
      this.timingprefs = ""
      this.config = this.idToConfig[this.orbID]
      this.logDaysAgo = 0
      this.viewingErrorLog = false
      this.calibratingPower = false
      if (this.prefsBackup) {
        this.prefs = this.prefsBackup
        await this.savePrefs()
      }
      this.prefsBackup = null
      this.updateViewing()
    },

    async setOrbKey() {
      this.config = await this.configWithOrbKey(this.config)
    },

    // config with ORB_KEY set for the current master key
    async configWithOrbKey(config) {
      if (config.trim().startsWith('{')) {
        // Arduino: JSON config
        let cfg = JSON.parse(config)
        cfg.ORB_KEY = await this.getOrbKey(cfg.ORB_ID)
        return JSON.stringify(cfg, null, 2)
      }
      // Pi: JS module config
      let orbID = readFromConfig(config, 'ORB_ID')
      let orbKey = await this.getOrbKey(orbID)
      return upsertKeyValueInConfig(config, 'ORB_KEY', orbKey, 'ORB_ID')
    },

    async unlockOrb() {
      if (!confirm("Unlock orb? This resets the Pi password, removes ORB_KEY, and clears WiFi credentials.")) return
      let command = 'sudo bash -c "echo pi:lumatron | chpasswd"'
      let response = await this.sendCommand({ type: "run", command })
      this.commandResponses += "% " + command + "\n" + (response.trim() || "(success)") + "\n"
      this.commandResponses += "Removing ORB_KEY from config.js\n"
      this.config = removeLineInConfig(this.config, "ORB_KEY")
      if (!await this.saveConfig(true)) return
      this.commandResponses += "Successfully removed ORB_KEY\n"
      await this.sendCommand({ type: "clearwifi" })
      this.commandResponses += "WiFi credentials cleared\n"
    },

    // Defaults to the selected orb's config. masterKey signs the save, for an orb not yet on the current one.
    async saveConfig(dontRestart, { orbID = this.orbID, config = this.config, masterKey } = {}) {
      let { orbID: configOrbID, orbKey: existingOrbKey } = readOrbKeyFromConfig(config)
      if (configOrbID && existingOrbKey) {
        let expectedOrbKey = await this.getOrbKey(configOrbID)
        if (existingOrbKey.toLowerCase() !== expectedOrbKey.toLowerCase()) {
          let message = "Config NOT saved: ORB_KEY doesn't match ORB_ID \"" + configOrbID + "\".\n"
              + "Expected " + expectedOrbKey.slice(0, 8) + "..., found " + existingOrbKey.slice(0, 8) + "...\n"
              + "Either ORB_KEY is still the one for a previous ORB_ID (use \"Set ORB_KEY\" to "
              + "regenerate it for this ID), or the loaded master key isn't the right one."
          this.commandResponses += message + "\n"
          alert(message)
          return false
        }
      }
      await this.sendCommand({ type: "setconfig", data: config, dontRestart }, orbID, false, masterKey)
      this.idToConfig[orbID] = config
      return true
    },

    async savePrefs(dontRestart) {
      await this.sendCommand({ type: "setprefs", data: this.prefs, dontRestart })
      this.idToPrefs[this.orbID] = this.prefs
    },

    async saveTimingPrefs() {
      await this.sendCommand({ type: "settimingprefs", data: this.timingprefs })
      this.idToTimingPrefs[this.orbID] = this.timingprefs
    },


    async restartOrb() {
      await this.sendCommand({ type: "restart" })
    },
    async updateFirmware() {
      await this.sendCommand({ type: "updateFirmware" })
    },

    async clearWifi() {
      await this.sendCommand({ type: "clearwifi" })
    },

    async fetchOrbVersionAndIP(orb) {
      let orbVersion = await this.sendCommand({ type: "version" }, orb.id)
      // No answer may just mean the orb isn't migrated yet and dropped the current key's signature
      if (!orbVersion && !this.orbMasterKeys[orb.id]) {
        await this.learnOrbMasterKey(orb.id)
        if (this.orbMasterKeys[orb.id]) {
          orbVersion = await this.sendCommand({ type: "version" }, orb.id)
        }
      }
      this.sendCommand({ type: "ip" }, orb.id).then(ip => {
        Vue.set(this.idToIP, orb.id, ip)
      }).catch(() => {})
      orbVersion = parseInt(orbVersion)
      if (!orbVersion) {
        Vue.set(this.idToCommit, orb.id, null)
        return
      }
      let serverVersion = orb.isArduino ? (this.versions.arduinoVersions?.esp32c3 ?? 0) : this.versions.gitCount
      Vue.set(this.idToCommit, orb.id, serverVersion - orbVersion)
    },

    async getOrbInfo() {
      try {
        const prevIDs = new Set(this.orbInfo.map(o => o.id))
        this.orbInfo = JSON.parse(await this.sendServerCommand({ type: "orblist" }))
        this.orbInfo = this.orbInfo.sort((a, b) => {
          let aName = a.alias != null ? a.alias : a.id
          let bName = b.alias != null ? b.alias : b.id
          return aName < bName ? -1 : 1
        })
        for (let orb of this.orbInfo) {
          if (!prevIDs.has(orb.id)) {
            this.fetchOrbVersionAndIP(orb)
          }
        }
        return true
      } catch(e) {
        return false
      }
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
      const stream = this.viewingErrorLog ? "error" : "out"
      this.idToLog[this.orbID] = await this.sendCommand(
        { type: "getlog", daysAgo: this.logDaysAgo, stream }, this.orbID)
      this.log = this.idToLog[this.orbID]
    },

    async toggleErrorLog() {
      this.viewingErrorLog = !this.viewingErrorLog
      await this.updateLog()
    },

    async viewBackups() {
      this.viewing = "backups"
      this.selectedBackup = null
      this.hideBackupFile()
      this.backupList = JSON.parse(await this.sendServerCommand({ type: "backuplist" }))
    },

    hideBackupFile() {
      this.backupFileView = null
      this.backupFileContents = ""
    },

    async viewBackupFile(field) {
      if (this.backupFileView == field) {
        this.hideBackupFile()
        return
      }
      this.backupFileView = field
      this.backupFileContents = ""
      this.deleteSelected = false
      let contents = await this.sendServerCommand({
        type: "readBackup",
        fileName: this.selectedBackup,
        field,
      })
      if (this.backupFileView == field) this.backupFileContents = contents
    },

    closeBackups() {
      this.viewing = 'config'
      this.deleteSelected = false
      this.hideBackupFile()
    },

    async restoreBackup() {
      await this.sendServerCommand({
        type: "restoreBackup",
        fileName: this.selectedBackup,
        orbID: this.orbID,
      })
      this.closeBackups()
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
        event.preventDefault()
        let cmd = this.command.replace(/\n/g, "")
        this.commandHistory.unshift(cmd)
        let response = await this.sendCommand({ type: "run", command: cmd })
        this.commandResponses += "% " + cmd + "\n" + (response.trim() || "(success)") + "\n"
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

    updateMasterKey() {
      let key = this.newMasterKeyInput.trim()
      if (!key) return
      if (key == this.masterKey) {
        this.newMasterKeyInput = ""
        this.masterKeyMessage = "That's already the current master key."
        return
      }
      if (!confirm("Replace the master key? The current one is kept as a previous key so orbs "
          + "still using it can be migrated with \"Set All Orb Keys\".")) return
      this.replaceMasterKey(key)
      this.newMasterKeyInput = ""
      this.masterKeyMessage = "New master key saved. The old one was stashed as a previous key."
    },

    replaceMasterKey(key) {
      // Orbs keep accepting the old key until they're migrated, so keep using it for them
      for (let orbID of [this.serverOrbID, ...this.orbInfo.map(orb => orb.id)]) {
        if (!this.orbMasterKeys[orbID]) Vue.set(this.orbMasterKeys, orbID, this.masterKey)
      }
      this.previousMasterKeys = [this.masterKey,
          ...this.previousMasterKeys.filter(k => k != key && k != this.masterKey)]
      localStorage.setItem("previousMasterKeys", JSON.stringify(this.previousMasterKeys))
      localStorage.setItem("masterKey", key)
      this.masterKey = key
    },

    // Remembers which known master key the orb accepts, so orbs not yet migrated can still be reached
    async learnOrbMasterKey(orbID) {
      let found = await this.findOrbMasterKey(orbID)
      if (found) Vue.set(this.orbMasterKeys, orbID, found.masterKey)
    },

    // Probes with getconfig, since an orb silently drops a command signed with the wrong key
    async findOrbMasterKey(orbID) {
      for (let masterKey of [this.masterKey, ...this.previousMasterKeys]) {
        let config = await this.sendCommand({ type: "getconfig" }, orbID, false, masterKey)
        if (config) return { masterKey, config }
      }
      return null
    },

    // Gives an orb an ORB_KEY for the current master key, signing with whichever key it accepts now
    async overrideOrbKey(orbID) {
      try {
        let found = await this.findOrbMasterKey(orbID)
        if (!found) return `${orbID}: no response with any known master key`
        let { orbID: configOrbID, orbKey } = readOrbKeyFromConfig(found.config)
        let expectedOrbKey = await this.getOrbKey(configOrbID || orbID)
        if (orbKey && orbKey.toLowerCase() == expectedOrbKey) {
          Vue.delete(this.orbMasterKeys, orbID)
          return `${orbID}: already set`
        }
        let config = await this.configWithOrbKey(found.config)
        if (!await this.saveConfig(false, { orbID, config, masterKey: found.masterKey })) {
          return `${orbID}: not saved, ORB_KEY doesn't match ORB_ID`
        }
        Vue.delete(this.orbMasterKeys, orbID)
        if (orbID == this.orbID) this.config = config
        return `${orbID}: ${orbKey ? "migrated from a previous master key" : "ORB_KEY set"}, restarting`
      } catch(e) {
        return `${orbID}: failed (${e.message})`
      }
    },

    async setAllOrbKeys() {
      this.settingAllOrbKeys = true
      this.orbKeyResults = "Finding the server's master key...\n"
      await this.learnOrbMasterKey(this.serverOrbID)
      await this.getOrbInfo()
      let orbIDs = this.orbInfo.map(orb => orb.id).filter(id => id != this.serverOrbID)
      this.orbKeyResults += `Setting keys on ${orbIDs.length} orb(s)...\n`
      await Promise.all(orbIDs.map(async orbID => {
        this.orbKeyResults += await this.overrideOrbKey(orbID) + "\n"
      }))
      // Last, because saving the server's config restarts the relay and drops every orb's connection
      this.orbKeyResults += await this.overrideOrbKey(this.serverOrbID) + "\n"
      this.orbKeyResults += "Done. Run again later for orbs that were offline.\n"
      this.settingAllOrbKeys = false
    },

    sendServerCommand(command) {
      return this.sendCommand(command, this.serverOrbID, true)
    },

    async sendCommand(command, orbID, isServerCommand, masterKey) {
      if (!orbID) orbID = this.orbID
      if (!masterKey) masterKey = this.orbMasterKeys[orbID] || this.masterKey
      command.timestamp = Date.now()
      command = JSON.stringify(command)
      let hash = await sha256(command + await this.getOrbKey(orbID, masterKey))
      let message = encodeURIComponent(command)
      let pathPrefix = isServerCommand ? "" : encodeURIComponent(orbID) + "/"
      let url = `${this.serverUrl}/${pathPrefix}admin?message=${message}&hash=${hash}`
      try {
        const controller = new AbortController()
        setTimeout(() => controller.abort(), 6000)
        let response = await fetch(url, { signal: controller.signal })
        // e.g. 404 "ORB DISCONNECTED", which must not pass for an answer when probing keys
        if (!response.ok) return ""
        return await response.text()
      } catch(_) {
        return ""
      }
    },

    showCalibration() {
      this.viewing = "calibration"
      this.updateConfig()
    },

    clearMaxes() {
      if (this.isArduino) {
        let cfg = JSON.parse(this.config)
        delete cfg.MAX_POWER_DRAW
        delete cfg.MAX_AVG_PIXEL_BRIGHTNESS
        this.config = JSON.stringify(cfg, null, 2)
      } else {
        this.config = removeLineInConfig(this.config, "MAX_POWER_DRAW")
        this.config = removeLineInConfig(this.config, "MAX_AVG_PIXEL_BRIGHTNESS")
      }
      this.saveConfig()
    },

    sendPrefsUpdate(update) {
      if (this.isArduino) {
        this.sendCommand({ type: "updatePrefs", update })
      } else {
        this.sendCommand({ type: "python", content: { type: "prefs", update } })
      }
    },

    // Automated calibration, Arduino only: the orb bisects MAX_AVG_PIXEL_BRIGHTNESS
    // itself, using its own brownout resets as the pass/fail signal, so nobody has
    // to watch the piece. It reboots several times before settling.
    async startAutoCalibration() {
      await this.sendCommand({ type: "powercalibrate" })
    },
    async cancelAutoCalibration() {
      await this.sendCommand({ type: "powercalibrate", cancel: true })
    },
    async startPowerCalibration() {
      await this.updatePrefs()
      this.prefsBackup = this.prefs
      this.calibratingPower = true
      this.powerValue = 1
      this.powerStep = 1
      this.stepIncreasing = true
      this.sendPowerValue()
      this.sendPrefsUpdate({ brightness: 234, idlePattern: "static", idleColor: "gradient", dimmer: 1 })
    },

    sendPowerValue() {
      let powerHex = this.powerValue.toString(16).padStart(2, '0')
      let color = `#${powerHex}${powerHex}${powerHex}`
      this.sendPrefsUpdate({ color1: color, color2: color, idlePattern: "static" })
    },

    async nextPowerValue(wasGood) {
      if ((this.powerStep == 1 && !this.stepIncreasing) || (wasGood && this.powerValue == 255)) {
        this.calibratingPower = false
        if (!wasGood) this.powerValue -= 1
        this.prefs = this.prefsBackup
        await this.savePrefs(true)
        if (this.isArduino) {
          let cfg = JSON.parse(this.config)
          cfg.MAX_AVG_PIXEL_BRIGHTNESS = this.powerValue
          this.config = JSON.stringify(cfg, null, 2)
        } else {
          this.config = upsertKeyValueInConfig(this.config, "MAX_AVG_PIXEL_BRIGHTNESS", this.powerValue)
        }
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

function loadPreviousMasterKeys() {
  try {
    return JSON.parse(localStorage.getItem("previousMasterKeys")) || []
  } catch(_) {
    return []
  }
}

// ORB_ID and ORB_KEY from either an Arduino (JSON) or Pi (JS module) config; missing ones are undefined
function readOrbKeyFromConfig(config) {
  if (config.trim().startsWith('{')) {
    let cfg = JSON.parse(config)
    return { orbID: cfg.ORB_ID, orbKey: cfg.ORB_KEY }
  }
  let orbID, orbKey
  try {
    orbID = readFromConfig(config, 'ORB_ID')
  } catch(_) {}
  try {
    orbKey = readFromConfig(config, 'ORB_KEY')
  } catch(_) {}
  return { orbID, orbKey }
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
