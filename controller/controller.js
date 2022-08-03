
// To prevent zoom on iOS
document.addEventListener("click", event => {
  if (event.target.tagName != "INPUT") {
    event.preventDefault()
    event.stopPropagation()
  }
})

function uuid() {
  let url = URL.createObjectURL(new Blob());
  URL.revokeObjectURL(url);
  return url.split("/")[3];
};

Vue.component('tallybutton', {
  props: ['label', 'election', 'vote', 'settings'],
  computed: {
    voteCount() {
      let voteCount = 0
      if (this.$root.voteTally[this.election]) {
        voteCount = this.$root.voteTally[this.election][this.vote] || 0
      }
      return voteCount
    },
    voteColors() {
      let icons = this.$root.claimedPlayers
          .filter(player => player.votes[this.election] == this.vote)
          .map(player => player.color)
      // for (let i = icons.length; i < this.$root.majorityCount; i++) {
      for (let i = icons.length; i < this.$root.consensusCount; i++) {
        icons.push("")
      }
      return icons
    },
    selected() {
      if (!this.$root.self.votes) {
        return false
      }
      return this.$root.self.votes[this.election] === this.vote
    },
    style() {
      if (this.voteCount > 0) {
        return {
          zIndex: 100
        }
      } else {
        return {}
      }
    },
  },
  methods: {
    sendVote() {
      this.$root.send({
        type: 'vote',
        election: this.election,
        vote: this.vote,
        settings: this.settings,
      })
    },
  },
  template: `
<div style="position: relative">
  <div class="button"
      @click="sendVote"
      :class="{ selected }"
      :style="style"
  >
    {{ label }}
    <div v-if="voteCount" class="vote-tally">
      <div v-for="color in voteColors"
          class="vote" :class="{ blank: !color }"
          :style="{ background: color }"
      ></div>
    </div>
  </div>
</div>`
})

var app = new Vue({
  el: '#app',
  data: {
    ws: null,
    wrtcs: null,
    signalSocket: null,
    signalClient: null,
    ls: null,
    fetchingIP: false,
    state: {},
    localFlags: {},
    hasSeenGlobalRules: false,
    showSettings: false,
    blurred: false,

    startLocation: null,
    isMoving: false,
    move: [0,0],
    timestamp: 0,
    latestMessage: 0,
    preciseTimeStart: window.performance.now(),
    epochTimeStart: Date.now(),

    carouselInterval: null,
    carouselPosition: 0,
    carouselCurrentX: 0,

    config: {},
    GAMES_INFO,
    uuid: uuid(),

    localSocketStatus: "CONNECTING",
    webRTCStatus: "CONNECTING",
    relaySocketStatus: "CONNECTING",
  },

  created() {

    this.startWebsocket()
    this.startWebRTCSocket()
    this.startLocalSocket()
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
      if (!this.wrtcs) {
        let self = this
        setTimeout(function(){self.startWebRTCSocket();},10)
      }
      if (!this.ls) {
        let self = this
        setTimeout(function(){self.startLocalSocket();},10)
      }
    };
    onblur = () => {
      if (!this.state.notimeout) {
        this.destroyWebsocket()
        this.destroyWebRTCSocket()
        this.destroyLocalSocket()
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
      console.log("checking status")
      if(this.blurred){
        return "LOST FOCUS"
      } else {
        if (this.relaySocketStatus == "CONNECTED" ||
            this.webRTCStatus == "CONNECTED" ||
            this.localSocketStatus == "CONNECTED") {
          return "CONNECTED"
        }
        if (this.relaySocketStatus == "CONNECTING" ||
            this.webRTCStatus == "CONNECTING" ||
            this.localSocketStatus == "CONNECTING") {
          return "CONNECTING"
        }
        return "DISCONNECTED"
      }
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

    majorityCount() {
      return Math.ceil((this.claimedPlayers.length + 1) / 2)
    },
    consensusCount() {
      return this.claimedPlayers.length
    },
    voteTally() {
      let tally = {}
      for (const player of this.claimedPlayers) {
        for (const election in player.votes) {
          const vote = player.votes[election]
          if (!tally[election]) {
            tally[election] = {}
          }
          tally[election][vote] = (tally[election][vote] || 0) + 1
        }
      }
      return tally
    },
    isReady() {
      return this.voteTally.ready &&
          this.voteTally.ready.yes > 1 &&
          this.voteTally.ready.yes >= this.consensusCount //this.majorityCount
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
      return this.claimedPlayers.filter(player => player.isPlaying && player.isAlive)
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
      if (!this.state.victor || isNothing(this.state.self)) {
        return false
      }
      if (this.state.victor.players) {
        return this.state.victor.players.includes(this.state.self)
      } else {
        return this.self.color === this.state.victor.color
      }
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
      console.log(this.hasSeenGlobalRules)
      console.log(startingRules)
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
    }
  },

  methods: {

    preciseTime() {
      let precise = this.epochTimeStart + window.performance.now() - this.preciseTimeStart
      return precise
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
        this.startWebsocket()
      } else if(this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(message)
        } catch (error) {
          this.destroyWebsocket()
          this.startWebsocket()
        }
      }
      if(!this.wrtcs) {
        this.startWebRTCSocket()
      } else {
        try {
          this.wrtcs.send(message)
        } catch(e) {
          this.destroyWebRTCSocket()
          this.startWebRTCSocket()
        }
      }
      if(!this.ls) {
        this.startLocalSocket()
      } else {
        try {
          this.ls.send(message)
        } catch(e) {
          this.destroyLocalSocket()
          this.startLocalSocket()
        }
      }
    },
    pulse() {
      this.send({type: "pulse"})
    },
    advance(from) {
      this.send({type: "advance", from})
    },
    ping() {
      this.send({type: "ping"})
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
      this.relaySocketStatus = "DISCONNECTED"
    },
    startWebsocket() {
      let self=this
      if(self.ws) {
        return // Already trying to establish a connection
      }
      this.relaySocketStatus == 'CONNECTING'
      this.ws = new WebSocket(`ws://${window.location.hostname}:7777${window.location.pathname}/${this.uuid}`)
      this.ws.onmessage = event => {
        self.$set(self, 'relaySocketStatus', 'CONNECTED')
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

    destroyWebRTCSocket() {
      if(this.wrtcs) {
        try {
          this.wrtcs.destroy()
        } catch(e) {
          console.log("Error closing webRTC socket", e)
        }
        this.wrtcs = null
      }
      if(this.signalSocket) {
        try {
          this.signalSocket.close()
        } catch(e) {
          console.log("Error closing signaling socket", e)
        }
        this.signalSocket = null
      }
      this.signalClient = null
      this.webRTCStatus = "DISCONNECTED"
    },
    startWebRTCSocket() {
      let self=this
      if(self.signalClient) {
        return // Already trying to establish a connection
      }
      this.webRTCStatus == 'CONNECTING'
      self.signalSocket = io(location.origin)
      self.signalClient = new SimpleSignalClient(self.signalSocket)
      self.signalClient.on('discover', async (allIDs) => {
        allIDs.forEach(async function(id){
          try {
            const { peer } = await self.signalClient.connect(id,{clientID:self.uuid})
            self.wrtcs = peer
            peer.on('data', function(data){
              self.$set(self, 'webRTCStatus', 'CONNECTED')
              self.handleMessage(data.toString())
            })
            peer.on('close',function(){
              setTimeout(function(){ self.destroyWebRTCSocket(); })
            })
            peer.on('error', (err) => {
              console.error("ERROR",err)
              setTimeout(function(){ self.destroyWebRTCSocket(); })
            })
          } catch(e) {
            console.log("WebRTC Connection error",e)
            self.destroyWebRTCSocket()
          }
        })
      })
      self.signalClient.discover({orbID:window.location.pathname.substr(1)})
    },

    destroyLocalSocket() {
      if(this.ls) {
        try {
          this.ls.close()
        } catch(e) {
          console.log("Error closing local socket", e)
        }
        this.ls = null
      }
      this.localSocketStatus = "DISCONNECTED"
    },
    startLocalSocket() {
      let self=this
      if(self.ls || self.fetchingIP) {
        return // Already trying to establish a connection
      }
      this.localSocketStatus == 'CONNECTING'
      self.fetchingIP = true
      fetch(`${location.origin}/ip${window.location.pathname}`,{method:"GET"})
        .then((response) => {
          self.fetchingIP = false
          response.text().then((ip) => {
            if(!ip) return
            self.ls = new WebSocket(`ws://${ip}:7777//${self.uuid}`)
            self.ls.onmessage = event => {
              self.$set(self, 'localSocketStatus', 'CONNECTED')
              self.handleMessage(event.data)
            }
            self.ls.onclose = event => {
              setTimeout(function(){ self.destroyLocalSocket(); })
            }
            self.ls.onerror = event => {
              console.error("ERROR",event)
              setTimeout(function(){ self.destroyLocalSocket(); })
            }
          })
        })
        .catch((e) => {
          self.fetchingIP = false
          console.error("Error fecthing local IP", e)
        })
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
      this.isMoving = true
      this.startLocation = [location.clientX, location.clientY]
      this.timestamp = Date.now()
    },
    handleEnd(location) {
      if (this.showSettings || !this.self.isReady) {
        return
      }
      if (Date.now() - this.timestamp > 10 &&
          Date.now() - this.timestamp < 300 &&
          Math.abs(this.startLocation[0] - location.clientX) < 10 &&
          Math.abs(this.startLocation[1] - location.clientY) < 10) {
        this.send({type: "tap"})
      }
      this.move = [0,0]

      this.send({type: "move", move: this.move})
      this.isMoving = false
    },
    handleChange(location) {
      if (this.showSettings) {
        return
      }
      if (!this.isMoving) {
        return
      }
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
      }

      this.send({type: "move", move: this.move})
    },

    showRules() {
      this.send({ type: 'unready' })
    },

    dismissRules() {
      // this.$set(this.localFlags, 'hasPlayedOnce', true)
      // this.$set(this.localFlags, this.state.game, true)
      this.hasSeenGlobalRules = true
      this.send({ type: 'ready' })
      this.carouselPosition = 0
      this.carouselCurrentX = 0
      if (this.carouselInterval) {
        clearInterval(this.carouselInterval)
        this.carouselInterval = null
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
        let targetX = innerWidth * -this.carouselPosition
        const alpha = 0.75
        this.carouselCurrentX = alpha * this.carouselCurrentX + (1 - alpha) * targetX
        this.$forceUpdate()
        if (Math.abs(this.carouselCurrentX - this.targetX) < 0.1) {
          clearInterval(this.carouselInterval)
          this.carouselInterval = null
        }
      }, 33)
    },
  },
});


function delay(millis, v) {
  return new Promise(function(resolve) {
    setTimeout(resolve.bind(null, v), millis)
  });
}

function isNothing(val) {
  return val === undefined || val === null
}
