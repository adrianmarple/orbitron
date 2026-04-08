// WiFi-enabled Lumatron Arduino template for ESP32-C3
// Requires libraries: WiFiManager, WebSockets (Markus Sattler), ArduinoJson, LittleFS
// OTA firmware URL: https://<relayHost>/firmware/<orbID>.bin
// Pixel geometry fetched automatically from https://<relayHost>/pixels/<pixelsName>.bin
//
// On first boot with no /pixels.bin on flash:
//   set config.json: { "orbID": "myorb", "relayHost": "my.lumatron.art", "pixels": "archimedes/rhombicosidodecahedron" }
//   the device will download geometry on first WiFi connect and cache it to /pixels.bin

#include <Adafruit_NeoPixel.h>
#include <math.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <WebSocketsClient_Generic.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>

#define PIN D10
#define FIRMWARE_VERSION "1.0.0"
#define PING_TIMEOUT_MS 30000
#define MAX_NEIGHBORS 6  // compile-time max; actual neighbor count per pixel determined by pixels.bin

// --- Geometry (loaded at runtime from /pixels.bin) ---
int SIZE = 0;
int RAW_SIZE = 0;
uint16_t (*dupes_to_uniques)[2] = nullptr;
uint16_t (*neighbors)[MAX_NEIGHBORS] = nullptr;
uint16_t *raw_to_unique = nullptr;
float (*coords)[3] = nullptr;

// --- Pattern state (heap-allocated in loadGeometry) ---
#define MAX_HEADS 64
int head_count = 1;
int fluid_heads[MAX_HEADS];
int fluid_head_buffer[MAX_HEADS];
float *fluid_values = nullptr;

#define MAX_PULSES 8
struct PulseState { float x, y, z; unsigned long start_ms, duration_ms; bool active; };
PulseState pulses[MAX_PULSES];

float lf_global_time = 0.0f;
unsigned long lf_last_ms = 0;

float *lightning_fluid = nullptr;
float lightning_time_pressure = 0.0f;
int16_t *lightning_to_sink = nullptr;
int16_t *lightning_distance = nullptr;
int16_t *lightning_bfs_queue = nullptr;

float *pattern_target = nullptr;
float *render_values = nullptr;

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

Prefs defaultPrefs = {
  PATTERN_DEFAULT, 0x25ff59, 0x00607c, 66, 70.0f, 60.0f, 25.0f, 100,
  0.707f, 0.707f, 0.0f, 0, 8.0f,
  1.0f, 0.0f, 0.0f, 25, 9,
  0.0f, 1.0f, 0.0f
};

// --- Prefs globals ---
int idlePattern = PATTERN_DEFAULT;
int start_r, start_g, start_b, end_r, end_g, end_b;
int gradientThreshold;
float idleDensity, idleBlend, idleFrameRate;
int brightness;
float staticDirX, staticDirY, staticDirZ;
int staticRotation;
float staticRotationTime;
float sinDirX, sinDirY, sinDirZ;
int sinMin, rippleWidth;
float patternBiasX, patternBiasY, patternBiasZ;
float alpha, brightness_factor;

// --- Config ---
String orbID;
String relayHost;
String pixelsName;

// --- WebSocket ---
WebSocketsClient wsClient;
unsigned long lastPingReceived = 0;

// --- Strip (created in loadGeometry after RAW_SIZE is known) ---
Adafruit_NeoPixel *strip = nullptr;

// --- Connected controller client IDs ---
#define MAX_CLIENTS 8
String connectedClients[MAX_CLIENTS];
int clientCount = 0;


// ===================== PREFS =====================

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

// Format helpers shared by prefsToJson / prefsFromJson / sendState
const char* patternName(int p) {
  switch (p) {
    case PATTERN_STATIC:     return "static";
    case PATTERN_SIN:        return "sin";
    case PATTERN_PULSES:     return "pulses";
    case PATTERN_FIREFLIES:  return "fireflies";
    case PATTERN_LIGHTFIELD: return "lightfield";
    case PATTERN_LIGHTNING:  return "lightning";
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
  doc["dimmer"]             = 1.0;
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
}

String prefsToJson(Prefs& p) {
  JsonDocument doc;
  buildPrefsJson(doc.to<JsonObject>(), p);
  String out;
  serializeJsonPretty(doc, out);
  return out;
}

Prefs prefsFromJson(JsonDocument& doc, Prefs& base) {
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
  return p;
}

// ===================== FILE I/O =====================

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

// ===================== GEOMETRY =====================

// Binary format written by relay /pixels/<name>.bin endpoint:
//   uint16_t SIZE, uint16_t RAW_SIZE,
//   uint16_t[SIZE][2] dupes_to_uniques,
//   uint16_t[SIZE][MAX_NEIGHBORS] neighbors (0xffff-padded),
//   uint16_t[RAW_SIZE] raw_to_unique,
//   float[SIZE][3] coords
void loadGeometry() {
  // Cache file is named after the pixels config (/ replaced with - for flat FS)
  String cacheName = pixelsName;
  cacheName.replace("/", "-");
  String cachePath = "/" + cacheName + ".bin";

  File f = LittleFS.open(cachePath, "r");
  if (!f) {
    // Clean up any stale .bin files from previous pixel configs
    File root = LittleFS.open("/");
    File entry = root.openNextFile();
    while (entry) {
      String entryPath = "/" + String(entry.name());
      entry.close();
      if (entryPath.endsWith(".bin")) LittleFS.remove(entryPath.c_str());
      entry = root.openNextFile();
    }
    root.close();

    if (!pixelsName.isEmpty() && !relayHost.isEmpty()) {
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
      f = LittleFS.open(cachePath, "r");
    }
  }

  if (!f) {
    Serial.println("No geometry available, using 1-pixel stub");
    SIZE = 1; RAW_SIZE = 1;
  } else {
    uint16_t s, rs;
    f.read((uint8_t*)&s, 2);  SIZE = s;
    f.read((uint8_t*)&rs, 2); RAW_SIZE = rs;
  }

  dupes_to_uniques  = (uint16_t (*)[2])           calloc(SIZE,    sizeof(*dupes_to_uniques));
  neighbors         = (uint16_t (*)[MAX_NEIGHBORS])malloc(SIZE *   sizeof(*neighbors));
  raw_to_unique     = (uint16_t *)                 calloc(RAW_SIZE, sizeof(uint16_t));
  coords            = (float (*)[3])               calloc(SIZE,    sizeof(*coords));
  fluid_values      = (float *)                    calloc(RAW_SIZE, sizeof(float));
  lightning_fluid   = (float *)                    calloc(RAW_SIZE, sizeof(float));
  lightning_to_sink = (int16_t *)                  calloc(SIZE,    sizeof(int16_t));
  lightning_distance= (int16_t *)                  calloc(SIZE,    sizeof(int16_t));
  lightning_bfs_queue=(int16_t *)                  calloc(SIZE,    sizeof(int16_t));
  pattern_target    = (float *)                    calloc(SIZE,    sizeof(float));
  render_values     = (float *)                    calloc(RAW_SIZE, sizeof(float));

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

  strip = new Adafruit_NeoPixel(RAW_SIZE, PIN, NEO_GRB + NEO_KHZ800);
  strip->begin();
}

// ===================== WEBSOCKET =====================

void sendInfoDump() {
  String configJson = readFile("/config.json");
  JsonDocument configDoc;
  deserializeJson(configDoc, configJson);

  JsonDocument msg;
  msg["type"] = "info";
  JsonObject cfg = msg["config"].to<JsonObject>();
  cfg["ORB_ID"] = orbID;
  cfg["PIXELS"] = pixelsName;
  cfg["ARDUINO"] = true;
  cfg["FIRMWARE_VERSION"] = FIRMWARE_VERSION;
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
  state["timestamp"] = (long)millis();
  state["gameInfo"] = nullptr;
  state["currentText"] = "";
  state["currentPrefName"] = "";
  state["prefNames"].to<JsonArray>();          // empty — no saved presets on Arduino
  state["prefTimestamps"].to<JsonObject>();
  state["exclude"].to<JsonObject>();

  JsonObject prefs = state["prefs"].to<JsonObject>();
  buildPrefsJson(prefs, p);

  // Merge timing prefs (schedule, weeklyTimer, dimmer, etc.)
  String timingJson = readFile("/timingprefs.json");
  if (!timingJson.isEmpty()) {
    JsonDocument timingDoc;
    if (deserializeJson(timingDoc, timingJson) == DeserializationError::Ok) {
      for (JsonPair kv : timingDoc.as<JsonObject>()) prefs[kv.key()] = kv.value();
    }
  } else {
    prefs["useTimer"] = false;
    prefs["weeklyTimer"] = false;
    prefs["dimmer"] = 1.0;
    JsonObject evt = prefs["schedule"].to<JsonArray>().add<JsonObject>();
    evt["prefName"] = "OFF"; evt["time"] = "00:00"; evt["fadeIn"] = 10; evt["fadeOut"] = 30;
    prefs["weeklySchedule"].to<JsonArray>();
    prefs["includedInCycles"].to<JsonObject>();
  }

  String stateStr;
  serializeJson(state, stateStr);
  sendToClient(clientID, stateStr);
}

void broadcastState() {
  for (int i = 0; i < clientCount; i++) sendState(connectedClients[i]);
}

void handleControllerMessage(const String& clientID, const String& message) {
  if (message == "ECHO") { sendToClient(clientID, "ECHO"); return; }

  JsonDocument doc;
  if (message.isEmpty() || deserializeJson(doc, message) != DeserializationError::Ok) return;
  if (doc["type"].as<String>() != "prefs") return;

  JsonObject update = doc["update"].as<JsonObject>();
  if (update.isNull()) return;

  // Split: regular prefs go to Prefs struct; timing prefs go to timingprefs.json
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

  if (!timingDoc.as<JsonObject>().isNull()) {
    String existing = readFile("/timingprefs.json");
    JsonDocument merged;
    if (!existing.isEmpty()) deserializeJson(merged, existing);
    for (JsonPair kv : timingDoc.as<JsonObject>()) merged[kv.key()] = kv.value();
    String out; serializeJsonPretty(merged, out); writeFile("/timingprefs.json", out);
  }

  Prefs p = loadPrefs();
  p = prefsFromJson(regularDoc, p);
  savePrefs(p);
  applyPrefs(p);
}

void handleAdminCommand(JsonDocument& msg) {
  String messageID = msg["hash"].as<String>();
  // Command is a JSON string embedded in msg["message"]
  JsonDocument cmdDoc;
  if (deserializeJson(cmdDoc, msg["message"].as<String>()) != DeserializationError::Ok) return;
  JsonObject cmd = cmdDoc.as<JsonObject>();
  String type = cmd["type"].as<String>();

  if (type == "getconfig") {
    sendResponse(messageID, readFile("/config.json"));
  } else if (type == "setconfig") {
    writeFile("/config.json", cmd["data"].as<String>());
    sendResponse(messageID, "OK");
    delay(500);
    ESP.restart();
  } else if (type == "getprefs") {
    sendResponse(messageID, readFile("/prefs.json"));
  } else if (type == "setprefs") {
    String prefsJson = cmd["data"].as<String>();
    JsonDocument doc;
    if (deserializeJson(doc, prefsJson) == DeserializationError::Ok) {
      Prefs p = prefsFromJson(doc, defaultPrefs);
      savePrefs(p);
      applyPrefs(p);
    }
    sendResponse(messageID, "OK");
  } else if (type == "gettimingprefs") {
    String s = readFile("/timingprefs.json");
    sendResponse(messageID, s.isEmpty() ? "{}" : s);
  } else if (type == "settimingprefs") {
    writeFile("/timingprefs.json", cmd["data"].as<String>());
    sendResponse(messageID, "OK");
  } else if (type == "restart") {
    sendResponse(messageID, "OK");
    delay(500);
    ESP.restart();
  } else if (type == "ip") {
    sendResponse(messageID, WiFi.localIP().toString());
  } else if (type == "commit") {
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
    savePrefs(p);
    applyPrefs(p);
    broadcastState();
  } else if (type == "setprefs") {
    // Bulk pref update: { type: "setprefs", prefs: { ... } }
    JsonObject prefs = msg["prefs"].as<JsonObject>();
    Prefs p = loadPrefs();
    JsonDocument doc;
    for (JsonPair kv : prefs) doc[kv.key()] = kv.value();
    p = prefsFromJson(doc, p);
    savePrefs(p);
    applyPrefs(p);
    broadcastState();
  }
}

void performOTA() {
  String url = "https://" + relayHost + "/firmware/" + orbID + ".bin";
  WiFiClientSecure client;
  client.setInsecure();  // replace with setCACert() once cert is pinned
  wsClient.disconnect();
  t_httpUpdate_return ret = httpUpdate.update(client, url);
  switch (ret) {
    case HTTP_UPDATE_OK:
      ESP.restart();  // shouldn't be reached; httpUpdate restarts automatically
      break;
    case HTTP_UPDATE_NO_UPDATES:
      break;
    case HTTP_UPDATE_FAILED:
      // reconnect and carry on
      wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
      break;
  }
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      lastPingReceived = millis();
      sendInfoDump();
      break;

    case WStype_TEXT: {
      String msg = String((char*)payload);
      if (msg == "PING") {
        lastPingReceived = millis();
        return;
      }
      if (msg == "GIT_HAS_UPDATE") { performOTA(); return; }

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
      } else {
        handleOrbMessage(doc);
      }
      break;
    }

    case WStype_DISCONNECTED:
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

// ===================== PATTERNS =====================

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
    strip->setPixelColor(i, (int)((end_b + delta_b * tv) * scale) +
                           ((int)((end_g + delta_g * tv) * scale) << 8) +
                           ((int)((end_r + delta_r * tv) * scale) << 16));
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
    strip->setPixelColor(i, (int)((end_b + delta_b * tv) * scale) +
                           ((int)((end_g + delta_g * tv) * scale) << 8) +
                           ((int)((end_r + delta_r * tv) * scale) << 16));
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
    strip->setPixelColor(i, (int)((end_b + delta_b * tv) * scale) +
                           ((int)((end_g + delta_g * tv) * scale) << 8) +
                           ((int)((end_r + delta_r * tv) * scale) << 16));
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
    strip->setPixelColor(i, (int)((end_b+delta_b*tv)*scale) + ((int)((end_g+delta_g*tv)*scale)<<8) + ((int)((end_r+delta_r*tv)*scale)<<16));
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
    strip->setPixelColor(i, (int)((end_b+delta_b*tv)*scale) + ((int)((end_g+delta_g*tv)*scale)<<8) + ((int)((end_r+delta_r*tv)*scale)<<16));
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
    strip->setPixelColor(i, (int)((end_b+delta_b*tv)*scale) + ((int)((end_g+delta_g*tv)*scale)<<8) + ((int)((end_r+delta_r*tv)*scale)<<16));
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
    strip->setPixelColor(i, (int)((end_b+delta_b*tv)*scale) + ((int)((end_g+delta_g*tv)*scale)<<8) + ((int)((end_r+delta_r*tv)*scale)<<16));
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

// ===================== SETUP / LOOP =====================

void setup() {
  Serial.begin(115200);
  Serial.println("Starting...");

  randomSeed(analogRead(0));

  LittleFS.begin(true);  // true = format if mount fails
  Serial.println("LittleFS mounted");

  // Load config, generating defaults if missing
  String configJson = readFile("/config.json");
  if (configJson.isEmpty()) {
    JsonDocument doc;
    doc["orbID"] = "arduino";
    doc["relayHost"] = "my.lumatron.art";
    doc["pixels"] = "archimedes/octtrue";
    serializeJsonPretty(doc, configJson);
    writeFile("/config.json", configJson);
    Serial.println("Config created with defaults");
  }
  {
    JsonDocument doc;
    deserializeJson(doc, configJson);
    orbID = doc["orbID"].as<String>();
    relayHost = doc["relayHost"].as<String>();
    pixelsName = doc["pixels"].as<String>();
  }
  Serial.println("Config loaded: orbID=" + orbID + " relayHost=" + relayHost);

  // Load and apply prefs (write defaults on first boot so getprefs returns something)
  Prefs p = loadPrefs();
  savePrefs(p);  // always re-save to ensure format is current
  applyPrefs(p);
  Serial.println("Prefs loaded");

  // WiFi (blocks until connected, starts AP portal if needed)
  Serial.println("Starting WiFiManager...");
  WiFiManager wm;
  wm.setAPCallback([](WiFiManager* wm) {
    Serial.println("AP portal started");
    // strip not yet initialized here — geometry loads after WiFi connects
  });
  wm.autoConnect(("Lumatron-" + orbID).c_str());
  Serial.println("WiFi connected: " + WiFi.localIP().toString());

  // Load geometry (fetches from relay if /pixels.bin not cached)
  loadGeometry();

  // WebSocket
  if (!relayHost.isEmpty() && !orbID.isEmpty()) {
    wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
    wsClient.onEvent(webSocketEvent);
    wsClient.setReconnectInterval(5000);
    Serial.println("WebSocket connecting to " + relayHost);
  }

  lastPingReceived = millis();
}

void loop() {
  wsClient.loop();
  checkPingTimeout();

  if (!strip) return;  // geometry not yet loaded

  switch (idlePattern) {
    case PATTERN_STATIC:     runStatic();     break;
    case PATTERN_SIN:        runSin();        break;
    case PATTERN_PULSES:     runPulses();     break;
    case PATTERN_FIREFLIES:  runFireflies();  break;
    case PATTERN_LIGHTFIELD: runLightField(); break;
    case PATTERN_LIGHTNING:  runLightning();  break;
    default:                 runDefault();    break;
  }

  strip->show();

  unsigned long loop_start = millis();
  float frame_rate = 30;
  if (idlePattern == PATTERN_DEFAULT || idlePattern == PATTERN_FIREFLIES)
    frame_rate = idleFrameRate;
  int delay_time = (int)(1000.0f / frame_rate) - (int)(millis() - loop_start);
  if (delay_time > 0) delay(delay_time);
}
