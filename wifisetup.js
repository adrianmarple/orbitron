const fs = require('fs')
const http = require('http')
const path = require('path')
const qs = require('querystring')
const process = require('process')
const { exec } = require('child_process')

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

function submitSSID(formData) {
    var ssid = formData.ssid.replace(/'/g, "\\'")
    var password = formData.password.replace(/'/g, "\\'")
    var priority = formData.priority == 'low' ? 1 : 2
    var append = `
network={
    ssid="${ssid}"
    psk="${password}"
    key_mgmt=WPA-PSK
    scan_ssid=1
    id_str="${ssid}"
    priority=${priority}
}
`
    var toExec=`echo '${append}' | sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf`
    exec(toExec)
    exec("sudo wpa_cli reconfigure")
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

