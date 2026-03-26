
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

window.gameTemplatePromise.then(() => {
var app = new Vue({
  el: '#app',
  mixins: [gameMixin],
  data: {
    os: "Unknown",
    browser: "Unknown",
    isIframe: location != parent.location,

    isPWA: window.matchMedia('(display-mode: standalone)').matches,
    orbID: location.pathname.split('/')[1],
    idToOrb: {},
    registeredIDs: [],
    draggingID: null,
    draggingTargetID: null,
    dragGhost: null,
    dragSourceID: null,
    dragSourceEl: null,
    dragPointerStart: null,
    dragPointerId: null,
    dragCleanup: null,
    dragTimer: null,
    dragScrolling: false,
    dragEdgeScrollRAF: null,
    momentumAnimationFrame: null,
    excludedIDs: [],
    excludedNameMap: {},
    manuallingRegistering: false,
    newID: "",
    registrationErrorMessage: "",
    loadingOrb: false,


    loginCode: "",
    localFlags: {},
    helpMessage: null,
    showConsignment: true,
    showAboutPage: false,
    blurred: false,
    renamingSave: "",
    saveNames: [],
    prefModalName: null,
    prefModalOriginalName: "",
    activeDropdown: null,

    latestMessage: 0,
    lastMessageTimestamp: 0,
    lastMessageTimestampCount: 0,
    epochTimeStart: Date.now(),

    prefs: {},
    unwatchers: {},
    dontSendUpdates: false,
    lastPrefUpdateTime: {},
    prefName: "",
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

    addEventListener("resize", () => {
      this.setRem()
      this.checkOverscroll()
    })
    addEventListener("DOMContentLoaded", this.setRem)
    // So hacky, but this seems relatively robust and necessary for things like firefox on iOS
    for (let i = 0; i < 5; i++) {
      setTimeout(this.setRem, 300*i)
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
    "state.prefs": function(val, oldValue) {
      if (!oldValue) {
        this.prefs = { ...val }
        for (let key in val) {
          if (this.unwatchers['prefs.' + key]) {
            this.unwatchers['prefs.' + key]()
          }
          this.unwatchers['prefs.' + key] = this.$watch('prefs.' + key, (v, vOld) => {
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

    appOverflowY() {
      if (this.isIframe) {
        return "inherit"
      } else if (this.speedbumpCallback || this.gameStarted) {
        return "hidden"
      } else {
        return "scroll"
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
    navBarCount() {
      let n = this.navBarItems.length
      return n % 2 == 1 ? n + 1 : n
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
    colorOptions() {
      let options = [['rainbow', 'Rainbow'], ['fixed', 'Fixed color'], ['gradient', 'Gradient']
      ].filter(([val, label]) => !this.exclude[val] && !this.exclude[label])
      let includibleOptions = [
        ['tricolor', '3 Colors'],
      ]
      for (let option of includibleOptions) {
        if (this.include[option[0]]) {
          options.push(option)
        }
      }
      return options
    },
    patternOptions() {
      let options = [
        ['static', 'Static'],
        ['fireflies', 'Fireflies'],
        ['lightning', 'Lightning'],
        ['pulses', 'Ripples'],
        ['sin', 'Waves'],
        ['lightfield', 'Sparkles'],
        ['default', 'Fire (default)'],
      ].filter(([val, label]) => !this.exclude[val] && !this.exclude[label])

      let includibleOptions = [
        ['hourglass', 'Hourglass'],
        ['linesine', 'Line Sine'],
      ]
      for (let option of includibleOptions) {
        if (this.include[option[0]]) {
          options.push(option)
        }
      }
      
      let extra = this.orbInfo.extraIdle
      if (extra) {
        let extraDisplayName = extra[0].toUpperCase() + extra.slice(1)
        options.unshift([extra, extraDisplayName])
      }
      return options
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
        orb.latestMessage = 0
        this.$set(orb, 'state', {})
        this.$set(orb, 'socketStatus', 'DISCONNECTED')
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
          let info = await data.json()
          if (!info) return
          this.initOrb(info)
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
    onDrop(targetID) {
      if (this.draggingID === targetID) return
      const from = this.registeredIDs.indexOf(this.draggingID)
      const to = this.registeredIDs.indexOf(targetID)
      this.registeredIDs.splice(from, 1)
      this.registeredIDs.splice(to, 0, this.draggingID)
      localStorage.setItem("registeredIDs", JSON.stringify(this.registeredIDs))
      this.draggingID = null
    },
    dragTargetID(event) {
      const el = document.elementFromPoint(event.clientX, event.clientY)
      const orbEl = el && el.closest('.orb-wrapper')
      if (!orbEl) return null
      const index = Array.from(orbEl.parentElement.children).indexOf(orbEl)
      return this.registeredIDs[index] ?? null
    },
    startMomentumScroll(app, velocity) {
      if (this.momentumAnimationFrame) cancelAnimationFrame(this.momentumAnimationFrame)
      const FRICTION = 0.995 // per ms — reaches ~1% in ~1s at 60fps
      let v = velocity
      let lastTime = null
      const animate = (time) => {
        if (lastTime === null) { lastTime = time; this.momentumAnimationFrame = requestAnimationFrame(animate); return }
        const dt = Math.min(time - lastTime, 32)
        lastTime = time
        v *= Math.pow(FRICTION, dt)
        if (Math.abs(v) < 0.02) { this.momentumAnimationFrame = null; return }
        app.scrollBy(0, v * dt)
        this.momentumAnimationFrame = requestAnimationFrame(animate)
      }
      this.momentumAnimationFrame = requestAnimationFrame(animate)
    },
    velocityFromMoves(recentMoves) {
      if (recentMoves.length < 2) return 0
      const first = recentMoves[0]
      const last = recentMoves[recentMoves.length - 1]
      const dt = last.time - first.time
      return dt > 0 ? (first.y - last.y) / dt : 0
    },
    trackScrollMove(recentMoves, e) {
      recentMoves.push({ y: e.clientY, time: e.timeStamp })
      while (recentMoves.length > 1 && e.timeStamp - recentMoves[0].time > 100) recentMoves.shift()
    },
    onScrollPointerDown(event) {
      if (event.pointerType === 'mouse') return
      if (event.target.closest('.orb')) return // Handles scrolling separately
      if (this.momentumAnimationFrame) { cancelAnimationFrame(this.momentumAnimationFrame); this.momentumAnimationFrame = null }
      const pointerId = event.pointerId
      const startY = event.clientY
      const app = document.getElementById('app')
      const startScrollTop = app.scrollTop
      const recentMoves = []
      let scrolling = false
      const onMove = (e) => {
        if (e.pointerId !== pointerId) return
        e.preventDefault()
        if (!scrolling) {
          if (Math.abs(e.clientY - startY) < 8) return
          scrolling = true
        }
        this.trackScrollMove(recentMoves, e)
        app.scrollTop = startScrollTop - (e.clientY - startY)
      }
      const onUp = (e) => {
        if (e.pointerId !== pointerId) return
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        if (scrolling) {
          const v = this.velocityFromMoves(recentMoves)
          if (Math.abs(v) > 0.05) this.startMomentumScroll(app, v)
        }
      }
      document.addEventListener('pointermove', onMove, { passive: false })
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)
    },
    onPointerDragStart(event, id) {
      if (this.momentumAnimationFrame) { cancelAnimationFrame(this.momentumAnimationFrame); this.momentumAnimationFrame = null }
      if (this.dragCleanup) this.dragCleanup()

      this.dragSourceEl = event.currentTarget
      this.dragSourceID = id
      this.dragPointerId = event.pointerId
      this.dragPointerStart = { x: event.clientX, y: event.clientY }

      const onMove = (e) => {
        if (e.pointerId !== this.dragPointerId) return
        this.onPointerDragMove(e)
      }
      const onUp = (e) => {
        if (e.pointerId !== this.dragPointerId) return
        this.onPointerDrop(e)
        cleanup()
      }
      const cleanup = () => {
        clearTimeout(this.dragTimer)
        this.dragTimer = null
        document.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerup', onUp)
        document.removeEventListener('pointercancel', onUp)
        this.dragCleanup = null
      }
      this.dragCleanup = cleanup
      document.addEventListener('pointermove', onMove, { passive: false })
      document.addEventListener('pointerup', onUp)
      document.addEventListener('pointercancel', onUp)

      if (event.pointerType === 'mouse') return
      if (this.registeredIDs.length <= 1) {
        this.dragScrolling = {
          startY: event.clientY,
          startScrollTop: document.getElementById('app').scrollTop,
          recentMoves: [{ y: event.clientY, time: event.timeStamp }],
        }
        return
      }
      this.dragTimer = setTimeout(() => {
        this.dragTimer = null
        this.startDragGhost()
      }, 200)
    },
    startDragGhost(x, y) {
      x = x ?? this.dragPointerStart.x
      y = y ?? this.dragPointerStart.y
      this.draggingID = this.dragSourceID
      const rect = this.dragSourceEl.getBoundingClientRect()
      const ghost = this.dragSourceEl.cloneNode(true)
      ghost.style.cssText = `
        position:fixed;width:${rect.width}px;
        height:${rect.height}px;
        left:${x - rect.width/2}px;
        top:${y - rect.height/2}px;
        pointer-events:none;
        z-index:1000;
        transform:scale(1.05);`
      const overlay = document.createElement('div')
      overlay.style.cssText = `
        position:absolute;
        inset:0;
        background:rgba(0,0,0,0.2);
        z-index:1;
        pointer-events:none;`
      ghost.appendChild(overlay)
      const srcCanvas = this.dragSourceEl.querySelector('canvas')
      const dstCanvas = ghost.querySelector('canvas')
      if (srcCanvas && dstCanvas) {
        dstCanvas.getContext('2d').drawImage(srcCanvas, 0, 0)
        if (this.isConnected(this.dragSourceID)) {
          window.addGhostView(this.dragSourceID, dstCanvas)
        }
      }
      document.querySelector('#registration').appendChild(ghost)
      this.dragGhost = ghost
    },
    onPointerDragMove(event) {
      event.preventDefault()
      if (!this.dragGhost) {
        if (event.pointerType === 'mouse') {
          this.startDragGhost(event.clientX, event.clientY)
        } else if (this.dragTimer) {
          const dx = event.clientX - this.dragPointerStart.x
          const dy = event.clientY - this.dragPointerStart.y
          if (Math.sqrt(dx*dx + dy*dy) > 20) {
            clearTimeout(this.dragTimer)
            this.dragTimer = null
            this.dragScrolling = {
              startY: event.clientY,
              startScrollTop: document.getElementById('app').scrollTop,
              recentMoves: [{ y: event.clientY, time: event.timeStamp }],
            }
          }
        } else if (this.dragScrolling) {
          const app = document.getElementById('app')
          this.trackScrollMove(this.dragScrolling.recentMoves, event)
          app.scrollTop = this.dragScrolling.startScrollTop - (event.clientY - this.dragScrolling.startY)
        }
        return
      }
      this.draggingTargetID = this.dragTargetID(event)
      const ghost = this.dragGhost
      ghost.style.left = (event.clientX - ghost.offsetWidth/2) + 'px'
      ghost.style.top  = (event.clientY - ghost.offsetHeight/2) + 'px'

      // Edge scroll when near top/bottom
      if (this.dragEdgeScrollRAF) {
        cancelAnimationFrame(this.dragEdgeScrollRAF)
        this.dragEdgeScrollRAF = null
      }
      const EDGE_ZONE = 80
      const y = event.clientY
      const vh = window.innerHeight
      let speed = 0
      if (y < EDGE_ZONE) speed = (y - EDGE_ZONE) * 0.3
      else if (y > vh - EDGE_ZONE) speed = (y - (vh - EDGE_ZONE)) * 0.3
      if (speed !== 0) {
        const app = document.getElementById('app')
        const scroll = () => {
          app.scrollBy(0, speed)
          this.dragEdgeScrollRAF = requestAnimationFrame(scroll)
        }
        this.dragEdgeScrollRAF = requestAnimationFrame(scroll)
      }
    },
    onPointerDrop(event) {
      if (this.dragEdgeScrollRAF) {
        cancelAnimationFrame(this.dragEdgeScrollRAF)
        this.dragEdgeScrollRAF = null
      }
      if (this.dragGhost) {
        window.removeGhostView()
        this.dragGhost.remove()
        this.dragGhost = null
        this.draggingTargetID = null
        const targetID = this.dragTargetID(event)
        this.onDrop(targetID || this.draggingID)
        document.addEventListener('click', e => e.stopPropagation(), { capture: true, once: true })
      }
      this.draggingID = null
      if (this.dragScrolling) {
        const v = this.velocityFromMoves(this.dragScrolling.recentMoves)
        if (Math.abs(v) > 0.05) this.startMomentumScroll(document.getElementById('app'), v)
      }
      this.dragScrolling = false
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

    openPrefModal(name) {
      this.prefModalName = name
      this.prefModalOriginalName = name
    },
    closePrefModal() {
      this.prefModalName = null
      this.prefModalOriginalName = ""
    },
    savePrefModalRename() {
      let newName = this.prefModalName
      let originalName = this.prefModalOriginalName
      if (!newName || newName === originalName) return
      let self = this
      let i = this.saveNames.indexOf(originalName)
      if (this.saveNames.includes(newName)) {
        this.prefModalName = originalName
        this.speedbumpMessage = `The save name "${newName}" is already being used.`
      } else {
        this.speedbumpMessage = `Would you like to rename ${originalName} to ${newName}?`
        this.speedbumpCallback = () => {
          self.send({ type: "renamePref", originalName, newName })
          if (i >= 0) self.saveNames[i] = newName
          self.prefModalOriginalName = newName
        }
      }
    },

    toggleIncludedInCycles(name, value) {
      let updated = Object.assign({}, this.prefs.includedInCycles)
      updated[name] = value
      this.send({ type: "prefs", update: { includedInCycles: updated } })
    },

    saveFocused(name) {
      this.renamingSave = name
    },
    saveBlurred(name, i) {
      let self = this
      let originalName = this.renamingSave
      this.saveNames[i] = this.renamingSave
      this.renamingSave = ""

      if (name == "" || name == originalName) { 
        return
      }

      console.log(this.saveNames)
      if (this.saveNames.includes(name)) {
        this.speedbumpMessage = `The save name "${name}" is already being used.`
      } else {
        this.speedbumpMessage = `Would you like to rename ${originalName} to ${name}?`
        this.speedbumpCallback = () => {
          self.send({type: "renamePref", originalName, newName: name})
          this.saveNames[i] = this.renamingSave
        }
      }
    },

    stripSaveName(name) {
      return name.replace(/[^0-9a-zA-Z ]/gi, '')
    },

    // Homescreen commands
    ping(orbID) {
      this.send({type: "ping"}, orbID)
    },
    advanceManualFade(orbID) {
      this.send({type: "advanceManualFade"}, orbID)
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
      this.$set(this.idToOrb[orbID], 'socketStatus', 'DISCONNECTED')
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
      this.$set(this.idToOrb[orbID], 'socketStatus', 'CONNECTING')
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
      if(message.timestamp <= this.idToOrb[orbID].latestMessage){
        return
      }
      this.idToOrb[orbID].latestMessage = message.timestamp
      if (message.self != this.state.self) {
        window.parent.postMessage({this: message.self}, '*')
      }
      this.dontSendUpdates = true
      this.$set(this.idToOrb[orbID], 'state', message)
      await this.$nextTick()
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
  },
})
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