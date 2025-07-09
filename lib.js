const crypto = require("crypto")
const fs = require('fs')
let { exec, execSync } = require('child_process')

//load and process config and environment variables
let config = require(__dirname + "/config.js")
config.ALIASES = config.ALIASES ?? {}
config.reverseAliases = {}
for (let id in config.ALIASES) {
  config.reverseAliases[config.ALIASES[id]] = id
}

if(config.KEY_LOCATION){
  config.httpsOptions = {
    key: fs.readFileSync(config.KEY_LOCATION),
    cert: fs.readFileSync(config.CERT_LOCATION),
  }
} else {
  config.httpsOptions = {}
}
const PYTHON_EXECUTABLE = config.PYTHON_EXECUTABLE || '/home/pi/.env/bin/python3'

let filePath = config.PIXELS || "rhombicosidodecahedron"
if (filePath.startsWith("/pixels/"))
  filePath = filePath.slice(8)
if (filePath.endsWith(".json"))
  filePath = filePath.slice(0, filePath.length - 5)
if (!filePath.includes("/"))
  filePath = filePath + "/" + filePath
filePath = `/pixels/${filePath}.json`
config.PIXELS = filePath

if (!config.DEV_MODE && config.TIMEZONE) {
  execute(`timedatectl set-timezone ${config.TIMEZONE}`)
}

//add timestamps to logs
const clog = console.log
const cerr = console.error
console.log = function(){
  clog(new Date().toISOString(), ...arguments)
}
console.error = function(){
  cerr(new Date().toISOString(), ...arguments)
}

process.on('uncaughtException', function(err, origin) {
  console.error('Uncaught exception: ', err, origin)
  process.exit(1)
})


function execute(command){
  let isRoot
  try {
    isRoot = execSync("whoami").toString().toLowerCase().indexOf("root") >= 0
  } catch(error) {
    isRoot = false
  }
  return new Promise(resolve => {
    exec((isRoot ? "" : "sudo ") + command,
    (error, stdout, stderr) => {
      if(error){
        console.error("execute Error:", error, stdout, stderr)
      }
      resolve(stdout.toString() + " " + stderr.toString())
    })
  })
}

async function checkConnection() {
  let output = await execute('curl -Is -H "Cache-Control: no-cache, no-store;Pragma: no-cache"  "http://www.google.com/?$(date +%s)" | head -n 1')
  let connected = output.indexOf("200") >= 0
  return connected
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function restartOrbitron(){
  if (config.DEV_MODE) return

  console.log(new Error().stack) // Useful for debugging
  let pm2Running = (await execute("ps -ea")).trim().indexOf("pm2") >= 0
  if(pm2Running){
    execute("pm2 restart all")
  } else {
    execute("reboot")
  }
}


async function processAdminCommand(jsonData) {
  if (config.ORB_KEY) {
    let expectedHash = await sha256(jsonData.message + config.ORB_KEY.toLowerCase())
    if (jsonData.hash != expectedHash) return null
  }
  try {
    jsonData = JSON.parse(jsonData.message)
  } catch { return null }
  if (jsonData.timestamp < Date.now() - 10*1000) return null
  return jsonData
}
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);                    
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}


function noCorsHeader(response, contentType) {
  response.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': "*",
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    "Access-Control-Allow-Headers": "x-requested-with, Content-Type, origin, authorization, accept, client-security-token",
    'Access-Control-Allow-Credentials': 'true',
  })
}

module.exports = {
  execute, checkConnection, delay, config, PYTHON_EXECUTABLE, restartOrbitron, processAdminCommand, noCorsHeader
}


// Extensions

Array.prototype.remove = function(elem) {
  let index = this.indexOf(elem)
  if (index >= 0) {
    this.splice(index, 1)
  }
  // Just ignore if not in array
}
Array.prototype.last = function(val) {
  if (val === undefined) val = 1
  return this[this.length - val]
}
