
// To prevent zoom on iOS
document.addEventListener("click", event => {
  if (event.target.tagName != "INPUT" &&
      event.target.tagName != "A") {
    event.preventDefault()
    event.stopPropagation()
  }
})

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

var app = new Vue({
  el: '#app',
  data: {
    ws: null,
    state: {},
    localFlags: {},
    hasSeenGlobalRules: false,
    showSettings: false,
    showAboutPage: false,
    blurred: false,

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

    config: {},
    prefs: {},
    GAMES_INFO,
    uuid: uuid(),

    socketStatus: "CONNECTING",

    speedbumpCallback: null,
    speedbumpMessage: "",

    homeStyle: {background: "blue"},
  },

  created() {
    this.startWebsocket()
    setInterval(() => {
      if(this.connectionStatus == "CONNECTED"){
        this.ping()
      }
    }, 3000)
    setInterval(() => {
      this.homeStyle = {
        background: phaseColor()
      }
    }, 30)
    onfocus = () => {
      this.blurred = false
      if (!this.ws) {
        let self=this
        setTimeout(function(){self.startWebsocket();},10)
      }
    };
    onblur = () => {
      if (!this.state.notimeout) {
        this.destroyWebsocket()
        this.blurred = true
      }
    };

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
    // Do this last just in case localStorage is inaccessible and errors
    // this.localFlags = JSON.parse(localStorage.getItem('flags')) || {}
  },

  watch: {
    "state.config": function(val, oldValue) {
      if (!oldValue) {
        this.config = { ...val }
        return
      }
      for (let key in val) {
        if (val[key] != oldValue[key]) {
          this.config = { ...val }
          return
        }
      }
    },
    "state.prefs": function(val, oldValue) {
      if (!oldValue) {
        this.prefs = { ...val }
        return
      }
      for (let key in val) {
        if (val[key] != oldValue[key]) {
          this.prefs = { ...val }
          return
        }
      }
    },
    "state.gameId": function(val, oldValue) {
      this.isReadyLocal = false
    },
    localFlags: {
      handler: function (val) {
        localStorage.setItem('flags', JSON.stringify(val))
      },
      deep: true
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
      let startingRules = this.hasSeenGlobalRules ? [] : GLOBAL_RULES
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

    confirmSpeedbump() {
      this.speedbumpCallback()
    },
    clearSpeedbump() {
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

    send(json) {
      //console.log(json)
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
      let self=this
      if(self.ws) {
        return // Already trying to establish a connection
      }
      this.socketStatus == 'CONNECTING'
      this.ws = new WebSocket(`ws://orbitron.games:7777/${window.location.pathname.split('/')[1]}/${this.uuid}`)
      this.ws.onmessage = event => {
        self.$set(self, 'socketStatus', 'CONNECTED')
        self.handleMessage(event.data)
      }
      this.ws.onclose = event => {
        setTimeout(function(){ self.destroyWebsocket(); })
      }
      this.ws.onerror = event => {
        console.error("ERROR",event)
        setTimeout(function(){ self.destroyWebsocket(); })
      }
    },

    handleMessage(data) {
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
      // console.log(message)
      self.$forceUpdate()
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

        this.send({type: "move", move: this.move})
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
      this.send({ type: "settings", update: {[settingsName]: this.config[settingsName] }})
    },
    updatePrefs(prefName) {
      this.send({ type: "prefs", update: {[prefName]: this.prefs[prefName] }})
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
});

function phaseColor() {
  let colorPhase = (Date.now()/1000.0/10) % 1
  let r,g,b
  if (colorPhase < 0.333) {
    r = 1 - 3 * colorPhase
    g = 3 * colorPhase
    b = 0
  } else if (colorPhase < 0.666) {
    r = 0
    g = 2 - 3 * colorPhase
    b = 3 * colorPhase - 1
  } else {
    r = 3 * colorPhase - 2
    g = 0
    b = 3 - 3 * colorPhase
  }
  const min = 200
  const range = 50
  return `rgb(${min + r*range},${min + g*range},${min + b*range})`
}