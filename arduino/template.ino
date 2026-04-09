#include <Adafruit_NeoPixel.h>

#define PIN D10

#define SIZE {{SIZE}}
#define RAW_SIZE {{RAW_SIZE}}
#define MAX_NEIGHBORS {{MAX_NEIGHBORS}}
const uint16_t dupes_to_uniques[SIZE][2] = {{DUPES_TO_UNIQUES}};
const uint16_t neighbors[SIZE][MAX_NEIGHBORS] = {{NEIGHBORS}};
const uint16_t raw_to_unique[RAW_SIZE] = {{RAW_TO_UNIQUE}};
const float coords[SIZE][3] = {{COORDS}};

// Geometry-dependent pattern state
float fluid_values[RAW_SIZE];
float lightning_fluid[RAW_SIZE];
int16_t lightning_to_sink[SIZE];
int16_t lightning_distance[SIZE];
int16_t lightning_bfs_queue[SIZE];
float pattern_target[SIZE];
float render_values[RAW_SIZE];

Adafruit_NeoPixel strip = Adafruit_NeoPixel(RAW_SIZE, PIN, NEO_GRB + NEO_KHZ800);

#define STRIP_SET(i, c) strip.setPixelColor(i, c)
#include "../patterns.h"

Prefs savedPrefs[] = {
  {PATTERN_DEFAULT, 0x25ff59, 0x00607c, 66, 70.0f, 60.0f, 25.0f, 100,
   0.707f, 0.707f, 0.0f, 0, 8.0f,
   1.0f, 0.0f, 0.0f, 25, 9,
   0.0f, 1.0f, 0.0f},
};

void setup() {
  strip.begin();
  randomSeed(13);
  applyPrefs(savedPrefs[0]);
}

void loop() {
  unsigned long loop_start_time = millis();

  switch (idlePattern) {
    case PATTERN_STATIC:     runStatic();     break;
    case PATTERN_SIN:        runSin();        break;
    case PATTERN_PULSES:     runPulses();     break;
    case PATTERN_FIREFLIES:  runFireflies();  break;
    case PATTERN_LIGHTFIELD: runLightField(); break;
    case PATTERN_LIGHTNING:  runLightning();  break;
    default:                 runDefault();    break;
  }

  strip.show();

  float frame_rate = 30;
  if (idlePattern == PATTERN_DEFAULT || idlePattern == PATTERN_FIREFLIES) {
    frame_rate = idleFrameRate;
  }
  int delay_time = (int)(1000.0f / frame_rate) - (int)(millis() - loop_start_time);
  if (delay_time > 0) delay(delay_time);
}
