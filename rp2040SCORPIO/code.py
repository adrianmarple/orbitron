from time import sleep, time, localtime
from board import *
import rp2pio
import adafruit_pioasm
import usb_cdc
import bitops
import microcontroller
import binascii

first_led_pin = NEOPIXEL0

strand_count = -1
pixels_per_strand = -1
total_pixel_bytes = -1
state_machine = None
bpp = 3
pixels = None

sleep(1) # necessary to wait for usb init
usb = usb_cdc.data
boot_time = time()
total_num_glitches = 0
num_glitches = 0
current_minute = 0

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
    usb.timeout = 0.5
    usb.write_timeout = 0.5
    print("Parameters reset!")

def main():
    global num_glitches
    global total_num_glitches
    global current_minute
    reset()
    print("BOARD READY")
    while True:
        loopFailed = False
        loopThrew = False
        minute = int(((time() - boot_time)/60) % 60)
        if minute != current_minute:
            current_minute = minute
            num_glitches = 0
        try:
            loopFailed = do_loop()
        except Exception as e:
            loopThrew = True
            print("LOOP THREW EXCEPTION")
            print(e)
        if loopFailed or loopThrew:
            print("Loop Failed: %s  Loop Threw: %s" % (loopFailed, loopThrew))
            num_glitches = num_glitches + 1
            total_num_glitches = total_num_glitches + 1

            t = localtime(time())
            print("%s:%s num glitches this minute: %d" % (t.tm_hour, t.tm_min, num_glitches))

            dt = (time() - boot_time)/60
            if dt > 0:
                gpm = total_num_glitches / dt
                print("avg glitches per minute: %f" % gpm)

            if(num_glitches >= 15):
                print("15 GLITCHES IN A MINUTE, RESETTING BOARD")
                sleep(2)
                microcontroller.reset()
            elif loopThrew:
                reset()
    print("THIS SHOULD NEVER HAPPEN")

def do_loop():
    global strand_count
    global pixels_per_strand
    global total_pixel_bytes
    global state_machine
    global pixels

    if not usb.connected:
        print("No Serial Connection!")
        sleep(0.5)
        return True
    
    sync = usb.read(1)
    if not sync or sync[0] != 0xff:
        return False
    
    sync = bytearray(usb.read(3))
    if not sync or len(sync) < 3 or sync != bytearray([0x22,0xee,0x11]):
        usb.reset_input_buffer()
        print("Bad sync!")
        return True
            
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
        return True

    count = usb.read(2)
    if count and len(count) == 2 and (count[0] > 0 or count[1] > 0):
        value = (count[0]<<8) + count[1]
        if value >= 5000:
            print("INVALID PIXELS PER STRAND %d" % value)
        elif value != pixels_per_strand:
            pixels_per_strand = value
            print("PIXELS PER STRAND ", pixels_per_strand)        
            total_pixel_bytes = strand_count * pixels_per_strand * bpp
            print("TOTAL PIXEL BYTES ", total_pixel_bytes)
            pixels = bytearray(total_pixel_bytes)    
    else:
        print("PIXELS PER STRAND ERROR", count)
        return True
    
    return process_frame()

def process_frame():
    global pixels
    expected_crc = bytearray(usb.read(4))
    read = usb.readinto(pixels)
    crc = binascii.crc32(pixels).to_bytes(4, 'big', signed=False)

    if crc != expected_crc:
        print("CRC mismatch, skipping frame:  expected %s - got %s" % (expected_crc, crc))
        return True

    if read != total_pixel_bytes:
        print("skipping frame, didn't read enough bytes: expected %d - got %d" % (total_pixel_bytes, read))
        return True        

    transmit(state_machine, strand_count, pixels)
    return False

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