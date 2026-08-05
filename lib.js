const crypto = require("crypto")
const fs = require('fs')
const path = require('path')
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
const PYTHON_EXECUTABLE = fs.existsSync(`${__dirname}/.venv/bin/python3`)
    ? `${__dirname}/.venv/bin/python3` : '/home/pi/.env/bin/python3'

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


// pi requires IANA timezones while arduino requires POSIx
// TIMEZONE accepts both and converts as needed
const ZONEINFO_DIR = "/usr/share/zoneinfo"
const IANA_NAME_REGEX = /^[A-Za-z][A-Za-z0-9_+-]*(\/[A-Za-z0-9_+.-]+)*$/

// "America/Los_Angeles" -> "PST8PDT,M3.2.0,M11.1.0" (null if unresolvable).
function ianaToPosix(zone) {
  if (typeof zone != "string") return null
  zone = zone.trim()
  // Validate before touching the filesystem (this is reachable from an HTTP path).
  // The regex allows "." inside later segments, so ".." needs its own rejection.
  if (!IANA_NAME_REGEX.test(zone)) return null
  if (zone.split("/").includes("..")) return null

  let contents
  try {
    contents = fs.readFileSync(path.join(ZONEINFO_DIR, zone)).toString("latin1")
  } catch {
    return null
  }
  // The footer is the last newline-delimited line. TZif v1-only files have none.
  let end = contents.lastIndexOf("\n")
  if (end < 1) return null
  let start = contents.lastIndexOf("\n", end - 1)
  if (start < 0) return null
  return contents.slice(start + 1, end).trim() || null
}

// POSIX -> IANA is many-to-one: 26 zones share "EST5EDT,M3.2.0,M11.1.0" and 34 share
// "CET-1CEST,M3.5.0,M10.5.0/3". Scanning alphabetically would answer America/Detroit
// and Africa/Ceuta, so check canonical zones first. Equivalent zones have identical
// rules, so where several match, list order is purely cosmetic.
const PREFERRED_ZONES = [
  "America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Chicago",
  "America/New_York", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo", "America/Bogota",
  "America/Argentina/Buenos_Aires", "Europe/London", "Europe/Dublin", "Europe/Lisbon",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam",
  "Europe/Stockholm", "Europe/Warsaw", "Europe/Athens", "Europe/Helsinki",
  "Europe/Kyiv", "Europe/Moscow", "Europe/Istanbul", "Africa/Johannesburg",
  "Africa/Cairo", "Africa/Lagos", "Africa/Nairobi", "Asia/Jerusalem", "Asia/Dubai",
  "Asia/Tehran", "Asia/Karachi", "Asia/Kolkata", "Asia/Kathmandu", "Asia/Dhaka",
  "Asia/Bangkok", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Tokyo",
  "Asia/Seoul", "Australia/Perth", "Australia/Brisbane", "Australia/Adelaide",
  "Australia/Sydney", "Pacific/Auckland", "UTC",
]

// Every region directory and zone file in zoneinfo is capitalized; this skips the
// *.tab metadata, posixrules, and the legacy lowercase aliases.
function listZoneinfoZones(dir = ZONEINFO_DIR, prefix = "") {
  let zones = []
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return zones
  }
  entries.sort((a, b) => a.name < b.name ? -1 : 1)
  for (let entry of entries) {
    if (!/^[A-Z]/.test(entry.name)) continue
    if (entry.isSymbolicLink()) continue
    let name = prefix ? prefix + "/" + entry.name : entry.name
    if (entry.isDirectory()) {
      zones = zones.concat(listZoneinfoZones(path.join(dir, entry.name), name))
    } else if (name.includes("/")) {
      zones.push(name)
    }
  }
  return zones
}

// "PST8PDT,M3.2.0,M11.1.0" -> "America/Los_Angeles" (null if nothing matches).
function posixToIana(posix) {
  if (typeof posix != "string") return null
  posix = posix.trim()
  if (!posix) return null
  for (let zone of PREFERRED_ZONES) {
    if (ianaToPosix(zone) == posix) return zone
  }
  // Only exotic zones reach the full scan; it costs ~10ms for all 553 of them.
  for (let zone of listZoneinfoZones()) {
    if (ianaToPosix(zone) == posix) return zone
  }
  return null
}

// timedatectl accepts IANA names only, but TIMEZONE may hold a POSIX string
// so normalize before handing it to the shell.
function setSystemTimezone(tz) {
  let zone = tz.trim()
  // Any name zoneinfo knows is usable as-is, which also covers single-segment zones
  // like "UTC" that a "contains /" test would misclassify. Guard on the directory
  // existing so a system without tzdata still passes a plain name straight through.
  if (!ianaToPosix(zone) && fs.existsSync(ZONEINFO_DIR)) {
    let resolved = posixToIana(zone)
    if (!resolved) {
      console.error(`TIMEZONE "${zone}" is neither an IANA name nor a recognized POSIX TZ string; leaving system timezone unchanged`)
      return
    }
    console.log(`TIMEZONE "${zone}" resolved to ${resolved}`)
    zone = resolved
  }
  // TIMEZONE can arrive from a restored backup, so never interpolate it unvalidated.
  if (!IANA_NAME_REGEX.test(zone) || zone.split("/").includes("..")) {
    console.error(`TIMEZONE "${zone}" is not a valid timezone name; leaving system timezone unchanged`)
    return
  }
  execute(`timedatectl set-timezone ${zone}`)
}

if (!config.DEV_MODE && config.TIMEZONE) {
  setSystemTimezone(config.TIMEZONE)
}

module.exports = {
  execute, checkConnection, delay, config, PYTHON_EXECUTABLE, restartOrbitron, processAdminCommand, noCorsHeader,
  ianaToPosix, posixToIana,
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
