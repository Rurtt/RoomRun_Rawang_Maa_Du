#include <Arduino.h>
#include <Wire.h>
#include "config.h"
#include "sensors.h"

static const uint8_t MPU = 0x68;
static const float ACCEL_LSB = 4096.0f;  // +-8 g
static const float GYRO_LSB = 16.4f;     // +-2000 deg/s
static const float G = 9.80665f;

static void mpuWrite(uint8_t reg, uint8_t v) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  Wire.write(v);
  Wire.endTransmission();
}

bool sensorsBegin() {
  analogReadResolution(12);
#if FAKE_MOTION
  return true;
#else
  Wire.begin(PIN_SDA, PIN_SCL);
  Wire.setClock(400000);
  Wire.beginTransmission(MPU);
  if (Wire.endTransmission() != 0) return false;  // no MPU6050 on the bus
  mpuWrite(0x6B, 0x00);  // wake
  delay(10);
  mpuWrite(0x1A, 0x03);  // DLPF ~44 Hz
  mpuWrite(0x1B, 0x18);  // gyro +-2000 deg/s
  mpuWrite(0x1C, 0x10);  // accel +-8 g (real jump pushes reach ~5 g)
  return true;
#endif
}

void readMotion(float ag[3], float r[3]) {
#if FAKE_MOTION
  // same running wave as server/fakeMotion.mjs: one upward pulse per footstep at 2.5 Hz
  float s = sinf(2.0f * PI * 2.5f * (millis() / 1000.0f));
  ag[0] = 0;
  ag[1] = 9.81f + 14.0f * (s > 0 ? s * s : 0);
  ag[2] = 0;
  r[0] = r[1] = r[2] = 0;
#else
  static float lastAg[3] = {0, 9.81f, 0}, lastR[3] = {0, 0, 0};
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0 || Wire.requestFrom(MPU, (uint8_t)14) != 14) {
    for (int i = 0; i < 3; i++) { ag[i] = lastAg[i]; r[i] = lastR[i]; }  // bus hiccup: repeat last
    return;
  }
  int16_t v[7];
  for (int i = 0; i < 7; i++) {
    uint8_t hi = Wire.read(), lo = Wire.read();
    v[i] = (int16_t)((hi << 8) | lo);
  }
  for (int i = 0; i < 3; i++) {
    ag[i] = lastAg[i] = v[i] / ACCEL_LSB * G;  // v[3] is temperature, skipped
    r[i] = lastR[i] = v[4 + i] / GYRO_LSB;
  }
#endif
}

float readVbat() {
  uint32_t mv = 0;
  for (int i = 0; i < 8; i++) mv += analogReadMilliVolts(PIN_VBAT);
  return (mv / 8.0f) * 2.0f / 1000.0f;
}
