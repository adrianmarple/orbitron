let { execute, config } = require('./lib')

async function update_external_board(){
  if(config.EXTERNAL_PIXEL_BOARD){
    console.log("Attempting to update external board")
    let info = (await execute("lsblk -fp | grep CIRCUITPY")).trim().split(' ')
    let label_index = info.indexOf("CIRCUITPY")
    if(label_index < 0) return

    let uuid = ""
    for (let i = label_index+1; i < info.length; i++) {
      let val = info[i].trim()
      if(val){
        uuid = val
        break
      }
    }
    if(uuid){
      console.log("Found UUID: ", uuid)
      await execute("mkdir -p /mnt/external_board")
      await execute("chown -R pi:pi /mnt/external_board")
      await execute(`mount UUID=${uuid} /mnt/external_board`)
      await execute("cp -f /home/pi/orbitron/rp2040SCORPIO/code.py /mnt/external_board/code.py")
      await execute("umount /mnt/external_board")
      console.log("external board updated!")
    }
  }
}

update_external_board()