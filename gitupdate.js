let { execute, checkConnection, timeUntilHour } = require('./lib')

async function checkForUpdates(){
  let connected = await checkConnection()
  let nextUpdateTime = connected ? timeUntilHour(2) : 1e4
  //console.log("hours until 2am", timeUntilHour(2) / 3600000)
  setTimeout(() => {
    checkForUpdates()
  }, nextUpdateTime);
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

if(!module.parent){
  checkForUpdates()
}

module.exports = {
  checkForUpdates, pullAndRestart
}