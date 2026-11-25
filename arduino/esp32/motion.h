// LSM6DSV16X accelerometer/gyro over I2C. All exposed vectors are in geometry coordinates.

#pragma once

#include <Wire.h>

#define MOTION_ADDR 0x6A

bool motionAvailable = false;
float motionRawAccel[3] = {0.0f, 0.0f, 0.0f};
float motionAccel[3] = {0.0f, 0.0f, 0.0f};
float motionGyro[3] = {0.0f, 0.0f, 0.0f};
float motionUp[3] = {0.0f, 1.0f, 0.0f};

static int motionIntPin = -1;
static int motionAxisIndex[3] = {0, 1, 2};
static float motionAxisSign[3] = {1.0f, 1.0f, 1.0f};
static unsigned long motionLastBump = 0;

static bool motionWrite(uint8_t reg, uint8_t val) {
  Wire.beginTransmission(MOTION_ADDR);
  Wire.write(reg);
  Wire.write(val);
  return Wire.endTransmission() == 0;
}

static bool motionRead(uint8_t reg, uint8_t* buf, size_t len) {
  Wire.beginTransmission(MOTION_ADDR);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((uint8_t)MOTION_ADDR, (uint8_t)len) != len) return false;
  for (size_t i = 0; i < len; i++) {
    buf[i] = Wire.read();
  }
  return true;
}

// "x,-z,y" means geometry x = chip x, geometry y = -chip z, geometry z = chip y
static bool motionParseAxes(const char* axes) {
  int count = 0;
  float sign = 1.0f;
  for (const char* c = axes; *c && count < 3; c++) {
    char ch = tolower(*c);
    if (ch == '-') {
      sign = -1.0f;
    } else if (ch >= 'x' && ch <= 'z') {
      motionAxisIndex[count] = ch - 'x';
      motionAxisSign[count] = sign;
      sign = 1.0f;
      count++;
    }
  }
  return count == 3;
}

bool motionBegin(int sda, int scl, int intPin, const char* axes) {
  if (!motionParseAxes(axes)) {
    Serial.println("Invalid MOTION_AXES: " + String(axes));
    return false;
  }
  Wire.begin(sda, scl, 400000);
  uint8_t id = 0;
  if (!motionRead(0x0F, &id, 1) || id != 0x70) {
    Serial.println("Motion sensor not found (WHO_AM_I=0x" + String(id, HEX) + ")");
    return false;
  }
  const uint8_t init[][2] = {
    {0x12, 0x44},  // CTRL3: BDU, IF_INC
    {0x10, 0x08},  // CTRL1: accel 480 Hz
    {0x11, 0x06},  // CTRL2: gyro 120 Hz
    {0x15, 0x04},  // CTRL6: 2000 dps
    {0x17, 0x02},  // CTRL8: 8 g
    {0x56, 0x0F},  // TAP_CFG0: latched, tap on x/y/z
    {0x57, 0x08},  // TAP_CFG1: x threshold, 0.25 g/LSB
    {0x58, 0x08},  // TAP_CFG2: y threshold
    {0x59, 0x08},  // TAP_THS_6D: z threshold
    {0x5A, 0x7F},  // TAP_DUR: shock 3, quiet 3, dur 7
    {0x5B, 0x00},  // WAKE_UP_THS: single tap only
    {0x5E, 0x40},  // MD1_CFG: single tap on INT1
    {0x50, 0x80},  // FUNCTIONS_ENABLE: interrupts
  };
  for (auto& r : init) {
    if (!motionWrite(r[0], r[1])) {
      Serial.println("Motion sensor write failed at 0x" + String(r[0], HEX));
      return false;
    }
  }
  motionIntPin = intPin;
  pinMode(motionIntPin, INPUT);
  motionAvailable = true;
  Serial.println("Motion sensor ready");
  return true;
}

void motionUpdate() {
  if (!motionAvailable) return;
  uint8_t buf[12];
  if (!motionRead(0x22, buf, 12)) return;
  float gyro[3];
  for (int i = 0; i < 3; i++) {
    gyro[i] = (int16_t)(buf[2*i] | (buf[2*i + 1] << 8)) * 0.07f;
    motionRawAccel[i] = (int16_t)(buf[6 + 2*i] | (buf[7 + 2*i] << 8)) * 0.000244f;
  }
  float len = 0.0f;
  for (int i = 0; i < 3; i++) {
    motionGyro[i] = gyro[motionAxisIndex[i]] * motionAxisSign[i];
    motionAccel[i] = motionRawAccel[motionAxisIndex[i]] * motionAxisSign[i];
    motionUp[i] += (motionAccel[i] - motionUp[i]) * 0.1f;
    len += motionUp[i] * motionUp[i];
  }
  len = sqrtf(len);
  if (len < 0.01f) return;
  for (int i = 0; i < 3; i++) {
    motionUp[i] /= len;
  }
}

bool motionTakeBump() {
  if (!motionAvailable || !digitalRead(motionIntPin)) return false;
  uint8_t src;
  motionRead(0x1D, &src, 1);  // ALL_INT_SRC: clears the latch
  if (millis() - motionLastBump < 1000) return false;
  motionLastBump = millis();
  return true;
}

// Shortest-arc rotation carrying north (0, 1, 0) onto motionUp
void motionTiltToUp(float& x, float& y, float& z) {
  float c = motionUp[1];
  if (c < -0.999f) {
    x = -x;
    y = -y;
    return;
  }
  float wx = motionUp[2];
  float wz = -motionUp[0];
  float cx = -wz * y;
  float cy = wz * x - wx * z;
  float cz = wx * y;
  float k = 1.0f / (1.0f + c);
  float nx = x + cx - wz * cy * k;
  float ny = y + cy + (wz * cx - wx * cz) * k;
  float nz = z + cz + wx * cy * k;
  x = nx;
  y = ny;
  z = nz;
}
