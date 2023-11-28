# SPDX-FileCopyrightText: 2022 Jeff Epler
#
# SPDX-License-Identifier: Unlicense

import adafruit_ticks
from adafruit_neopxl8 import NeoPxl8
import time
import board
from board import *
import busio
import digitalio
from adafruit_bus_device.spi_device import SPIDevice
import rp2pio
import adafruit_pioasm


# Customize for your strands here
num_strands = 1
first_led_pin = NEOPIXEL0

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

def transmit(buffer):
    while sm.pending:
        pass
    if num_strands == 1:
        sm.background_write(buffer, swap=True)
    #else:
    #    bitops.bit_transpose(buffer, self._pixels, self._num_strands)
    #    self._sm.background_write(self._data32)

uart = busio.UART(TX, RX, baudrate=2000000)

while True:
    t0 = adafruit_ticks.ticks_ms()
    data = uart.read(4092)
    if data:
        try:
            transmit(memoryview(data).cast("L"))
        except Exception:
            pass # do something here?
    print(adafruit_ticks.ticks_ms() - t0)
