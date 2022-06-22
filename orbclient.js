const WebSocket = require('ws')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./pako.min.js')

var ws = null

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
          audio_process.stdin.write(data + "\n", "utf-8")
        } catch(e) {
          console.log(e)
        }
      } else {
        try {
          let rawPixelsString = pako.inflate(data, {to: 'string'})
          python_process.stdin.write(rawPixelsString + "\n", "utf8")
        } catch(e) {
          console.log(e)
        }

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
  startWebsocket()
}
setInterval(loop, 1000)

