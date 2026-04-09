// WiFi-enabled Lumatron Arduino template for ESP32-C3
// Requires libraries: WiFiManager, WebSockets (Markus Sattler), ArduinoJson, LittleFS
// OTA firmware URL: https://<relayHost>/firmware/<orbID>.bin
// Pixel geometry fetched automatically from https://<relayHost>/pixels/<pixelsName>.bin
//
// On first boot with no /pixels.bin on flash:
//   set config.json: { "ORB_ID": "myorb", "RELAY_HOST": "my.lumatron.art", "PIXELS": "archimedes/rhombicosidodecahedron" }
//   the device will download geometry on first WiFi connect and cache it to /pixels.bin

#include <Adafruit_NeoPixel.h>
#include <math.h>
#include "mbedtls/sha256.h"
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
float *fluid_values = nullptr;
float *lightning_fluid = nullptr;
int16_t *lightning_to_sink = nullptr;
int16_t *lightning_distance = nullptr;
int16_t *lightning_bfs_queue = nullptr;
float *pattern_target = nullptr;
float *render_values = nullptr;

// --- Strip (created in loadGeometry after RAW_SIZE is known) ---
Adafruit_NeoPixel *strip = nullptr;

#define STRIP_SET(i, c) strip->setPixelColor(i, c)
#include "../patterns.h"

Prefs defaultPrefs = {
  PATTERN_DEFAULT, 0x25ff59, 0x00607c, 66, 70.0f, 60.0f, 25.0f, 100,
  0.707f, 0.707f, 0.0f, 0, 8.0f,
  1.0f, 0.0f, 0.0f, 25, 9,
  0.0f, 1.0f, 0.0f
};

// --- Config ---
String orbID;
String relayHost;
String pixelsName;
String orbKey;  // sha256(orbID + masterKey); empty = no auth required

// --- WebSocket ---
WebSocketsClient wsClient;
unsigned long lastPingReceived = 0;

// --- Connected controller client IDs ---
#define MAX_CLIENTS 8
String connectedClients[MAX_CLIENTS];
int clientCount = 0;
String currentPrefName = "";

// --- Timing state ---
bool useTimer = false;
bool weeklyTimer = false;
float dimmer = 1.0f;
String lastTriggeredEventKey = "";
unsigned long nextEventMs = 0;

// --- Backup state ---
unsigned long nextBackupMs = ULONG_MAX;


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
  return p;
}

// ===================== FILE I/O =====================

// Saved presets use individual files matching the Pi format: /savedprefs/<name>.prefs.json
String savedPrefPath(const String& name) {
  return "/savedprefs/" + name + ".prefs.json";
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

// ===================== BACKUP =====================

void sendBackup(const String& nameOverride) {
  JsonDocument doc;
  JsonObject backup = doc["backup"].to<JsonObject>();
  if (nameOverride.length() > 0) backup["nameOverride"] = nameOverride;
  backup["config"]  = readFile("/config.json");
  backup["prefs"]   = readFile("/prefs.json");
  String timingJson = readFile("/timingprefs.json");
  if (!timingJson.isEmpty()) backup["timingprefs"] = timingJson;

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
  Serial.println("Backup sent");
  computeNextBackupMs();
}

void handleRestoreFromBackup(JsonDocument& msg) {
  JsonObject backup = msg["backup"].as<JsonObject>();

  String configStr = backup["config"].as<String>();
  if (!configStr.isEmpty()) writeFile("/config.json", configStr);

  String prefsStr = backup["prefs"].as<String>();
  if (!prefsStr.isEmpty()) writeFile("/prefs.json", prefsStr);

  String timingStr = backup["timingprefs"].as<String>();
  if (!timingStr.isEmpty()) writeFile("/timingprefs.json", timingStr);

  // Replace all saved prefs
  clearDirectory("/savedprefs");
  JsonObjectConst savedPrefs = backup["savedPrefs"].as<JsonObjectConst>();
  for (JsonPairConst kv : savedPrefs) {
    String path = "/savedprefs/" + String(kv.key().c_str());
    writeFile(path.c_str(), kv.value().as<String>());
  }

  writeFile("/currentprefname.txt", "");
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

    if (!pixelsName.isEmpty() && pixelsName != "null" && !relayHost.isEmpty()) {
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
  state["isArduino"] = true;
  state["gameInfo"] = nullptr;
  state["currentText"] = "";
  state["currentPrefName"] = currentPrefName;
  // Build sorted prefNames from /savedprefs/ directory
  {
    JsonArray names = state["prefNames"].to<JsonArray>();
    String arr[16];
    int n = listSavedPrefNames(arr, 16);
    for (int i = 0; i < n; i++) names.add(arr[i]);
  }
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
    prefs["dimmer"] = dimmer;
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

void mergeTimingPrefs(JsonObjectConst timingObj) {
  String existing = readFile("/timingprefs.json");
  JsonDocument merged;
  if (!existing.isEmpty()) deserializeJson(merged, existing);
  for (JsonPairConst kv : timingObj) merged[kv.key()] = kv.value();

  // If timer is being disabled, persist dimmer=1 before writing
  if (!merged["useTimer"].as<bool>()) merged["dimmer"] = 1.0f;

  // Write first so loadTimingPrefs and checkSchedule both see the updated data
  String out; serializeJsonPretty(merged, out); writeFile("/timingprefs.json", out);
  loadTimingPrefs();

  if (useTimer) {
    lastTriggeredEventKey = "";  // re-apply active event on any timing pref change
    checkSchedule();
    computeNextEventMs();
  }
  // When timer disabled, dimmer already set to 1 via loadTimingPrefs reading the file
}

void handleControllerMessage(const String& clientID, const String& message) {
  if (message == "ECHO") { sendToClient(clientID, "ECHO"); return; }

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

    if (!timingDoc.as<JsonObject>().isNull()) mergeTimingPrefs(timingDoc.as<JsonObject>());

    Prefs p = loadPrefs();
    p = prefsFromJson(regularDoc, p);
    savePrefs(p); applyPrefs(p);
    currentPrefName = "";
    writeFile("/currentprefname.txt", "");
    broadcastState();

  } else if (type == "savePrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    Prefs p = loadPrefs();
    JsonDocument entryDoc;
    buildPrefsJson(entryDoc.to<JsonObject>(), p);
    String out; serializeJsonPretty(entryDoc, out);
    writeFile(savedPrefPath(name).c_str(), out);
    currentPrefName = name;
    writeFile("/currentprefname.txt", name);
    broadcastState();

  } else if (type == "loadPrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    String savedJson = readFile(savedPrefPath(name).c_str());
    if (savedJson.isEmpty()) return;
    JsonDocument savedDoc;
    if (deserializeJson(savedDoc, savedJson) != DeserializationError::Ok) return;

    Prefs p = prefsFromJson(savedDoc, defaultPrefs);
    savePrefs(p); applyPrefs(p);
    currentPrefName = name;
    writeFile("/currentprefname.txt", name);
    broadcastState();

  } else if (type == "deletePrefs") {
    String name = doc["name"].as<String>();
    if (name.isEmpty()) return;

    LittleFS.remove(savedPrefPath(name).c_str());

    // Remove from includedInCycles in timingprefs.json
    String timingJson = readFile("/timingprefs.json");
    if (!timingJson.isEmpty()) {
      JsonDocument timingDoc;
      if (deserializeJson(timingDoc, timingJson) == DeserializationError::Ok) {
        JsonObject inc = timingDoc["includedInCycles"].as<JsonObject>();
        if (!inc.isNull()) inc.remove(name);
        String timingOut; serializeJsonPretty(timingDoc, timingOut);
        writeFile("/timingprefs.json", timingOut);
      }
    }

    if (currentPrefName == name) {
      currentPrefName = "";
      writeFile("/currentprefname.txt", "");
    }
    broadcastState();

  } else if (type == "clearPrefs") {
    Prefs p = defaultPrefs;
    savePrefs(p); applyPrefs(p);
    currentPrefName = "";
    writeFile("/currentprefname.txt", "");
    broadcastState();

  } else if (type == "advanceManualFade") {
    dimmer = (dimmer >= 0.5f) ? 0.0f : 1.0f;
    JsonDocument timingDoc;
    String timingJson = readFile("/timingprefs.json");
    if (!timingJson.isEmpty()) deserializeJson(timingDoc, timingJson);
    timingDoc["dimmer"] = dimmer;
    String timingOut; serializeJsonPretty(timingDoc, timingOut);
    writeFile("/timingprefs.json", timingOut);
    broadcastState();

  } else if (type == "renamePref") {
    String originalName = doc["originalName"].as<String>();
    String newName = doc["newName"].as<String>();
    if (originalName.isEmpty() || newName.isEmpty() || originalName == newName) return;

    String savedJson = readFile(savedPrefPath(originalName).c_str());
    if (savedJson.isEmpty()) return;
    writeFile(savedPrefPath(newName).c_str(), savedJson);
    LittleFS.remove(savedPrefPath(originalName).c_str());

    // Rename in timingprefs.json (includedInCycles + schedule events)
    String timingJson = readFile("/timingprefs.json");
    if (!timingJson.isEmpty()) {
      JsonDocument timingDoc;
      if (deserializeJson(timingDoc, timingJson) == DeserializationError::Ok) {
        JsonObject inc = timingDoc["includedInCycles"].as<JsonObject>();
        if (!inc.isNull() && inc.containsKey(originalName)) {
          bool val = inc[originalName].as<bool>();
          inc.remove(originalName);
          inc[newName.c_str()] = val;
        }
        for (JsonObject evt : timingDoc["schedule"].as<JsonArray>())
          if (evt["prefName"].as<String>() == originalName) evt["prefName"] = newName;
        for (JsonObject evt : timingDoc["weeklySchedule"].as<JsonArray>())
          if (evt["prefName"].as<String>() == originalName) evt["prefName"] = newName;
        String timingOut; serializeJsonPretty(timingDoc, timingOut);
        writeFile("/timingprefs.json", timingOut);
      }
    }

    if (currentPrefName == originalName) {
      currentPrefName = newName;
      writeFile("/currentprefname.txt", newName);
    }
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
    loadTimingPrefs();
    checkSchedule();
    computeNextEventMs();
    sendResponse(messageID, "OK");
  } else if (type == "manualBackup") {
    sendBackup(cmd["nameOverride"] | "");
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
    savePrefs(p); applyPrefs(p);
    currentPrefName = ""; writeFile("/currentprefname.txt", "");
    broadcastState();
  } else if (type == "setprefs") {
    // Bulk pref update: { type: "setprefs", prefs: { ... } }
    JsonObject prefs = msg["prefs"].as<JsonObject>();
    Prefs p = loadPrefs();
    JsonDocument doc;
    for (JsonPair kv : prefs) doc[kv.key()] = kv.value();
    p = prefsFromJson(doc, p);
    savePrefs(p); applyPrefs(p);
    currentPrefName = ""; writeFile("/currentprefname.txt", "");
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

// ===================== TIMING =====================

void loadTimingPrefs() {
  String json = readFile("/timingprefs.json");
  if (json.isEmpty()) return;
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;
  if (!doc["useTimer"].isNull())    useTimer    = doc["useTimer"].as<bool>();
  if (!doc["weeklyTimer"].isNull()) weeklyTimer = doc["weeklyTimer"].as<bool>();
  if (!doc["dimmer"].isNull())      dimmer      = doc["dimmer"].as<float>();
}

int parseTimeMinutes(const String& s) {
  if (s.length() < 5) return 0;
  return s.substring(0, 2).toInt() * 60 + s.substring(3, 5).toInt();
}

void triggerScheduleEvent(JsonObject evt) {
  String prefName = evt["prefName"].as<String>();
  bool isOff = (prefName == "OFF");

  if (!isOff) {
    String savedJson = readFile(savedPrefPath(prefName).c_str());
    if (!savedJson.isEmpty()) {
      JsonDocument savedDoc;
      if (deserializeJson(savedDoc, savedJson) == DeserializationError::Ok) {
        Prefs p = prefsFromJson(savedDoc, defaultPrefs);
        savePrefs(p); applyPrefs(p);
        currentPrefName = prefName;
        writeFile("/currentprefname.txt", prefName);
      }
    }
  }

  dimmer = isOff ? 0.0f : 1.0f;

  // Persist dimmer so subsequent loadTimingPrefs() calls don't override the schedule-set value
  String timingJson = readFile("/timingprefs.json");
  JsonDocument timingDoc;
  if (!timingJson.isEmpty()) deserializeJson(timingDoc, timingJson);
  timingDoc["dimmer"] = dimmer;
  String timingOut; serializeJsonPretty(timingDoc, timingOut);
  writeFile("/timingprefs.json", timingOut);
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

  String json = readFile("/timingprefs.json");
  if (json.isEmpty()) return;
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;

  JsonArray sched = weeklyTimer
    ? doc["weeklySchedule"].as<JsonArray>()
    : doc["schedule"].as<JsonArray>();
  if (sched.isNull() || sched.size() == 0) return;

  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int DAY = 24 * 60;

  int minDistFwd = DAY * 7 + 1;
  for (JsonObject evt : sched) {
    int evtMin = parseTimeMinutes(evt["time"].as<String>());
    int dist;
    if (weeklyTimer) {
      int evtDay = evt["weekday"] | 0;
      int dayDiff = (evtDay - t.tm_wday + 7) % 7;
      dist = dayDiff * DAY + (evtMin - nowMin);
      if (dist <= 0) dist += 7 * DAY;
    } else {
      dist = (evtMin - nowMin + DAY) % DAY;
      if (dist == 0) dist = DAY;
    }
    if (dist < minDistFwd) minDistFwd = dist;
  }

  if (minDistFwd < DAY * 7 + 1)
    nextEventMs = millis() + (unsigned long)minDistFwd * 60000UL;
}

// Precompute millis() deadline for the next 2am auto-backup.
void computeNextBackupMs() {
  struct tm t;
  if (!getLocalTime(&t)) {
    nextBackupMs = millis() + 3600000UL;  // retry in 1h if NTP not ready
    return;
  }
  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int TARGET = 2 * 60;  // 2:00am in minutes
  int minsUntil = (TARGET - nowMin + 24 * 60) % (24 * 60);
  if (minsUntil == 0) minsUntil = 24 * 60;
  nextBackupMs = millis() + (unsigned long)minsUntil * 60000UL;
}

void checkSchedule() {
  if (!useTimer) return;
  struct tm t;
  if (!getLocalTime(&t)) return;

  String json = readFile("/timingprefs.json");
  if (json.isEmpty()) return;
  JsonDocument doc;
  if (deserializeJson(doc, json) != DeserializationError::Ok) return;

  JsonArray sched = weeklyTimer
    ? doc["weeklySchedule"].as<JsonArray>()
    : doc["schedule"].as<JsonArray>();
  if (sched.isNull() || sched.size() == 0) return;

  int nowMin = t.tm_hour * 60 + t.tm_min;
  const int DAY = 24 * 60;

  // Find the active event: most recent past event (wraps midnight)
  int activeIdx = -1, activeDistBack = DAY + 1;
  for (int i = 0; i < (int)sched.size(); i++) {
    JsonObject evt = sched[i];
    if (weeklyTimer && (evt["weekday"] | 0) != t.tm_wday) continue;
    int dist = (nowMin - parseTimeMinutes(evt["time"].as<String>()) + DAY) % DAY;
    if (dist < activeDistBack) { activeDistBack = dist; activeIdx = i; }
  }
  if (activeIdx < 0) return;

  JsonObject activeEvt = sched[activeIdx];
  // Key on time only (not prefName) so editing an event's pref doesn't re-trigger it
  String evtKey = String(weeklyTimer ? (int)(activeEvt["weekday"] | 0) : -1) + ":" +
                  activeEvt["time"].as<String>();

  if (evtKey != lastTriggeredEventKey) {
    lastTriggeredEventKey = evtKey;
    triggerScheduleEvent(activeEvt);
    broadcastState();
  }
}

// ===================== SETUP / LOOP =====================

void setup() {
  Serial.begin(115200);
  Serial.println("Starting...");

  randomSeed(analogRead(0));

  LittleFS.begin(true);  // true = format if mount fails
  LittleFS.mkdir("/savedprefs");
  Serial.println("LittleFS mounted");

  // Load config, generating defaults if missing
  String configJson = readFile("/config.json");
  if (configJson.isEmpty()) {
    JsonDocument doc;
    doc["ORB_ID"] = "arduino";
    doc["RELAY_HOST"] = "my.lumatron.art";
    doc["PIXELS"] = "archimedes/octtrue";
    serializeJsonPretty(doc, configJson);
    writeFile("/config.json", configJson);
    Serial.println("Config created with defaults");
  }
  {
    JsonDocument doc;
    deserializeJson(doc, configJson);
    orbID = doc["ORB_ID"].as<String>();
    relayHost = doc["RELAY_HOST"].as<String>();
    pixelsName = doc["PIXELS"].as<String>();
    orbKey = doc["ORB_KEY"] | "";
  }
  Serial.println("Config loaded: ORB_ID=" + orbID + " RELAY_HOST=" + relayHost);

  // Load and apply prefs (write defaults on first boot so getprefs returns something)
  currentPrefName = readFile("/currentprefname.txt");
  Prefs p = loadPrefs();
  savePrefs(p);  // always re-save to ensure format is current
  applyPrefs(p);
  loadTimingPrefs();
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

  // Sync time via NTP
  {
    JsonDocument cfgDoc;
    String cfgJson = readFile("/config.json");
    deserializeJson(cfgDoc, cfgJson);
    const char* tz = cfgDoc["TIMEZONE"] | "PST8PDT,M3.2.0,M11.1.0";  // default: Los Angeles
    configTzTime(tz, "pool.ntp.org", "time.nist.gov");
    Serial.println("NTP configured (tz: " + String(tz) + ")");
  }

  // WebSocket — start before geometry so admin commands work even if geometry fails
  if (!relayHost.isEmpty() && !orbID.isEmpty()) {
    wsClient.beginSSL(relayHost.c_str(), 7777, ("/relay/" + orbID).c_str());
    wsClient.onEvent(webSocketEvent);
    wsClient.setReconnectInterval(5000);
    Serial.println("WebSocket connecting to " + relayHost);
  }

  // Load geometry (fetches from relay if not cached; skipped if PIXELS is unset)
  loadGeometry();
  checkSchedule();
  computeNextEventMs();
  computeNextBackupMs();

  lastPingReceived = millis();
}

void loop() {
  unsigned long loop_start = millis();

  wsClient.loop();
  checkPingTimeout();

  if (loop_start >= nextEventMs) {
    checkSchedule();
    computeNextEventMs();
  }

  if (loop_start >= nextBackupMs) {
    sendBackup("");  // sendBackup calls computeNextBackupMs() to reschedule
  }

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

  // Apply dimmer as post-render pixel scale
  float d = constrain(dimmer, 0.0f, 1.0f);
  if (d < 0.999f) {
    for (int i = 0; i < RAW_SIZE; i++) {
      uint32_t c = strip->getPixelColor(i);
      uint8_t r = ((c >> 16) & 0xff) * d;
      uint8_t g = ((c >> 8)  & 0xff) * d;
      uint8_t b = (c & 0xff)          * d;
      strip->setPixelColor(i, ((uint32_t)r << 16) | ((uint32_t)g << 8) | b);
    }
  }
  strip->show();

  float frame_rate = 30;
  if (idlePattern == PATTERN_DEFAULT || idlePattern == PATTERN_FIREFLIES)
    frame_rate = idleFrameRate;
  int delay_time = (int)(1000.0f / frame_rate) - (int)(millis() - loop_start);
  if (delay_time > 0) delay(delay_time);
}
