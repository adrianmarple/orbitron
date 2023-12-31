const PYTHON_EXECUTABLE = '/home/pi/.env/bin/python3'
let { exec, execSync } = require('child_process')

//load and process config and environment variables
let config = require(__dirname + "/config.js")
if(config.KEY_LOCATION){
  config.httpsOptions = {
    key: fs.readFileSync(config.KEY_LOCATION),
    cert: fs.readFileSync(config.CERT_LOCATION),
  }
} else {
  config.httpsOptions = {}
}

console.log(config)

let filePath = config.PIXELS || "rhombicosidodecahedron"
if (filePath.startsWith("/pixels/"))
  filePath = filePath.slice(8)
if (filePath.endsWith(".json"))
  filePath = filePath.slice(0, filePath.length - 5)
if (!filePath.includes("/"))
  filePath = filePath + "/" + filePath
filePath = `/pixels/${filePath}.json`
config.PIXELS = filePath

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

module.exports = {
  execute, checkConnection, delay, config, PYTHON_EXECUTABLE
}