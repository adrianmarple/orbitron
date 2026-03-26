"""BCM283x NeoPixel / APA102 / External Board Driver"""
import atexit
import numpy as np
import sys
import json
import os
import zlib

config = json.loads(os.getenv("CONFIG"))

LED_STRIP_TYPE = config.get("LED_STRIP_TYPE", "WS2812B").upper()

match LED_STRIP_TYPE:
    case "APA102":
        from apa102_pi.driver import APA102 as _APA102Driver  # type: ignore
    case "EXTERNAL":
        import serial  # type: ignore
    case _:  # WS2812B
        # NOTE: Writing takes 10µs per byte no matter what (according to https://github.com/jgarff/rpi_ws281x/blob/1f47b59ed603223d1376d36c788c89af67ae2fdc/ws2811.c#L1130)
        import digitalio  # type: ignore
        import board  # type: ignore
        import _rpi_ws281x as ws  # type: ignore

        # pylint: disable=redefined-outer-name,too-many-branches,too-many-statements
        # pylint: disable=global-statement,protected-access
        LED_CHANNEL = 0
        LED_FREQ_HZ = 800000  # Frequency of the LED signal.  We only support 800KHz
        LED_DMA_NUM = 10  # DMA channel to use, can be 0-14.
        LED_BRIGHTNESS = 255  # We manage the brightness in the neopixel library
        LED_INVERT = 0  # We don't support inverted logic

        gpio = digitalio.DigitalInOut(board.D18)
        gpio.direction = digitalio.Direction.OUTPUT

_led_strip = None
_apa102_strip = None
external_board = None
external_board_logs = None


def start_pixels(num_pixels):
    match LED_STRIP_TYPE:
        case "EXTERNAL":
            _connect_external_board()
            _connect_external_board_logging()
        case "APA102":
            global _apa102_strip
            _apa102_strip = _APA102Driver(
                num_led=num_pixels,
                global_brightness=config.get("APA102_BRIGHTNESS", 31),
                mosi=config.get("APA102_MOSI_PIN", 10),
                sclk=config.get("APA102_SCLK_PIN", 11),
                order='rgb',
            )
            atexit.register(_apa102_strip.cleanup)
        case _:  # WS2812B
            global _led_strip
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
            ws.ws2811_channel_t_count_set(channel, num_pixels)  # we manage 4 vs 3 bytes in the library
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
            atexit.register(lambda: (ws.ws2811_fini(_led_strip), ws.delete_ws2811_t(_led_strip)))

def _connect_external_board():
    global external_board
    _close_external_board()
    while external_board is None:
        try:
            external_board = serial.Serial("/dev/serial/by-id/usb-Adafruit_Feather_RP2040_Scorpio_DF625857C745162E-if02", timeout=0.6, write_timeout=0.6)
        except Exception as e:
            print("ERROR CONNECTING TO EXTERNAL BOARD ", e, file=sys.stderr)
            print("will retry...", file=sys.stderr)
            _close_external_board()

def _close_external_board():
    global external_board
    if external_board:
        external_board.close()
        external_board = None

def _connect_external_board_logging():
    global external_board_logs
    _close_external_board_logging()
    while external_board_logs is None:
        try:
            external_board_logs = serial.Serial("/dev/serial/by-id/usb-Adafruit_Feather_RP2040_Scorpio_DF625857C745162E-if00")
        except Exception as e:
            print("ERROR CONNECTING TO EXTERNAL BOARD LOGGING", e, file=sys.stderr)
            print("will retry...", file=sys.stderr)
            _close_external_board_logging()

def _close_external_board_logging():
    global external_board_logs
    if external_board_logs:
        external_board_logs.close()
        external_board_logs = None

def display_pixels(pixels):
    match LED_STRIP_TYPE:
        case "EXTERNAL":
            _write_external(pixels)
        case "APA102":
            _write_apa102(pixels)
        case _:  # WS2812B
            _write_ws2812b(pixels)

def _write_external(pixels):
    try:
        pixels[:, [0,1]] = pixels[:, [1,0]]
        pixel_data = np.clip(np.uint8(pixels),0,0xfe).tobytes()
        crc = zlib.crc32(pixel_data).to_bytes(4, 'big', signed=False)
        strand_count = config.get("STRAND_COUNT")
        pixels_per_strand = config.get("PIXELS_PER_STRAND")
        out = bytearray([0xff,0x22,0xee,0x11]) + strand_count.to_bytes(1,'big') + pixels_per_strand.to_bytes(2,'big') + crc + pixel_data
        external_board.write(out)
    except Exception as e:
        print("Error writing to external board %s" % e, file=sys.stderr)
        _connect_external_board()
    if external_board_logs:
        try:
            logs = external_board_logs.read_all()
            if logs:
                print("EXTERNAL BOARD: %s" % logs.decode(), file=sys.stderr)
        except Exception as e:
            print("Error writing to external board logs %s" % e, file=sys.stderr)
            _connect_external_board_logging()

def _write_apa102(pixels):
    for i, (r, g, b) in enumerate(pixels):
        _apa102_strip.set_pixel(i, int(r), int(g), int(b))
    _apa102_strip.show()

def _write_ws2812b(pixels):
    pixels = np.uint32(pixels)
    buf = (pixels[:,1]*(1<<16) + pixels[:,0]*(1<<8) + pixels[:,2]).tolist()

    channel = ws.ws2811_channel_get(_led_strip, LED_CHANNEL)
    if gpio._pin.id != ws.ws2811_channel_t_gpionum_get(channel):
        raise RuntimeError("Raspberry Pi neopixel support is for one strip only!")

    for i in range(len(buf)):
        ws.ws2811_led_set(channel, i, buf[i])

    resp = ws.ws2811_render(_led_strip)
    if resp != ws.WS2811_SUCCESS:
        message = ws.ws2811_get_return_t_str(resp)
        raise RuntimeError(
            "ws2811_render failed with code {0} ({1})".format(resp, message)
        )

