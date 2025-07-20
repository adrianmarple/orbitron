#!/usr/bin/env node
const http = require('http')
const qs = require('querystring')
const { checkConnection, execute, delay, config } = require('../lib')
const { displayText } = require('../orb')
const { respondWithFile } = require('../server')

// ---Wifi Setup Code---
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0

let someoneConnectedToAccessPoint = false
let forceExitAccessPointLoop = false

async function startAccessPoint() {
  if(!(await execute("ifconfig")).includes("wlan0")){
    console.log("No wifi devices, cannot start access point")
    stopAccessPoint()
    return
  }
  removeWifiProfile("OrbHotspot")
  await execute('nmcli connection add type wifi con-name "OrbHotspot" autoconnect no wifi.mode ap wifi.ssid "Lumatron" ipv4.method shared ipv6.method shared')
  await execute('nmcli connection up OrbHotspot')
  console.log("STARTED ACCESS POINT")
  forceExitAccessPointLoop = false
  someoneConnectedToAccessPoint = false
  accessPointLoop()
}

async function accessPointLoop(){
  let connected = await checkConnection()
  if (connected || forceExitAccessPointLoop) {
    return
  }
  let out = await execute("iw dev wlan0 station dump")
  someoneConnectedToAccessPoint = out.includes("Station")
  if (someoneConnectedToAccessPoint) {
    displayText("VISIT URL 10.42.0.1")
  } else {
    displayText("JOIN WIFI LUMATRON")
  }
  setTimeout(accessPointLoop, 500)
}

async function stopAccessPoint(ssid, password) {
  forceExitAccessPointLoop = true
  someoneConnectedToAccessPoint = false
  removeWifiProfile("OrbHotspot")
  if(ssid){
    displayText(`ADDING SSID ${ssid}`)
    await removeWifiProfile(ssid)
    if(password != ""){
      password =  `802-11-wireless-security.key-mgmt WPA-PSK 802-11-wireless-security.psk ${password}`
    }
    await execute(`nmcli connection add con-name "${ssid}" type wifi ssid "${ssid}" ${password} autoconnect yes save yes`)
    await execute(`nmcli connection up "${ssid}"`)
  }
}

async function removeWifiProfile(connectionName){
  let connectionExists = (await execute("nmcli connection show")).indexOf(connectionName) >= 0
  if(connectionExists){
    console.log("Removed Wifi Profile: ", connectionName)
    await execute(`nmcli connection delete ${connectionName}`)
  }
}

async function submitSSID(formData) {
  let ssid = formData.ssid.replace(/'/g, "\\'")
  console.log("ADDING SSID: ", ssid)
  let password = formData.password.replace(/'/g, "\\'").trim()
  await stopAccessPoint(ssid, password)
}

let isFirstNetworkCheck = true
async function networkCheck() {
  let connected = await checkConnection()
  if(connected) {
    isFirstNetworkCheck = false
    setTimeout(networkCheck, 120e3)
    return
  }

  displayText("CHECKING FOR INTERNET")
  numTimesNetworkCheckFailed += 1
  await stopAccessPoint()
  await delay(isFirstNetworkCheck ? 15e3 : 60e3)

  isFirstNetworkCheck = false
  connected = await checkConnection()
  if (connected) {
    numTimesNetworkRestartWorked += 1
    setTimeout(networkCheck, 120e3)
  } else {
    numTimesAccessPointStarted += 1
    await startAccessPoint()
    await delay(120e3)
    while (someoneConnectedToAccessPoint) {
      await delay(10e3)
    }
    setTimeout(networkCheck, 1e3)
  }
}

let wifiSetupServer = http.createServer(function (req, res) {
  if (req.method === 'GET') {
    let filepath = req.url
    if (filepath == "/" || filepath.includes("form")) {
      displayText("ADD SSID")
      respondWithFile(res, "/accesspoint/form.html")
    } else {
      respondWithFile(res, filepath)
    }
  } else if (req.method === 'POST') {
    let body = ""
    req.on('data', function(data) {
      body += data
    })
    req.on('end', function() {
      let formData = qs.parse(body)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      let responseData = {
        redirect: `https://my.lumatron.art/${config.ORB_ID}`
      }
      res.end(JSON.stringify(responseData), 'utf-8')
      submitSSID(formData)
    })
  }
})

if (!config.NO_ACCESS_POINT) {
  wifiSetupServer.listen(80,() => {
    console.log("wifi setup Listening on port 80")
  })
  setTimeout(networkCheck, 5e3)
}
