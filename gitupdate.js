let { exec, execSync } = require('child_process')
let runDirectly = !module.parent

function timeUntilHour(hour) {
  if (hour < 0 || hour > 24) throw new Error("Invalid hour format!")

  const now = new Date()
  const target = new Date(now)

  if (now.getHours() >= hour) {
      target.setDate(now.getDate() + 1)
  }
  target.setHours(hour)
  target.setMinutes(0)
  target.setSeconds(0)
  target.setMilliseconds(0)

  return target.getTime() - now.getTime()
}

// Copied from lib, but we don't want any internal dependencies for this file
function execute(command){
  return new Promise(resolve => {
    let isRoot
    try {
      isRoot = execSync("whoami").toString().toLowerCase().indexOf("root") >= 0
    } catch(error) {
      isRoot = false
    }
    exec((isRoot ? "" : "sudo ") + command,
    (error, stdout, stderr) => {
      if(error){
        console.error("execute Error:", error, stdout, stderr)
      }
      resolve(stdout.toString() + " " + stderr.toString())
    })
  })
}

async function checkForUpdates(){
  let output = await execute('curl -Is -H "Cache-Control: no-cache, no-store;Pragma: no-cache"  "http://www.google.com/?$(date +%s)" | head -n 1')
  let connected = output.indexOf("200") >= 0
  if(!runDirectly){
    let nextUpdateTime = connected ? timeUntilHour(2) : 1e4
    //console.log("hours until 2am", timeUntilHour(2) / 3600000)
    setTimeout(() => {
      checkForUpdates()
    }, nextUpdateTime)
  }
  if(!connected) return
  pullAndRestart()
}

async function pullAndRestart() {
  await execute("git config pull.ff only")
  let output = (await execute("git pull")).toLowerCase()
  if(output.indexOf("already up to date") >= 0){
    console.log("Already has latest code from git")
  } else if(output.indexOf("fatal") >= 0){
    console.log("Git pull failed: " + output)
  } else if(output.indexOf("fast-forward") >= 0 || output.indexOf("files changed") >= 0){
    console.log("Has git updates, restarting!")
    execute("pm2 restart all")
  } else {
    console.error("Inconclusive git pull results: ", output)
  }
}

if(runDirectly){
  checkForUpdates()
}

module.exports = {
  checkForUpdates, pullAndRestart
}
