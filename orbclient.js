const WebSocket = require('ws')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./pako.min.js')

var ws = null
var rawPixels = ""
var gameState = {}
var loopTime = Date.now()
var frameTime = 1/30 * 1000


var config=require(__dirname + "/config.js")
console.log(config)

function startWebsocket() {
  if(ws) {
    return // Already trying to establish a connection
  }
  try {
    ws = new WebSocket(`ws://orbitron.games:8888`)
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
  } catch(e) {
    console.log(e)
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

const audio_process = spawn('python3', ['-u', `${__dirname}/orbclientaudio.py`],{env:{...process.env,...config}});
audio_process.stdout.on('data', data => {
  message = data.toString().trim()
  if (message) {
    console.log(message)
  }
});
audio_process.stderr.on('data', data => {
  message = data.toString().trim()
  if(message){
    console.log(message)
  }
});
audio_process.on('uncaughtException', function(err) {
  console.log('Caught python exception: ' + err);
});


function loop() {
  let dt = Date.now() - loopTime
  if(dt >= frameTime) {
    loopTime = loopTime + frameTime
    startWebsocket()
    if(rawPixels) {
      let rawPixelsString = pako.inflate(rawPixels, {to: 'string'})
      //console.log("RAW PIXELS AS HEX", rawPixelsString)
      //console.log("RAW PIXELS INFLATED", rawPixelsInflated)
      try {
        python_process.stdin.write(rawPixelsString + "\n", "utf8")
      } catch(e) {
        console.log(e)
      }
    }
    if(gameState) {
      try {
        audio_process.stdin.write(JSON.stringify(gameState) + "\n", "utf-8")
      } catch(e) {
        console.log(e)
      }
    }
  }
}
setInterval(loop, frameTime/4)

