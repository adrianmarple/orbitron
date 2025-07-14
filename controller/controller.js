
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
    orbID: location.pathname.split('/')[1],
    isPWA: window.matchMedia('(display-mode: standalone)').matches,
    registeredIDs: [],
    newID: "",
    registrationErrorMessage: "",

    ws: null,
    state: {},
    
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

    socketStatus: "CONNECTING",

    speedbumpCallback: null,
    speedbumpMessage: "",
    speedbumpTimestamp: 0,

    rem: 999,
    vw: innerWidth / 100.0,
    vh: innerHeight / 100.0,
    nav: "timing",
  },

  created() {
    this.startWebsocket()
    setInterval(() => {
      if(this.connectionStatus == "CONNECTED"){
        this.ping()
      }
    }, 3000)
    onfocus = () => {
      this.blurred = false
      if (!this.ws) {
        let self=this
        setTimeout(function(){self.startWebsocket();},10)
      }
    }
    onblur = () => {
      if (!this.state.notimeout) {
        this.destroyWebsocket()
        this.blurred = true
      }
    }

    let rawRegisteredIDs = localStorage.getItem("registeredIDs")
    if (rawRegisteredIDs) {
      try {
        this.registeredIDs = JSON.parse(rawRegisteredIDs)
      } catch(e) {
        console.error(e)
      }
    }
    history.replaceState({ orbID: this.orbID }, "")
    addEventListener("popstate", (event) => {
      this.openOrb(event.state.orbID)
    })

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

    onresize = this.setRem
    addEventListener("DOMContentLoaded", this.setRem)
    // So hacky, but this seems relatively robust and necessary for things like firefox on iOS
    for (let i = 0; i < 20; i++) {
      setTimeout(this.setRem, 100*i)
    }

    this.nav = this.navBarItems[0]
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
      if (!deepCompare(v, vOld)) {
        this.saveNames = [...this.state.prefNames]
      }
    },
    "state.gameId": function(val, oldValue) {
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

    navBarItems() {
      return ['colors', 'pattern', 'save', 'timing', 'games']
        .filter(name => !this.exclude[name])
    },
    patternDropdownInfo() {
      let info = [
        ['static', 'Static'],
        ['fireflies', 'Fireflies'],
        ['lightning', 'Lightning'],
        ['pulses', 'Ripples'],
        ['sin', 'Sine'],
        ['lightfield', 'Sparkles'],
        ['default', 'Default'],
      ].filter(([val, label]) => !this.exclude[val] && !this.exclude[label])

      let optionalPatterns = [
        ['hourglass', 'Hourglass'],
      ]
      for (let optionalPattern of optionalPatterns) {
        if (this.include[optionalPattern[0]]) {
          info.push(optionalPattern)
        }
      }
      
      let extra = this.state.extraIdle
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

    eventOptions() {
      return this.state.prefNames.concat("OFF").map(name => [name, name])
    },

    exclude() {
      return this.state.exclude || {}
    },
    include() {
      return this.state.include || {}
    },
    gameStarted() {
      return this.state.game != "idle"
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
        if (this.state.extraStartingRules) {
          startingRules = [...this.state.extraStartingRules, ...startingRules]
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

    async onRegistrationKeypress(event) {
      this.registrationErrorMessage = ""
      if (event.key == "Enter") {
        this.registerID()
      }
    },
    async registerID() {
      if (this.registeredIDs.includes(this.newID)) {
        this.registrationErrorMessage = "Id already registered."
        return
      }
      let info = await (await fetch(`${location.origin}/${this.newID}/info`)).json()
      if (!info) {
        this.registrationErrorMessage = "That id has never connected to the server."
        return
      }

      this.registeredIDs.push(this.newID)
      this.newID = ""
      localStorage.setItem("registeredIDs", JSON.stringify(this.registeredIDs))
    },
    openOrb(orbID, saveToHistory) {
      if (saveToHistory) {
        history.pushState({ orbID }, "", orbID)
      }
      this.orbID = orbID
      this.destroyWebsocket()
      if (orbID) {
        this.startWebsocket()
      }
    },
    openRegistration() {
      this.openOrb("", true)
    },
    deleteRegistration(id) {
      let self = this
      this.speedbumpMessage = `This will remove "${id}", you can always add it back.`
      this.speedbumpCallback = () => {
        self.registeredIDs.remove(id)
        localStorage.setItem("registeredIDs", JSON.stringify(this.registeredIDs))
      }
      console.log("wtf")
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
    advanceManualFade() {
      this.send({type: "advanceManualFade"})
    },
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
    ping() {
      this.send({type: "ping"})
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
        this.speedbumpMessage = "This will permanently clobber any unsaved settings."
        this.speedbumpCallback = () => {
          self.send({ type: "loadPrefs", name })
        }
      }
    },

    send(json) {
      // console.log(json)
      json.timestamp = this.preciseTime()
      let message = null
      try {
        message = JSON.stringify(json)
      } catch(e) {
        console.log("Error stringifying JSON", e)
        return
      }
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        try {
          this.startWebsocket()
        } catch(e) {
          console.log(e)
        }
      } else if(this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(message)
        } catch (error) {
          this.destroyWebsocket()
          this.startWebsocket()
        }
      }
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

    destroyWebsocket() {
      if(this.ws) {
        try {
          this.ws.close()
        } catch(e) {
          console.log("Error closing relay socket",e)
        }
        this.ws = null
      }
      this.socketStatus = "DISCONNECTED"
    },
    startWebsocket() {
      if(this.ws || !this.orbID) {
        return // Already trying to establish a connection or no orbID
      }
      let protocolAndHost
      if (location.hostname == "localhost" || location.hostname.startsWith("192.168")) {
        protocolAndHost = "ws://" + location.hostname
      } else {
        protocolAndHost = "wss://" + location.hostname
      }
      this.socketStatus == 'CONNECTING'
      this.ws = new WebSocket(`${protocolAndHost}:7777/${this.orbID}/${this.uuid}`)
      let self=this
      this.ws.onmessage = event => {
        self.$set(self, 'socketStatus', 'CONNECTED')
        self.handleMessage(event.data)
      }
      this.ws.onclose = event => {
        console.log(event.target)
        setTimeout(function(){ self.destroyWebsocket(); })
      }
      this.ws.onerror = event => {
        console.error("ERROR",event)
        setTimeout(function(){ self.destroyWebsocket(); })
      }
    },

    async handleMessage(data) {
      let self = this
      message = JSON.parse(data)
      if(message.timestamp <= self.latestMessage){
        return
      }
      self.latestMessage = message.timestamp
      if (message.self != this.state.self) {
        window.parent.postMessage({self: message.self}, '*')
      }
      self.state = message
      self.dontSendUpdates = true
      await self.$forceUpdate()
      self.dontSendUpdates = false
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
    // displaySignup() {
    //   if (this.localFlags.hasSeenSignup) {
    //     return
    //   }
    //   this.$set(this.localFlags, 'hasSeenSignup', true)
    //   document.getElementById("signup").style.display = 'block'
    // },

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