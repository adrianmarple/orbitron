"""BCM283x NeoPixel Driver Class"""
import atexit
import digitalio
import board
import numpy as np
import _rpi_ws281x as ws
import sys
from time import time, sleep
from multiprocessing import Process, Pipe
import serial
import json
import os
import zlib

config = json.loads(os.getenv("CONFIG"))

# NOTE: Writing takes 10µs per byte no matter what (according to https://github.com/jgarff/rpi_ws281x/blob/1f47b59ed603223d1376d36c788c89af67ae2fdc/ws2811.c#L1130)

# LED configuration.
# pylint: disable=redefined-outer-name,too-many-branches,too-many-statements
# pylint: disable=global-statement,protected-access
LED_CHANNEL = 0
LED_FREQ_HZ = 800000  # Frequency of the LED signal.  We only support 800KHz
LED_DMA_NUM = 10  # DMA channel to use, can be 0-14.
LED_BRIGHTNESS = 255  # We manage the brightness in the neopixel library
LED_INVERT = 0  # We don't support inverted logic
LED_STRIP = None  # We manage the color order within the neopixel library

# a 'static' object that we will use to manage our PWM DMA channel
# we only support one LED strip per raspi
_led_strip = None
process_conn = None
external_board = None

gpio = digitalio.DigitalInOut(board.D18)
gpio.direction = digitalio.Direction.OUTPUT


def start_pixel_output_process():
    global process_conn
    parent_conn, child_conn = Pipe()
    process_conn = parent_conn
    p = Process(target=pixel_output_loop, args=(child_conn,))
    p.start()

def start_external_pixel_board():
    global external_board
    if config.get("EXTERNAL_PIXEL_BOARD"):
        if external_board:
            external_board.close()
            external_board = None
            sleep(2)
        while external_board == None:
            try:
                external_board = serial.Serial("/dev/serial/by-id/usb-Adafruit_Feather_RP2040_Scorpio_DF625857C745162E-if02", timeout=0.01)
                #print("BAUD RATES ", external_board.BAUDRATES, file=sys.stderr)
            except Exception as e:
                external_board = None
                print("ERROR CONNECTING TO EXTERNAL BOARD ", e, file=sys.stderr)
                print("will retry...", file=sys.stderr)
                sleep(1)

def pixel_output_loop(conn):
    print("Pixel process stared", file=sys.stderr)
    conn.send("started")
    while True:
        neopixel_write(conn.recv())
        conn.send("done")

def display_pixels(pixels):
    global external_board
    if external_board:
        try:
            pixels[:, [0,1]] = pixels[:, [1,0]]
            pixel_data = np.clip(np.uint8(pixels),0,0xfe).tobytes()
            crc = zlib.crc32(pixel_data).to_bytes(4, 'big', signed=False)
            strand_count = config.get("STRAND_COUNT")
            pixels_per_strand = config.get("PIXELS_PER_STRAND")
            out = bytearray([0xff,0x11,0xff,0x11]) + strand_count.to_bytes(1,'big') + pixels_per_strand.to_bytes(2,'big') + crc + pixel_data
            external_board.write(out)
        except Exception as e:
            print("error writing to external board", file=sys.stderr)
            print(e, file=sys.stderr)
            start_external_pixel_board()
        return
    pixels = np.uint32(pixels)
    buf = pixels[:,1]*(1<<16) + pixels[:,0]*(1<<8) + pixels[:,2]
    buf = buf.tolist()
    if process_conn:
        process_conn.recv()
        process_conn.send(buf)
    else:
        neopixel_write(buf)

def neopixel_write(buf):
    global _led_strip  # we'll have one strip we init if its not at first

    if _led_strip is None:
        # Create a ws2811_t structure from the LED configuration.
        # Note that this structure will be created on the heap so you
        # need to be careful that you delete its memory by calling
        # delete_ws2811_t when it's not needed.
        _led_strip = ws.new_ws2811_t()

        # Initialize all channels to off
        for channum in range(2):
            channel = ws.ws2811_channel_get(_led_strip, channum)
            ws.ws2811_channel_t_count_set(channel, 0)
            ws.ws2811_channel_t_gpionum_set(channel, 0)
            ws.ws2811_channel_t_invert_set(channel, 0)
            ws.ws2811_channel_t_brightness_set(channel, 0)

        channel = ws.ws2811_channel_get(_led_strip, LED_CHANNEL)

        # Initialize the channel in use
        LED_STRIP = ws.WS2811_STRIP_RGB
        ws.ws2811_channel_t_count_set(
            channel, len(buf)
        )  # we manage 4 vs 3 bytes in the library
        ws.ws2811_channel_t_gpionum_set(channel, gpio._pin.id)
        ws.ws2811_channel_t_invert_set(channel, LED_INVERT)
        ws.ws2811_channel_t_brightness_set(channel, LED_BRIGHTNESS)
        ws.ws2811_channel_t_strip_type_set(channel, LED_STRIP)

        # Initialize the controller
        ws.ws2811_t_freq_set(_led_strip, LED_FREQ_HZ)
        ws.ws2811_t_dmanum_set(_led_strip, LED_DMA_NUM)

        resp = ws.ws2811_init(_led_strip)
        if resp != ws.WS2811_SUCCESS:
            if resp == -5:
                raise RuntimeError(
                    "NeoPixel support requires running with sudo, please try again!"
                )
            message = ws.ws2811_get_return_t_str(resp)
            raise RuntimeError(
                "ws2811_init failed with code {0} ({1})".format(resp, message)
            )
        atexit.register(neopixel_cleanup)

    channel = ws.ws2811_channel_get(_led_strip, LED_CHANNEL)
    if gpio._pin.id != ws.ws2811_channel_t_gpionum_get(channel):
        raise RuntimeError("Raspberry Pi neopixel support is for one strip only!")

    # assign all colors!
    for i in range(len(buf)):
        ws.ws2811_led_set(channel, i, buf[i])

    resp = ws.ws2811_render(_led_strip)
    if resp != ws.WS2811_SUCCESS:
        message = ws.ws2811_get_return_t_str(resp)
        raise RuntimeError(
            "ws2811_render failed with code {0} ({1})".format(resp, message)
        )

def neopixel_cleanup():
    """Cleanup when we're done"""
    global _led_strip

    if _led_strip is not None:
        # Ensure ws2811_fini is called before the program quits.
        ws.ws2811_fini(_led_strip)
        # Example of calling delete function to clean up structure memory.  Isn't
        # strictly necessary at the end of the program execution here, but is good practice.
        ws.delete_ws2811_t(_led_strip)
        _led_strip = None
