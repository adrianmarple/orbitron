#!/usr/bin/env node
const http = require('http')
const qs = require('querystring')
const fs = require('fs')
const { execFile } = require('child_process')
const path = require('path')
const { checkConnection, execute, delay, config } = require('../lib')
const { displayText, registerAccessPointHandler } = require('../orb')

const PORTAL_HTML_PATH = path.join(__dirname, 'captiveportal.html')
const AP_SSID = `Lumatron-${config.ORB_ID}`

// ---Wifi Setup Code---
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0

async function checkConnectionAndCleanup() {
  const connected = await checkConnection()
  if (connected) await stopAccessPoint()
  return connected
}



let accessedFormTime = 0
let someoneConnectedToAccessPoint = false
let forceExitAccessPointLoop = false

async function startAccessPoint() {
  if (!(await execute("ifconfig")).includes("wlan")) {
    console.log("No wifi devices, cannot start access point")
    stopAccessPoint()
    return
  }
  await removeWifiProfile("OrbHotspot")
  await execute(`nmcli connection add type wifi con-name "OrbHotspot" autoconnect no wifi.mode ap wifi.ssid "${AP_SSID}" ipv4.method shared ipv6.method shared`)
  await execute('nmcli connection up OrbHotspot')
  console.log("STARTED ACCESS POINT")
  forceExitAccessPointLoop = false
  someoneConnectedToAccessPoint = false
  accessPointLoop()
}

async function accessPointLoop() {
  let connected = await checkConnectionAndCleanup()
  if (connected || forceExitAccessPointLoop) {
    return
  }
  let out = await execute("iw dev wlan0 station dump")
  someoneConnectedToAccessPoint = out.includes("Station")

  if (!someoneConnectedToAccessPoint) {
    displayText(`JOIN WIFI ${AP_SSID}`)
  } else {
    displayText("ADD SSID")
  }
  setTimeout(accessPointLoop, 500)
}

function nmcli(...args) {
  return new Promise((resolve, reject) => {
    execFile('nmcli', args, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message))
      else resolve(stdout)
    })
  })
}

async function stopAccessPoint(ssid, password) {
  forceExitAccessPointLoop = true
  someoneConnectedToAccessPoint = false
  await removeWifiProfile("OrbHotspot")
  if (ssid) {
    displayText(`ADDING SSID ${ssid}`)
    await removeWifiProfile(ssid)
    const args = ['connection', 'add', 'con-name', ssid, 'type', 'wifi', 'ssid', ssid, 'autoconnect', 'yes', 'save', 'yes']
    if (password) {
      args.push('802-11-wireless-security.key-mgmt', 'WPA-PSK', '802-11-wireless-security.psk', password)
    }
    await nmcli(...args)
    await nmcli('connection', 'up', ssid)
  }
}

async function removeWifiProfile(connectionName) {
  let connectionExists = (await execute("nmcli connection show")).indexOf(connectionName) >= 0
  if (connectionExists) {
    console.log("Removed Wifi Profile: ", connectionName)
    await execute(`nmcli connection delete "${connectionName}"`)
  }
}

async function scanNetworks() {
  try {
    const out = await execute('nmcli -t -f SSID,SIGNAL,SECURITY device wifi list')
    const seen = new Set()
    return out.trim().split('\n')
      .filter(l => l.trim())
      .map(line => {
        // nmcli -t escapes colons as \: — swap them out before splitting
        const parts = line.replace(/\\:/g, '\x00').split(':').map(p => p.replace(/\x00/g, ':'))
        const ssid = parts[0]
        const signal = parseInt(parts[1]) || 0
        const security = parts[2] || ''
        return { ssid, rssi: Math.round(signal / 2) - 100, open: !security || security === '--' }
      })
      .filter(n => n.ssid && !seen.has(n.ssid) && seen.add(n.ssid))
      .sort((a, b) => b.rssi - a.rssi)
  } catch (e) {
    return []
  }
}

async function getVersion() {
  try {
    return (await execute('git rev-list --count HEAD')).trim()
  } catch (e) {
    return '?'
  }
}

function redirect(res, location) {
  res.writeHead(302, { Location: location })
  res.end()
}

function sendJSON(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}

let wifiSetupServer = http.createServer(async function (req, res) {
  const url = req.url.split('?')[0]

  // Captive portal OS probes → redirect to portal
  if (url === '/generate_204' || url === '/hotspot-detect.html' || url === '/ncsi.txt') {
    return redirect(res, 'http://10.42.0.1/')
  }

  if (req.method === 'GET') {
    if (url === '/') {
      accessedFormTime = Date.now()
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(fs.readFileSync(PORTAL_HTML_PATH))
    } else if (url === '/info') {
      sendJSON(res, { orbID: config.ORB_ID, version: await getVersion() })
    } else if (url === '/scan') {
      sendJSON(res, await scanNetworks())
    } else {
      res.writeHead(404)
      res.end()
    }
  } else if (req.method === 'POST' && url === '/connect') {
    let body = ''
    req.on('data', d => body += d)
    req.on('end', async () => {
      const { ssid, password } = qs.parse(body)
      console.log("Portal: connecting to SSID:", ssid)
      // Respond before tearing down the AP — removing OrbHotspot drops the
      // client's connection, so the response would never arrive otherwise.
      sendJSON(res, { success: true })
      await delay(500)
      await stopAccessPoint(ssid, password || '')
    })
  } else {
    res.writeHead(405)
    res.end()
  }
})

async function hasSavedWifiCredentials() {
  const out = await execute("nmcli -t -f NAME,TYPE connection show")
  return out.split('\n').some(line => {
    const [name, type] = line.split(':')
    return type === 'wifi' && name !== 'OrbHotspot'
  })
}

let isFirstNetworkCheck = true
async function networkCheck() {
  try {
    let connected = await checkConnectionAndCleanup()
    if (connected) {
      isFirstNetworkCheck = false
      if (!config.DONT_RECONNECT) setTimeout(networkCheck, 120e3)
      return
    }

    numTimesNetworkCheckFailed += 1
    await stopAccessPoint()
    await delay(isFirstNetworkCheck ? 15e3 : 60e3)

    isFirstNetworkCheck = false
    if (config.DONT_RECONNECT) return
    connected = await checkConnectionAndCleanup()
    if (connected) {
      numTimesNetworkRestartWorked += 1
      setTimeout(networkCheck, 120e3)
    } else if (!(await hasSavedWifiCredentials())) {
      numTimesAccessPointStarted += 1
      await startAccessPoint()
      await delay(120e3)
      while (someoneConnectedToAccessPoint) {
        await delay(10e3)
      }
      setTimeout(networkCheck, 1e3)
    } else {
      setTimeout(networkCheck, 20e3)
    }
  } catch(e) {
    console.error("networkCheck error:", e)
    setTimeout(networkCheck, 30e3)
  }
}

if (!config.NO_ACCESS_POINT) {
  wifiSetupServer.listen(80, () => {
    console.log("wifi setup listening on port 80")
  })
  setTimeout(networkCheck, 5e3)
  registerAccessPointHandler(startAccessPoint)
}
