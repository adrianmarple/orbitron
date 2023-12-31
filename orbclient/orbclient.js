const PYTHON_EXECUTABLE = '/home/pi/.env/bin/python3'

const WebSocket = require('ws')
const process = require('process')
const { spawn, exec } = require('child_process')
const pako = require('./thirdparty/pako.min.js')

//add timestamps to logs
const clog = console.log
const cerr = console.error
console.log = function(){
  clog(new Date().toISOString(), ...arguments)
}
console.error = function(){
  cerr(new Date().toISOString(), ...arguments)
}


function handleKill(signal){
  console.log("GOT KILL SIGNAL")
  if(audio_process){
    audio_process.kill()
  }
  if(python_process){
    python_process.kill()
  }
  process.exit()
}

process.on('SIGINT', handleKill);
process.on('SIGTERM', handleKill);
process.on('SIGHUP', handleKill);

var ws = null

var config=require(__dirname + "/config.js")
console.log(config)

var lastMessage = Date.now()

function startWebsocket() {
  if(ws && Date.now() - lastMessage < 10000) {
    return // Already trying to establish a connection
  }
  try {
    console.log("trying to connect to server...")
    lastMessage = Date.now()
    ws = new WebSocket(`wss://orbitron.games:8888`)
    ws.binaryType = "arraybuffer"
    ws.onmessage = event => {
      lastMessage = Date.now()
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
    ws.onopen = event => {
      console.log("Connected to server")
    }
  } catch(e) {
    console.log(e)
    ws = null
  }
}

const python_process = spawn(PYTHON_EXECUTABLE, ['-u', `${__dirname}/orbclient.py`],{env:{...process.env,...config}});
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

const audio_process = spawn(PYTHON_EXECUTABLE, ['-u', `${__dirname}/orbclientaudio.py`],{env:{...process.env,...config}});
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

