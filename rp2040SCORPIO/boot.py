import usb_cdc 
import usb_hid
import usb_midi
usb_midi.disable()
usb_hid.disable()
usb_cdc.enable(console=True,data=True)