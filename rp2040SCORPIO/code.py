from adafruit_ticks import ticks_ms
import time
from board import *
import rp2pio
import adafruit_pioasm
import usb_cdc
import bitops
import supervisor
from microcontroller import watchdog
from watchdog import WatchDogMode
import adafruit_hashlib as hashlib

first_led_pin = NEOPIXEL0

strand_count = -1
pixels_per_strand = -1
total_pixel_bytes = -1
state_machine = None
bpp = 3
pixels = None

time.sleep(1) # necessary to wait for usb init
usb = usb_cdc.data
boot_time = ticks_ms()
num_glitches = 0
md5 = hashlib.md5()

def reset():
    global strand_count
    global pixels_per_strand
    global total_pixel_bytes
    global state_machine
    global pixels
    strand_count = -1
    pixels_per_strand = -1
    total_pixel_bytes = -1
    pixels = None
    if state_machine:
        state_machine.deinit()
    state_machine = None
    usb.reset_input_buffer()
    usb.reset_output_buffer()
    usb.timeout = 0.1
    usb.write_timeout = 0

def main():
    # tc = 0
    # dt = 0
    reset()
    watchdog.timeout = 2
    watchdog.mode = WatchDogMode.RESET
    watchdog.feed()
    print("READY")
    while True:
        # t0 = ticks_ms()
        try:
            do_loop()
        except Exception as e:
            print(e)
            reset()
        # dt = (tc * dt + ticks_ms() - t0)/(tc+1)
        # tc += 1
        # if tc == 120:
        #     print("avg frame time last 120 frames: ", dt)
        #     tc = 0
        #     dt = 0


def do_loop():
    global strand_count
    global pixels_per_strand
    global total_pixel_bytes
    global state_machine
    global pixels

    if not usb.connected:
        print("No Sreial Connection!")
        time.sleep(0.1)
        watchdog.feed()
        return
    
    sync = usb.read(1)
    if not sync or sync[0] != 0xff:
        return
    sync = bytearray(usb.read(3))
    if not sync or len(sync) < 3 or sync != bytearray([0x11,0xff,0x11]):
        usb.reset_input_buffer()
        return
            
    count = usb.read(1)
    if count and count[0] > 0 and count[0] <= 8:
        value = count[0]
        if value != strand_count:
            reset()
            strand_count = value
            print("STRAND COUNT ", strand_count)
            state_machine = initialize_state_machine(strand_count)
    else:
        print("STRAND COUNT ERROR", count)
        return

    count = usb.read(2)
    if count and len(count) == 2 and (count[0] > 0 or count[1] > 0):
        value = (count[0]<<8) + count[1]
        if value != pixels_per_strand:
            pixels_per_strand = value
            print("PIXELS PER STRAND ", pixels_per_strand)        
            total_pixel_bytes = strand_count * pixels_per_strand * bpp
            print("TOTAL PIXEL BYTES ", total_pixel_bytes)
            pixels = bytearray(total_pixel_bytes)
    else:
        print("PIXELS PER STRAND ERROR", count)
        return
    
    process_frame()

def process_frame():
    global pixels
    global num_glitches
    hash_val = bytearray(usb.read(16))
    read = usb.readinto(pixels)
    md5.update(pixels)
    if bytearray(md5.digest()) != hash_val:
        print("HASH MISMATCH!")
        print(hash_val)
        print(md5.digest())

    if read != total_pixel_bytes:
        print("skipping frame, didn't read enough bytes: %d" % read)
        num_glitches = num_glitches + 1
        gpm = num_glitches / ((ticks_ms() - boot_time) / 60000)
        print("glitches per minute: %f" % gpm)
        return
    
    try:
        transmit(state_machine, strand_count, pixels)
        watchdog.feed()
    except Exception as e:
        print(e)

def transmit(sm, num_strands, buffer):
    if num_strands == 1:
        sm.background_write(memoryview(buffer).cast("L"), swap=True)
    else:
       out = bytearray([])
       bitops.bit_transpose(buffer, out, num_strands)
       sm.background_write(memoryview(out).cast("L"))

def initialize_state_machine(num_strands):
    _PROGRAM = """
    .program piopixl8
    top:
        mov pins, null      ; always-low part (last cycle is the 'pull ifempty' after wrap)
        pull block          ; wait for fresh data
        out y, 32           ; get count of NeoPixel bits

    ; NeoPixels are 800khz bit streams. We are choosing zeros as <312ns hi, 936 lo>
    ; and ones as <700 ns hi, 546 ns lo> and a clock of 16*800kHz, so the always-high
    ; time is 4 cycles, the variable time is 5 cycles, and the always-low time is 7 cycles
    bitloop:
        pull ifempty [1]     ; don't start outputting HIGH unless data is available (always-low part)
        mov pins, ~ null [3] ; always-high part
        {}                   ; variable part
        mov pins, null       ; always-low part (last cycle is the 'pull ifempty' after wrap)

        jmp y--, bitloop     ; always-low part

    ; A minimum delay is required so that the next pixel starts refreshing the front of the strands
        pull block
        out y, 32

    wait_reset:
        jmp y--, wait_reset
        jmp top
    """
    if num_strands == 8:
        variable_part = "out pins, 8 [4]      ; variable part"
    elif num_strands == 1:
        variable_part = "out pins, 1 [4]      ; variable part"
    else:
        variable_part = f"""
            out pins, {num_strands} [3]       ; variable part
            out x, {8-num_strands}            ; variable part
        """

    program = _PROGRAM.format(variable_part)
    assembled = adafruit_pioasm.assemble(program)
    sm = rp2pio.StateMachine(
                assembled,
                frequency=800_000 * 16,
                first_out_pin=first_led_pin,
                out_pin_count=num_strands,
                first_set_pin=first_led_pin,
                auto_pull=False,
                out_shift_right=num_strands != 1,
            )
    while sm.pending:
        pass
    return sm


main()