#!/usr/bin/env node
const { checkConnection, execute, config} = require('./lib')
const http = require('http')
const qs = require('querystring')

// ---Wifi Setup Code---
let numTimesNetworkCheckFailed = 0
let numTimesNetworkRestartWorked = 0
let numTimesAccessPointStarted = 0
if(!config.IS_SERVER){
  let FORM = `
  <!DOCTYPE html>
  <html>

    <head>
        <title>Add Wifi Network</title>
    </head>

    <body>
        <form action="/" method="post">
          SSID: <input type = "text" name = "ssid" />
          <br>
          <br>
          Password: <input type = "password" name = "password" />
          <br>
          <br>
          Priority: <input type = "radio" name = "priority" value = "low" checked> Low
          <input type = "radio" name = "priority" value = "high"> High
          <br>
          <br>
          <input type = "submit" name = "submit" value = "Submit" />
        </form>
    </body>

  </html>
  `
  let SUBMITTED = `
  <!DOCTYPE html>
  <html>
    <meta http-equiv="Refresh" content="3">
    <head>
        <title>Submission Completed</title>
    </head>

    <body>
          SSID and Password submitted, WiFi will now restart to apply changes and the page will refresh.
    </body>

  </html>
  `

  async function startAccessPoint(){
    await execute("mv /etc/dhcpcd.conf.accesspoint /etc/dhcpcd.conf")
    await execute("systemctl restart networking.service")
    await execute("systemctl restart dhcpcd")
    await execute("systemctl restart hostapd")
    console.log("STARTED ACCESS POINT")
  }

  async function stopAccessPoint(){
    let hostapdRunning = (await execute("ps -ea | grep hostapd")).indexOf("hostapd") >= 0
    if(hostapdRunning){
      await execute("systemctl stop hostapd")
      await execute("systemctl restart networking.service")
      await execute("systemctl restart dhcpcd")
      await execute("wpa_cli reconfigure")
      console.log("STOPPED ACCESS POINT")
    }
    await execute("mv /etc/dhcpcd.conf /etc/dhcpcd.conf.accesspoint")
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
    if(password.trim() == ""){
      append = `
  network={
      ssid="${ssid}"
      key_mgmt=NONE
      scan_ssid=1
      id_str="${ssid}"
      priority=${priority}
  }
  `
    } else {
      append = `
  network={
      ssid="${ssid}"
      psk="${password}"
      key_mgmt=WPA-PSK
      scan_ssid=1
      id_str="${ssid}"
      priority=${priority}
  }
  `
    }
    let toExec=`echo '${append}' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf`
    await execute(toExec)
    await stopAccessPoint()
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
      }, isFirstNetworkCheck ? 3e4 : 3 * 6e4);
    } else {
      isFirstNetworkCheck = false
      setTimeout(networkCheck, 2 * 6e4);
    }
  }

  let wifiSetupServer = http.createServer(function (req, res) {
    if (req.method === 'GET') { 
      res.writeHead(200, { 'Content-Type': 'text/html' }) 
      res.write(FORM)
      res.end()
    } else if (req.method === 'POST') {
      let body = ""
      req.on('data', function(data) {
        body += data
      })
      req.on('end', function() {
        let formData = qs.parse(body)
        console.log(formData)
        res.writeHead(200, {'Content-Type': 'text/html'})
        res.write(SUBMITTED)
        res.end()
        submitSSID(formData)
      })
    }
  })

  wifiSetupServer.listen(9090,() => {
    console.log("wifi setup Listening on port 9090")
  })
  setTimeout(() => {
    networkCheck()
  }, 6e4)