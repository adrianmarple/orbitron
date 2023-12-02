#!/usr/bin/env node
const { checkConnection, execute, config} = require('../lib')
const http = require('http')
const qs = require('querystring')
const { displayText } = require('../orb')
const { respondWithFile } = require('../server')

// ---Wifi Setup Code---
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0
if(!config.IS_SERVER){
  async function startAccessPoint(){
    let connectionExists = (await execute("sudo nmcli connection show")).indexOf("OrbHotspot") >= 0
    if(connectionExists){
      await execute('sudo nmcli connection delete OrbHotspot')
    }
    await execute('sudo nmcli connection add type wifi con-name "OrbHotspot" autoconnect no wifi.mode ap wifi.ssid "Super Orbitron" ipv4.method shared ipv6.method shared')
    await execute('sudo nmcli connection up OrbHotspot')
    console.log("STARTED ACCESS POINT")
    displayText("JOIN WIFI SUPER ORBITRON")
  }

  async function stopAccessPoint(){
    //let hostapdRunning = (await execute("ps -ea")).indexOf("hostapd") >= 0
    try {
      await execute("sudo nmcli device disconnect wlan0")
      await execute("sudo nmcli device up wlan0")
    } catch(_) {
      // Do nothing
    }
    console.log("STOPPED ACCESS POINT")
  }

  async function submitSSID(formData) {
    let ssid = formData.ssid.replace(/'/g, "\\'")
    console.log("Adding SSID: ", ssid)
    if(ssid == ""){
      await stopAccessPoint()
      return
    }
    let password = formData.password.replace(/'/g, "\\'")
    let priority = formData.priority == 'low' ? 1 : 2
    let append = ""
    if(password.trim() != ""){
      append = `password ${password}`
    }

    await stopAccessPoint()
    await execute(`sudo nmcli dev wifi connect ${ssid} ${append}`)
    displayText("ADDED SSID")
  }

  let isFirstNetworkCheck = true
  async function networkCheck(){
    let connected = await checkConnection()
    if(!connected){
      numTimesNetworkCheckFailed += 1
      await stopAccessPoint()
      setTimeout(async () => {
        isFirstNetworkCheck = false
        let connected2 = await checkConnection()
        if(!connected2){
          numTimesAccessPointStarted += 1
          await startAccessPoint()
          setTimeout(networkCheck, 10 * 6e4);
        } else {
          numTimesNetworkRestartWorked += 1
          setTimeout(networkCheck, 2 * 6e4);
        }
      }, isFirstNetworkCheck ? 1e4 : 3 * 6e4);
    } else {
      isFirstNetworkCheck = false
      setTimeout(networkCheck, 2 * 6e4);
    }
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
  }, 2e4)
}