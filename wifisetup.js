const fs = require('fs')
const http = require('http')
const path = require('path')
const qs = require('querystring')
const process = require('process')
const { execSync } = require('child_process')

let PORT = process.env.PORT || 9090

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
SUBMITTED = `
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

function tryExecSync(command){
  try {
    execSync(command)
  } catch(err){
    console.log(err)
  }
}

function startAccessPoint(){
  console.log("STARTING ACCESS POINT")
  tryExecSync("sudo mv /etc/dhcpcd.conf.accesspoint /etc/dhcpcd.conf")
  tryExecSync("sudo systemctl enable hostapd")
  tryExecSync("sudo systemctl restart networking.service")
  tryExecSync("sudo systemctl restart dhcpcd")
  tryExecSync("sudo systemctl restart hostapd")
  console.log("FINISHED STARTING ACCESS POINT")
}

function stopAccessPoint(){
  console.log("STOPPING ACCESS POINT")
  tryExecSync("sudo systemctl stop hostapd")
  tryExecSync("sudo systemctl disable hostapd")
  tryExecSync("sudo mv /etc/dhcpcd.conf /etc/dhcpcd.conf.accesspoint")
  tryExecSync("sudo systemctl restart networking.service")
  tryExecSync("sudo systemctl restart dhcpcd")
  tryExecSync("sudo wpa_cli reconfigure")
  console.log("FINISHED STOPPING ACCESS POINT")
}

function submitSSID(formData) {
  var ssid = formData.ssid.replace(/'/g, "\\'")
  console.log("Addind SSID: ", ssid)
  if(ssid == ""){
    stopAccessPoint()
    return
  }
  var password = formData.password.replace(/'/g, "\\'")
  var priority = formData.priority == 'low' ? 1 : 2
  var append = ""
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
  var toExec=`echo '${append}' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf`
  tryExecSync(toExec)
  stopAccessPoint()
}

let server = http.createServer(function (req, res) {
  if (req.method === 'GET') { 
    res.writeHead(200, { 'Content-Type': 'text/html' }) 
    res.write(FORM)
    res.end()
  } else if (req.method === 'POST') {
    var body = ""
    req.on('data', function(data) {
      body += data
    })
    req.on('end', function() {
      var formData = qs.parse(body)
      console.log(formData)
      res.writeHead(200, {'Content-Type': 'text/html'})
      res.write(SUBMITTED)
      res.end()
      submitSSID(formData)
    })
  }
})

server.listen(PORT,function(err){
  console.log("Listening on " + PORT,err)
})

// access point management
const http2 = require('http2');

function isConnected() {
  return new Promise((resolve) => {
    const client = http2.connect('https://www.google.com');
    client.setTimeout(5000)
    client.on('connect', () => {
      resolve(true);
      client.destroy();
    });
    client.on('error', () => {
      resolve(false);
      client.destroy();
    });
    client.on('timeout', () => {
      resolve(false);
      client.destroy();
    });
  });
};

function networkCheck(){
  isConnected().then((connected)=>{
    console.log("Internet Connected: ", connected)
    if(!connected){
      stopAccessPoint()
      setTimeout(() => {
        isConnected().then((connected2)=>{
          if(!connected2){
            startAccessPoint()
            setTimeout(networkCheck, 10 * 60 * 1000);
          } else {
            setTimeout(networkCheck, 60 * 1000);
          }
        })
      }, 60 * 1000);
    } else {
      setTimeout(networkCheck, 60 * 1000);
    }
  })
}
networkCheck()