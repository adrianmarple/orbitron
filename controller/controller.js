
// To prevent zoom on iOS
document.addEventListener("click", event => {
  if (!event.target) return
  if (event.target.tagName === "INPUT") return
  if (event.target.tagName === "A") return

  if (!event.target.parentNode) return
  if (event.target.parentNode.tagName === "A") return

  event.preventDefault()
  event.stopPropagation()
})

// Send scroll information to parent frame so you can still scroll using this conroller in an iframe
if (location != parent.location) {
  let y = 0
  addEventListener("mousedown", (event) => {
    y = event.clientY
  })
  addEventListener("touchstart", (event) => {
    y = event.changedTouches[0].clientY
  })

  addEventListener("mousemove", (event) => {
    parent.postMessage(y - event.clientY, "*")
  })
  addEventListener("touchmove", (event) => {
    parent.postMessage(y - event.changedTouches[0].clientY, "*")
  })
}

const searchParams = new URLSearchParams(location.search)

var app = new Vue({
  el: '#app',
  data: {
    os: "Unknown",
    browser: "Unknown",
    isIframe: location != parent.location,

    isPWA: window.matchMedia('(display-mode: standalone)').matches,
    orbID: location.pathname.split('/')[1],
    idToOrb: {},
    registeredIDs: [],
    excludedIDs: [],
    excludedNameMap: {},
    manuallingRegistering: false,
    newID: "",
    registrationErrorMessage: "",
    loadingOrb: false,

    
    loginCode: "",
    localFlags: {},
    hasSeenGlobalRules: false,
    helpMessage: null,
    showConsignment: true,
    showSettings: false,
    showAboutPage: false,
    blurred: false,
    renamingSave: "",
    saveNames: [],
    activeDropdown: null,

    startLocation: null,
    delta: null,
    isDragging: false,
    isMoving: false,
    isReadyLocal: false,
    loadingDotCount: 1,
    move: [0,0],
    timestamp: 0,
    latestMessage: 0,
    lastMessageTimestamp: 0,
    lastMessageTimestampCount: 0,
    epochTimeStart: Date.now(),

    carouselInterval: null,
    carouselPosition: 0,
    carouselCurrentX: 0,
    carouselVelocityX: 0,

    settings: {},
    prefs: {},
    dontSendUpdates: false,
    lastPrefUpdateTime: {},
    prefName: "",
    GAMES_INFO,
    uuid: uuid(),

    speedbumpCallback: null,
    speedbumpMessage: "",
    speedbumpTimestamp: 0,

    rem: 999,
    vw: innerWidth / 100.0,
    vh: innerHeight / 100.0,
    nav: "timing",

    overscrollTop: 0,
    overscrollBottom: 0,
  },

  async created() {
    let self = this

    if (navigator.userAgent.indexOf("Win") !== -1) {
      this.os = "Windows";
    } else if (navigator.userAgent.indexOf("X11") !== -1 || navigator.userAgent.indexOf("Linux") !== -1) {
      this.os = "Linux";
    } else if (navigator.userAgent.indexOf("Android") !== -1) {
      this.os = "Android";
    } else if (navigator.userAgent.indexOf("like Mac") !== -1) {
      this.os = "iOS";
    } else if (navigator.userAgent.indexOf("Mac") !== -1) {
      this.os = "MacOS";
    }

    if (navigator.userAgent.indexOf("OP") !== -1) {
      this.browser = "Opera";
    } else if (navigator.userAgent.indexOf("CriOS") !== -1 || navigator.userAgent.indexOf("Chrome") !== -1) {
      this.browser = "Chrome";
    } else if (navigator.userAgent.indexOf("Firefox") !== -1) {
      this.browser = "Firefox";
    } else if (navigator.userAgent.indexOf("MSIE") !== -1) {
      this.browser = "IE";
    } else if (navigator.userAgent.indexOf("Safari") !== -1) {
      this.browser = "Safari";
    }

    onfocus = () => {
      this.blurred = false
      setTimeout(() => {
        self.auditWebsockets()
      }, 10)
    }

    onmousedown = this.handleStart
    ontouchstart = event => {
      this.handleStart(event.touches[0])
    }

    onmouseup = this.handleEnd
    ontouchend = event => {
      this.handleEnd(event.changedTouches[0])
    }

    onmousemove = this.handleChange
    ontouchmove = event => {
      this.handleChange(event.changedTouches[0])
    }

    addEventListener("resize", () => {
      this.setRem()
      this.checkOverscroll()
    })
    addEventListener("DOMContentLoaded", this.setRem)
    // So hacky, but this seems relatively robust and necessary for things like firefox on iOS
    for (let i = 0; i < 20; i++) {
      setTimeout(this.setRem, 100*i)
    }

    this.nav = this.navBarItems[0]

    history.replaceState({ orbID: this.orbID }, "")
    addEventListener("popstate", (event) => {
      this.openOrb(event.state.orbID)
    })

    if (this.orbID) {
      try {
        let reponse = await fetch(`${location.origin}/${this.orbID}/info`)
        let orb = await reponse.json()
        this.initOrb(orb)
        this.orbID = orb.id
        this.startWebsocket()
      }
      catch (e) {
        console.error(e)
        this.initOrb(this.getOrb(this.orbID))
      }
    }
    setInterval(() => {
      if(self.socketStatus == "CONNECTED") {
        self.ping()
      }
    }, 3000)
    setInterval(() => {
      for (let orb of Object.values(self.idToOrb)) {
        if (orb.socketStatus == "CONNECTED") {
          self.ping(orb.id)
        }
      }
    }, 10000) // Ping non-main orbs less often

    try {
      let rawRegisteredIDs = localStorage.getItem("registeredIDs")
      let rawExcludedIDs = localStorage.getItem("excludedIDs")
      let rawExcludedNameMap = localStorage.getItem("excludedNameMap")
      if (rawRegisteredIDs) {
        this.registeredIDs = JSON.parse(rawRegisteredIDs)
      }
      if (rawExcludedIDs) {
        this.excludedIDs = JSON.parse(rawExcludedIDs)
      }
      if (rawExcludedNameMap) {
        this.excludedNameMap = JSON.parse(rawExcludedNameMap)
      }
      this.updateLocalOrbs()
    } catch(e) {
      console.error(e)
    }

    setInterval(() => {
      if (document.hasFocus()) {
        self.updateLocalOrbs()
      }
    }, 5000)
  },

  watch: {
    newID() {
      this.newID = this.newID.toLowerCase().replace(/[^a-zA-Z0-9]/g, '')
    },
    "state.settings": function(val, oldValue) {
      if (!oldValue) {
        this.settings = { ...val }
        return
      }
      for (let key in val) {
        if (val[key] != oldValue[key]) {
          this.settings = { ...val }
          return
        }
      }
    },
    "state.prefs": function(val, oldValue) {
      if (!oldValue) {
        this.prefs = { ...val }
        for (let key in val) {
          this.$watch('prefs.' + key, (v, vOld) => {
            if (this.dontSendUpdates) return
            if (typeof(v) == 'object' || v != vOld) {
              this.send({ type: "prefs", update: {[key]: this.prefs[key] }})
            }
          }, {deep: true})
        }
        return
      }
      for (let key in val) {
        if (!deepCompare(val[key], oldValue[key]) &&
            (!this.state.prefTimestamps[key] ||
             !this.lastPrefUpdateTime[key] ||
             this.lastPrefUpdateTime[key] < this.state.prefTimestamps[key])) {
          this.lastPrefUpdateTime[key] = this.state.prefTimestamps[key]
          if (!deepCompare(val[key], this.prefs[key])) {
            this.prefs[key] = val[key]
          }
        }
      }
    },
    "state.prefNames": function(v, vOld) {
      if (v && !deepCompare(v, vOld)) {
        this.saveNames = [...this.state.prefNames]
      }
    },
    "state.gameId": function() {
      this.isReadyLocal = false
    },
    "state.victory": function(val, oldValue) {
      if (!val && oldValue) {
        this.speedbumpCallback = null
      }
    },
    "state.exclude": function(val) {
      if (!this.navBarItems.includes(this.nav)) {
        this.nav = this.navBarItems[0]
      }
    },
    localFlags: {
      handler: function (val) {
        localStorage.setItem('flags', JSON.stringify(val))
      },
      deep: true
    },
    speedbumpCallback: function() {
      this.speedbumpTimestamp = Date.now()
    },
  },

  computed: {
    BETWEEN_GAMES() { return !this.state.game },
    ws() {
      return this.orbInfo.ws ?? null
    },
    state() {
      return this.orbInfo.state ?? {}
    },
    socketStatus() {
      return this.orbInfo.socketStatus
    },
    connectionStatus() {
      if(this.blurred){
        return "LOST FOCUS"
      } else {
        return this.socketStatus
      }
    },

    mustLogin() {
      return this.state.mustLogin
    },

    orbInfo() {
      return this.idToOrb[this.orbID] || {}
    },

    navBarItems() {
      let items = ['colors', 'pattern', 'save', 'timing']
        .filter(name => !this.exclude[name])
      if (this.include.games) {
        items.push('games')
      }
      return items
    },

    dimmerString() {
      let dimmerStates = this.orbInfo.dimmerStates || [1, 0]
      let nextDimmerIndex = 0
      let closestDistance = 1
      for (let i = 0; i < dimmerStates.length; i++) {
        let distance = Math.abs(this.state.prefs.dimmer - dimmerStates[i])
        if (distance < closestDistance) {
          closestDistance = distance
          nextDimmerIndex = (i + 1) % dimmerStates.length
        }
      }
      let nextDimmerState = dimmerStates[nextDimmerIndex]
      if (nextDimmerState == 0) {
        return "Off"
      } else if (nextDimmerState == 1) {
        return "On"
      } else {
        return `Dim (${Math.round(nextDimmerState * 100)}%)`
      }
    },
    patternDropdownInfo() {
      let info = [
        ['static', 'Static'],
        ['fireflies', 'Fireflies'],
        ['lightning', 'Lightning'],
        ['pulses', 'Ripples'],
        ['sin', 'Waves'],
        ['lightfield', 'Sparkles'],
        ['default', 'Fire (default)'],
      ].filter(([val, label]) => !this.exclude[val] && !this.exclude[label])

      let optionalPatterns = [
        ['hourglass', 'Hourglass'],
      ]
      for (let optionalPattern of optionalPatterns) {
        if (this.include[optionalPattern[0]]) {
          info.push(optionalPattern)
        }
      }
      
      let extra = this.orbInfo.extraIdle
      if (extra) {
        let extraDisplayName = extra[0].toUpperCase() + extra.slice(1)
        info.unshift([extra, extraDisplayName])
      }
      return info
    },

    scheduleType() {
      return this.prefs.weeklyTimer ? "weeklySchedule" : "schedule"
    },
    allTimersAreOff() {
      for (let event of this.prefs[this.scheduleType]) {
        if (event.prefName != 'OFF') {
          return false
        }
      }
      return true
    },

    isCurrentOrbRegistered() {
      if (!this.orbID) return false
      return this.registeredIDs.includes(this.orbID)
    },

    eventOptions() {
      return this.state.prefNames.concat("OFF").map(name => [name, name])
    },

    exclude() {
      return this.orbInfo.exclude || {}
    },
    include() {
      return this.orbInfo.include || {}
    },
    gameStarted() {
      return this.state.game && this.state.game != "idle"
    },

    victoryCondition() {
      return this.substitute(this.gameInfo.victoryCondition)
    },

    mode() {
      return this.state.gameState
    },
    hasClaimed() {
      return !isNothing(this.state.self)
    },
    self() {
      if (this.state.players && !isNothing(this.state.self))
        return this.state.players[this.state.self]
      else
        return {}
    },
    claimedPlayers() {
      if (this.state.players) {
        return this.state.players.filter(player => player.isClaimed)
      } else {
        return []
      }
    },
    unreadyPlayers() {
      return this.claimedPlayers.filter(player => !player.isReady)
    },
    livePlayers() {
      return this.claimedPlayers.filter(player => player.isAlive)
    },
    playersByRanking() {
      return this.livePlayers.sort((p0, p1) => {
        return (p1.score * 1e12 - p1.scoreTimestamp) - (p0.score * 1e12 - p0.scoreTimestamp)
      })
    },
    position() {
      let rawPosition = this.playersByRanking.indexOf(this.self) + 1
      if (rawPosition % 10 == 1) {
        return rawPosition + "st";
      }
      if (rawPosition % 10 == 2) {
        return rawPosition + "nd";
      }
      if (rawPosition % 10 == 3) {
        return rawPosition + "rd";
      }
      return rawPosition + "th";
    },


    joystickBGStyle() {
      if (this.startLocation) {
        let joystickElem = document.querySelector(".joystick-bg")
        let joystickWidth
        if (joystickElem) {
          joystickWidth = joystickElem.getBoundingClientRect().width
        } else {
          joystickWidth = window.innerWidth * 0.7
        }
        return {
          left: `calc(${this.startLocation[0] - joystickWidth/2}px)`,
          top:  `calc(${this.startLocation[1] - joystickWidth/2}px)`,
        }
      }
    },
    joystickNubStyle() {
      return {
        right: (25 * this.move[0]) + "%",
        bottom: (25 * this.move[1]) + "%",
      }
    },

    maxScore() {
      let maxScore = 0
      for (let player of this.state.players) {
        maxScore = Math.max(maxScore, player.score)
      }
      return maxScore
    },
    iAmVictorious() {
      for (let victor of this.state.victors) {
        if (this.self.color == victor.color) {
          return true
        }
      }
      return false
    },

    nextGameName() {
      for (let info of GAMES_INFO) {
        if (info.name == this.state.nextGame) {
          return info.label
        }
      }
      return ""
    },
    gameInfo() {
      for (let info of GAMES_INFO) {
        if (info.name == this.state.game) {
          return info
        }
      }
      return {}
    },

    rules() {
      let startingRules
      if (this.hasSeenGlobalRules) {
        startingRules = []
      } else {
        startingRules = GLOBAL_RULES
        if (this.orbInfo.extraStartingRules) {
          startingRules = [...this.orbInfo.extraStartingRules, ...startingRules]
        }
      }
      if (!this.gameInfo || !this.gameInfo.rules) {
        return startingRules
      } else {
        return startingRules.concat(this.gameInfo.rules)
      }
    },
    carouselSize() {
      return this.rules.length
    },
    carouselStyle() {
      return {
        left: this.carouselCurrentX + "px",
        width: (this.carouselSize * innerWidth) + "px",
        marginLeft: ((this.carouselSize - 1) * innerWidth) + "px",
      }
    },
  },

  methods: {
    setRem() {
      this.vw = innerWidth / 100.0
      this.vh = innerHeight / 100.0
      this.rem =  Math.min(1.35 * this.vh, 2 * this.vw)
      this.$forceUpdate()
    },

    resetRegistration() {
      this.speedbumpMessage = "This will clear all data in local storage, then refresh the page. Pieces connected to the same wifi should reappear."
      this.speedbumpCallback = () => {
        localStorage.clear()
        location.reload()
      }
    },
    initOrb(info) {
      let orb = this.idToOrb[info.orbID]
      if (orb) {
        for (let key in info) {
          this.$set(orb, key, info[key])
        }
      } else {
        orb = info
        this.$set(this.idToOrb, orb.orbID, orb)
        orb.id = orb.orbID
        orb.ws = null
        orb.state = {}
        orb.socketStatus = "DISCONNECTED"
      }
    },
    async updateLocalOrbs() {
      let self = this
      let localOrbs = await (await fetch(`${location.origin}/localorbs`)).json()
      for (let orbID of localOrbs) {
        if (!this.registeredIDs.includes(orbID)) {
          this.registeredIDs.push(orbID)
        }
      }
      this.registeredIDs = this.registeredIDs.filter(id => !this.excludedIDs.includes(id))
      localStorage.setItem("registeredIDs", JSON.stringify(this.registeredIDs))
      
      for (let id of this.registeredIDs) {
        fetch(`${location.origin}/${id}/info`).then(async data => {
          this.initOrb(await data.json())
          if (self.idToOrb[id].isCurrentlyConnected) {
            self.startWebsocket(id)
          }
        })
      }
    },
    async auditWebsockets() {
      this.startWebsocket() // Prioritize current orb's websocket first
      for (let orb of Object.values(this.idToOrb)) {
        if (orb.isCurrentlyConnected) {
          this.startWebsocket(orb.id)
        }
      }
    },
    showAddOrb() {
      this.manuallingRegistering = true
      this.$nextTick(() => {
        this.$refs.manualRegistration.focus();
      });
    },
    async onRegistrationKeypress(event) {
      this.registrationErrorMessage = ""
      if (event.key == "Enter") {
        this.registerID()
      }
    },
    async registerID() {
      if (this.registeredIDs.includes(this.newID)) {
        this.registrationErrorMessage = "Id already added."
        return
      }
      let info = await (await fetch(`${location.origin}/${this.newID}/info`)).json()
      if (!info) {
        this.registrationErrorMessage = "That id has never connected to the server."
        return
      }

      this.initOrb(info)
      this.registeredIDs.push(this.newID)
      localStorage.setItem("registeredIDs", JSON.stringify(this.registeredIDs))
      if (this.excludedIDs.includes(this.newID)) {
        this.excludedIDs.remove(this.newID)
        localStorage.setItem("excludedIDs", JSON.stringify(this.excludedIDs))
      }
      this.newID = ""
      this.manuallingRegistering = false
      this.registrationErrorMessage = ""
    },
    async openOrb(orbID, saveToHistory) {
      let orb = this.idToOrb[orbID]
      if (orb && !this.isConnected(orbID)) {
        return
      }
      if (orb) {
        this.loadingOrb = true
        try {
          await new Promise((resolve, reject) => {
            this.send("ECHO", orbID)
            let timeout = setTimeout(() => {
              reject()
              orb.resolveEcho = () => {}
            }, 3000)
            orb.resolveEcho = () => {
              clearTimeout(timeout)
              resolve()
            }
          })
        } catch(_) {
          this.loadingOrb = false
          orb.isCurrentlyConnected = false
          return
        }
        this.loadingOrb = false
      }
      this.manuallingRegistering = false
      if (saveToHistory) {
        history.pushState({ orbID }, "", orbID || "/")
      }
      this.orbID = orbID
    },
    openRegistration() {
      this.openOrb("", true)
      this.overscrollBottom = 0
      this.overscrollTop = 0
    },
    deleteRegistration(id) {
      let self = this
      this.speedbumpMessage = `This will remove "${this.getOrb(id).name}", you can always add it back.`
      this.speedbumpCallback = () => {
        self.registeredIDs.remove(id)
        localStorage.setItem("registeredIDs", JSON.stringify(self.registeredIDs))
        self.excludedIDs.push(id)
        localStorage.setItem("excludedIDs", JSON.stringify(self.excludedIDs))
        self.excludedNameMap[id] = self.getOrb(id).name
        localStorage.setItem("excludedNameMap", JSON.stringify(self.excludedNameMap))
        self.registrationErrorMessage = ""
        setTimeout(self.checkOverscroll, 1)
      }
    },

    getOrb(id) {
      return this.idToOrb[id] ?? { orbID: id, name: id }
    },

    isConnected(id) {
      let orb = this.getOrb(id)
      return orb.isCurrentlyConnected && orb.socketStatus == "CONNECTED"
    },
    dimmer(id) {
      id = id ?? this.orbID
      let state = this.getOrb(id).state
      if (!state || !state.prefs) return 0
      return state.prefs.dimmer
    },

    checkOverscroll() {
      elem = document.querySelector("#app")
      this.overscrollBottom = Math.max(0, elem.scrollTop - elem.scrollHeight + elem.clientHeight + 10*this.rem)
      this.overscrollTop = Math.max(0, -elem.scrollTop + 8*this.rem)
    },

    login() {
      this.send({type: "login", loginCode: this.loginCode})
    },
    lg(x) {
      return Math.log(x)/Math.log(2)
    },
    preciseTime() {
      let t = Date.now()
      if(t != this.lastMessageTimestamp){
        this.lastMessageTimestamp = t
        this.lastMessageTimestampCount = 0
      }
      t = t + this.lastMessageTimestampCount * .001
      this.lastMessageTimestampCount += 1
      return t
    },
    startGames() {
      this.send({type: "skip"})
    },
    addNewEvent(event) {
      this.prefs[this.scheduleType].push({...event})
      this.sortSchedule()
    },
    deleteEvent(event) {
      this.prefs[this.scheduleType].remove(event)
    },
    sortSchedule() {
      this.prefs.schedule.sort((a,b) => {
        return a.time.localeCompare(b.time)
      })
      this.prefs.weeklySchedule.sort((a,b) => {
        return a.time.localeCompare(b.time) + 1e6 * (a.weekday - b.weekday)
      })
    },

    saveFocused(name) {
      this.renamingSave = name
    },
    saveBlurred(name, i) {
      if (name != "" && name != this.renamingSave) {
        let self = this
        let originalName = this.renamingSave
        this.speedbumpMessage = `Would you like to rename ${this.renamingSave} to ${name}?`
        this.speedbumpCallback = () => {
          self.send({type: "renamePref", originalName, newName: name})
        }
      }
      this.saveNames[i] = this.renamingSave
      this.renamingSave = ""
    },

    stripSaveName(name) {
      return name.replace(/[^0-9a-zA-Z ]/gi, '')
    },
    substitute(string) {
      let re = /\{\{(.*?)\}\}/
      let match = re.exec(string)
      while (match) {
        let sub = match[1]
        let value = this
        for (let key of sub.split(".")) {
          value = value[key]
        }
        string = string.replace(re, value)
        match = re.exec(string)
      }
      return string
    },

    // Homescreen commands
    ping(orbID) {
      this.send({type: "ping"}, orbID)
    },
    advanceManualFade(orbID) {
      this.send({type: "advanceManualFade"}, orbID)
    },
    // Game related commands
    pulse() {
      this.send({type: "pulse"})
    },
    startAnyway() {
      let self = this
      this.speedbumpMessage = "Other players may still be reading the rules."
      this.speedbumpCallback = () => {
        self.send({type: "advance", from:"start"})
      }
    },
    skip() {
      let self = this
      this.speedbumpMessage = `This will skip ${this.gameInfo.label} for everyone.`
      this.speedbumpCallback = () => {
        self.send({type: "skip"})
      }
    },
    leave() {
      let self = this
      this.speedbumpMessage = `This will stop games for everyone.`
      this.speedbumpCallback = () => {
        self.send({type: "leave"})
      }
    },
    skipvictory() {
      let self = this
      this.speedbumpMessage = `Continue on to ${this.nextGameName}?`
      this.speedbumpCallback = () => {
        self.send({type: "advance", from: "victory"})
      }
    },
    playagain() {
      let self = this
      this.speedbumpMessage = `Everyone will play ${this.gameInfo.label} again.`
      this.speedbumpCallback = () => {
        self.send({type: "playagain"})
      }
    },
    showRules() {
      this.isReadyLocal = false
      this.send({ type: 'unready' })
    },
    dismissRules() {
      this.hasSeenGlobalRules = true
      this.isReadyLocal = true
      this.send({ type: 'ready' })
      this.runLoadingAnimation()
      this.carouselPosition = 0
      this.carouselCurrentX = 0
      if (this.carouselInterval) {
        clearInterval(this.carouselInterval)
        this.carouselInterval = null
      }
    },
    // Pref commands
    clearPrefs() {
      if (this.state.currentPrefName) {
        // Don't bother with speedbump if settings are already saved somewhere
        this.prefName = ""
        this.send({ type: "clearPrefs"})
      } else {
        let self = this
        this.speedbumpMessage = "This will permanently clear any unsaved settings."
        this.speedbumpCallback = () => {
          self.prefName = ""
          self.send({ type: "clearPrefs"})
        }
      }
    },
    deletePrefs(name) {
      name = name || this.prefName
      let self = this
      this.speedbumpMessage = `This will delete "${name}".`
      this.speedbumpCallback = () => {
        self.send({ type: "deletePrefs", name })
      }
    },
    savePrefs(name) {
      name = name || this.prefName
      if (this.state.prefNames.includes(name)) {
        let self = this
        this.speedbumpMessage = `This will overwrite "${name}".`
        this.speedbumpCallback = () => {
          self.send({ type: "savePrefs", name })
        }
      }
      else {
        this.send({ type: "savePrefs", name })
      }
    },
    loadPrefs(name) {
      name = name || this.prefName
      if (this.state.currentPrefName) {
        // Don't bother with speedbump if settings are already saved somewhere
        this.send({ type: "loadPrefs", name })
      } else {
        let self = this
        this.speedbumpMessage = "This will permanently override any unsaved settings."
        this.speedbumpCallback = () => {
          self.send({ type: "loadPrefs", name })
        }
      }
    },

    send(message, orbID) {
      // console.log(message)
      orbID = orbID ?? this.orbID
      let ws = this.idToOrb[orbID].ws
      if (typeof message != "string") {
        message.timestamp = this.preciseTime()
        try {
          message = JSON.stringify(message)
        } catch(e) {
          console.log("Error stringifying JSON", e)
          return
        }
      }
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        try {
          this.destroyWebsocket(orbID)
          this.startWebsocket(orbID)
        } catch(e) {
          console.log(e)
        }
      } else if(ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(message)
        } catch (error) {
          this.destroyWebsocket(orbID)
          this.startWebsocket(orbID)
        }
      }
    },

    destroyWebsocket(orbID) {
      orbID = orbID ?? this.orbID
      let orb = this.getOrb(orbID)
      if(orb.ws) {
        try {
          orb.ws.close()
        } catch(e) {
          console.log("Error closing relay socket", e)
        }
        orb.ws = null
      }
      this.idToOrb[orbID].socketStatus = "DISCONNECTED"
    },
    startWebsocket(orbID) {
      orbID = orbID ?? this.orbID
      let orb = this.getOrb(orbID)
      if(orb.ws || !orbID) {
        return // Already trying to establish a connection or no orbID
      }
      let protocolAndHost
      if (location.hostname == "localhost" || location.hostname.startsWith("192.168")) {
        protocolAndHost = "ws://" + location.hostname
      } else {
        protocolAndHost = "wss://" + location.hostname
      }
      orb.socketStatus == 'CONNECTING'
      let ws = new WebSocket(`${protocolAndHost}:7777/${orbID}/${this.uuid}`)
      let self = this
      ws.onopen= _ => {
        self.$set(self.idToOrb[orbID], 'socketStatus', 'CONNECTED')
      }
      ws.onmessage = event => {
        self.$set(self.idToOrb[orbID], 'socketStatus', 'CONNECTED')
        self.handleMessage(event.data, orbID)
      }
      ws.onclose = _ => {
        setTimeout(function(){ self.destroyWebsocket(orbID) })
      }
      ws.onerror = event => {
        console.error("ERROR",event)
        setTimeout(function(){ self.destroyWebsocket(orbID) })
      }
      orb.ws = ws
    },

    async handleMessage(data, orbID) {
      if (data == "ECHO") {
        this.idToOrb[orbID].resolveEcho()
        return
      }
      let message = JSON.parse(data)
      if(message.timestamp <= this.latestMessage){
        return
      }
      this.latestMessage = message.timestamp
      if (message.self != this.state.self) {
        window.parent.postMessage({this: message.self}, '*')
      }
      let orb = {...this.idToOrb[orbID]}
      orb.state = message
      this.$set(this.idToOrb, orbID, orb)
      
      this.dontSendUpdates = true
      await this.$forceUpdate()
      this.dontSendUpdates = false
    },

    confirmSpeedbump() {
      if (Date.now() - this.speedbumpTimestamp < 100) return
      this.speedbumpCallback()
    },
    clearSpeedbump() {
      if (Date.now() - this.speedbumpTimestamp < 100) return
      this.speedbumpCallback = null
      this.speedbumpMessage = ""
    },

    runLoadingAnimation() {
      let self = this
      self.loadingDotCount = 1
      let interval = setInterval(() => {
        if (self.self.isReady) {
          clearInterval(interval)
          return
        }
        self.send({ type: 'ready' })
        self.loadingDotCount += 1
        if (self.loadingDotCount > 5) {
          self.loadingDotCount = 1
        }
        self.$forceUpdate()
      }, 500)
    },

    handleStart(location) {
      if (this.showSettings) {
        return
      }
      this.startLocation = [location.clientX, location.clientY]
      this.currentLocation = this.startLocation
      this.timestamp = Date.now()
      if (this.self.isReady) {
        this.isMoving = true
      } else {
        this.isDragging = true
      }
    },
    handleEnd(location) {
      if (this.showSettings) {
        return
      }
      if (this.isDragging) {
        let finalX = -(this.carouselCurrentX + this.carouselVelocityX * 20)
        this.carouselPosition = Math.round(finalX / innerWidth)
        this.carouselPosition = Math.max(this.carouselPosition, 0)
        this.updateCarousel()
        this.isDragging = false
      }
      if (this.isMoving) {
        if (Date.now() - this.timestamp > 10 &&
            Date.now() - this.timestamp < 300 &&
            Math.abs(this.startLocation[0] - location.clientX) < 10 &&
            Math.abs(this.startLocation[1] - location.clientY) < 10) {
          this.send({type: "tap"})
        }
        this.move = [0,0]

        this.send({type: "move", move: this.move})
        this.isMoving = false
      }
    },
    handleChange(location) {
      if (this.showSettings) {
        return
      }
      if (this.isDragging) {
        let deltaX = location.clientX - this.startLocation[0]
        this.carouselCurrentX += deltaX
        this.carouselVelocityX = Math.max(Math.min(deltaX,innerWidth/30),-innerWidth/30)
        this.startLocation = [location.clientX, location.clientY]
      }
      if (this.isMoving) {
        let joystickBG = document.querySelector(".joystick-bg")
        if (!joystickBG)
          return
        let joystickWidth = joystickBG.getBoundingClientRect().width
        let maxDisplacement = joystickWidth * 0.25

        this.move = [(this.startLocation[0] - location.clientX) / maxDisplacement,
                     (this.startLocation[1] - location.clientY) / maxDisplacement]
        let moveMagnitude = Math.sqrt(this.move[0] * this.move[0] + this.move[1] * this.move[1])
        if (moveMagnitude > 1) {
          this.move[0] /= moveMagnitude
          this.move[1] /= moveMagnitude

          this.startLocation = [
            location.clientX + this.move[0] * maxDisplacement,
            location.clientY + this.move[1] * maxDisplacement
          ]
          this.startLocation[0] = Math.max(this.startLocation[0], joystickWidth/2)
          this.startLocation[0] = Math.min(this.startLocation[0], innerWidth - joystickWidth/2)
          this.startLocation[1] = Math.max(this.startLocation[1], joystickWidth/2)
          this.startLocation[1] = Math.min(this.startLocation[1], innerHeight - joystickWidth/2)
        }

        let [x,y] = this.move
        if (searchParams.has("mirror") | searchParams.has("m")) {
          x *= -1
        }

        this.send({type: "move", move: [x,y]})
      }
    },

    settingsKeydown(event) {
      if(event.keyCode == 13) {
        event.target.blur()
        event.preventDefault()
      }
    },
    updateSettings(settingsName) {
      this.send({ type: "settings", update: {[settingsName]: this.settings[settingsName] }})
    },

    prettifySettingName(name) {
      return name.toLowerCase().replaceAll("_", " ")
    },

    advanceCarousel() {
      this.carouselPosition += 1
      if (this.carouselPosition >= this.carouselSize) {
        this.dismissRules()
      }
      this.updateCarousel()
    },
    updateCarousel() {
      if (this.carouselInterval) {
        return
      }
      this.carouselInterval = setInterval(() => {
        if (this.isDragging) {
          return
        }
        let targetX = innerWidth * -this.carouselPosition
        const alpha = 0.75
        this.carouselVelocityX = alpha * this.carouselVelocityX
        this.carouselCurrentX += this.carouselVelocityX
        this.carouselCurrentX = alpha * this.carouselCurrentX + (1 - alpha) * targetX
        this.$forceUpdate()
        if (this.carouselCurrentX < -(this.carouselSize - 0.1) * innerWidth) {
          this.dismissRules()
        }
        if (Math.abs(this.carouselCurrentX - this.targetX) < 0.1) {
          clearInterval(this.carouselInterval)
          this.carouselInterval = null
        }
      }, 33)
    },
  },
})

class Orb {
  constructor(basicInfo) {
    this.info = basicInfo
    this.id = basicInfo.orbID
    this.ws = null
    this.socketStatus = "DISCONNECTED"
    this.state = {}
  }
}

Array.prototype.remove = function(elem) {
  let index = this.indexOf(elem)
  if (index >= 0) {
    this.splice(index, 1)
  }
  // Just ignore if not in array
}

function delay(millis, v) {
  return new Promise(function(resolve) {
    setTimeout(resolve.bind(null, v), millis)
  })
}
function uuid() {
  let url = URL.createObjectURL(new Blob())
  URL.revokeObjectURL(url)
  return url.split("/")[3]
}
function isNothing(val) {
  return val === undefined || val === null
}

// From https://stackoverflow.com/questions/26049303/how-to-compare-two-json-have-the-same-properties-without-order
function deepCompare(obj1, obj2) {
  // compare types
  if (typeof obj1 !== typeof obj2) {
    return false;
  }

  // compare properties recursively
  if (typeof obj1 === 'object') {
    if (Array.isArray(obj1) !== Array.isArray(obj2)) {
      return false;
    }
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) {
        return false;
      }
      for (let i = 0; i < obj1.length; i++) {
        if (!deepCompare(obj1[i], obj2[i])) {
          return false;
        }
      }
    } else {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      if (keys1.length !== keys2.length) {
        return false;
      }
      for (const key of keys1) {
        if (
          !Object.prototype.hasOwnProperty.call(obj2, key) ||
          !deepCompare(obj1[key], obj2[key])
        ) {
          return false;
        }
      }
    }
  } else {
    // compare primitive values
    if (obj1 !== obj2) {
      return false;
    }
  }

  // objects are equal
  return true;
}