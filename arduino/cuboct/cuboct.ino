#include <Adafruit_NeoPixel.h>

#define PIN D10

#define SIZE 120
#define RAW_SIZE 240
#define MAX_NEIGHBORS 4
int dupes_to_uniques[] = {0x00590000,0x00580001,0x00570002,0x00560003,0x00550004,0x00540005,0x00530006,0x00520007,0x00510008,0x00500009,0x004f000a,0x004e000b,0x004d000c,0x004c000d,0x004b000e,0x004a000f,0x00490010,0x00480011,0x00470012,0x00460013,0x00450014,0x00440015,0x00430016,0x00420017,0x00410018,0x00400019,0x003f001a,0x003e001b,0x003d001c,0x003c001d,0x00ef001e,0x00ee001f,0x00ed0020,0x00ec0021,0x00eb0022,0x00720023,0x00710024,0x00700025,0x006f0026,0x006e0027,0x006d0028,0x006c0029,0x006b002a,0x006a002b,0x0069002c,0x0068002d,0x0067002e,0x0066002f,0x00650030,0x00640031,0x00630032,0x00620033,0x00610034,0x00600035,0x005f0036,0x005e0037,0x005d0038,0x005c0039,0x005b003a,0x005a003b,0x00ea0073,0x00e90074,0x00e80075,0x00e70076,0x00e60077,0x00e50078,0x00e40079,0x00e3007a,0x00e2007b,0x00e1007c,0x00a4007d,0x00a3007e,0x00a2007f,0x00a10080,0x00a00081,0x009f0082,0x009e0083,0x009d0084,0x009c0085,0x009b0086,0x009a0087,0x00990088,0x00980089,0x0097008a,0x0096008b,0x0095008c,0x0094008d,0x0093008e,0x0092008f,0x00910090,0x00e000a5,0x00df00a6,0x00de00a7,0x00dd00a8,0x00dc00a9,0x00db00aa,0x00da00ab,0x00d900ac,0x00d800ad,0x00d700ae,0x00d600af,0x00d500b0,0x00d400b1,0x00d300b2,0x00d200b3,0x00d100b4,0x00d000b5,0x00cf00b6,0x00ce00b7,0x00cd00b8,0x00cc00b9,0x00cb00ba,0x00ca00bb,0x00c900bc,0x00c800bd,0x00c700be,0x00c600bf,0x00c500c0,0x00c400c1,0x00c300c2};
long long neighbors[] = {0x001d003b0001001e,0xffffffff00020000,0xffffffff00030001,0xffffffff00040002,0x0041004000050003,0x0041004000060004,0xffffffff00070005,0xffffffff00080006,0xffffffff00090007,0x005f005e000a0008,0x005f005e000b0009,0xffffffff000c000a,0xffffffff000d000b,0xffffffff000e000c,0x002d002c000f000d,0x002d002c0010000e,0xffffffff0011000f,0xffffffff00120010,0xffffffff00130011,0x0050004f00140012,0x0050004f00150013,0xffffffff00160014,0xffffffff00170015,0xffffffff00180016,0x006e006d00190017,0x006e006d001a0018,0xffffffff001b0019,0xffffffff001c001a,0xffffffff001d001b,0x0000003b001e001c,0x003b001f001d0000,0xffffffff0020001e,0xffffffff0021001f,0xffffffff00220020,0x0059003c00230021,0x0059003c00240022,0xffffffff00250023,0xffffffff00260024,0xffffffff00270025,0x0064006300280026,0x0064006300290027,0xffffffff002a0028,0xffffffff002b0029,0xffffffff002c002a,0x000f000e002d002b,0x000f000e002e002c,0xffffffff002f002d,0xffffffff0030002e,0xffffffff0031002f,0x004b004a00320030,0x004b004a00330031,0xffffffff00340032,0xffffffff00350033,0xffffffff00360034,0x0073007200370035,0x0073007200380036,0xffffffff00390037,0xffffffff003a0038,0xffffffff003b0039,0x001e0000001d003a,0x00590022003d0023,0xffffffff003e003c,0xffffffff003f003d,0xffffffff0040003e,0x000500040041003f,0x0005000400420040,0xffffffff00430041,0xffffffff00440042,0xffffffff00450043,0x0077005a00460044,0x0077005a00470045,0xffffffff00480046,0xffffffff00490047,0xffffffff004a0048,0x00320031004b0049,0x00320031004c004a,0xffffffff004d004b,0xffffffff004e004c,0xffffffff004f004d,0x001400130050004e,0x001400130051004f,0xffffffff00520050,0xffffffff00530051,0xffffffff00540052,0x0069006800550053,0x0069006800560054,0xffffffff00570055,0xffffffff00580056,0xffffffff00590057,0x003c002300220058,0x00770045005b0046,0xffffffff005c005a,0xffffffff005d005b,0xffffffff005e005c,0x000a0009005f005d,0x000a00090060005e,0xffffffff0061005f,0xffffffff00620060,0xffffffff00630061,0x0028002700640062,0x0028002700650063,0xffffffff00660064,0xffffffff00670065,0xffffffff00680066,0x0055005400690067,0x00550054006a0068,0xffffffff006b0069,0xffffffff006c006a,0xffffffff006d006b,0x00190018006e006c,0x00190018006f006d,0xffffffff0070006e,0xffffffff0071006f,0xffffffff00720070,0x0037003600730071,0x0037003600740072,0xffffffff00750073,0xffffffff00760074,0xffffffff00770075,0x005a004600450076};

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
