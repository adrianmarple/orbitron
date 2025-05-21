let { execute, config, delay } = require('./lib')

async function fixExternalWifi(){
  let repeat = false
  let blacklist_present = (await execute("ls /etc/modprobe.d/")).includes("external_wifi_blacklist.conf")
  if(config.EXTERNAL_WIFI){
    if((await execute("usbreset || true")).toLowerCase().includes("disk")){
      console.log("USB WIFI showing as DISK, changing USB mode")
      let vendor_product = (await execute("(usbreset || true) | grep -i disk")).split(" ").filter(function(data){ return data.includes(":") })[0].split(":")
      console.log(vendor_product)
      console.log((await execute(`usb_modeswitch -s 10 -K -v ${vendor_product[0]} -p ${vendor_product[1]} -V 0bda -P c820`)))
      if((await execute("usbreset || true")).toLowerCase().includes("disk")){
        repeat = true
        console.log("Failed to reset USB WIFI! Still showing as DISK.")
      } else {
        console.log("Successfully reset USB WIFI")
        await delay(2000)
      }
    }

    let has_two_wifis = (await execute("ifconfig")).includes("wlan1")
    if(has_two_wifis){
      console.log("Internal wifi is enabled when it shouldn't be")
      await execute("cp -f /home/pi/orbitron/external_wifi_blacklist.conf /etc/modprobe.d/")
      if(!blacklist_present){
        console.log("blacklist not present, copying and rebooting")
        await execute("reboot")
      } else {
        console.log("blacklist already present!")
      }
    }
  } else {
    if(blacklist_present){
      console.log("Wifi blacklist present when it shouldn't be, removing and rebooting.")
      await execute("rm -f /etc/modprobe.d/external_wifi_blacklist.conf")
      await execute("reboot")
    }
  }
  if(repeat){
    setTimeout(fixExternalWifi, 15 * 1000)
  }
}

module.exports = {
  fixExternalWifi
}
