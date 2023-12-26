#!/usr/bin/env node
const http = require('http')
const qs = require('querystring')
const { checkConnection, execute, delay} = require('../lib')
const { displayText } = require('../orb')
const { respondWithFile } = require('../server')

// ---Wifi Setup Code---
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0

async function startAccessPoint(){
  removeWifiProfile("OrbHotspot")
  await execute('sudo nmcli connection add type wifi con-name "OrbHotspot" autoconnect no wifi.mode ap wifi.ssid "Super Orbitron" ipv4.method shared ipv6.method shared')
  await execute('sudo nmcli connection up OrbHotspot')
  console.log("STARTED ACCESS POINT")
  displayText("JOIN WIFI SUPER ORBITRON")
}

async function stopAccessPoint(ssid, password){
  removeWifiProfile("OrbHotspot")
  if(ssid){
    removeWifiProfile(ssid)
    displayText(`ADDING SSID ${ssid}`)
    if(password != ""){
      password =  `802-11-wireless-security.key-mgmt WPA-PSK 802-11-wireless-security.psk ${password}`
    }
    await execute(`sudo nmcli connection add con-name "${ssid}" type wifi ssid "${ssid}" ${password} autoconnect yes save yes`)
    await execute(`sudo nmcli connection up "${SSID}"`)
  }
}

async function removeWifiProfile(connectionName){
  let connectionExists = (await execute("sudo nmcli connection show")).indexOf(connectionName) >= 0
  if(connectionExists){
    console.log("Removed Wifi Profile: ", connectionName)
    await execute(`sudo nmcli connection delete ${connectionName}`)
  }
}

async function submitSSID(formData) {
  let ssid = formData.ssid.replace(/'/g, "\\'")
  console.log("Adding SSID: ", ssid)
  let password = formData.password.replace(/'/g, "\\'").trim()
  await stopAccessPoint(ssid, password)
}

let isFirstNetworkCheck = true
async function networkCheck() {
  let connected = await checkConnection()
  if(connected) {
    isFirstNetworkCheck = false
    await delay(120e3)
    networkCheck()
    return
  }

  displayText("CHECKING FOR INTERNET")
  numTimesNetworkCheckFailed += 1
  await stopAccessPoint()
  await delay(isFirstNetworkCheck ? 25e3 : 100e3)

  isFirstNetworkCheck = false
  connected = await checkConnection()
  if (connected) {
    numTimesNetworkRestartWorked += 1
    await delay(120e3)
  } else {
    numTimesAccessPointStarted += 1
    await startAccessPoint()
    await delay(600e3)
  }
  networkCheck()
}

let wifiSetupServer = http.createServer(function (req, res) {
  if (req.method === 'GET') {
    let filepath = req.url
    if (filepath == "/" || filepath.includes("form")) {
      respondWithFile(res, "/accesspoint/form.html")
    } else {
      console.log(filepath)
      respondWithFile(res, filepath)
    }
  } else if (req.method === 'POST') {
    let body = ""
    req.on('data', function(data) {
      body += data
    })
    req.on('end', function() {
      let formData = qs.parse(body)
      console.log(formData)
      respondWithFile(res, "/accesspoint/submitted.html")
      submitSSID(formData)
    })
  }
})

wifiSetupServer.listen(80,() => {
  console.log("wifi setup Listening on port 80")
})
setTimeout(() => {
  networkCheck()
}, 5e3)
