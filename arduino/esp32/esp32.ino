// WiFi-enabled Lumatron Arduino template for ESP32-C3/C6
// Requires libraries: WebSockets by Markus Sattler, ArduinoJson, LittleFS
// OTA firmware URL: https://<relayHost>/firmware/<orbID>.bin
// Pixel geometry fetched automatically from https://<relayHost>/pixels/<pixelsName>.bin
//
// On first boot with no /pixels.bin on flash:
//   set config.json: { "ORB_ID": "myorb", "PIXELS": "archimedes/octtrue" }
//   the device will download geometry on first WiFi connect and cache it to /pixels.bin

#include "ws2812_rmt.h"
#include <math.h>
#include <sys/time.h>
#include "mbedtls/sha256.h"
#include <WiFi.h>
#include <esp_wifi.h>
#include <WiFiClientSecure.h>
#include <DNSServer.h>
#include <WebServer.h>
#include "portal_html.h"
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

// Forward declaration so Arduino's auto-generated function prototypes (which
// it inserts right after this include block) can use Prefs& as a parameter
// type. The full struct is defined later in patterns.h.
struct Prefs;

#ifdef CONFIG_IDF_TARGET_ESP32C6
  #define PIN 18               // GPIO 18 = D10 on XIAO ESP32-C6
  #define DEFAULT_BUTTON_PIN 20 // GPIO 20 = D9  on XIAO ESP32-C6
  #define CHIP_TYPE "esp32c6"
#elif defined(CONFIG_IDF_TARGET_ESP32S3)
  #define PIN 9                // GPIO 9  = D10 on XIAO ESP32-S3
  #define DEFAULT_BUTTON_PIN 8  // GPIO 8  = D9  on XIAO ESP32-S3
  #define CHIP_TYPE "esp32s3"
#else
  #define PIN 10               // GPIO 10 = D10 on XIAO ESP32-C3
  #define DEFAULT_BUTTON_PIN 9  // GPIO 9  = D9  on XIAO ESP32-C3
  #define CHIP_TYPE "esp32c3"
#endif
#ifndef FIRMWARE_VERSION_NUM
#define FIRMWARE_VERSION_NUM 0
#endif
#define FIRMWARE_VERSION (String(FIRMWARE_VERSION_NUM))
#define PING_TIMEOUT_MS 30000
#define MAX_NEIGHBORS 6  // compile-time max; actual neighbor count per pixel determined by pixels.bin

// On S3 (which has OPI PSRAM), allocate geometry in PSRAM so internal DMA-capable
// RAM stays free for I2SClocklessLedDriver's I2S DMA buffers.
// ps_malloc/ps_calloc prefer PSRAM when available (PSRAM=opi in FQBN) and fall
// back to regular heap automatically. On C3/C6 (no PSRAM), use plain malloc/calloc.
#ifdef CONFIG_IDF_TARGET_ESP32S3
  #define GEO_MALLOC(sz)    ps_malloc(sz)
  #define GEO_CALLOC(n, sz) ps_calloc((n), (sz))
#else
  #define GEO_MALLOC(sz)    malloc(sz)
  #define GEO_CALLOC(n, sz) calloc((n), (sz))
#endif

// --- Geometry (loaded at runtime from /pixels.bin) ---
int SIZE = 0;
int RAW_SIZE = 0;
uint16_t (*dupes_to_uniques)[2] = nullptr;
uint16_t (*neighbors)[MAX_NEIGHBORS] = nullptr;
uint16_t *raw_to_unique = nullptr;
float (*coords)[3] = nullptr;
float bbox_min[3] = {0, 0, 0};
float bbox_max[3] = {0, 0, 0};

// --- Pattern state (heap-allocated in loadGeometry) ---
// Scratch: one shared block for pattern-specific arrays; carved per pattern by setupPatternScratch().
// SCRATCH_SIZE = RAW_SIZE*sizeof(float) + SIZE*sizeof(int16_t)*3
// (largest user is LIGHTNING: one float[RAW_SIZE] + three int16_t[SIZE])
uint8_t *scratch = nullptr;
size_t scratch_size = 0;
float *fluid_values = nullptr;       // DEFAULT, FIREFLIES: points into scratch
float *lightning_fluid = nullptr;    // LIGHTNING: points into scratch
int16_t *lightning_to_sink = nullptr;   // LIGHTNING: points into scratch
int16_t *lightning_distance = nullptr;  // LIGHTNING: points into scratch
int16_t *lightning_bfs_queue = nullptr; // LIGHTNING: points into scratch
float *pattern_target = nullptr;     // PULSES, LIGHTFIELD: points into scratch
float *linesine_positions = nullptr; // LINESINE: points into scratch
float *render_values = nullptr;      // permanent; used for inter-frame temporal smoothing

// --- Strip ---
// Renderers write into `pixels` (float RGB, AOS) without clipping, so additive
// blending has free headroom. stripShow() clips to 0..255 and packs into
// `leds` (GRB byte order, the WS2812 wire format) just before DMA. `leds`
// stays in internal SRAM because DMA needs it; `pixels` uses GEO_CALLOC, so
// on S3 it lands in PSRAM (frees ~18KB of internal SRAM at 1500 LEDs; the
// per-frame PSRAM access overhead is ~500-800us, well under the frame budget).
uint8_t *leds = nullptr;          // 3 bytes/LED in GRB order (matches WS2812 wire)
float (*pixels)[3] = nullptr;     // RGB float, [RAW_SIZE][3]

void stripShow() {
  if (!leds || !pixels) return;
  for (int i = 0; i < RAW_SIZE; i++) {
    float fr = pixels[i][0], fg = pixels[i][1], fb = pixels[i][2];
    if (fr < 0) fr = 0; else if (fr > 255) fr = 255;
    if (fg < 0) fg = 0; else if (fg > 255) fg = 255;
    if (fb < 0) fb = 0; else if (fb > 255) fb = 255;
    uint8_t* p = leds + i*3;
    p[0] = (uint8_t)fg;
    p[1] = (uint8_t)fr;
    p[2] = (uint8_t)fb;
  }
  ws2812_show(leds, RAW_SIZE * 3);
}

#include "patterns.h"

Prefs defaultPrefs = {
  PATTERN_DEFAULT, 0x25ff59, 0x00607c, 66, 70.0f, 60.0f, 25.0f, 100,
  0.707f, 0.707f, 0.0f, 0, 8.0f,
  1.0f, 0.0f, 0.0f, 25, 9,
  0.0f, 1.0f, 0.0f, 4.0f
};

// --- Config ---
String orbID;
String relayHost;
String pixelsName;
String orbKey;  // sha256(orbID + masterKey); empty = no auth required
String timezone;
bool continuousIntegration = false;
bool dontReconnect = false;
float maxAvgPixelBrightness = 0;  // 0 = disabled; 0-255 average per channel
bool fullBrightnessOnPowerOn = true;
bool skipAcOnPower = false;

// --- Manual fade pin ---
int buttonPin = 0;  // 0 = disabled (GPIO 0 isn't used as a button on any supported board)
String shortPressAction = "DIM";
String longPressAction = "CYCLE";
String extraLongPressAction = "ACCESS_POINT";
bool fadePinLastState = false;  // true = pressed
unsigned long fadePinPressStart = 0;
bool fadePinLongFired = false;
bool fadePinExtraLongFired = false;
const unsigned long LONG_PRESS_TIME = 700;
const unsigned long EXTRA_LONG_PRESS_TIME = 4000;
bool virtualButtonState = false;  // true = pressed; set by buttonStart/buttonEnd messages

// --- WebSocket ---
WebSocketsClient wsClient;
unsigned long lastPingReceived = 0;

// --- Connected controller client IDs ---
#define MAX_CLIENTS 8
String connectedClients[MAX_CLIENTS];
int clientCount = 0;
String currentPrefName = "";

// Updates the in-memory name and writes to flash only if the value changed.
// Avoids a flash write per prefs tweak (which disables interrupts for ~50ms
// and can underrun the WS2812 DMA encoder, producing visible glitches).
// Holds render_mutex around the write so it happens between frames (no DMA
// active), same protection as savePrefsAndApply.
void setCurrentPrefName(const String& name) {
  if (currentPrefName == name) return;
  bool took = (render_mutex != nullptr);
  if (took) xSemaphoreTake(render_mutex, portMAX_DELAY);
  currentPrefName = name;
  writeFile("/currentprefname.txt", name);
  if (took) xSemaphoreGive(render_mutex);
}

// --- Geometry loaded flag ---
bool geometryLoaded = false;  // true once real geometry (SIZE > 1) is in memory

// --- Timing state ---
bool useTimer = false;
float dimmer = 1.0f;
String lastTriggeredEventKey = "";
unsigned long nextEventMs = 0;
JsonDocument timingPrefsDoc;  // in-memory cache of /timingprefs.json

// --- State drift detection ---
// Cached hash of the most recent state JSON (excluding transient timestamp).
// Broadcast periodically as STATE_HASH:<hex> so controllers can detect drift
// from missed state messages and request a resync.
uint32_t currentStateHash = 0;
unsigned long nextStateHashMs = 0;
const unsigned long STATE_HASH_INTERVAL_MS = 3000;

inline uint32_t fnv1a(const char* s, size_t len) {
  uint32_t h = 2166136261u;
  for (size_t i = 0; i < len; i++) { h ^= (uint8_t)s[i]; h *= 16777619u; }
  return h;
}

// Fade state, recomputed by checkSchedule()
bool fadeStateValid = false;
float curEventMin = 0.0f;     // current event start, minute-of-day
float nextEventMin = 0.0f;    // next event start, minute-of-day
bool curIsOff = true;
bool prevIsOff = true;
bool nextIsOff = true;
float prevFadeIn = 10.0f;     // minutes
float nextFadeOut = 30.0f;    // minutes

// --- Backup state ---
unsigned long nextBackupMs = ULONG_MAX;

// --- Render mutex ---
// Taken by the network task when handling a WebSocket event (modifying shared state).
// Taken by loop() for the duration of each render frame.
// On S3: tasks run on separate cores so this prevents true concurrent access.
// On C3/C6: tasks share one core; mutex is still correct, just has no parallelism benefit.
SemaphoreHandle_t render_mutex = nullptr;
volatile bool apActive = false;


// ===================== PREFS =====================

// Format helpers shared by prefsToJson / prefsFromJson / sendState
const char* patternName(int p) {
  switch (p) {
    case PATTERN_STATIC:     return "static";
    case PATTERN_SIN:        return "sin";
    case PATTERN_PULSES:     return "pulses";
    case PATTERN_FIREFLIES:  return "fireflies";
    case PATTERN_LIGHTFIELD: return "lightfield";
    case PATTERN_LIGHTNING:  return "lightning";
    case PATTERN_LINESINE:   return "linesine";
    default:                 return "default";
  }
}
int patternFromName(const char* name) {
  if (!name) return PATTERN_DEFAULT;
  if (strcmp(name, "static") == 0)     return PATTERN_STATIC;
  if (strcmp(name, "sin") == 0)        return PATTERN_SIN;
  if (strcmp(name, "pulses") == 0)     return PATTERN_PULSES;
  if (strcmp(name, "fireflies") == 0)  return PATTERN_FIREFLIES;
  if (strcmp(name, "lightfield") == 0) return PATTERN_LIGHTFIELD;
  if (strcmp(name, "lightning") == 0)  return PATTERN_LIGHTNING;
  if (strcmp(name, "linesine") == 0)   return PATTERN_LINESINE;
  return PATTERN_DEFAULT;
}
String colorToHex(long color) {
  char buf[8]; snprintf(buf, sizeof(buf), "#%06lx", color & 0xffffff); return String(buf);
}
long hexToColor(const char* hex) {
  if (!hex || hex[0] != '#') return 0; return strtol(hex + 1, nullptr, 16);
}
String dirToString(float x, float y, float z) {
  char buf[64]; snprintf(buf, sizeof(buf), "%g,%g,%g", x, y, z); return String(buf);
}
void parseDir(const char* s, float& x, float& y, float& z) {
  x = y = z = 0.0f; if (!s) return; sscanf(s, "%f,%f,%f", &x, &y, &z);
}

// Serialize prefs in controller-compatible (Python) format
void buildPrefsJson(JsonObject doc, Prefs& p) {
  doc["idleColor"]          = "gradient";  // Arduino only supports gradient
  doc["idlePattern"]        = patternName(p.idlePattern);
  doc["gradientStartColor"] = colorToHex(p.gradientStartColor);
  doc["gradientEndColor"]   = colorToHex(p.gradientEndColor);
  doc["gradientThreshold"]  = p.gradientThreshold;
  doc["brightness"]         = p.brightness;
  doc["dimmer"]             = dimmer;
  doc["idleBlend"]          = p.idleBlend;
  doc["idleDensity"]        = p.idleDensity;
  doc["idleFrameRate"]      = p.idleFrameRate;
  doc["staticDirection"]    = dirToString(p.staticDirX, p.staticDirY, p.staticDirZ);
  doc["sinDirection"]       = dirToString(p.sinDirX, p.sinDirY, p.sinDirZ);
  doc["patternBias"]        = dirToString(p.patternBiasX, p.patternBiasY, p.patternBiasZ);
  doc["staticRotation"]     = (bool)p.staticRotation;
  doc["staticRotationTime"] = p.staticRotationTime;
  doc["rippleWidth"]        = p.rippleWidth;
  doc["sinMin"]             = p.sinMin;
  doc["sinWaveCycles"]      = p.sinWaveCycles;
}

String prefsToJson(Prefs& p) {
  JsonDocument doc;
  buildPrefsJson(doc.to<JsonObject>(), p);
  String out;
  serializeJsonPretty(doc, out);
  return out;
}

Prefs prefsFromJson(JsonVariantConst doc, Prefs& base) {
  Prefs p = base;
  // Strings must be strings (they come from our own serialization)
  if (doc["idlePattern"].is<const char*>())
    p.idlePattern = patternFromName(doc["idlePattern"].as<const char*>());
  if (doc["gradientStartColor"].is<const char*>())
    p.gradientStartColor = hexToColor(doc["gradientStartColor"].as<const char*>());
  if (doc["gradientEndColor"].is<const char*>())
    p.gradientEndColor = hexToColor(doc["gradientEndColor"].as<const char*>());
  if (doc["staticDirection"].is<const char*>())
    parseDir(doc["staticDirection"].as<const char*>(), p.staticDirX, p.staticDirY, p.staticDirZ);
  if (doc["sinDirection"].is<const char*>())
    parseDir(doc["sinDirection"].as<const char*>(), p.sinDirX, p.sinDirY, p.sinDirZ);
  if (doc["patternBias"].is<const char*>())
    parseDir(doc["patternBias"].as<const char*>(), p.patternBiasX, p.patternBiasY, p.patternBiasZ);
  // Numerics: use as<T>() so string "42" (from HTML range inputs) coerces correctly
  if (!doc["gradientThreshold"].isNull())  p.gradientThreshold  = doc["gradientThreshold"].as<int>();
  if (!doc["brightness"].isNull())         p.brightness         = doc["brightness"].as<int>();
  if (!doc["idleBlend"].isNull())          p.idleBlend          = doc["idleBlend"].as<float>();
  if (!doc["idleDensity"].isNull())        p.idleDensity        = doc["idleDensity"].as<float>();
  if (!doc["idleFrameRate"].isNull())      p.idleFrameRate      = doc["idleFrameRate"].as<float>();
  if (!doc["staticRotationTime"].isNull()) p.staticRotationTime = doc["staticRotationTime"].as<float>();
  if (!doc["rippleWidth"].isNull())        p.rippleWidth        = doc["rippleWidth"].as<int>();
  if (!doc["sinMin"].isNull())             p.sinMin             = doc["sinMin"].as<int>();
  if (!doc["staticRotation"].isNull())     p.staticRotation     = doc["staticRotation"].as<bool>() ? 1 : 0;
  if (!doc["sinWaveCycles"].isNull())      p.sinWaveCycles      = doc["sinWaveCycles"].as<float>();
  return p;
}

// ===================== FILE I/O =====================

// Saved presets use individual files matching the Pi format: /savedprefs/<name>.prefs.json
String savedPrefPath(const String& name) {
  return "/savedprefs/" + name + ".prefs.json";
}

// Apply saved prefOrder from a timingprefs JsonDocument to an already-populated arr.
// Names in prefOrder come first (in order), remaining names appended at end.
int applyPrefOrder(String* arr, int n, const JsonDocument& timingDoc) {
  JsonArrayConst order = timingDoc["prefOrder"].as<JsonArrayConst>();
  if (order.isNull() || order.size() == 0) return n;
  String ordered[16];
  int count = 0;
  for (JsonVariantConst v : order) {
    String name = v.as<String>();
    for (int i = 0; i < n; i++) {
      if (arr[i] == name) { ordered[count++] = name; arr[i] = ""; break; }
    }
  }
  for (int i = 0; i < n; i++) {
    if (!arr[i].isEmpty()) ordered[count++] = arr[i];
  }
  for (int i = 0; i < count; i++) arr[i] = ordered[i];
  return count;
}

// List saved preset names from /savedprefs/ directory, sorted alphabetically.
// Returns count written into arr (capped at maxNames).
int listSavedPrefNames(String* arr, int maxNames) {
  int n = 0;
  File dir = LittleFS.open("/savedprefs");
  if (!dir || !dir.isDirectory()) return 0;
  File entry = dir.openNextFile();
  while (entry && n < maxNames) {
    String fname = String(entry.name());
    int slash = fname.lastIndexOf('/');
    if (slash >= 0) fname = fname.substring(slash + 1);
    entry.close();
    if (fname.endsWith(".prefs.json"))
      arr[n++] = fname.substring(0, fname.length() - 11);
    entry = dir.openNextFile();
  }
  dir.close();
  for (int i = 0; i < n-1; i++)
    for (int j = 0; j < n-1-i; j++)
      if (arr[j] > arr[j+1]) { String t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t; }
  return n;
}

// Delete all files in a directory (non-recursive)
void clearDirectory(const char* dirPath) {
  File dir = LittleFS.open(dirPath);
  if (!dir || !dir.isDirectory()) return;
  String paths[32];
  int count = 0;
  File entry = dir.openNextFile();
  while (entry && count < 32) {
    if (!entry.isDirectory()) {
      String name = String(entry.name());
      if (!name.startsWith("/")) name = String(dirPath) + "/" + name;
      paths[count++] = name;
    }
    entry.close();
    entry = dir.openNextFile();
  }
  dir.close();
  for (int i = 0; i < count; i++) LittleFS.remove(paths[i].c_str());
}

String readFile(const char* path) {
  File f = LittleFS.open(path, "r");
  if (!f) return "";
  String s = f.readString();
  f.close();
  return s;
}

void writeFile(const char* path, const String& content) {
  File f = LittleFS.open(path, "w");
  if (f) { f.print(content); f.close(); }
}

Prefs loadPrefs() {
  String json = readFile("/prefs.json");
  if (json.isEmpty()) return defaultPrefs;
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return defaultPrefs;
  return prefsFromJson(doc, defaultPrefs);
}

void savePrefs(Prefs& p) {
  writeFile("/prefs.json", prefsToJson(p));
}

// Save + apply prefs with a single render_mutex acquisition. The mutex is
// held while we (a) write prefs.json to flash (~50ms with all interrupts
// disabled) and (b) mutate the pattern globals. The render task can't be
// mid-stripShow() during this — its DMA isn't active, so the flash write's
// interrupt-disable can't underrun the WS2812 encoder ISR.
void savePrefsAndApply(Prefs& p) {
  bool took = (render_mutex != nullptr);
  if (took) xSemaphoreTake(render_mutex, portMAX_DELAY);
  savePrefs(p);
  applyPrefs(p);
  if (took) xSemaphoreGive(render_mutex);
}

// ===================== BACKUP =====================

void sendBackup(const String& nameOverride) {
  JsonDocument doc;
  JsonObject backup = doc["backup"].to<JsonObject>();
  if (nameOverride.length() > 0) backup["nameOverride"] = nameOverride;
  backup["config"]  = readFile("/config.json");
  backup["prefs"]   = readFile("/prefs.json");
  if (!timingPrefsDoc.isNull()) {
    String timingJson;
    serializeJsonPretty(timingPrefsDoc, timingJson);
    backup["timingprefs"] = timingJson;
  }

  JsonObject savedPrefsObj = backup["savedPrefs"].to<JsonObject>();
  File dir = LittleFS.open("/savedprefs");
  if (dir && dir.isDirectory()) {
    File entry = dir.openNextFile();
    while (entry) {
      if (!entry.isDirectory()) {
        String fname = String(entry.name());
        int slash = fname.lastIndexOf('/');
        if (slash >= 0) fname = fname.substring(slash + 1);
        if (fname.endsWith(".prefs.json"))
          savedPrefsObj[fname] = entry.readString();
      }
      entry.close();
      entry = dir.openNextFile();
    }
    dir.close();
  }

  String out;
  serializeJson(doc, out);
  wsClient.sendTXT(out);
  Serial.println("Backup sent" + (nameOverride.length() > 0 ? " (name: " + nameOverride + ")" : ""));
  computeNextBackupMs();
}

void handleRestoreFromBackup(JsonDocument& msg) {
  JsonObject backup = msg["backup"].as<JsonObject>();

  String configStr = backup["config"].as<String>();
  if (!configStr.isEmpty()) writeFile("/config.json", configStr);

  String prefsStr = backup["prefs"].as<String>();
  if (!prefsStr.isEmpty()) writeFile("/prefs.json", prefsStr);

  String timingStr = backup["timingprefs"].as<String>();
  if (!timingStr.isEmpty()) {
    writeFile("/timingprefs.json", timingStr);
    loadTimingPrefs();
  }

  // Replace all saved prefs
  clearDirectory("/savedprefs");
  JsonObjectConst savedPrefs = backup["savedPrefs"].as<JsonObjectConst>();
  for (JsonPairConst kv : savedPrefs) {
    String path = "/savedprefs/" + String(kv.key().c_str());
    writeFile(path.c_str(), kv.value().as<String>());
  }

  setCurrentPrefName("");
  Serial.println("Backup restored, restarting...");
  delay(500);
  ESP.restart();
}

// ===================== GEOMETRY =====================

// Binary format written by relay /pixels/<name>.bin endpoint:
//   uint16_t SIZE, uint16_t RAW_SIZE,
//   uint16_t[SIZE][2] dupes_to_uniques,
//   uint16_t[SIZE][MAX_NEIGHBORS] neighbors (0xffff-padded),
//   uint16_t[RAW_SIZE] raw_to_unique,
//   float[SIZE][3] coords

// Download geometry from relay to LittleFS cache. No-op if cache already exists.
// Must be called with WiFi connected.
void fetchGeometryToCache() {
  if (pixelsName.isEmpty() || pixelsName == "null" || relayHost.isEmpty()) return;

  String cacheName = pixelsName;
  cacheName.replace("/", "-");
  String cachePath = "/" + cacheName + ".bin";
  if (LittleFS.exists(cachePath)) return;

  // Clean up any stale .bin files from previous pixel configs
  String stalePaths[16];
  int staleCount = 0;
  File root = LittleFS.open("/");
  File entry = root.openNextFile();
  while (entry && staleCount < 16) {
    String name = String(entry.name());
    if (!name.startsWith("/")) name = "/" + name;
    entry.close();
    if (name.endsWith(".bin")) stalePaths[staleCount++] = name;
    entry = root.openNextFile();
  }
  root.close();
  for (int i = 0; i < staleCount; i++) LittleFS.remove(stalePaths[i].c_str());

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = "https://" + relayHost + "/pixels/" + pixelsName + ".bin";
  Serial.println("Fetching geometry: " + url);
  http.begin(client, url);
  int code = http.GET();
  if (code == 200) {
    File out = LittleFS.open(cachePath, "w");
    if (out) { http.writeToStream(&out); out.close(); }
    else Serial.println("Failed to open " + cachePath + " for write");
  } else {
    Serial.println("Geometry fetch failed: HTTP " + String(code));
  }
  http.end();
}

// Load geometry from LittleFS cache into memory. Falls back to 1-pixel mode if cache missing.
// Safe to call a second time under render_mutex (e.g. after fetchGeometryToCache on S3).
void loadGeometry() {
  String cacheName = pixelsName;
  cacheName.replace("/", "-");
  String cachePath = "/" + cacheName + ".bin";

  File f = LittleFS.open(cachePath, "r");
  if (!f) {
    Serial.println("Geometry unavailable, falling back to 1-pixel mode");
    SIZE = 1; RAW_SIZE = 1;
  } else {
    uint16_t s, rs;
    f.read((uint8_t*)&s, 2);  SIZE = s;
    f.read((uint8_t*)&rs, 2); RAW_SIZE = rs;
  }

  dupes_to_uniques  = (uint16_t (*)[2])           GEO_CALLOC(SIZE,    sizeof(*dupes_to_uniques));
  neighbors         = (uint16_t (*)[MAX_NEIGHBORS])GEO_MALLOC(SIZE *   sizeof(*neighbors));
  raw_to_unique     = (uint16_t *)                 GEO_CALLOC(RAW_SIZE, sizeof(uint16_t));
  coords            = (float (*)[3])               GEO_CALLOC(SIZE,    sizeof(*coords));
  scratch_size      = (size_t)RAW_SIZE * sizeof(float) + (size_t)SIZE * sizeof(int16_t) * 3;
  scratch           = (uint8_t *)                  GEO_MALLOC(scratch_size);
  render_values     = (float *)                    GEO_CALLOC(RAW_SIZE, sizeof(float));

  if (!dupes_to_uniques || !neighbors || !raw_to_unique || !coords || !scratch || !render_values) {
    Serial.println("loadGeometry: allocation failed, falling back to 1-pixel mode");
    SIZE = 1; RAW_SIZE = 1;
    if (f) f.close();
    return;
  }

  // Fill neighbors with 0xffff sentinel so patterns terminate correctly
  memset(neighbors, 0xff, SIZE * sizeof(*neighbors));

  if (f) {
    f.read((uint8_t*)dupes_to_uniques, SIZE * sizeof(*dupes_to_uniques));
    f.read((uint8_t*)neighbors,        SIZE * sizeof(*neighbors));
    f.read((uint8_t*)raw_to_unique,    RAW_SIZE * sizeof(uint16_t));
    f.read((uint8_t*)coords,           SIZE * sizeof(*coords));
    f.close();
    Serial.printf("Geometry loaded: SIZE=%d RAW_SIZE=%d\n", SIZE, RAW_SIZE);
  }

  // Compute bounding box. Initialized to include the origin (matches Pi engine.py).
  for (int d = 0; d < 3; d++) { bbox_min[d] = 0.0f; bbox_max[d] = 0.0f; }
  for (int i = 0; i < SIZE; i++)
    for (int d = 0; d < 3; d++) {
      if (coords[i][d] < bbox_min[d]) bbox_min[d] = coords[i][d];
      if (coords[i][d] > bbox_max[d]) bbox_max[d] = coords[i][d];
    }

  setupPatternScratch(idlePattern);

  // (Re)allocate the GRB pixel buffer and (re)init the RMT-DMA driver.
  // ws2812_begin is idempotent — safe on the second loadGeometry() call
  // after first-boot geometry fetch.
  free(leds);
  free(pixels);
  leds = (uint8_t*)calloc(RAW_SIZE * 3, sizeof(uint8_t));
  pixels = (float (*)[3])GEO_CALLOC(RAW_SIZE, sizeof(float[3]));
  ws2812_begin(PIN, RAW_SIZE);

  geometryLoaded = (SIZE > 1);
}

// ===================== WEBSOCKET =====================

void sendInfoDump() {
  String configJson = readFile("/config.json");
  JsonDocument configDoc;
  deserializeJson(configDoc, configJson);

  // Strip sensitive/hardware fields
  configDoc.remove("ORB_KEY");
  configDoc.remove("BUTTON_PIN");

  // Tack on fields not stored in config.json
  configDoc["ARDUINO"] = true;
  configDoc["FIRMWARE_VERSION"] = FIRMWARE_VERSION;

  JsonDocument msg;
  msg["type"] = "info";
  msg["config"] = configDoc;
  String out;
  serializeJson(msg, out);
  wsClient.sendTXT(out);
}

void sendResponse(const String& messageID, const String& data) {
  JsonDocument doc;
  doc["messageID"] = messageID;
  doc["data"] = data;
  String out;
  serializeJson(doc, out);
  wsClient.sendTXT(out);
}

// ===================== CONTROLLER STATE =====================

void sendToClient(const String& clientID, const String& message) {
  JsonDocument envelope;
  envelope["clientID"] = clientID;
  envelope["message"] = message;
  String out;
  serializeJson(envelope, out);
  wsClient.sendTXT(out);
}

void sendState(const String& clientID) {
  Prefs p = loadPrefs();
  JsonDocument state;
  state["isArduino"] = true;
  state["gameInfo"] = nullptr;
  state["currentText"] = "";
  state["currentPrefName"] = currentPrefName;
  state["prefTimestamps"].to<JsonObject>();
  state["exclude"].to<JsonObject>();

  JsonObject prefs = state["prefs"].to<JsonObject>();
  buildPrefsJson(prefs, p);

  // Build prefNames from /savedprefs/ directory, applying saved order
  {
    JsonArray names = state["prefNames"].to<JsonArray>();
    String arr[16];
    int n = listSavedPrefNames(arr, 16);
    if (!timingPrefsDoc.isNull()) n = applyPrefOrder(arr, n, timingPrefsDoc);
    for (int i = 0; i < n; i++) names.add(arr[i]);
  }

  if (!timingPrefsDoc.isNull()) {
    for (JsonPair kv : timingPrefsDoc.as<JsonObject>()) prefs[kv.key()] = kv.value();
    // Ensure includedInCycles is always present (may be absent in older timingprefs.json)
    if (!prefs["includedInCycles"].is<JsonObject>()) prefs["includedInCycles"].to<JsonObject>();
  } else {
    prefs["useTimer"] = false;
    prefs["dimmer"] = dimmer;
    JsonObject evt = prefs["schedule"].to<JsonArray>().add<JsonObject>();
    evt["prefName"] = "OFF"; evt["time"] = "00:00"; evt["fadeIn"] = 10; evt["fadeOut"] = 30;
    prefs["includedInCycles"].to<JsonObject>();
  }
  // Always ship the full timing schema. Vue 2's reactivity is only set up for
  // keys present in the initial state.prefs broadcast — if useTimer (or any
  // other timing toggle) is missing, the checkbox v-model and the watcher
  // that pushes changes back to the orb both go dormant for it.
  if (prefs["useTimer"].isNull())               prefs["useTimer"]    = false;
  if (prefs["weeklyTimer"].isNull())            prefs["weeklyTimer"] = false;
  if (!prefs["schedule"].is<JsonArray>())       prefs["schedule"].to<JsonArray>();
  if (!prefs["weeklySchedule"].is<JsonArray>()) prefs["weeklySchedule"].to<JsonArray>();

  // Compute hash from the stable state (without transient timestamp). Then
  // add timestamp + hash and serialize a second time for the actual send.
  String stableStr;
  serializeJson(state, stableStr);
  currentStateHash = fnv1a(stableStr.c_str(), stableStr.length());

  state["timestamp"] = (long)millis();
  state["stateHash"] = String(currentStateHash, HEX);
  String stateStr;
  serializeJson(state, stateStr);
  sendToClient(clientID, stateStr);
}

void broadcastStateHash() {
  if (clientCount == 0) return;
  String msg = "STATE_HASH:" + String(currentStateHash, HEX);
  for (int i = 0; i < clientCount; i++) sendToClient(connectedClients[i], msg);
}

void broadcastState() {
  for (int i = 0; i < clientCount; i++) sendState(connectedClients[i]);
}

void mergeTimingPrefs(JsonObjectConst timingObj) {
  bool prevUseTimer = useTimer;

  for (JsonPairConst kv : timingObj) timingPrefsDoc[kv.key()] = kv.value();

  // If timer is being disabled, persist dimmer=1 before writing
  if (!timingPrefsDoc["useTimer"].as<bool>()) timingPrefsDoc["dimmer"] = 1.0f;

  // Update globals and write file
  if (!timingPrefsDoc["useTimer"].isNull()) useTimer = timingPrefsDoc["useTimer"].as<bool>();
  if (!timingPrefsDoc["dimmer"].isNull())   dimmer   = timingPrefsDoc["dimmer"].as<float>();
  Serial.println("mergeTimingPrefs: useTimer=" + String(useTimer) + " dimmer=" + String(dimmer));
  saveTimingPrefs();

  if (useTimer) {
    // Only force a re-trigger when the timer is first turned on. checkSchedule
    // already triggers naturally when the active event's evtKey differs from
    // lastTriggeredEventKey, which covers genuine schedule edits. Resetting on
    // every echo of `schedule` (the controller round-trips it after each state
    // broadcast) would re-fire the active event seconds after the real trigger
    // — visible as a brief render hiccup and pattern-scratch reset.
    if (!prevUseTimer) lastTriggeredEventKey = "";
    checkSchedule();
    computeNextEventMs();
  }
  // When timer disabled, dimmer already set to 1 above and persisted via saveTimingPrefs
}

void handleControllerMessage(const String& clientID, const String& message) {
  if (message == "ECHO") {
    sendToClient(clientID, "ECHO");
    sendState(clientID);
    return;
  }
  if (message == "RESYNC") {
    // Controller detected a state-hash mismatch — send a fresh state without
    // also echoing (ECHO has openOrb-handshake semantics we don't want here).
    sendState(clientID);
    return;
  }

  JsonDocument doc;
  if (message.isEmpty() || deserializeJson(doc, message) != DeserializationError::Ok) return;

  String type = doc["type"].as<String>();

  if (type == "prefs") {
    JsonObject update = doc["update"].as<JsonObject>();
    if (update.isNull()) return;

    static const char* timingKeys[] = {
      "useTimer","weeklyTimer","schedule","weeklySchedule","dimmer","includedInCycles", nullptr
    };
    JsonDocument regularDoc, timingDoc;
    for (JsonPair kv : update) {
      bool isTiming = false;
      for (int i = 0; timingKeys[i]; i++) if (strcmp(kv.key().c_str(), timingKeys[i]) == 0) { isTiming = true; break; }
      if (isTiming) timingDoc[kv.key()] = kv.value();
      else          regularDoc[kv.key()] = kv.value();
    }

    JsonObject timingObj = timingDoc.as<JsonObject>();
    if (!timingObj.isNull()) mergeTimingPrefs(timingObj);

    if (!regularDoc.as<JsonObject>().isNull()) {
      Prefs p = loadPrefs();
      p = prefsFromJson(regularDoc, p);
      savePrefsAndApply(p);
      setCurrentPrefName("");
    }
    broadcastState();

  } else if (type == "savePrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    Prefs p = loadPrefs();
    JsonDocument entryDoc;
    buildPrefsJson(entryDoc.to<JsonObject>(), p);
    String out; serializeJsonPretty(entryDoc, out);
    writeFile(savedPrefPath(name).c_str(), out);
    setCurrentPrefName(name);
    broadcastState();

  } else if (type == "loadPrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    String savedJson = readFile(savedPrefPath(name).c_str());
    if (savedJson.isEmpty()) return;
    JsonDocument savedDoc;
    if (deserializeJson(savedDoc, savedJson) != DeserializationError::Ok) return;

    Prefs p = prefsFromJson(savedDoc, defaultPrefs);
    savePrefsAndApply(p);
    setCurrentPrefName(name);
    broadcastState();

  } else if (type == "deletePrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    LittleFS.remove(savedPrefPath(name).c_str());

    // Remove from includedInCycles in timingPrefsDoc
    JsonObject inc = timingPrefsDoc["includedInCycles"].as<JsonObject>();
    if (!inc.isNull()) {
      inc.remove(name);
      saveTimingPrefs();
    }

    if (currentPrefName == name) setCurrentPrefName("");
    broadcastState();

  } else if (type == "clearPrefs") {
    Prefs p = defaultPrefs;
    savePrefsAndApply(p);
    setCurrentPrefName("");
    broadcastState();

  } else if (type == "advanceManualFade") {
    advanceDim();

  } else if (type == "copyPrefs") {
    String name = doc["name"].as<String>();
    String copyName = doc["copyName"].as<String>();
    if (name.isEmpty() || copyName.isEmpty()) return;

    String savedJson = readFile(savedPrefPath(name).c_str());
    if (savedJson.isEmpty()) return;
    writeFile(savedPrefPath(copyName).c_str(), savedJson);
    broadcastState();

  } else if (type == "renamePref") {
    String originalName = doc["originalName"].as<String>();
    String newName = doc["newName"].as<String>();
    if (originalName.isEmpty() || newName.isEmpty() || originalName == newName) return;

    String savedJson = readFile(savedPrefPath(originalName).c_str());
    if (savedJson.isEmpty()) return;
    writeFile(savedPrefPath(newName).c_str(), savedJson);
    LittleFS.remove(savedPrefPath(originalName).c_str());

    // Rename in timingPrefsDoc (includedInCycles + schedule events)
    {
      JsonObject inc = timingPrefsDoc["includedInCycles"].as<JsonObject>();
      if (!inc.isNull() && inc.containsKey(originalName)) {
        bool val = inc[originalName].as<bool>();
        inc.remove(originalName);
        inc[newName.c_str()] = val;
      }
      for (JsonObject evt : timingPrefsDoc["schedule"].as<JsonArray>())
        if (evt["prefName"].as<String>() == originalName) evt["prefName"] = newName;
      saveTimingPrefs();
    }

    if (currentPrefName == originalName) setCurrentPrefName(newName);
    broadcastState();

  } else if (type == "buttonStart") {
    virtualButtonState = true;

  } else if (type == "buttonEnd") {
    virtualButtonState = false;

  } else if (type == "reorderPrefs") {
    String name = doc["name"].as<String>();
    String targetName = doc["targetName"].as<String>();
    if (name.isEmpty() || targetName.isEmpty() || name == targetName) return;

    String names[16];
    int n = listSavedPrefNames(names, 16);
    n = applyPrefOrder(names, n, timingPrefsDoc);

    int from = -1, to = -1;
    for (int i = 0; i < n; i++) {
      if (names[i] == name) from = i;
      if (names[i] == targetName) to = i;
    }
    if (from < 0 || to < 0) return;
    String tmp = names[from];
    if (from < to) {
      for (int i = from; i < to; i++) names[i] = names[i+1];
    } else {
      for (int i = from; i > to; i--) names[i] = names[i-1];
    }
    names[to] = tmp;

    timingPrefsDoc["prefOrder"].to<JsonArray>();
    for (int i = 0; i < n; i++) timingPrefsDoc["prefOrder"].add(names[i]);
    saveTimingPrefs();
    broadcastState();
  }
}

String sha256hex(const String& input) {
  unsigned char hash[32];
  mbedtls_sha256((const unsigned char*)input.c_str(), input.length(), hash, 0);
  char buf[65];
  for (int i = 0; i < 32; i++) snprintf(buf + i*2, 3, "%02x", hash[i]);
  buf[64] = '\0';
  return String(buf);
}

void handleAdminCommand(JsonDocument& msg) {
  String messageID = msg["hash"].as<String>();
  String messageStr = msg["message"].as<String>();

  // Validate hash if ORB_KEY is configured (silently drop on failure, same as Pi)
  if (orbKey.length() > 0 && sha256hex(messageStr + orbKey) != messageID) return;

  JsonDocument cmdDoc;
  if (deserializeJson(cmdDoc, messageStr) != DeserializationError::Ok) return;

  // Validate timestamp if NTP is synced (Unix time > 2024-01-01)
  long long timestamp = cmdDoc["timestamp"] | 0LL;
  time_t now = time(nullptr);
  if (now > 1704067200L && timestamp > 0LL) {
    long long nowMs = (long long)now * 1000LL;
    if (nowMs > timestamp + 10000LL || timestamp > nowMs + 10000LL) return;
  }

  JsonObject cmd = cmdDoc.as<JsonObject>();
  String type = cmd["type"].as<String>();

  if (type == "getconfig") {
    sendResponse(messageID, readFile("/config.json"));
  } else if (type == "setconfig") {
    String data = cmd["data"].as<String>();
    JsonDocument testDoc;
    if (deserializeJson(testDoc, data) != DeserializationError::Ok) {
      sendResponse(messageID, "ERROR: invalid JSON");
      return;
    }
    writeFile("/config.json", data);
    sendResponse(messageID, "OK");
    delay(500);
    ESP.restart();
  } else if (type == "getprefs") {
    sendResponse(messageID, readFile("/prefs.json"));
  } else if (type == "updatePrefs") {
    JsonObject update = cmd["update"].as<JsonObject>();
    if (!update.isNull()) {
      Prefs p = loadPrefs();
      p = prefsFromJson(update, p);
      savePrefsAndApply(p);
      setCurrentPrefName("");
      broadcastState();
    }
    sendResponse(messageID, "OK");
  } else if (type == "setprefs") {
    String prefsJson = cmd["data"].as<String>();
    JsonDocument doc;
    if (deserializeJson(doc, prefsJson) == DeserializationError::Ok) {
      Prefs p = prefsFromJson(doc, defaultPrefs);
      savePrefsAndApply(p);
    }
    sendResponse(messageID, "OK");
  } else if (type == "gettimingprefs") {
    String s;
    if (timingPrefsDoc.isNull()) s = "{}";
    else serializeJsonPretty(timingPrefsDoc, s);
    sendResponse(messageID, s);
  } else if (type == "settimingprefs") {
    writeFile("/timingprefs.json", cmd["data"].as<String>());
    loadTimingPrefs();
    checkSchedule();
    computeNextEventMs();
    sendResponse(messageID, "OK");
  } else if (type == "manualBackup") {
    sendBackup(cmd["nameOverride"] | "");
    sendResponse(messageID, "OK");
  } else if (type == "clearwifi") {
    sendResponse(messageID, "OK");
    delay(200);
    WiFi.disconnect(/*wifioff=*/false, /*eraseap=*/true);
    delay(300);
    ESP.restart();
  } else if (type == "restart") {
    sendResponse(messageID, "OK");
    delay(500);
    ESP.restart();
  } else if (type == "ip") {
    sendResponse(messageID, WiFi.localIP().toString());
  } else if (type == "version") {
    sendResponse(messageID, FIRMWARE_VERSION);
  } else if (type == "getlog") {
    sendResponse(messageID, "No log on Arduino");
  } else if (type == "geterror") {
    sendResponse(messageID, "No error log on Arduino");
  } else {
    sendResponse(messageID, "Not supported on Arduino");
  }
}

void handleOrbMessage(JsonDocument& msg) {
  String type = msg["type"].as<String>();

  if (type == "setpref") {
    // Single pref update: { type: "setpref", name: "...", value: ... }
    Prefs p = loadPrefs();
    JsonDocument wrapper;
    wrapper[msg["name"].as<String>()] = msg["value"];
    p = prefsFromJson(wrapper, p);
    savePrefsAndApply(p);
    setCurrentPrefName("");
    broadcastState();
  } else if (type == "setprefs") {
    // Bulk pref update: { type: "setprefs", prefs: { ... } }
    JsonObject prefs = msg["prefs"].as<JsonObject>();
    Prefs p = loadPrefs();
    JsonDocument doc;
    for (JsonPair kv : prefs) doc[kv.key()] = kv.value();
    p = prefsFromJson(doc, p);
    savePrefsAndApply(p);
    setCurrentPrefName("");
    broadcastState();
  }
}

void performOTA() {
  String url = "https://" + relayHost + "/firmware/" + CHIP_TYPE + ".bin?version=" + FIRMWARE_VERSION_NUM;
  Serial.println("OTA check: " + url);
  WiFiClientSecure client;
  client.setInsecure();  // TODO: implement certificate pinning
  wsClient.disconnect();

  // Render one final frame with pixel 0 forced to green as the OTA indicator,
  // then hold render_mutex through the entire update so the render loop blocks
  // Pixel 0 is only lit when the dimmer/fade isn't fully off.
  xSemaphoreTake(render_mutex, portMAX_DELAY);
  if (leds && pixels) {
    renderFrame();
    if (computeFade() > 0.0f) { pixels[0][0] = 0; pixels[0][1] = 255; pixels[0][2] = 0; }
    stripShow();
  }

  t_httpUpdate_return ret = httpUpdate.update(client, url);
  switch (ret) {
    case HTTP_UPDATE_OK:
      Serial.println("OTA update applied, restarting");
      ESP.restart();  // shouldn't be reached; httpUpdate restarts automatically
      break;
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("OTA: already up to date");
      wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
      break;
    case HTTP_UPDATE_FAILED:
      Serial.println("OTA failed: " + httpUpdate.getLastErrorString());
      // reconnect and carry on
      wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
      break;
  }
  xSemaphoreGive(render_mutex);
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  // Note: no render_mutex here — webSocketEvent runs in networkTask, same task as wsClient.loop(),
  // so it can't race with itself. Render loop only races on idlePattern/color reads, which are
  // harmless single-frame glitches if they change mid-frame.
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket connected");
      lastPingReceived = millis();
      sendInfoDump();
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      if (msg == "PING") {
        lastPingReceived = millis();
        return;
      }
      if (msg == "FORCE_UPDATE") {
        Serial.println("FORCE_UPDATE received, starting OTA immediately");
        performOTA();
        return;
      }
      if (msg == "HAS_UPDATE") {
        Serial.println("HAS_UPDATE received, CI=" + String(continuousIntegration ? "true" : "false"));
        if (continuousIntegration) performOTA();
        return;
      }

      JsonDocument doc;
      if (deserializeJson(doc, msg) != DeserializationError::Ok) return;

      // Relay forwards controller messages as { clientID, message, closed }
      if (doc.containsKey("clientID")) {
        String clientID = doc["clientID"].as<String>();
        bool closed = doc["closed"] | false;
        if (closed) {
          for (int i = 0; i < clientCount; i++) {
            if (connectedClients[i] == clientID) {
              connectedClients[i] = connectedClients[--clientCount];
              break;
            }
          }
        } else {
          bool found = false;
          for (int i = 0; i < clientCount; i++) {
            if (connectedClients[i] == clientID) { found = true; break; }
          }
          if (!found && clientCount < MAX_CLIENTS)
            connectedClients[clientCount++] = clientID;
          handleControllerMessage(clientID, doc["message"].as<String>());
          sendState(clientID);
        }
        return;
      }

      String msgType = doc["type"].as<String>();
      if (msgType == "admin") {
        handleAdminCommand(doc);
      } else if (msgType == "restoreFromBackup") {
        handleRestoreFromBackup(doc);
      } else {
        handleOrbMessage(doc);
      }
      break;
    }

    case WStype_DISCONNECTED:
      Serial.println("WebSocket disconnected");
      break;

    default:
      break;
  }
}

void checkPingTimeout() {
  if (millis() - lastPingReceived > PING_TIMEOUT_MS) {
    wsClient.disconnect();
    lastPingReceived = millis();
  }
}

// ===================== MANUAL FADE PIN =====================

void advanceDim() {
  dimmer = (dimmer >= 0.5f) ? 0.0f : 1.0f;
  Serial.println("advanceDim: dimmer=" + String(dimmer));
  saveDimmer();
  broadcastState();
}

// Load next saved preset. Cycles only includedInCycles presets; falls back to all presets if none are included.
void advanceCycle() {
  JsonObject inc = timingPrefsDoc["includedInCycles"].as<JsonObject>();

  String names[16];
  int n = listSavedPrefNames(names, 16);
  n = applyPrefOrder(names, n, timingPrefsDoc);
  String cyclable[16];
  int cycleCount = 0;
  for (int i = 0; i < n; i++) {
    if (!inc.isNull() && inc[names[i]].as<bool>()) cyclable[cycleCount++] = names[i];
  }
  String* cycle = cyclable;
  int cycleLen = cycleCount;
  if (cycleLen == 0) { cycle = names; cycleLen = n; }
  if (cycleLen == 0) return;

  int currentIdx = -1;
  for (int i = 0; i < cycleLen; i++) {
    if (cycle[i] == currentPrefName) { currentIdx = i; break; }
  }
  String nextName = cycle[(currentIdx + 1) % cycleLen];

  String savedJson = readFile(savedPrefPath(nextName).c_str());
  if (savedJson.isEmpty()) return;
  JsonDocument savedDoc;
  if (deserializeJson(savedDoc, savedJson) != DeserializationError::Ok) return;
  Prefs p = prefsFromJson(savedDoc, defaultPrefs);
  savePrefsAndApply(p);
  setCurrentPrefName(nextName);
  broadcastState();
}

void performPinAction(const String& action) {
  if (action == "DIM") advanceDim();
  else if (action == "CYCLE") advanceCycle();
  else if (action == "ACCESS_POINT") runCaptivePortal();
}

// Poll fade pin each loop(). Short fires immediately on release.
// Long fires while held past LONG_PRESS_TIME. Extra-long fires while held past EXTRA_LONG_PRESS_TIME.
void checkFadePin() {
  // true = pressed. OR logic: pressed if hardware OR virtual is pressed.
  bool state = virtualButtonState;
  if (buttonPin) state = state || !digitalRead(buttonPin);  // INPUT_PULLUP: LOW = pressed
  unsigned long now = millis();

  if (!fadePinLastState && state) {
    // Rising edge: press started
    fadePinPressStart = now;
    fadePinLongFired = false;
    fadePinExtraLongFired = false;
  } else if (fadePinLastState && !state) {
    // Falling edge: released. Short fires only if neither long nor extra-long fired.
    if (!fadePinLongFired) performPinAction(shortPressAction);
    fadePinLongFired = false;
    fadePinExtraLongFired = false;
  } else if (state) {
    unsigned long held = now - fadePinPressStart;
    if (!fadePinLongFired && held >= LONG_PRESS_TIME) {
      fadePinLongFired = true;
      performPinAction(longPressAction);
    }
    if (!fadePinExtraLongFired && held >= EXTRA_LONG_PRESS_TIME) {
      fadePinExtraLongFired = true;
      performPinAction(extraLongPressAction);
    }
  }

  fadePinLastState = state;
}

// ===================== TIMING =====================

void saveTimingPrefs() {
  String out;
  serializeJsonPretty(timingPrefsDoc, out);
  writeFile("/timingprefs.json", out);
}

void saveDimmer() {
  timingPrefsDoc["dimmer"] = dimmer;
  saveTimingPrefs();
}

void loadTimingPrefs() {
  String json = readFile("/timingprefs.json");
  timingPrefsDoc.clear();
  if (json.isEmpty()) return;
  if (deserializeJson(timingPrefsDoc, json) != DeserializationError::Ok) {
    timingPrefsDoc.clear();
    return;
  }
  if (!timingPrefsDoc["useTimer"].isNull()) useTimer = timingPrefsDoc["useTimer"].as<bool>();
  if (!timingPrefsDoc["dimmer"].isNull())   dimmer   = timingPrefsDoc["dimmer"].as<float>();
  Serial.println("loadTimingPrefs: useTimer=" + String(useTimer) + " dimmer=" + String(dimmer));
}

int parseTimeMinutes(const String& s) {
  if (s.length() < 5) return 0;
  return s.substring(0, 2).toInt() * 60 + s.substring(3, 5).toInt();
}

void triggerScheduleEvent(JsonObject evt, JsonObject prevEvt) {
  String prefName = evt["prefName"].as<String>();
  bool isOff = (prefName == "OFF");
  bool prevWasOff = (prevEvt["prefName"].as<String>() == "OFF");

  if (!isOff) {
    String savedJson = readFile(savedPrefPath(prefName).c_str());
    if (!savedJson.isEmpty()) {
      JsonDocument savedDoc;
      if (deserializeJson(savedDoc, savedJson) == DeserializationError::Ok) {
        Prefs p = prefsFromJson(savedDoc, defaultPrefs);
        savePrefsAndApply(p);
        setCurrentPrefName(prefName);
      }
    }
  }

  // Match Pi update_schedule(): only reset dimmer when transitioning to/from OFF.
  // Non-OFF → non-OFF leaves dimmer alone (so manual dim persists across events).
  bool changed = false;
  if (isOff)            { dimmer = 0.0f; changed = true; }
  else if (prevWasOff)  { dimmer = 1.0f; changed = true; }
  Serial.println("triggerScheduleEvent: prefName=" + prefName +
                 " prevOff=" + String(prevWasOff) + " dimmer=" + String(dimmer));

  // Persist dimmer so subsequent loadTimingPrefs() calls don't override the schedule-set value
  if (changed) saveDimmer();
}

// Precompute when the next schedule event fires and store as millis() deadline.
void computeNextEventMs() {
  nextEventMs = ULONG_MAX;
  if (!useTimer) return;
  struct tm t;
  if (!getLocalTime(&t)) {
    nextEventMs = millis() + 60000UL;  // retry NTP in 60s
    return;
  }

  JsonArray sched = timingPrefsDoc["schedule"].as<JsonArray>();
  if (sched.isNull() || sched.size() == 0) return;

  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int DAY = 24 * 60;

  int minDistFwd = DAY + 1;
  for (JsonObject evt : sched) {
    int dist = (parseTimeMinutes(evt["time"].as<String>()) - nowMin + DAY) % DAY;
    if (dist == 0) dist = DAY;
    if (dist < minDistFwd) minDistFwd = dist;
  }

  // Subtract the sub-minute already elapsed so we fire on the event's actual
  // wall-clock boundary, not the next whole-minute boundary measured from now
  // (gap during which computeFade's `remaining` wraps to ~DAY and saturates
  // fade to 1, popping the previous preset to full brightness). gettimeofday
  // gives microsecond precision once NTP has synced; convert to ms.
  if (minDistFwd < DAY + 1) {
    struct timeval tv;
    gettimeofday(&tv, nullptr);
    unsigned long subMinMs = (unsigned long)((tv.tv_sec % 60) * 1000 + tv.tv_usec / 1000);
    nextEventMs = millis() + (unsigned long)minDistFwd * 60000UL - subMinMs;
  }
}

// Precompute millis() deadline for the next 2am auto-backup.
void computeNextBackupMs() {
  struct tm t;
  if (!getLocalTime(&t)) {
    nextBackupMs = millis() + 3600000UL;  // retry in 1h if NTP not ready
    Serial.println("computeNextBackupMs: NTP not ready, retrying in 1h");
    return;
  }
  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int TARGET = 2 * 60;  // 2:00am in minutes
  int minsUntil = (TARGET - nowMin + 24 * 60) % (24 * 60);
  if (minsUntil == 0) minsUntil = 24 * 60;
  nextBackupMs = millis() + (unsigned long)minsUntil * 60000UL;
  Serial.println("Next backup/OTA in " + String(minsUntil) + " min");
}

void checkSchedule() {
  fadeStateValid = false;
  if (!useTimer) return;
  struct tm t;
  if (!getLocalTime(&t)) return;

  JsonArray sched = timingPrefsDoc["schedule"].as<JsonArray>();
  if (sched.isNull() || sched.size() == 0) return;

  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int DAY = 24 * 60;
  int n = (int)sched.size();

  // Find the active event: most recent past event (wraps midnight)
  int activeIdx = -1, activeDistBack = DAY + 1;
  for (int i = 0; i < n; i++) {
    int dist = (nowMin - parseTimeMinutes(sched[i]["time"].as<String>()) + DAY) % DAY;
    if (dist < activeDistBack) { activeDistBack = dist; activeIdx = i; }
  }
  if (activeIdx < 0) return;

  JsonObject activeEvt = sched[activeIdx];
  int activeMin = parseTimeMinutes(activeEvt["time"].as<String>());

  // Find prev and next events relative to active. Single-event schedule: prev=next=active.
  int prevIdx = activeIdx, nextIdx = activeIdx;
  if (n > 1) {
    int prevDist = DAY + 1, nextDist = DAY + 1;
    for (int i = 0; i < n; i++) {
      if (i == activeIdx) continue;
      int em = parseTimeMinutes(sched[i]["time"].as<String>());
      int back = (activeMin - em + DAY) % DAY; if (back == 0) back = DAY;
      int fwd  = (em - activeMin + DAY) % DAY; if (fwd  == 0) fwd  = DAY;
      if (back < prevDist) { prevDist = back; prevIdx = i; }
      if (fwd  < nextDist) { nextDist = fwd;  nextIdx = i; }
    }
  }

  JsonObject prevEvt = sched[prevIdx];
  JsonObject nextEvt = sched[nextIdx];

  // Cache fade state
  curEventMin  = (float)activeMin;
  nextEventMin = (float)parseTimeMinutes(nextEvt["time"].as<String>());
  curIsOff  = (activeEvt["prefName"].as<String>() == "OFF");
  prevIsOff = (prevEvt["prefName"].as<String>()   == "OFF");
  nextIsOff = (nextEvt["prefName"].as<String>()   == "OFF");
  prevFadeIn  = prevEvt["fadeIn"].isNull()  ? 10.0f : prevEvt["fadeIn"].as<float>();
  nextFadeOut = nextEvt["fadeOut"].isNull() ? 30.0f : nextEvt["fadeOut"].as<float>();
  fadeStateValid = true;

  // Key on time only (not prefName) so editing an event's pref doesn't re-trigger it
  String evtKey = activeEvt["time"].as<String>();
  if (evtKey != lastTriggeredEventKey) {
    lastTriggeredEventKey = evtKey;
    triggerScheduleEvent(activeEvt, prevEvt);
    broadcastState();
  }
}

// Matches Python prefs.fade(): linear fade-in from previous event, fade-out toward next,
// with durations only honored on transitions involving an OFF event (else 0.2 min crossfade).
// Capped by manual dimmer.
float computeFade() {
  float clampedDimmer = constrain(dimmer, 0.0f, 1.0f);
  if (!useTimer || !fadeStateValid || curIsOff) return clampedDimmer;
  struct tm t;
  if (!getLocalTime(&t)) return clampedDimmer;
  struct timeval tv;
  gettimeofday(&tv, nullptr);
  // tm_sec is integer; add tv_usec so nowMin advances every frame, not every
  // second. Otherwise the fade `d` is constant for ~30 frames at a time and
  // every pixel steps in lockstep at the second boundary, masking the natural
  // per-pixel/per-channel uint8 quantization waves.
  float nowMin = t.tm_hour * 60.0f + t.tm_min + (t.tm_sec + tv.tv_usec / 1e6f) / 60.0f;
  const float DAY = 24.0f * 60.0f;
  float elapsed   = fmodf(nowMin - curEventMin  + DAY, DAY);
  float remaining = fmodf(nextEventMin - nowMin + DAY, DAY);

  float startDur = max(0.01f, prevIsOff ? prevFadeIn  : 0.2f);
  float endDur   = max(0.01f, nextIsOff ? nextFadeOut : 0.2f);
  float startFade = elapsed   / startDur;
  float endFade   = remaining / endDur;
  float fade = min(startFade, endFade);
  fade = constrain(fade, 0.0f, 1.0f);
  return min(fade, clampedDimmer);
}

// ===================== CAPTIVE PORTAL =====================

// Try to connect using saved NVS credentials. If unavailable or timed out,
// spin up a captive portal AP so the user can enter WiFi credentials.
// Blocks until connected (either from NVS or portal entry).

static DNSServer portalDNS;
static WebServer portalHTTP(80);

// Start AP, DNS catch-all, and HTTP server. Loop until WiFi connects.
void runCaptivePortal() {
  Serial.println("Starting captive portal AP...");
  WiFi.mode(WIFI_AP_STA);
  String apName = "Lumatron-" + orbID;
  WiFi.softAP(apName.c_str());
  IPAddress apIP = WiFi.softAPIP();
  Serial.println("AP: " + apName + " IP: " + apIP.toString());

  // Start async scan immediately
  WiFi.scanNetworks(/*async=*/true);

  // DNS: redirect all queries to the AP IP
  portalDNS.start(53, "*", apIP);

  // Serve captive-portal redirect for OS probes
  auto redirectToRoot = []() {
    portalHTTP.sendHeader("Location", "http://192.168.4.1/");
    portalHTTP.send(302, "text/plain", "");
  };
  portalHTTP.on("/generate_204", HTTP_GET, redirectToRoot);       // Android
  portalHTTP.on("/hotspot-detect.html", HTTP_GET, redirectToRoot); // iOS
  portalHTTP.on("/ncsi.txt", HTTP_GET, redirectToRoot);            // Windows

  // Serve the portal HTML
  portalHTTP.on("/", HTTP_GET, []() {
    portalHTTP.send_P(200, "text/html", PORTAL_HTML);
  });

  // Orb info (orbID + firmware version)
  portalHTTP.on("/info", HTTP_GET, []() {
    String json = "{\"orbID\":\"" + orbID + "\",\"version\":\"" + FIRMWARE_VERSION + "\"}";
    portalHTTP.send(200, "application/json", json);
  });

  // WiFi scan results; kicks off a new async scan for next request
  portalHTTP.on("/scan", HTTP_GET, []() {
    int n = WiFi.scanComplete();
    String json = "[";
    if (n > 0) {
      for (int i = 0; i < n; i++) {
        if (i) json += ",";
        String ssid = WiFi.SSID(i);
        ssid.replace("\\", "\\\\");
        ssid.replace("\"", "\\\"");
        json += "{\"ssid\":\"" + ssid + "\",\"rssi\":" + WiFi.RSSI(i) +
                ",\"open\":" + (WiFi.encryptionType(i) == WIFI_AUTH_OPEN ? "true" : "false") + "}";
      }
    }
    json += "]";
    portalHTTP.send(200, "application/json", json);
    // Kick off next scan for next refresh
    WiFi.scanNetworks(/*async=*/true);
  });

  // Connect handler: WiFi.begin with supplied creds, wait up to 15s
  portalHTTP.on("/connect", HTTP_POST, []() {
    String ssid = portalHTTP.arg("ssid");
    String password = portalHTTP.arg("password");
    Serial.println("Portal: connecting to SSID: " + ssid);
    WiFi.begin(ssid.c_str(), password.c_str());
    unsigned long t0 = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - t0 < 15000) {
      delay(200);
      portalDNS.processNextRequest();
    }
    if (WiFi.status() == WL_CONNECTED) {
      String ip = WiFi.localIP().toString();
      portalHTTP.send(200, "application/json", "{\"success\":true,\"ip\":\"" + ip + "\"}");
      Serial.println("Portal: connected, IP=" + ip);
    } else {
      WiFi.disconnect();
      portalHTTP.send(200, "application/json", "{\"success\":false}");
      Serial.println("Portal: connection failed");
    }
  });

  portalHTTP.begin();
  Serial.println("Portal HTTP server started");

  // Loop until connected
  apActive = true;
  while (WiFi.status() != WL_CONNECTED) {
    portalDNS.processNextRequest();
    portalHTTP.handleClient();
  }
  apActive = false;

  portalHTTP.stop();
  portalDNS.stop();
  WiFi.mode(WIFI_STA);
  Serial.println("Portal: WiFi connected, IP=" + WiFi.localIP().toString());
}

// Returns true if WiFi credentials are saved in NVS.
bool hasSavedWifiCredentials() {
  wifi_config_t conf;
  if (esp_wifi_get_config(WIFI_IF_STA, &conf) != ESP_OK) return false;
  return strlen((const char*)conf.sta.ssid) > 0;
}

// Try NVS creds first. If no creds saved, run captive portal.
// If creds exist but network is unavailable, continue without portal.
void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(!dontReconnect);
  // Keep the radio in active mode rather than the default DTIM-based modem
  // sleep — the periodic radio wake-ups produce non-deterministic interrupt
  // bursts that can disrupt WS2812 timing under DMA-RMT. Costs ~50-100mA.
  WiFi.setSleep(WIFI_PS_NONE);
  if (!hasSavedWifiCredentials()) {
    Serial.println("No saved WiFi credentials, launching portal");
    runCaptivePortal();
    return;
  }
  WiFi.begin();  // uses last credentials stored in NVS
  Serial.println("Connecting to WiFi: " + WiFi.SSID() + "...");
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 10000) {
    delay(200);
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("WiFi connected: " + WiFi.localIP().toString());
  } else if (!skipAcOnPower && esp_reset_reason() == ESP_RST_POWERON) {
    Serial.println("WiFi unavailable on power-up, launching portal");
    runCaptivePortal();
  } else {
    Serial.println("WiFi unavailable, continuing without portal");
  }
}

// ===================== SETUP / LOOP =====================

void setup() {
  Serial.begin(115200);
  Serial.println("========================================");
  Serial.println("  Firmware version: " + FIRMWARE_VERSION);
  Serial.println("========================================");

  randomSeed(esp_random());

  LittleFS.begin(true);  // true = format if mount fails
  LittleFS.mkdir("/savedprefs");
  Serial.println("LittleFS mounted");

  // Load config, generating defaults if missing
  String configJson = readFile("/config.json");
  if (configJson.isEmpty()) {
    JsonDocument doc;
    doc["ORB_ID"] = "arduino";
    doc["PIXELS"] = "archimedes/octtrue";
    serializeJsonPretty(doc, configJson);
    writeFile("/config.json", configJson);
    Serial.println("Config created with defaults");
  }
  {
    JsonDocument doc;
    deserializeJson(doc, configJson);
    orbID = doc["ORB_ID"].as<String>();
    relayHost = doc["RELAY_HOST"] | "my.lumatron.art";
    pixelsName = doc["PIXELS"].as<String>();
    orbKey = doc["ORB_KEY"] | "";
    timezone = doc["TIMEZONE"] | "PST8PDT,M3.2.0,M11.1.0";
    continuousIntegration = doc["CONTINUOUS_INTEGRATION"] | false;
    dontReconnect = doc["DONT_RECONNECT"] | false;
    maxAvgPixelBrightness = doc["MAX_AVG_PIXEL_BRIGHTNESS"] | 0.0f;
    buttonPin = doc["BUTTON_PIN"] | DEFAULT_BUTTON_PIN;
    shortPressAction = doc["SHORT_PRESS_ACTION"] | "DIM";
    longPressAction = doc["LONG_PRESS_ACTION"] | "CYCLE";
    extraLongPressAction = doc["EXTRA_LONG_PRESS_ACTION"] | "ACCESS_POINT";
    fullBrightnessOnPowerOn = doc["FULL_BRIGHTNESS_ON_POWER_ON"] | true;
    // Default to "skip" if the piece has a hardware button (user can launch
    // AP via long-press); otherwise default to "don't skip" so the AP comes
    // up automatically when WiFi fails on a fresh boot.
    skipAcOnPower = doc["SKIP_AC_ON_POWER"] | (bool)buttonPin;
  }
  Serial.println("Config loaded: ORB_ID=" + orbID + " RELAY_HOST=" + relayHost);

  // Load and apply prefs (write defaults on first boot so getprefs returns something)
  currentPrefName = readFile("/currentprefname.txt");
  Prefs p = loadPrefs();
  savePrefsAndApply(p);  // re-save to normalize format, then apply (no mutex contention at boot)
  loadTimingPrefs();
  if (fullBrightnessOnPowerOn && esp_reset_reason() == ESP_RST_POWERON && dimmer != 1.0f) {
    dimmer = 1.0f;
    saveDimmer();
    Serial.println("Power-on reset: dimmer set to 1");
  }
  Serial.println("Prefs loaded (dimmer=" + String(dimmer) + ")");

  if (buttonPin) {
    pinMode(buttonPin, INPUT_PULLUP);
    fadePinLastState = !digitalRead(buttonPin);  // INPUT_PULLUP: LOW=pressed, so invert
    Serial.println("Button pin: GPIO " + String(buttonPin));
  }

  // Load geometry from cache so render loop can start immediately.
  // WiFi, NTP, geometry fetch (if cache missing), and WebSocket init happen in networkTask.
  // On S3 with PSRAM, geometry is allocated in PSRAM so internal DMA RAM stays free for RMT.
  loadGeometry();

  render_mutex = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(networkTask, "net", 16384, nullptr, 1, nullptr, 0);
  vTaskPrioritySet(nullptr, 2);
}

void renderAPRings() {
  float width = 0.1f;
  for (int i = 0; i < RAW_SIZE; i++) {
    int u = raw_to_unique[i];
    float dot = -coords[u][1];  // direction (0,-1,0): south pole origin
    float add = 0.0f;
    for (int n = 0; n < 4; n++) {
      float t = 1.0f - fmodf(millis()/6000.0f + n/4.0f, 1.0f);
      add += pulseSample(dot, t, width);
    }
    if (add <= 0.0f) continue;
    float v = add * 100.0f;
    pixels[i][0] += v;
    pixels[i][1] += v;
    pixels[i][2] += v;
  }
}

void networkTask(void*) {
  // Network init deferred from setup() so render loop can start immediately.
  connectWiFi();
  configTzTime(timezone.c_str(), "pool.ntp.org", "time.nist.gov");
  Serial.println("NTP configured (tz: " + timezone + ")");

  if (!geometryLoaded) {
    fetchGeometryToCache();
    xSemaphoreTake(render_mutex, portMAX_DELAY);
    loadGeometry();
    xSemaphoreGive(render_mutex);
  }

  if (!relayHost.isEmpty() && !orbID.isEmpty()) {
    wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
    wsClient.onEvent(webSocketEvent);
    wsClient.setReconnectInterval(5000);
    Serial.println("WebSocket connecting to " + relayHost);
    unsigned long wsDeadline = millis() + 10000;
    while (!wsClient.isConnected() && millis() < wsDeadline) {
      wsClient.loop();
      delay(10);
    }
    Serial.println(wsClient.isConnected() ? "WebSocket connected" : "WebSocket did not connect in time, continuing");
  }

  lastPingReceived = millis();
  checkSchedule();
  computeNextEventMs();
  computeNextBackupMs();

  for (;;) {
    wsClient.loop();
    checkPingTimeout();
    checkFadePin();

    unsigned long now = millis();
    if (now >= nextEventMs) {
      Serial.println("Timer event triggered");
      checkSchedule();
      computeNextEventMs();
    }
    if (now >= nextBackupMs) {
      Serial.println("2am backup/OTA triggered");
      sendBackup("");  // sendBackup calls computeNextBackupMs() to reschedule
      performOTA();
    }
    if (now >= nextStateHashMs) {
      broadcastStateHash();
      nextStateHashMs = now + STATE_HASH_INTERVAL_MS;
    }

    delay(1);
  }
}

// Pattern switch + dimmer post-scale + power cap. Caller holds render_mutex
// and is responsible for any overlays (AP rings, OTA indicator) and strip->Show().
void renderFrame() {
  switch (idlePattern) {
    case PATTERN_STATIC:     runStatic();     break;
    case PATTERN_SIN:        runSin();        break;
    case PATTERN_PULSES:     runPulses();     break;
    case PATTERN_FIREFLIES:  runFireflies();  break;
    case PATTERN_LIGHTFIELD: runLightField(); break;
    case PATTERN_LIGHTNING:  runLightning();  break;
    case PATTERN_LINESINE:   runLineSine();   break;
    default:                 runDefault();    break;
  }

  // Apply timer fade + manual dimmer as post-render pixel scale
  float d = computeFade();
  if (d < 0.999f) {
    for (int i = 0; i < RAW_SIZE; i++) {
      pixels[i][0] *= d;
      pixels[i][1] *= d;
      pixels[i][2] *= d;
    }
  }

  // Apply MAX_AVG_PIXEL_BRIGHTNESS power cap. Sum the clamped (0..255) values
  // so the cap matches what'll actually drive the LEDs, not the headroom above.
  if (maxAvgPixelBrightness > 0) {
    float total = 0;
    for (int i = 0; i < RAW_SIZE; i++) {
      for (int c = 0; c < 3; c++) {
        float v = pixels[i][c];
        if (v > 255) v = 255; else if (v < 0) v = 0;
        total += v;
      }
    }
    float maxTotal = (float)maxAvgPixelBrightness * RAW_SIZE * 3;
    if (total > maxTotal) {
      float scale = maxTotal / total;
      for (int i = 0; i < RAW_SIZE; i++) {
        pixels[i][0] *= scale;
        pixels[i][1] *= scale;
        pixels[i][2] *= scale;
      }
    }
  }
}

void loop() {
  if (!leds || !pixels) {  // allocation error fallback
    delay(10);
    return;
  }

  xSemaphoreTake(render_mutex, portMAX_DELAY);
  if (!leds || !pixels) {
    xSemaphoreGive(render_mutex);
    delay(10);
    return;
  }

  unsigned long loop_start = millis();

  renderFrame();

  if (apActive) renderAPRings();

  stripShow();

  float frame_rate = 30;
  if (idlePattern == PATTERN_DEFAULT || idlePattern == PATTERN_FIREFLIES)
    frame_rate = idleFrameRate;
  int delay_time = (int)(1000.0f / frame_rate - (millis() - loop_start));

  xSemaphoreGive(render_mutex);

  delay(max(delay_time, 1));  // always yield at least 1ms so idle task feeds WDT
}
