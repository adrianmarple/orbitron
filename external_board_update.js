let { execute, config } = require('./lib')

if(config.EXTERNAL_PIXEL_BOARD){
  console.log("Attempting to update external board")
  let info = execute("lsblk -fp | grep CIRCUITPY").trim().split(' ')
  let label_index = info.indexOf("CIRCUITPY")
  if(label_index < 0) return

  let uuid = ""
  for (let i = label_index; i < info.length; i++) {
    let val = info[i].trim()
    if(val){
      uuid = val
      break
    }
  }
  if(uuid){
    console.log("Found UUID: ", uuid)
    execute("sudo mkdir -p /mnt/external_board")
    execute("sudo chown -R pi:pi /mnt/external_board")
    execute(`sudo mount UUID=${uuid} /mnt/external_board`)
    execute("sudo cp -f /home/pi/orbitron/rp2040SCORPIO/code.py /mnt/external_board/code.py")
    execute("sudo umount /mnt/external_board")
    console.log("external board updated!")
  }
}