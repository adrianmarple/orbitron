#include <Adafruit_NeoPixel.h>
#include <math.h>

#define PIN D10

#define SIZE 120
#define RAW_SIZE 240
#define MAX_NEIGHBORS 4
const uint16_t dupes_to_uniques[SIZE][2] = {{0,89},{1,88},{2,87},{3,86},{4,85},{5,84},{6,83},{7,82},{8,81},{9,80},{10,79},{11,78},{12,77},{13,76},{14,75},{15,74},{16,73},{17,72},{18,71},{19,70},{20,69},{21,68},{22,67},{23,66},{24,65},{25,64},{26,63},{27,62},{28,61},{29,60},{30,239},{31,238},{32,237},{33,236},{34,235},{35,114},{36,113},{37,112},{38,111},{39,110},{40,109},{41,108},{42,107},{43,106},{44,105},{45,104},{46,103},{47,102},{48,101},{49,100},{50,99},{51,98},{52,97},{53,96},{54,95},{55,94},{56,93},{57,92},{58,91},{59,90},{115,234},{116,233},{117,232},{118,231},{119,230},{120,229},{121,228},{122,227},{123,226},{124,225},{125,164},{126,163},{127,162},{128,161},{129,160},{130,159},{131,158},{132,157},{133,156},{134,155},{135,154},{136,153},{137,152},{138,151},{139,150},{140,149},{141,148},{142,147},{143,146},{144,145},{165,224},{166,223},{167,222},{168,221},{169,220},{170,219},{171,218},{172,217},{173,216},{174,215},{175,214},{176,213},{177,212},{178,211},{179,210},{180,209},{181,208},{182,207},{183,206},{184,205},{185,204},{186,203},{187,202},{188,201},{189,200},{190,199},{191,198},{192,197},{193,196},{194,195}};
const uint16_t neighbors[SIZE][MAX_NEIGHBORS] = {{30,1,59,29},{0,2,65535,65535},{1,3,65535,65535},{2,4,65535,65535},{3,5,64,65},{4,6,64,65},{5,7,65535,65535},{6,8,65535,65535},{7,9,65535,65535},{8,10,94,95},{9,11,94,95},{10,12,65535,65535},{11,13,65535,65535},{12,14,65535,65535},{13,15,44,45},{14,16,44,45},{15,17,65535,65535},{16,18,65535,65535},{17,19,65535,65535},{18,20,79,80},{19,21,79,80},{20,22,65535,65535},{21,23,65535,65535},{22,24,65535,65535},{23,25,109,110},{24,26,109,110},{25,27,65535,65535},{26,28,65535,65535},{27,29,65535,65535},{28,30,59,0},{0,29,31,59},{30,32,65535,65535},{31,33,65535,65535},{32,34,65535,65535},{33,35,60,89},{34,36,60,89},{35,37,65535,65535},{36,38,65535,65535},{37,39,65535,65535},{38,40,99,100},{39,41,99,100},{40,42,65535,65535},{41,43,65535,65535},{42,44,65535,65535},{43,45,14,15},{44,46,14,15},{45,47,65535,65535},{46,48,65535,65535},{47,49,65535,65535},{48,50,74,75},{49,51,74,75},{50,52,65535,65535},{51,53,65535,65535},{52,54,65535,65535},{53,55,114,115},{54,56,114,115},{55,57,65535,65535},{56,58,65535,65535},{57,59,65535,65535},{58,29,0,30},{35,61,34,89},{60,62,65535,65535},{61,63,65535,65535},{62,64,65535,65535},{63,65,4,5},{64,66,4,5},{65,67,65535,65535},{66,68,65535,65535},{67,69,65535,65535},{68,70,90,119},{69,71,90,119},{70,72,65535,65535},{71,73,65535,65535},{72,74,65535,65535},{73,75,49,50},{74,76,49,50},{75,77,65535,65535},{76,78,65535,65535},{77,79,65535,65535},{78,80,19,20},{79,81,19,20},{80,82,65535,65535},{81,83,65535,65535},{82,84,65535,65535},{83,85,104,105},{84,86,104,105},{85,87,65535,65535},{86,88,65535,65535},{87,89,65535,65535},{88,34,35,60},{70,91,69,119},{90,92,65535,65535},{91,93,65535,65535},{92,94,65535,65535},{93,95,9,10},{94,96,9,10},{95,97,65535,65535},{96,98,65535,65535},{97,99,65535,65535},{98,100,39,40},{99,101,39,40},{100,102,65535,65535},{101,103,65535,65535},{102,104,65535,65535},{103,105,84,85},{104,106,84,85},{105,107,65535,65535},{106,108,65535,65535},{107,109,65535,65535},{108,110,24,25},{109,111,24,25},{110,112,65535,65535},{111,113,65535,65535},{112,114,65535,65535},{113,115,54,55},{114,116,54,55},{115,117,65535,65535},{116,118,65535,65535},{117,119,65535,65535},{118,69,70,90}};
const uint16_t raw_to_unique[RAW_SIZE] = {0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,29,28,27,26,25,24,23,22,21,20,19,18,17,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0,59,58,57,56,55,54,53,52,51,50,49,48,47,46,45,44,43,42,41,40,39,38,37,36,35,60,61,62,63,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,89,88,87,86,85,84,83,82,81,80,79,78,77,76,75,74,73,72,71,70,90,91,92,93,94,95,96,97,98,99,100,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,119,118,117,116,115,114,113,112,111,110,109,108,107,106,105,104,103,102,101,100,99,98,97,96,95,94,93,92,91,90,69,68,67,66,65,64,63,62,61,60,34,33,32,31,30};
const float coords[SIZE][3] = {{-0.5715476066494084,-0.653197264742181,0.0816496580927726},{-0.48989794855663565,-0.7348469228349536,0.24494897427831783},{-0.4082482904638631,-0.8164965809277261,0.408248290463863},{-0.24494897427831783,-0.7348469228349536,0.4898979485566357},{-0.08164965809277264,-0.653197264742181,0.5715476066494083},{0.0816496580927726,-0.5715476066494084,0.653197264742181},{0.24494897427831783,-0.48989794855663565,0.7348469228349536},{0.408248290463863,-0.4082482904638631,0.8164965809277261},{0.4898979485566357,-0.24494897427831785,0.7348469228349536},{0.5715476066494083,-0.08164965809277269,0.653197264742181},{0.653197264742181,0.08164965809277261,0.5715476066494084},{0.7348469228349536,0.24494897427831785,0.4898979485566357},{0.8164965809277261,0.40824829046386296,0.408248290463863},{0.7348469228349536,0.48989794855663565,0.24494897427831783},{0.653197264742181,0.5715476066494083,0.08164965809277264},{0.5715476066494084,0.653197264742181,-0.0816496580927726},{0.48989794855663565,0.7348469228349536,-0.24494897427831783},{0.4082482904638631,0.8164965809277261,-0.408248290463863},{0.24494897427831783,0.7348469228349536,-0.4898979485566357},{0.08164965809277264,0.653197264742181,-0.5715476066494083},{-0.0816496580927726,0.5715476066494084,-0.653197264742181},{-0.24494897427831783,0.48989794855663565,-0.7348469228349536},{-0.408248290463863,0.4082482904638631,-0.8164965809277261},{-0.4898979485566357,0.24494897427831785,-0.7348469228349536},{-0.5715476066494083,0.08164965809277269,-0.653197264742181},{-0.653197264742181,-0.08164965809277261,-0.5715476066494084},{-0.7348469228349536,-0.24494897427831785,-0.4898979485566357},{-0.8164965809277261,-0.40824829046386296,-0.408248290463863},{-0.7348469228349536,-0.48989794855663565,-0.24494897427831783},{-0.653197264742181,-0.5715476066494083,-0.08164965809277264},{-0.653197264742181,-0.5715476066494084,0.0816496580927726},{-0.7348469228349536,-0.48989794855663565,0.24494897427831783},{-0.8164965809277261,-0.4082482904638631,0.408248290463863},{-0.7348469228349536,-0.24494897427831783,0.4898979485566357},{-0.653197264742181,-0.08164965809277264,0.5715476066494083},{-0.5715476066494084,0.0816496580927726,0.653197264742181},{-0.4898979485566357,0.24494897427831783,0.7348469228349536},{-0.4082482904638631,0.40824829046386296,0.8164965809277261},{-0.24494897427831788,0.48989794855663565,0.7348469228349536},{-0.08164965809277269,0.5715476066494083,0.653197264742181},{0.08164965809277261,0.653197264742181,0.5715476066494084},{0.24494897427831785,0.7348469228349536,0.4898979485566357},{0.40824829046386296,0.8164965809277261,0.408248290463863},{0.48989794855663565,0.7348469228349536,0.24494897427831783},{0.5715476066494083,0.653197264742181,0.08164965809277264},{0.653197264742181,0.5715476066494084,-0.0816496580927726},{0.7348469228349536,0.48989794855663565,-0.24494897427831783},{0.8164965809277261,0.4082482904638631,-0.408248290463863},{0.7348469228349536,0.24494897427831783,-0.4898979485566357},{0.653197264742181,0.08164965809277264,-0.5715476066494083},{0.5715476066494084,-0.0816496580927726,-0.653197264742181},{0.4898979485566357,-0.24494897427831783,-0.7348469228349536},{0.4082482904638631,-0.40824829046386296,-0.8164965809277261},{0.24494897427831788,-0.48989794855663565,-0.7348469228349536},{0.08164965809277269,-0.5715476066494083,-0.653197264742181},{-0.08164965809277261,-0.653197264742181,-0.5715476066494084},{-0.24494897427831785,-0.7348469228349536,-0.4898979485566357},{-0.40824829046386296,-0.8164965809277261,-0.408248290463863},{-0.48989794855663565,-0.7348469228349536,-0.24494897427831783},{-0.5715476066494083,-0.653197264742181,-0.08164965809277264},{-0.5715476066494084,-0.0816496580927726,0.653197264742181},{-0.4898979485566357,-0.24494897427831783,0.7348469228349536},{-0.4082482904638631,-0.40824829046386296,0.8164965809277261},{-0.24494897427831788,-0.48989794855663565,0.7348469228349536},{-0.08164965809277269,-0.5715476066494083,0.653197264742181},{0.08164965809277261,-0.653197264742181,0.5715476066494084},{0.24494897427831785,-0.7348469228349536,0.4898979485566357},{0.40824829046386296,-0.8164965809277261,0.408248290463863},{0.48989794855663565,-0.7348469228349536,0.24494897427831783},{0.5715476066494083,-0.653197264742181,0.08164965809277264},{0.653197264742181,-0.5715476066494084,-0.0816496580927726},{0.7348469228349536,-0.48989794855663565,-0.24494897427831783},{0.8164965809277261,-0.4082482904638631,-0.408248290463863},{0.7348469228349536,-0.24494897427831783,-0.4898979485566357},{0.653197264742181,-0.08164965809277264,-0.5715476066494083},{0.5715476066494084,0.0816496580927726,-0.653197264742181},{0.4898979485566357,0.24494897427831783,-0.7348469228349536},{0.4082482904638631,0.40824829046386296,-0.8164965809277261},{0.24494897427831788,0.48989794855663565,-0.7348469228349536},{0.08164965809277269,0.5715476066494083,-0.653197264742181},{-0.08164965809277261,0.653197264742181,-0.5715476066494084},{-0.24494897427831785,0.7348469228349536,-0.4898979485566357},{-0.40824829046386296,0.8164965809277261,-0.408248290463863},{-0.48989794855663565,0.7348469228349536,-0.24494897427831783},{-0.5715476066494083,0.653197264742181,-0.08164965809277264},{-0.653197264742181,0.5715476066494084,0.0816496580927726},{-0.7348469228349536,0.48989794855663565,0.24494897427831783},{-0.8164965809277261,0.4082482904638631,0.408248290463863},{-0.7348469228349536,0.24494897427831783,0.4898979485566357},{-0.653197264742181,0.08164965809277264,0.5715476066494083},{0.653197264742181,-0.5715476066494084,0.0816496580927726},{0.7348469228349536,-0.48989794855663565,0.24494897427831783},{0.8164965809277261,-0.4082482904638631,0.408248290463863},{0.7348469228349536,-0.24494897427831783,0.4898979485566357},{0.653197264742181,-0.08164965809277264,0.5715476066494083},{0.5715476066494084,0.0816496580927726,0.653197264742181},{0.4898979485566357,0.24494897427831783,0.7348469228349536},{0.4082482904638631,0.40824829046386296,0.8164965809277261},{0.24494897427831788,0.48989794855663565,0.7348469228349536},{0.08164965809277269,0.5715476066494083,0.653197264742181},{-0.08164965809277261,0.653197264742181,0.5715476066494084},{-0.24494897427831785,0.7348469228349536,0.4898979485566357},{-0.40824829046386296,0.8164965809277261,0.408248290463863},{-0.48989794855663565,0.7348469228349536,0.24494897427831783},{-0.5715476066494083,0.653197264742181,0.08164965809277264},{-0.653197264742181,0.5715476066494084,-0.0816496580927726},{-0.7348469228349536,0.48989794855663565,-0.24494897427831783},{-0.8164965809277261,0.4082482904638631,-0.408248290463863},{-0.7348469228349536,0.24494897427831783,-0.4898979485566357},{-0.653197264742181,0.08164965809277264,-0.5715476066494083},{-0.5715476066494084,-0.0816496580927726,-0.653197264742181},{-0.4898979485566357,-0.24494897427831783,-0.7348469228349536},{-0.4082482904638631,-0.40824829046386296,-0.8164965809277261},{-0.24494897427831788,-0.48989794855663565,-0.7348469228349536},{-0.08164965809277269,-0.5715476066494083,-0.653197264742181},{0.08164965809277261,-0.653197264742181,-0.5715476066494084},{0.24494897427831785,-0.7348469228349536,-0.4898979485566357},{0.40824829046386296,-0.8164965809277261,-0.408248290463863},{0.48989794855663565,-0.7348469228349536,-0.24494897427831783},{0.5715476066494083,-0.653197264742181,-0.08164965809277264}};

#define PATTERN_DEFAULT     0
#define PATTERN_STATIC      1
#define PATTERN_SIN         2
#define PATTERN_PULSES      3
#define PATTERN_FIREFLIES   4
#define PATTERN_LIGHTFIELD  5
#define PATTERN_LIGHTNING   6

struct Prefs {
  int idlePattern;          // PATTERN_*, default 0
  long gradientStartColor;  // packed 0xRRGGBB, default #25ff59
  long gradientEndColor;    // packed 0xRRGGBB, default #00607c
  int gradientThreshold;    // 0-100, default 66
  float idleDensity;        // default 70.0
  float idleBlend;          // 0-100, default 60.0
  float idleFrameRate;      // fps, default 25.0
  int brightness;           // 0-100, default 100
  float staticDirX, staticDirY, staticDirZ;  // default (0.707, 0.707, 0)
  int staticRotation;       // bool, default 0
  float staticRotationTime; // seconds, default 8.0
  float sinDirX, sinDirY, sinDirZ;  // default (1, 0, 0)
  int sinMin;               // 0-255, default 25
  int rippleWidth;          // 0-100, default 9
  float patternBiasX, patternBiasY, patternBiasZ;  // default (0, 1, 0)
};

Prefs savedPrefs[] = {
  {PATTERN_DEFAULT, 0x25ff59, 0x00607c, 66, 30.0f, 60.0f, 25.0f, 100,
   0.707f, 0.707f, 0.0f, 0, 8.0f,
   1.0f, 0.0f, 0.0f, 25, 9,
   0.0f, 1.0f, 0.0f},
};

// --- Default + Fireflies pattern state ---
#define MAX_HEADS 64
int head_count = 1;
int fluid_heads[MAX_HEADS];
int fluid_head_buffer[MAX_HEADS];
float fluid_values[RAW_SIZE];

// --- Pulses pattern state ---
#define MAX_PULSES 8
struct PulseState {
  float x, y, z;
  unsigned long start_ms;
  unsigned long duration_ms;
  bool active;
};
PulseState pulses[MAX_PULSES];

// --- LightField pattern state ---
float lf_global_time = 0.0f;
unsigned long lf_last_ms = 0;


// --- Lightning pattern state ---
float lightning_fluid[RAW_SIZE];
float lightning_time_pressure = 0.0f;
int16_t lightning_to_sink[SIZE];
int16_t lightning_distance[SIZE];
int16_t lightning_bfs_queue[SIZE];

// --- Shared scratch buffer for non-default patterns (avoids large stack allocs) ---
float pattern_target[SIZE];

float render_values[RAW_SIZE];

// Prefs globals (defaults matching Python default_prefs)
int idlePattern = PATTERN_DEFAULT;
int start_r = 0x25;
int start_g = 0xff;
int start_b = 0x59;
int end_r = 0x00;
int end_g = 0x60;
int end_b = 0x7c;
int gradientThreshold = 66;
float idleDensity = 70.0f;
float idleBlend = 60.0f;
float idleFrameRate = 25.0f;
int brightness = 100;
// Static pattern
float staticDirX = 0.707f;
float staticDirY = 0.707f;
float staticDirZ = 0.0f;
int staticRotation = 0;
float staticRotationTime = 8.0f;
// Sin pattern
float sinDirX = 1.0f;
float sinDirY = 0.0f;
float sinDirZ = 0.0f;
int sinMin = 25;
// Pulses pattern
int rippleWidth = 9;
// Fireflies pattern
float patternBiasX = 0.0f;
float patternBiasY = 1.0f;
float patternBiasZ = 0.0f;

// Cached derived values (recomputed in applyPrefs)
float alpha = 0.3f;
float brightness_factor = 1.0f;

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
  idlePattern = p.idlePattern;
  staticDirX = p.staticDirX; staticDirY = p.staticDirY; staticDirZ = p.staticDirZ;
  staticRotation = p.staticRotation;
  staticRotationTime = p.staticRotationTime;
  sinDirX = p.sinDirX; sinDirY = p.sinDirY; sinDirZ = p.sinDirZ;
  sinMin = p.sinMin;
  rippleWidth = p.rippleWidth;
  patternBiasX = p.patternBiasX; patternBiasY = p.patternBiasY; patternBiasZ = p.patternBiasZ;

  float frame_delta = (1.0f / p.idleFrameRate) * expf(2.7f - p.idleBlend / 17.0f);
  alpha = 1.0f - expf(-10.0f * frame_delta);
  brightness_factor = (p.brightness / 100.0f) * (p.brightness / 100.0f);
}

Adafruit_NeoPixel strip = Adafruit_NeoPixel(RAW_SIZE, PIN, NEO_GRB + NEO_KHZ800);

void setup() {
  strip.begin();
  randomSeed(13);

  applyPrefs(savedPrefs[0]);
}

// Render pattern_target[SIZE] (per unique pixel) with alpha blend and gradient color into strip
void applyTargetValues(float brightness_scale) {
  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;
  float bf = brightness_factor * brightness_scale;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float target_v = pattern_target[u];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha;
    render_values[i] = v2;
    float tv = target_v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * bf;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

// Render fv[RAW_SIZE] directly (no alpha blend) with gradient color into strip
void applyFluidValues(float* fv, float brightness_scale) {
  float inv_threshold = 100.0f / gradientThreshold;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;
  float bf = brightness_factor * brightness_scale;
  for (int i = 0; i < RAW_SIZE; i++) {
    float v = fv[i];
    render_values[i] = v;
    float tv = v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = v * bf;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runDefault() {
  float target_head_count = SIZE * idleDensity / 1600.0f;
  float head_ratio = head_count / target_head_count;
  float dampening_factor = 1.0f + head_ratio * head_ratio * 5.0f;
  float density_scale = dampening_factor / (idleDensity * 0.03f);

  int new_head_count = 0;
  for (int i = 0; i < head_count; i++) {
    int head = fluid_heads[i];
    for (int j = 0; j < MAX_NEIGHBORS; j++) {
      if (new_head_count >= MAX_HEADS) break;
      int n = neighbors[head][j];
      if (n == 0xffff) continue;
      float x = (fluid_values[dupes_to_uniques[n][0]] + 0.01f) * density_scale;
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
    fluid_values[dupes_to_uniques[fluid_heads[i]][0]] = 1.0f;
    fluid_values[dupes_to_uniques[fluid_heads[i]][1]] = 1.0f;
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
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runFireflies() {
  int target_head_count = (int)(SIZE * idleDensity / 2000);
  if (target_head_count < 1) target_head_count = 1;

  int new_head_count = 0;
  for (int i = 0; i < head_count && new_head_count < MAX_HEADS; i++) {
    int head = fluid_heads[i];

    // Collect and shuffle neighbors
    int nbrs[MAX_NEIGHBORS];
    int nbr_count = 0;
    for (int j = 0; j < MAX_NEIGHBORS; j++) {
      int n = neighbors[head][j];
      if (n == 0xffff) break;
      nbrs[nbr_count++] = n;
    }
    for (int j = nbr_count - 1; j > 0; j--) {
      int k = random(j + 1);
      int tmp = nbrs[j]; nbrs[j] = nbrs[k]; nbrs[k] = tmp;
    }

    for (int j = 0; j < nbr_count; j++) {
      int n = nbrs[j];

      // Direction from neighbor to head, dotted with patternBias for directional bias
      // head and n are unique indices, so coords can be accessed directly
      float dx = coords[head][0] - coords[n][0];
      float dy = coords[head][1] - coords[n][1];
      float dz = coords[head][2] - coords[n][2];
      float mag = sqrtf(dx*dx + dy*dy + dz*dz);
      if (mag > 0.001f) { dx /= mag; dy /= mag; dz /= mag; }
      float bias = (dx * patternBiasX + dy * patternBiasY + dz * patternBiasZ) * 2.0f + 1.0f;

      float x = (fluid_values[dupes_to_uniques[n][0]] + 0.02f) * 1.5f * bias;
      if (x < (float)random(0x10000) / 0x10000) {
        fluid_head_buffer[new_head_count++] = n;
        fluid_values[dupes_to_uniques[n][0]] = 1.0f;
        fluid_values[dupes_to_uniques[n][1]] = 1.0f;
        break;
      }
    }
  }

  // Fill up to target head count with random pixels
  while (new_head_count < target_head_count && new_head_count < MAX_HEADS) {
    int n = random(SIZE);
    fluid_head_buffer[new_head_count++] = n;
    fluid_values[dupes_to_uniques[n][0]] = 1.0f;
    fluid_values[dupes_to_uniques[n][1]] = 1.0f;
  }

  memcpy(fluid_heads, fluid_head_buffer, sizeof(fluid_heads));
  head_count = new_head_count;

  // Inline render (same structure as runDefault, with 0.84 decay)
  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    fluid_values[i] *= 0.84f;
    float target_v = fluid_values[i] * fluid_values[i];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha;
    render_values[i] = v2;
    float tv = target_v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * brightness_factor;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runStatic() {
  float dx, dy, dz;
  if (staticRotation) {
    float theta = (millis() / 1000.0f) * 2.0f * PI / staticRotationTime;
    dx = sinf(theta);
    dy = cosf(theta);
    dz = 0.0f;
  } else {
    dx = staticDirX; dy = staticDirY; dz = staticDirZ;
  }

  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;
  float actual_brightness = brightness_factor * 0.2f;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float target_v = (1.0f + dx * coords[u][0] + dy * coords[u][1] + dz * coords[u][2]) / 2.0f;
    float tv = target_v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = target_v * actual_brightness;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runSin() {
  float period = idleDensity * idleDensity / 150.0f;
  float speed = idleFrameRate * period / 200.0f;
  unsigned long period_ms = max(1UL, (unsigned long)(1000.0f / speed));
  float phase = (float)(millis() % period_ms) / (float)period_ms * (2.0f * PI);

  float min_val = sinMin / 255.0f;
  float denom = 2.0f + min_val;

  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float dot = sinDirX * coords[u][0] + sinDirY * coords[u][1] + sinDirZ * coords[u][2];
    float target_v = (sinf(-dot * period + phase) + 1.0f + min_val) / denom;
    if (target_v < 0.0f) target_v = 0.0f;
    if (target_v > 1.0f) target_v = 1.0f;
    float tv = target_v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = target_v * brightness_factor;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runPulses() {
  unsigned long now_ms = millis();
  float width = rippleWidth / 100.0f;

  for (int i = 0; i < SIZE; i++) pattern_target[i] = 0.0f;

  // Render active pulses
  bool pulse_is_visible = false;
  for (int p = 0; p < MAX_PULSES; p++) {
    if (!pulses[p].active) continue;
    unsigned long elapsed_ms = now_ms - pulses[p].start_ms;
    if (elapsed_ms >= pulses[p].duration_ms) {
      pulses[p].active = false;
      continue;
    }
    float t = (float)elapsed_ms / (float)pulses[p].duration_ms;
    if (t < 0.5f) pulse_is_visible = true;
    t = 1.0f - t;  // reverse=True: pulse starts at location, expands outward

    for (int i = 0; i < SIZE; i++) {
      float dot = pulses[p].x * coords[i][0] + pulses[p].y * coords[i][1] + pulses[p].z * coords[i][2];
      float ds = (dot / 4.0f + 0.75f) / width + (-0.5f * (t + 1.0f) / width + 1.0f - t);
      float v = ds * (1.0f - ds) / 3.0f;
      if (v < 0.0f) v = 0.0f;
      float vv = v * v * 12.0f;
      pattern_target[i] += vv;
      if (pattern_target[i] > 1.0f) pattern_target[i] = 1.0f;
    }
  }

  // Spawn new pulses
  int active_count = 0;
  for (int p = 0; p < MAX_PULSES; p++) {
    if (pulses[p].active) active_count++;
  }
  float max_pulses = idleDensity / 10.0f;
  if (max_pulses < 2.0f) max_pulses = 2.0f;

  if (active_count < (int)max_pulses) {
    float spawn_chance = idleDensity / 50.0f / idleFrameRate;
    if (spawn_chance * 0x10000 > random(0xffff) || !pulse_is_visible) {
      for (int p = 0; p < MAX_PULSES; p++) {
        if (!pulses[p].active) {
          float rx = (random(0x10001) - 0x8000) / (float)0x8000;
          float ry = (random(0x10001) - 0x8000) / (float)0x8000;
          float rz = (random(0x10001) - 0x8000) / (float)0x8000;
          float rmag = sqrtf(rx*rx + ry*ry + rz*rz);
          if (rmag < 0.001f) rmag = 1.0f;
          pulses[p].x = rx / rmag;
          pulses[p].y = ry / rmag;
          pulses[p].z = rz / rmag;
          pulses[p].start_ms = now_ms;
          float base_duration = 70.0f / idleFrameRate;
          float duration_s = base_duration * (1.0f + random(0x10000) / (float)0x10000);
          pulses[p].duration_ms = (unsigned long)(duration_s * 1000.0f);
          pulses[p].active = true;
          break;
        }
      }
    }
  }

  applyTargetValues(1.0f);
}

void runLightField() {
  unsigned long now_ms = millis();
  float dt = (now_ms - lf_last_ms) / 1000.0f;
  lf_last_ms = now_ms;

  lf_global_time += dt * 2.0f * PI * (idleFrameRate / 300.0f);
  float inv_threshold = 100.0f / gradientThreshold;
  int delta_r = start_r - end_r;
  int delta_g = start_g - end_g;
  int delta_b = start_b - end_b;

  for (int i = 0; i < RAW_SIZE; i++) {
    // Knuth multiplicative hash gives each pixel a unique speed, brightness, and phase
    uint32_t hf = (uint32_t)(i + 1) * 2654435761u;
    uint32_t hb = (uint32_t)(i + 1) * 2246822519u;
    uint32_t hp = (uint32_t)(i + 1) * 3266489917u;
    float factor = (hf >> 16) * (10.0f / 65536.0f) + 0.5f;
    float rb = (hb >> 16) * (0.9f / 65536.0f) + 0.1f;
    float phase = (hp >> 16) * (2.0f * PI / 65536.0f);
    float v = fmaxf(sinf(fmodf(lf_global_time * factor + phase, 2.0f * PI)), 0.0f) * (rb * rb);
    render_values[i] = v;
    float tv = v * inv_threshold;
    if (tv > 1.0f) tv = 1.0f;
    float scale = v * brightness_factor;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    strip.setPixelColor(i, b + (g << 8) + (r << 16));
  }
}

void runLightning() {
  float decay = expf(-idleFrameRate / 60.0f);
  for (int i = 0; i < RAW_SIZE; i++) lightning_fluid[i] *= decay;

  lightning_time_pressure += ((float)random(0x10000) / 0x10000) * idleFrameRate / 200.0f;

  if (lightning_time_pressure >= 1.0f) {
    lightning_time_pressure = 0.0f;

    // Pick a random sink (unique index) and BFS outward to build the spanning tree
    int sink = random(SIZE);
    lightning_fluid[dupes_to_uniques[sink][0]] = 1.0f;
    lightning_fluid[dupes_to_uniques[sink][1]] = 1.0f;

    for (int i = 0; i < SIZE; i++) {
      lightning_to_sink[i] = -1;
      lightning_distance[i] = -1;
    }
    lightning_to_sink[sink] = sink;
    lightning_distance[sink] = 0;

    int q_head = 0, q_tail = 0;
    lightning_bfs_queue[q_tail++] = sink;
    while (q_head < q_tail) {
      int node = lightning_bfs_queue[q_head++];
      for (int j = 0; j < MAX_NEIGHBORS; j++) {
        int n = neighbors[node][j];
        if (n == 0xffff) break;
        if (lightning_distance[n] < 0) {
          lightning_distance[n] = lightning_distance[node] + 1;
          lightning_to_sink[n] = node;
          lightning_bfs_queue[q_tail++] = n;
        }
      }
    }

    // Trace paths from random sources (unique indices) to the sink
    int source_count = (int)(SIZE * idleDensity / 1000);
    for (int s = 0; s < source_count; s++) {
      int source = random(SIZE);
      while (source != sink) {
        int parent = lightning_to_sink[source];
        if (parent < 0) break;
        float value = 0.5f + expf(-(float)lightning_distance[source] / SIZE * 100.0f);
        lightning_fluid[dupes_to_uniques[source][0]] = value;
        lightning_fluid[dupes_to_uniques[source][1]] = value;
        source = parent;
      }
    }
  }

  applyFluidValues(lightning_fluid, 1.0f);
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
