const PYTHON_EXECUTABLE = '/home/pi/.env/bin/python3'
let { exec, execSync } = require('child_process')

//load and process config and environment variables
let config = require(__dirname + "/config.js")
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
});

function isRoot() {
  try {
    return execSync("whoami").toString().toLowerCase().indexOf("root") >= 0
  } catch(error) {
    return false
  }
}

function execute(command){
  return new Promise((resolve,reject) => {
    exec((isRoot() ? "" : "sudo ") + command,
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
  return output.indexOf("200 OK") >= 0
};


module.exports = {
  execute, checkConnection, config, PYTHON_EXECUTABLE
}