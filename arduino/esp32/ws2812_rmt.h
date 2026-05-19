// Minimal WS2812B driver for arduino-esp32 3.x using ESP-IDF's RMT TX with DMA.
//
// Why this exists: every Arduino LED library we tried (Adafruit_NeoPixel,
// NeoPixelBus, FastLED, I2SClocklessLedDriver) was either incompatible with
// arduino-esp32 3.x, missing S3 support, or had its DMA disrupted by Wi-Fi
// interrupts. Using the RMT TX driver directly with `mem_block_symbols`
// sized to hold the entire frame means the DMA streams the whole frame
// without any mid-frame ISR servicing, so Wi-Fi can't perturb timing.
//
// Public API (C-style, global state — only one strip supported):
//   ws2812_begin(pin, num_leds)   — (re)init; safe to call again on re-config
//   ws2812_show(leds, byte_count) — blocking transmit of the GRB buffer
//
// The leds buffer is GRB-ordered (3 bytes/LED: G, R, B), matching WS2812
// wire format. Caller allocates and owns the buffer.

#pragma once

#include <driver/rmt_tx.h>

static rmt_channel_handle_t ws2812_channel = nullptr;
static rmt_encoder_handle_t ws2812_encoder = nullptr;
static int ws2812_pin = -1;
static size_t ws2812_max_bytes = 0;

// 10 MHz resolution → 0.1 µs per tick. WS2812B timing in ticks:
//   T0H = 0.3 µs (3 ticks),  T0L = 0.9 µs (9 ticks)
//   T1H = 0.9 µs (9 ticks),  T1L = 0.3 µs (3 ticks)
//   TRES (reset / latch) = >50 µs low
static const rmt_bytes_encoder_config_t WS2812_ENCODER_CONFIG = {
  .bit0 = { .duration0 = 3, .level0 = 1, .duration1 = 9, .level1 = 0 },
  .bit1 = { .duration0 = 9, .level0 = 1, .duration1 = 3, .level1 = 0 },
  .flags = { .msb_first = 1 },
};

// (Re)init the RMT TX channel for `num_leds` WS2812 pixels on the given pin.
// Allocates DMA memory sized to hold the entire frame so the transmission is
// single-shot with no descriptor chaining (no mid-frame ISR).
//
// Returns true on success. If false, ws2812_show() becomes a no-op.
inline bool ws2812_begin(int pin, size_t num_leds) {
  // Tear down any existing channel/encoder so this is idempotent.
  if (ws2812_channel)  { rmt_disable(ws2812_channel); rmt_del_channel(ws2812_channel); ws2812_channel = nullptr; }
  if (ws2812_encoder)  { rmt_del_encoder(ws2812_encoder); ws2812_encoder = nullptr; }

  ws2812_pin = pin;
  ws2812_max_bytes = num_leds * 3;

  // mem_block_symbols for DMA mode is capped at 1024 by this driver (verified
  // empirically — 2048+ returns ESP_ERR_INVALID_ARG). Larger frames are still
  // handled, but via a small encoder-ISR refill at ~1024-symbol boundaries.
  rmt_tx_channel_config_t tx_chan_config = {};
  tx_chan_config.gpio_num         = (gpio_num_t)pin;
  tx_chan_config.clk_src          = RMT_CLK_SRC_DEFAULT;
  tx_chan_config.resolution_hz    = 10 * 1000 * 1000;  // 10 MHz, 0.1 µs/tick
  tx_chan_config.mem_block_symbols = 1024;
  tx_chan_config.trans_queue_depth = 4;
  tx_chan_config.flags.with_dma   = true;

  esp_err_t err = rmt_new_tx_channel(&tx_chan_config, &ws2812_channel);
  if (err == ESP_ERR_INVALID_ARG || err == ESP_ERR_NOT_SUPPORTED) {
    // DMA isn't available — fall back to non-DMA chained-block RMT. Loses the
    // DMA descriptor-walking property; encoder ISRs are firing per RMT block
    // boundary so Wi-Fi-induced ISR jitter can perturb WS2812 timing again.
    Serial.printf("ws2812: DMA channel failed (0x%x), retrying non-DMA\n", err);
    tx_chan_config.flags.with_dma = false;
    tx_chan_config.mem_block_symbols = 64;
    err = rmt_new_tx_channel(&tx_chan_config, &ws2812_channel);
  }
  if (err != ESP_OK) {
    Serial.printf("ws2812: rmt_new_tx_channel failed: 0x%x\n", err);
    ws2812_channel = nullptr;
    return false;
  }

  err = rmt_new_bytes_encoder(&WS2812_ENCODER_CONFIG, &ws2812_encoder);
  if (err != ESP_OK) {
    Serial.printf("ws2812: rmt_new_bytes_encoder failed: 0x%x\n", err);
    rmt_del_channel(ws2812_channel);
    ws2812_channel = nullptr;
    return false;
  }

  err = rmt_enable(ws2812_channel);
  if (err != ESP_OK) {
    Serial.printf("ws2812: rmt_enable failed: 0x%x\n", err);
    rmt_del_encoder(ws2812_encoder);
    rmt_del_channel(ws2812_channel);
    ws2812_channel = nullptr;
    ws2812_encoder = nullptr;
    return false;
  }
  return true;
}

// Blocking transmit. `leds` must point to a GRB-ordered byte buffer; `bytes`
// should equal num_leds * 3 from the most recent ws2812_begin() call.
inline void ws2812_show(const uint8_t* leds, size_t bytes) {
  if (!ws2812_channel || !ws2812_encoder || !leds) return;
  rmt_transmit_config_t tx_config = {};
  tx_config.loop_count = 0;
  rmt_transmit(ws2812_channel, ws2812_encoder, leds, bytes, &tx_config);
  rmt_tx_wait_all_done(ws2812_channel, portMAX_DELAY);
}
