"""BCM283x NeoPixel / APA102 Driver"""
import atexit
import numpy as np
import sys
import json
import os

config = json.loads(os.getenv("CONFIG"))

LED_STRIP_TYPE = config.get("LED_STRIP_TYPE", "WS2812B").upper()

match LED_STRIP_TYPE:
    case "APA102":
        from apa102_pi.driver.apa102 import APA102 as _APA102Driver  # type: ignore
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


def start_pixels(num_pixels):
    match LED_STRIP_TYPE:
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

def display_pixels(pixels):
    match LED_STRIP_TYPE:
        case "APA102":
            _write_apa102(pixels)
        case _:  # WS2812B
            _write_ws2812b(pixels)

def _write_apa102(pixels):
    brightness_byte = 0xE0 | _apa102_strip.global_brightness
    # leds buffer layout: 4-byte start frame, then 4 bytes per pixel [brightness, b, g, r]
    n = len(pixels)
    buf = np.empty(n * 4, dtype=np.uint8)
    buf[0::4] = brightness_byte
    buf[1::4] = pixels[:, 2]  # blue
    buf[2::4] = pixels[:, 1]  # green
    buf[3::4] = pixels[:, 0]  # red
    _apa102_strip.leds[4:4 + n * 4] = buf.tolist()
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
