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
  removeAccessPointProfile()
  await execute('sudo nmcli connection add type wifi con-name "OrbHotspot" autoconnect no wifi.mode ap wifi.ssid "Super Orbitron" ipv4.method shared ipv6.method shared')
  await execute('sudo nmcli connection up OrbHotspot')
  console.log("STARTED ACCESS POINT")
  displayText("JOIN WIFI SUPER ORBITRON")
}

async function stopAccessPoint(){
  removeAccessPointProfile()
  await execute("sudo nmcli device disconnect wlan0")
  await execute("sudo nmcli device up wlan0")
  console.log("STOPPED ACCESS POINT")
}

async function removeAccessPointProfile(){
  let connectionExists = (await execute("sudo nmcli connection show")).indexOf("OrbHotspot") >= 0
  if(connectionExists){
    await execute('sudo nmcli connection delete OrbHotspot')
  }
}

async function submitSSID(formData) {
  let ssid = formData.ssid.replace(/'/g, "\\'")
  console.log("Adding SSID: ", ssid)
  if(ssid == ""){
    await stopAccessPoint()
    return
  }
  let password = formData.password.replace(/'/g, "\\'")
  let append = ""
  if(password.trim() != ""){
    append = `password ${password}`
  }

  await stopAccessPoint()
  await execute(`sudo nmcli dev wifi connect ${ssid} ${append}`)
  displayText(`ADDED SSID ${ssid}`)
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
  await delay(isFirstNetworkCheck ? 25e3 : 300e3)

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
