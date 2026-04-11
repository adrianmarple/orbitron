#pragma once
#include <math.h>

// Pattern IDs
#define PATTERN_DEFAULT     0
#define PATTERN_STATIC      1
#define PATTERN_SIN         2
#define PATTERN_PULSES      3
#define PATTERN_FIREFLIES   4
#define PATTERN_LIGHTFIELD  5
#define PATTERN_LIGHTNING   6

// Prefs struct (shared between template and esp32)
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

// Pattern state — fixed-size, not geometry-dependent
#define MAX_HEADS 64
int head_count = 1;
int fluid_heads[MAX_HEADS];
int fluid_head_buffer[MAX_HEADS];

#define MAX_PULSES 8
struct PulseState { float x, y, z; unsigned long start_ms, duration_ms; bool active; };
PulseState pulses[MAX_PULSES];

float lf_global_time = 0.0f;
unsigned long lf_last_ms = 0;
float lightning_time_pressure = 0.0f;

// Prefs-derived globals (set by applyPrefs)
int idlePattern = PATTERN_DEFAULT;
int start_r = 0x25, start_g = 0xff, start_b = 0x59;
int end_r = 0x00, end_g = 0x60, end_b = 0x7c;
int gradientThreshold = 66;
float idleDensity = 70.0f;
float idleBlend = 60.0f;
float idleFrameRate = 25.0f;
int brightness = 100;
float staticDirX = 0.707f, staticDirY = 0.707f, staticDirZ = 0.0f;
int staticRotation = 0;
float staticRotationTime = 8.0f;
float sinDirX = 1.0f, sinDirY = 0.0f, sinDirZ = 0.0f;
int sinMin = 25;
int rippleWidth = 9;
float patternBiasX = 0.0f, patternBiasY = 1.0f, patternBiasZ = 0.0f;
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

// STRIP_SET(i, color) must be defined by the including file:
//   template: #define STRIP_SET(i, c) strip.setPixelColor(i, c)
//   esp32:    #define STRIP_SET(i, c) strip->setPixelColor(i, c)

void applyTargetValues(float brightness_scale) {
  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r, delta_g = start_g - end_g, delta_b = start_b - end_b;
  float bf = brightness_factor * brightness_scale;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float target_v = pattern_target[u];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha;
    render_values[i] = v2;
    float tv = target_v * inv_threshold; if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * bf;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void applyFluidValues(float* fv, float brightness_scale) {
  float inv_threshold = 100.0f / gradientThreshold;
  int delta_r = start_r - end_r, delta_g = start_g - end_g, delta_b = start_b - end_b;
  float bf = brightness_factor * brightness_scale;
  for (int i = 0; i < RAW_SIZE; i++) {
    float v = fv[i]; render_values[i] = v;
    float tv = v * inv_threshold; if (tv > 1.0f) tv = 1.0f;
    float scale = v * bf;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
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
      int n = neighbors[head][j]; if (n == 0xffff) continue;
      float x = (fluid_values[dupes_to_uniques[n][0]] + 0.01f) * density_scale;
      if (x * 0x10000 < random(0xffff)) fluid_head_buffer[new_head_count++] = n;
    }
  }
  float scc = 0.01f / (head_ratio * head_ratio);
  if (new_head_count < MAX_HEADS && scc * 0x10000 > random(0xffff))
    fluid_head_buffer[new_head_count++] = random(SIZE);
  if (new_head_count != 0) { memcpy(fluid_heads, fluid_head_buffer, sizeof(fluid_heads)); head_count = new_head_count; }
  for (int i = 0; i < head_count; i++) {
    fluid_values[dupes_to_uniques[fluid_heads[i]][0]] = 1.0f;
    fluid_values[dupes_to_uniques[fluid_heads[i]][1]] = 1.0f;
  }
  float inv_threshold = 100.0f / gradientThreshold;
  float one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r - end_r, delta_g = start_g - end_g, delta_b = start_b - end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    fluid_values[i] *= 0.86f;
    float target_v = fluid_values[i] * fluid_values[i];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha;
    render_values[i] = v2;
    float tv = target_v * inv_threshold; if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * brightness_factor;
    int r = (int)((end_r + delta_r * tv) * scale);
    int g = (int)((end_g + delta_g * tv) * scale);
    int b = (int)((end_b + delta_b * tv) * scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void runFireflies() {
  int target_head_count = (int)(SIZE * idleDensity / 2000); if (target_head_count < 1) target_head_count = 1;
  int new_head_count = 0;
  for (int i = 0; i < head_count && new_head_count < MAX_HEADS; i++) {
    int head = fluid_heads[i];
    int nbrs[MAX_NEIGHBORS]; int nbr_count = 0;
    for (int j = 0; j < MAX_NEIGHBORS; j++) { int n = neighbors[head][j]; if (n == 0xffff) break; nbrs[nbr_count++] = n; }
    for (int j = nbr_count - 1; j > 0; j--) { int k = random(j+1); int tmp = nbrs[j]; nbrs[j] = nbrs[k]; nbrs[k] = tmp; }
    for (int j = 0; j < nbr_count; j++) {
      int n = nbrs[j];
      float dx = coords[head][0]-coords[n][0], dy = coords[head][1]-coords[n][1], dz = coords[head][2]-coords[n][2];
      float mag = sqrtf(dx*dx+dy*dy+dz*dz); if (mag > 0.001f) { dx/=mag; dy/=mag; dz/=mag; }
      float bias = (dx*patternBiasX + dy*patternBiasY + dz*patternBiasZ) * 2.0f + 1.0f;
      float x = (fluid_values[dupes_to_uniques[n][0]] + 0.02f) * 1.5f * bias;
      if (x < (float)random(0x10000) / 0x10000) {
        fluid_head_buffer[new_head_count++] = n;
        fluid_values[dupes_to_uniques[n][0]] = 1.0f; fluid_values[dupes_to_uniques[n][1]] = 1.0f;
        break;
      }
    }
  }
  while (new_head_count < target_head_count && new_head_count < MAX_HEADS) {
    int n = random(SIZE); fluid_head_buffer[new_head_count++] = n;
    fluid_values[dupes_to_uniques[n][0]] = 1.0f; fluid_values[dupes_to_uniques[n][1]] = 1.0f;
  }
  memcpy(fluid_heads, fluid_head_buffer, sizeof(fluid_heads)); head_count = new_head_count;
  float inv_threshold = 100.0f / gradientThreshold, one_minus_alpha = 1.0f - alpha;
  int delta_r = start_r-end_r, delta_g = start_g-end_g, delta_b = start_b-end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    fluid_values[i] *= 0.84f;
    float target_v = fluid_values[i] * fluid_values[i];
    float v2 = render_values[i] * one_minus_alpha + target_v * alpha; render_values[i] = v2;
    float tv = target_v * inv_threshold; if (tv > 1.0f) tv = 1.0f;
    float scale = v2 * brightness_factor;
    int r = (int)((end_r+delta_r*tv)*scale);
    int g = (int)((end_g+delta_g*tv)*scale);
    int b = (int)((end_b+delta_b*tv)*scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void runStatic() {
  float dx, dy, dz;
  if (staticRotation) { float theta = (millis()/1000.0f)*2.0f*PI/staticRotationTime; dx=sinf(theta); dy=cosf(theta); dz=0.0f; }
  else { dx=staticDirX; dy=staticDirY; dz=staticDirZ; }
  float inv_threshold = 100.0f/gradientThreshold;
  int delta_r=start_r-end_r, delta_g=start_g-end_g, delta_b=start_b-end_b;
  float ab = brightness_factor * 0.2f;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float target_v = (1.0f + dx*coords[u][0] + dy*coords[u][1] + dz*coords[u][2]) / 2.0f;
    float tv = target_v*inv_threshold; if (tv>1.0f) tv=1.0f;
    float scale = target_v*ab;
    int r = (int)((end_r+delta_r*tv)*scale);
    int g = (int)((end_g+delta_g*tv)*scale);
    int b = (int)((end_b+delta_b*tv)*scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void runSin() {
  float period = idleDensity*idleDensity/150.0f;
  float speed = idleFrameRate*period/200.0f;
  unsigned long period_ms = max(1UL, (unsigned long)(1000.0f/speed));
  float phase = (float)(millis()%period_ms)/(float)period_ms*(2.0f*PI);
  float min_val = sinMin/255.0f, denom = 2.0f+min_val;
  float inv_threshold = 100.0f/gradientThreshold;
  int delta_r=start_r-end_r, delta_g=start_g-end_g, delta_b=start_b-end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float dot = sinDirX*coords[u][0]+sinDirY*coords[u][1]+sinDirZ*coords[u][2];
    float target_v = (sinf(-dot*period+phase)+1.0f+min_val)/denom;
    if (target_v<0.0f) target_v=0.0f; if (target_v>1.0f) target_v=1.0f;
    float tv = target_v*inv_threshold; if (tv>1.0f) tv=1.0f;
    float scale = target_v*brightness_factor;
    int r = (int)((end_r+delta_r*tv)*scale);
    int g = (int)((end_g+delta_g*tv)*scale);
    int b = (int)((end_b+delta_b*tv)*scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void runPulses() {
  unsigned long now_ms = millis();
  float width = rippleWidth/100.0f;
  for (int i = 0; i < SIZE; i++) pattern_target[i] = 0.0f;
  bool pulse_is_visible = false;
  for (int p = 0; p < MAX_PULSES; p++) {
    if (!pulses[p].active) continue;
    unsigned long elapsed_ms = now_ms - pulses[p].start_ms;
    if (elapsed_ms >= pulses[p].duration_ms) { pulses[p].active = false; continue; }
    float t = (float)elapsed_ms/(float)pulses[p].duration_ms;
    if (t < 0.5f) pulse_is_visible = true;
    t = 1.0f - t;
    for (int i = 0; i < SIZE; i++) {
      float dot = pulses[p].x*coords[i][0]+pulses[p].y*coords[i][1]+pulses[p].z*coords[i][2];
      float ds = (dot/4.0f+0.75f)/width+(-0.5f*(t+1.0f)/width+1.0f-t);
      float v = ds*(1.0f-ds)/3.0f; if (v<0.0f) v=0.0f;
      float vv = v*v*12.0f; pattern_target[i] += vv; if (pattern_target[i]>1.0f) pattern_target[i]=1.0f;
    }
  }
  int active_count = 0;
  for (int p = 0; p < MAX_PULSES; p++) if (pulses[p].active) active_count++;
  float max_pulses = idleDensity/10.0f; if (max_pulses<2.0f) max_pulses=2.0f;
  if (active_count < (int)max_pulses) {
    float spawn_chance = idleDensity/50.0f/idleFrameRate;
    if (spawn_chance*0x10000 > random(0xffff) || !pulse_is_visible) {
      for (int p = 0; p < MAX_PULSES; p++) {
        if (!pulses[p].active) {
          float rx=(random(0x10001)-0x8000)/(float)0x8000, ry=(random(0x10001)-0x8000)/(float)0x8000, rz=(random(0x10001)-0x8000)/(float)0x8000;
          float rmag=sqrtf(rx*rx+ry*ry+rz*rz); if (rmag<0.001f) rmag=1.0f;
          pulses[p].x=rx/rmag; pulses[p].y=ry/rmag; pulses[p].z=rz/rmag;
          pulses[p].start_ms=now_ms;
          float dur_s = (70.0f/idleFrameRate)*(1.0f+random(0x10000)/(float)0x10000);
          pulses[p].duration_ms=(unsigned long)(dur_s*1000.0f);
          pulses[p].active=true; break;
        }
      }
    }
  }
  applyTargetValues(1.0f);
}

void runLightField() {
  unsigned long now_ms = millis();
  float dt = (now_ms-lf_last_ms)/1000.0f; lf_last_ms = now_ms;
  lf_global_time += dt*2.0f*PI*(idleFrameRate/300.0f);
  float inv_threshold = 100.0f/gradientThreshold;
  int delta_r=start_r-end_r, delta_g=start_g-end_g, delta_b=start_b-end_b;
  for (int i = 0; i < RAW_SIZE; i++) {
    uint32_t hf=(uint32_t)(i+1)*2654435761u, hb=(uint32_t)(i+1)*2246822519u, hp=(uint32_t)(i+1)*3266489917u;
    float factor=(hf>>16)*(10.0f/65536.0f)+0.5f, rb=(hb>>16)*(0.9f/65536.0f)+0.1f, phase=(hp>>16)*(2.0f*PI/65536.0f);
    float v=fmaxf(sinf(fmodf(lf_global_time*factor+phase,2.0f*PI)),0.0f)*(rb*rb);
    render_values[i]=v;
    float tv=v*inv_threshold; if (tv>1.0f) tv=1.0f;
    float scale=v*brightness_factor;
    int r = (int)((end_r+delta_r*tv)*scale);
    int g = (int)((end_g+delta_g*tv)*scale);
    int b = (int)((end_b+delta_b*tv)*scale);
    STRIP_SET(i, b + (g << 8) + (r << 16));
  }
}

void runLightning() {
  float decay=expf(-idleFrameRate/60.0f);
  for (int i = 0; i < RAW_SIZE; i++) lightning_fluid[i]*=decay;
  lightning_time_pressure+=((float)random(0x10000)/0x10000)*idleFrameRate/200.0f;
  if (lightning_time_pressure >= 1.0f) {
    lightning_time_pressure=0.0f;
    int sink=random(SIZE);
    lightning_fluid[dupes_to_uniques[sink][0]]=1.0f; lightning_fluid[dupes_to_uniques[sink][1]]=1.0f;
    for (int i=0;i<SIZE;i++) { lightning_to_sink[i]=-1; lightning_distance[i]=-1; }
    lightning_to_sink[sink]=sink; lightning_distance[sink]=0;
    int q_head=0,q_tail=0; lightning_bfs_queue[q_tail++]=sink;
    while (q_head<q_tail) {
      int node=lightning_bfs_queue[q_head++];
      for (int j=0;j<MAX_NEIGHBORS;j++) {
        int n=neighbors[node][j]; if (n==0xffff) break;
        if (lightning_distance[n]<0) { lightning_distance[n]=lightning_distance[node]+1; lightning_to_sink[n]=node; lightning_bfs_queue[q_tail++]=n; }
      }
    }
    int source_count=(int)(SIZE*idleDensity/1000);
    for (int s=0;s<source_count;s++) {
      int source=random(SIZE);
      while (source!=sink) {
        int parent=lightning_to_sink[source]; if (parent<0) break;
        float value=0.5f+expf(-(float)lightning_distance[source]/SIZE*100.0f);
        lightning_fluid[dupes_to_uniques[source][0]]=value; lightning_fluid[dupes_to_uniques[source][1]]=value;
        source=parent;
      }
    }
  }
  applyFluidValues(lightning_fluid,1.0f);
}
