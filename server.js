#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const process = require('process')
const { spawn } = require('child_process')
const SimpleSignalClient = require('simple-signal-client') 
const wrtc = require('wrtc')
const { io } = require("socket.io-client");

const NO_TIMEOUT = process.argv.includes('-t')
const INSTALLATION = process.env.INSTALLATION || "debug"
const KEY = process.env.ORBITRON_KEY || "debug"
const SWITCHBOARD = process.env.SWITCHBOARD || "https://super-orbitron.herokuapp.com/"

let GAME = "bomberman"
for (let arg of process.argv.slice(2)) {
    if (arg[0] !== '-') {
        GAME = arg
        break
    }
}

//WebRTC connection to switchboard
const socket = io(SWITCHBOARD);
var signalClient = new SimpleSignalClient(socket)
signalClient.on('discover', (allIDs) => {
    //console.log("DISCOVER",allIDs)
})

signalClient.on('request', async (request) => {
    try {
      const { peer } = await request.accept(null,{wrtc:wrtc}) // Accept the incoming request
      //console.log("REQUEST",request,peer)
      connectionQueue.push(peer)
      bindDataEvents(peer)
      upkeep() // Will claim player if available
    } catch (e) {
      console.error(e)
    }
})

function bindDataEvents(peer) {
    peer.on('data', data => {
        //console.log("DATA",peer.pid,peer._id,!peer.pid,!connections[peer.pid])
        if (!typeof(peer.pid)==="number" || !connections[peer.pid]) {
            return
        }
        content = JSON.parse(data)
        content.self = peer.pid
        peer.lastActivityTime = Date.now()
        //console.log("DATA CONTENT",content)
        python_process.stdin.write(JSON.stringify(content) + "\n", "utf8")
    })

    peer.on('close', () => {
        //console.log("CLOSE",peer.pid,peer._id)
        release = { self: peer.pid, type: "release" }
        python_process.stdin.write(JSON.stringify(release) + "\n", "utf8")
        if (typeof(peer.pid)==="number" && connections[peer.pid]) {
            delete connections[peer.pid]
        } else {
            connectionQueue = connectionQueue.filter(elem => elem !== peer)
        }

    })
    peer.on('error', (err) => {
        console.error("ERROR",peer.pid,err)
    })
}

setInterval(upkeep, 1000)

function upkeep() {
    //refresh signal server
    signalClient.discover({installation:INSTALLATION,key:KEY})
    // Check for stale players
    if (gameState.players && !NO_TIMEOUT) {
        for (let peer of Object.values(connections)) {
            let player = gameState.players[peer.pid]
            if (!player.isReady && !player.isPlaying &&
                Date.now() - peer.lastActivityTime > 30*1000) { // 30 seconds
                //console.log("Player timed out.",peer._id, peer.pid,peer.lastActivityTime)
                peer.destroy("TIMEOUT")
            }
        }
    }

    let id = 0;
    for (let peer of [...connectionQueue]) {
        while (id < MAX_PLAYERS) {
            if (!connections[id]) {
                peer.pid=id
                peer.lastActivityTime = Date.now()
                connections[peer.pid] = peer
                claim = { self: peer.pid, type: "claim" }
                python_process.stdin.write(JSON.stringify(claim) + "\n", "utf8")
                connectionQueue = connectionQueue.filter(elem => elem !== peer)
                break;
            }
            id += 1;
        }
        if (id >= MAX_PLAYERS) {
            message = {...gameState}
            message.queuePosition = connectionQueue.indexOf(peer) + 1
            peer.send(JSON.stringify(message))
        }
    }
}

MAX_PLAYERS = 6
connections = {}
connectionQueue = []


// Communications with python script

gameState = {}

function broadcast(baseMessage) {
    gameState = baseMessage
    for (let id in connections) {
        baseMessage.self = id
        connections[id].send(JSON.stringify(baseMessage))
    }
    delete baseMessage.self
    for (let i = 0; i < connectionQueue.length; i++) {
        baseMessage.queuePosition = i + 1
        connectionQueue[i].send(JSON.stringify(baseMessage))
    }
}

const python_process = spawn('sudo', ['python3', '-u', `${__dirname}/main.py`]);
python_process.stdout.on('data', data => {
    message = data.toString()
    if (data[0] == 123) { // check is first char is '{'
        try {
            broadcast(JSON.parse(message));
        } catch(e) {
            console.error(e);
            console.error(message);
        }
    } else {
        message = message.slice(0, -1)
        if (message) {
            console.log(message)
        }
    }
});
python_process.stderr.on('data', data => {
    message = data.toString()
    if (!message.includes("underrun occurred")) {
        message = message.slice(0, -1)
        if (message) {
            console.log(message)
        }
    }
});

let start_message = { type: "start", game: GAME }
python_process.stdin.write(JSON.stringify(start_message) + "\n", "utf8")
