let { exec, execSync } = require('child_process')

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

function timeUntilHour(hour) {
  if (hour < 0 || hour > 24) throw new Error("Invalid hour format!");

  const now = new Date();
  const target = new Date(now);

  if (now.getHours() >= hour)
      target.setDate(now.getDate() + 1);

  target.setHours(hour);
  target.setMinutes(0);
  target.setSeconds(0);
  target.setMilliseconds(0);

  return target.getTime() - 
  now.getTime();
}

module.exports = {
  execute, checkConnection, timeUntilHour
}