let { execute, config, delay } = require('./lib')

async function fixExternalWifi(){
  let repeat = false
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
  }
  if(repeat){
    setTimeout(fixExternalWifi, 15 * 1000)
  }
}

module.exports = {
  fixExternalWifi
}
