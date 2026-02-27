#include <Adafruit_NeoPixel.h>

#define PIN D10

#define SIZE {{SIZE}}
#define RAW_SIZE {{RAW_SIZE}}
#define MAX_NEIGHBORS {{MAX_NEIGHBORS}}
int dupes_to_uniques[] = {{DUPES_TO_UNIQUES}};
long long neighbors[] = {{NEIGHBORS}};

#define MAX_HEADS 64
int head_count = 1;
int fluid_heads[MAX_HEADS];
int fluid_head_buffer[MAX_HEADS];
float fluid_values[RAW_SIZE];
float render_values[RAW_SIZE];

// Prefs globals (defaults matching Python default_prefs)
int start_r = 0x25;
int start_g = 0xff;
int start_b = 0x59;
int end_r = 0x00;
int end_g = 0x60;
int end_b = 0x7c;
int gradientThreshold = 66;
double idleDensity = 70.0;
double idleBlend = 60.0;
double idleFrameRate = 15.0;
int brightness = 100;

// Cached derived values (recomputed in applyPrefs)
float alpha = 0.3f;
float brightness_factor = 1.0f;

struct Prefs {
  long gradientStartColor;  // packed 0xRRGGBB, default #25ff59
  long gradientEndColor;    // packed 0xRRGGBB, default #00607c
  int gradientThreshold;    // 0-100, default 66
  double idleDensity;       // default 70.0
  double idleBlend;         // 0-100, default 60.0
  double idleFrameRate;     // fps, default 15.0
  int brightness;           // 0-100, default 100
};

Prefs savedPrefs[] = {
  {0x25ff59, 0x00607c, 66, 70.0, 60.0, 25.0, 100},
};

void applyPrefs(Prefs& p) {
  start_r = (p.gradientStartColor >> 16) & 0xff;
  start_g = (p.gradientStartColor >> 8) & 0xff;
  start_b = p.gradientStartColor & 0xff;
  end_r = (p.gradientEndColor >> 16) & 0xff;
  end_g = (p.gradientEndColor >> 8) & 0xff;
  end_b = p.gradientEndColor & 0xff;
  gradientThreshold = p.gradientThreshold;
  idleDensity = p.idleDensity;
  idleBlend = p.idleBlend;
  idleFrameRate = p.idleFrameRate;
  brightness = p.brightness;

  float frame_delta = (1.0f / p.idleFrameRate) * exp(2.7 - p.idleBlend / 17.0);
  alpha = 1.0f - exp(-10.0f * frame_delta);
  brightness_factor = (p.brightness / 100.0f) * (p.brightness / 100.0f);
}

Adafruit_NeoPixel strip = Adafruit_NeoPixel(RAW_SIZE, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  strip.begin();
  randomSeed(13);
  applyPrefs(savedPrefs[0]);
}

void loop() {
  int loop_start_time = millis();
  float target_head_count = SIZE * idleDensity / 1600.0f;
  float head_ratio = head_count / target_head_count;
  float dampening_factor = 1.0f + head_ratio * head_ratio * 5.0f;
  float density_scale = dampening_factor / (idleDensity * 0.03f);

  int new_head_count = 0;

  for (int i = 0; i < head_count; i++) {
    int head = fluid_heads[i];
    for (int j = 0; j < MAX_NEIGHBORS; j++) {
      if (new_head_count >= MAX_HEADS) {
        break;
      }
      int n = (neighbors[head] >> (j * 16)) & 0xffff;
      if (n == 0xffff) {
        continue;
      }
      float x = (fluid_values[dupes_to_uniques[n] & 0xffff] + 0.01f) * density_scale;
      if (x * 0x10000 < random(0xffff)) {
        fluid_head_buffer[new_head_count++] = n;
      }
    }
  }

  float spontaneous_combustion_chance = 0.01f / (head_ratio * head_ratio);
  if (new_head_count < MAX_HEADS && spontaneous_combustion_chance * 0x10000 > random(0xffff)) {
    fluid_head_buffer[new_head_count++] = random(SIZE);
  }

  if (new_head_count != 0) {
    memcpy(fluid_heads, fluid_head_buffer, sizeof(fluid_heads));
    head_count = new_head_count;
  }
  for (int i = 0; i < head_count; i++) {
    int uniques = dupes_to_uniques[fluid_heads[i]];
    fluid_values[uniques & 0xffff] = 1.0f;
    fluid_values[uniques >> 16 & 0xffff] = 1.0f;
  }

  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;

  for (int i = 0; i < RAW_SIZE; i++) {
    fluid_values[i] *= 0.86f;

    float target_v = fluid_values[i] * fluid_values[i];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha;
    render_values[i] = v2;

    float tv = target_v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * brightness_factor;
    int r = (end_r + delta_r * tv) * scale;
    int g = (end_g + delta_g * tv) * scale;
    int b = (end_b + delta_b * tv) * scale;
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
  strip.show();

  int delay_time = (int)(1000.0f / idleFrameRate) - (millis() - loop_start_time);
  if (delay_time > 0) {
    delay(delay_time);
  }
}
