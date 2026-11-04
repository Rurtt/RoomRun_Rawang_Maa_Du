// RoomRun stick: MPU6050 motion + 2 buttons in, buzz motor + LED out, over WiFi
// to the ระวังหมาดุ relay. See README.md for build/flash.
#include "config.h"
#include "rr_logic.h"
#include "sensors.h"
#include "link.h"

static Debounce bigBtn, smallBtn;
static BuzzPlayer buzz;
static bool sensorOk = false;
static float vbat = 0;
static uint32_t nextSampleUs = 0, nextBatMs = 0, nextWarnMs = 0;
static const uint32_t SAMPLE_US = 1000000UL / SAMPLE_HZ;

static void onBuzz(const char* pattern) {
  Serial.printf("buzz %s\n", pattern);
  buzz.start(pattern, millis());
}

static void sendBattery() {
  vbat = readVbat();
  char buf[96];
  fmtBat(buf, sizeof buf, HAND, vbat, batteryPct(vbat));
  linkSend(buf);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_BIG, INPUT_PULLUP);
  pinMode(PIN_SMALL, INPUT_PULLUP);
  pinMode(PIN_LED, OUTPUT);
  pinMode(PIN_MOTOR, OUTPUT);
  digitalWrite(PIN_MOTOR, LOW);
  sensorOk = sensorsBegin();
  Serial.printf("RoomRun stick %c%s, MPU6050 %s\n", HAND, FAKE_MOTION ? " (fake motion)" : "", sensorOk ? "ok" : "NOT FOUND");
  vbat = readVbat();
  linkOnBuzz(onBuzz);
  linkBegin();
  nextSampleUs = micros();
}

void loop() {
  uint32_t now = millis();
  // a connect attempt can block linkLoop (TCP timeout, build_opt.h sets 1 s):
  // never leave the motor running through a stall
  digitalWrite(PIN_MOTOR, LOW);
  linkLoop(now);
  now = millis();
  bool ready = linkReady();

  uint32_t us = micros();
  if ((int32_t)(us - nextSampleUs) >= 0) {
    nextSampleUs += SAMPLE_US;
    if ((int32_t)(us - nextSampleUs) > 100000) nextSampleUs = us + SAMPLE_US;  // fell far behind: don't burst
    if (sensorOk && ready) {
      float ag[3], r[3];
      readMotion(ag, r);
      char buf[160];
      fmtMotion(buf, sizeof buf, HAND, now, ag, r);
      linkSend(buf);
    } else if (!sensorOk && (int32_t)(now - nextWarnMs) >= 0) {
      nextWarnMs = now + 2000;
      Serial.println("MPU6050 not found: check SDA/SCL wiring");
    }
  }

  char buf[96];
  if (bigBtn.update(digitalRead(PIN_BIG) == LOW, now)) {
    fmtBtn(buf, sizeof buf, HAND, now, "big");
    linkSend(buf);
    Serial.println("btn big");
  }
  if (smallBtn.update(digitalRead(PIN_SMALL) == LOW, now)) {
    fmtBtn(buf, sizeof buf, HAND, now, "small");
    linkSend(buf);
    Serial.println("btn small");
  }

  static bool wasReady = false;
  if ((int32_t)(now - nextBatMs) >= 0 || (ready && !wasReady)) {  // every 10 s, and right after connect
    nextBatMs = now + 10000;
    sendBattery();
  }
  wasReady = ready;

  digitalWrite(PIN_MOTOR, buzz.motorOn(now) ? HIGH : LOW);
  bool low = vbat > NO_BATTERY_V && vbat < LOW_BATTERY_V;
  LedMode mode = low ? LedMode::LowBattery : ready ? LedMode::Connected : LedMode::Searching;
  digitalWrite(PIN_LED, ledOn(mode, now) ? HIGH : LOW);
}
