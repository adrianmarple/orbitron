const WebSocket = require('ws')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./pako.min.js')

var ws = null
var rawPixels = ""
var gameState = {}
var loopTime = 0
var frameTime = 1/30 * 1000


var config=require(__dirname + "/config.js")
console.log(config)

function startWebsocket() {
  if(ws) {
    return // Already trying to establish a connection
  }
  ws = new WebSocket(`ws://165.227.0.44:8888`)
  ws.binaryType = "arraybuffer"
  ws.onmessage = event => {
    let data = event.data
    if(typeof data === "string"){
      try {
        gameState = JSON.parse(data)
      } catch(e) {
        console.log(e)
      }
    } else {
      rawPixels = event.data
    }
  }
  ws.onclose = event => {
    console.log("CLOSE")
    ws = null
  }
  ws.onerror = event => {
    console.error("ERROR",event)
    ws = null
  }
}

const python_process = spawn('python3', ['-u', `${__dirname}/orbclient.py`],{env:{...process.env,...config}});
python_process.stdout.on('data', data => {
  message = data.toString().trim()
  if (message) {
    console.log(message)
  }
});
python_process.stderr.on('data', data => {
  message = data.toString().trim()
  if(message){
    console.log(message)
  }
});
python_process.on('uncaughtException', function(err) {
  console.log('Caught python exception: ' + err);
});

function loop() {
  let dt = Date.now() - loopTime
  if(dt >= frameTime) {
    loopTime = Date.now()
    if(rawPixels) {
      let rawPixelsString = Buffer.from(pako.inflate(rawPixels)).toString('hex')
      //console.log("RAW PIXELS AS HEX", rawPixelsString)
      try {
        python_process.stdin.write(rawPixelsString + "\n", "utf8")
      } catch(e) {
        console.log(e)
      }
    }
  }
}
setInterval(loop, 1)
startWebsocket()

