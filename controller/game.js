// Fetch and inject game template before Vue initializes
window.gameTemplatePromise = fetch('/controller/game.html')
  .then(r => r.text())
  .then(html => {
    const placeholder = document.getElementById('game-sections-placeholder')
    if (placeholder) placeholder.outerHTML = html
  })

window.gameMixin = {
  data() {
    return {
      startLocation: null,
      isDragging: false,
      isMoving: false,
      movePending: false,
      isReadyLocal: false,
      loadingDotCount: 1,
      move: [0,0],
      timestamp: 0,
      carouselInterval: null,
      carouselPosition: 0,
      carouselCurrentX: 0,
      carouselVelocityX: 0,
      settings: {},
      hasSeenGlobalRules: false,
      showSettings: false,
    }
  },

  created() {
    onmousedown = this.handleStart
    ontouchstart = event => { this.handleStart(event.touches[0]) }
    onmouseup = this.handleEnd
    ontouchend = event => { this.handleEnd(event.changedTouches[0]) }
    onmousemove = this.handleChange
    ontouchmove = event => { this.handleChange(event.changedTouches[0]) }
  },

  watch: {
    "state.gameInfo.settings": function(val, oldValue) {
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
    "state.gameInfo.gameId": function() {
      this.isReadyLocal = false
    },
    "state.victory": function(val, oldValue) {
      if (!val && oldValue) {
        this.speedbumpCallback = null
      }
    },
  },

  computed: {
    BETWEEN_GAMES() { return !this.state.gameInfo },
    gameStarted() {
      return !!this.state.gameInfo
    },
    gameInfo() {
      return this.state.gameInfo || {}
    },

    victoryCondition() {
      return this.substitute(this.gameMeta.victoryCondition)
    },

    mode() {
      return this.gameInfo.gameState
    },
    hasClaimed() {
      return !isNothing(this.state.self)
    },
    self() {
      if (this.gameInfo.players && !isNothing(this.state.self))
        return this.gameInfo.players[this.state.self]
      else
        return {}
    },
    claimedPlayers() {
      if (this.gameInfo.players) {
        return this.gameInfo.players.filter(player => player.isClaimed)
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
      if (!this.gameInfo.players) return 1
      let maxScore = 1
      for (let player of this.gameInfo.players) {
        maxScore = Math.max(maxScore, player.score)
      }
      return maxScore
    },
    iAmVictorious() {
      if (!this.gameInfo.victors) return false
      for (let victor of this.gameInfo.victors) {
        if (this.self.color == victor.color) {
          return true
        }
      }
      return false
    },

    nextGameName() {
      for (let info of GAMES_INFO) {
        if (info.name == this.gameInfo.nextGame) {
          return info.label
        }
      }
      return ""
    },
    gameMeta() {
      for (let info of GAMES_INFO) {
        if (info.name == this.gameInfo.game) {
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
        if (this.orbInfo.EXTRA_STARTING_RULES) {
          startingRules = [...this.orbInfo.EXTRA_STARTING_RULES, ...startingRules]
        }
      }
      if (this.gameMeta && this.gameMeta.rules) {
        startingRules =  startingRules.concat(this.gameMeta.rules)
      }
      return startingRules.filter(rule => rule.nonFlatOnly || !this.orbInfo.IS_FLAT)
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
    startGames() {
      this.send({type: "skip"})
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
      this.speedbumpMessage = `This will skip ${this.gameMeta.label} for everyone.`
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
      this.speedbumpMessage = `Everyone will play ${this.gameMeta.label} again.`
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

        if (!this.movePending) {
          this.movePending = true
          requestAnimationFrame(() => {
            this.movePending = false
            let [x, y] = this.move
            if (searchParams.has("mirror") || searchParams.has("m")) {
              x *= -1
            }
            this.send({type: "move", move: [x, y]})
          })
        }
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
        if (Math.abs(this.carouselCurrentX - targetX) < 0.1) {
          clearInterval(this.carouselInterval)
          this.carouselInterval = null
        }
      }, 33)
    },
  },
}
