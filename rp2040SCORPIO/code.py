import adafruit_ticks
import time
import board
from board import *
import busio
import rp2pio
import adafruit_pioasm


first_led_pin = NEOPIXEL0
max_uart_buf_size = 4092

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
    return rp2pio.StateMachine(
                assembled,
                frequency=800_000 * 16,
                first_out_pin=first_led_pin,
                out_pin_count=num_strands,
                first_set_pin=first_led_pin,
                auto_pull=False,
                out_shift_right=num_strands != 1,
            )

def transmit(sm, num_strands, buffer):
    while sm.pending:
        pass
    if num_strands == 1:
        sm.background_write(buffer, swap=True)
    #else:
    #    bitops.bit_transpose(buffer, self._pixels, self._num_strands)
    #    self._sm.background_write(self._data32)

uart = busio.UART(TX, RX, baudrate=2000000)
state_machine = None
strand_count = -1
pixels_per_strand = -1
total_pixel_bytes = -1
bpp = 3

while True:
    sync = uart.read(1)
    if sync != 0xff:
        continue
    else:
        while strand_count == -1:
            uart.write([0xf8])
            response = uart.read(1)
            if response[0] != 0xf8:
                continue
            count = uart.read(1)
            strand_count = count[0]
        
        while pixels_per_strand == -1:
            uart.write([0xf0])
            response = uart.read(1)
            if response[0] != 0xf0:
                continue
            count = uart.read(2)
            pixels_per_strand = (count[0]<<8) + count[1]
        
        if state_machine == None:
            total_pixel_bytes = strand_count * pixels_per_strand * bpp
            state_machine = initialize_state_machine(strand_count)
        
        uart.write([0xff])
        
    #t0 = adafruit_ticks.ticks_ms()
    if total_pixel_bytes <= max_uart_buf_size:
        pixels = uart.read(total_pixel_bytes)
    else:
        pixels = []
        remaining = total_pixel_bytes
        while remaining > 0:
            to_read = min(max_uart_buf_size,remaining)
            data = uart.read(to_read)
            if data and len(data) == to_read:
                remaining -= to_read
                pixels.append(data)
            else:
                break

    if pixels and len(pixels) == total_pixel_bytes:
        try:
            transmit(state_machine, strand_count, memoryview(pixels).cast("L"))
        except Exception:
            pass # do something here?
    #print(adafruit_ticks.ticks_ms() - t0)
