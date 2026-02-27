#include <Adafruit_NeoPixel.h> 

#define FRAME_MILLIS 24
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
double fluid_values[RAW_SIZE];
double render_values[RAW_SIZE];

int start_r = 0x25;
int start_g = 0xff;
int start_b = 0x59;
int end_r = 0x00;
int end_g = 0x60;
int end_b = 0x7c;

Adafruit_NeoPixel strip = Adafruit_NeoPixel(RAW_SIZE, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  Serial.begin(115200);
  strip.begin();
  randomSeed(13);
}

void loop() {
  int loop_start_time = millis();
  double target_head_count = SIZE / 30.0;
  double head_ratio = head_count / target_head_count;
  double dampening_factor = 1 + head_ratio*head_ratio*5;

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
      double x = fluid_values[dupes_to_uniques[n] & 0xffff] + 0.01;
      x *= dampening_factor / 1.5;
      if (x * 0x10000 < random(0xffff)) {
        fluid_head_buffer[new_head_count++] = n;
      }
    }
  }

  double spontaneous_combustion_chance = 0.01 / (head_ratio * head_ratio);
  if (new_head_count < MAX_HEADS && spontaneous_combustion_chance * 0x10000 > random(0xffff)) {
    fluid_head_buffer[new_head_count++] = random(SIZE);
  }

  if (new_head_count != 0) {
    memcpy(fluid_heads, fluid_head_buffer, sizeof(fluid_heads));
    head_count = new_head_count;
  }
  for (int i = 0; i < head_count; i++) {
    int uniques = dupes_to_uniques[fluid_heads[i]];
    fluid_values[uniques & 0xffff] = 1.0;
    fluid_values[uniques >> 16 & 0xffff] = 1.0;
  }

  double alpha = 0.3;
  for (int i = 0; i < RAW_SIZE; i++) {
    fluid_values[i] *= 0.86;

    double v = fluid_values[i] * fluid_values[i];
    double v2 = render_values[i] * (1-alpha) + v * alpha;
    render_values[i] = v2;

    int r = (start_r * v + end_r * (1 - v)) * v2;
    int g = (start_g * v + end_g * (1 - v)) * v2;
    int b = (start_b * v + end_b * (1 - v)) * v2;
    strip.setPixelColor(i, b + (g<<8) + (r<<16));
  }
  strip.show();
    
  int delay_time = FRAME_MILLIS - (millis() - loop_start_time);
  if (delay_time > 0) {
    delay(10);
  }
}