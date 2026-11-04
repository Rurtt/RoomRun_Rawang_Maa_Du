// Host tests for rr_logic.h (no Arduino). Build + run:
//   g++ -std=c++17 -Wall -I firmware/stick firmware/stick/test/test_logic.cpp -o firmware/build/test_logic.exe
//   firmware/build/test_logic.exe   -> prints OK
#include <cassert>
#include <cstdio>
#include <cstring>
#include "rr_logic.h"

static void debounce() {
  Debounce d;
  // 10 ms glitch: never fires
  assert(!d.update(true, 0));
  assert(!d.update(true, 10));
  assert(!d.update(false, 11));
  assert(!d.update(false, 60));
  // held press: fires once after 25 ms stable, then stays quiet
  assert(!d.update(true, 100));
  assert(!d.update(true, 120));
  assert(d.update(true, 126));
  assert(!d.update(true, 200));
  assert(!d.update(true, 900));
  // release then press again: fires again
  assert(!d.update(false, 1000));
  assert(!d.update(false, 1030));
  assert(!d.update(true, 1100));
  assert(d.update(true, 1130));
}

static void buzz() {
  BuzzPlayer b;
  assert(!b.motorOn(0));
  b.start("pack", 0);
  assert(b.motorOn(0));
  assert(!b.motorOn(160));
  assert(b.motorOn(260));
  assert(!b.motorOn(420));
  assert(b.motorOn(560));
  assert(!b.motorOn(651));
  assert(!b.motorOn(5000));
  b.start("hit", 1000);
  assert(b.motorOn(1100));
  assert(!b.motorOn(1121));
  b.start("caught", 2000);
  b.start("jump", 2100);  // replaces caught
  assert(b.motorOn(2120));
  assert(!b.motorOn(2141));
  b.start("nope", 3000);  // unknown: ignored
  assert(!b.motorOn(3000));
  b.start("caught", 4000);
  b.start("nope", 4100);  // unknown does not stop a running one
  assert(b.motorOn(4200));
  assert(!b.motorOn(4601));
}

static void led() {
  assert(ledOn(LedMode::Searching, 250));
  assert(!ledOn(LedMode::Searching, 750));
  assert(ledOn(LedMode::Connected, 750));
  assert(ledOn(LedMode::LowBattery, 50));
  assert(!ledOn(LedMode::LowBattery, 150));
}

static void battery() {
  assert(batteryPct(4.25f) == 100);
  assert(batteryPct(4.20f) == 100);
  assert(batteryPct(3.80f) == 50);
  assert(batteryPct(3.50f) == 5);
  assert(batteryPct(3.2f) == 0);
}

static void format() {
  char buf[256];
  const float ag[3] = {0, 9.81f, 0}, r[3] = {0, 0, 0};
  fmtMotion(buf, sizeof buf, 'L', 1234, ag, r);
  assert(strcmp(buf, "{\"t\":\"m\",\"hand\":\"L\",\"ts\":1234,\"ag\":[0.00,9.81,0.00],\"a\":null,\"r\":[0.00,0.00,0.00]}") == 0);
  const float neg[3] = {-0.004f, -12.345f, 3.0f};
  fmtMotion(buf, sizeof buf, 'R', 5, neg, r);
  assert(strcmp(buf, "{\"t\":\"m\",\"hand\":\"R\",\"ts\":5,\"ag\":[0.00,-12.35,3.00],\"a\":null,\"r\":[0.00,0.00,0.00]}") == 0
         || strcmp(buf, "{\"t\":\"m\",\"hand\":\"R\",\"ts\":5,\"ag\":[-0.00,-12.35,3.00],\"a\":null,\"r\":[0.00,0.00,0.00]}") == 0);
  fmtHello(buf, sizeof buf, 'L');
  assert(strcmp(buf, "{\"t\":\"hello\",\"role\":\"phone\",\"hand\":\"L\",\"dev\":\"stick\",\"fw\":\"0.1\"}") == 0);
  fmtBtn(buf, sizeof buf, 'R', 77, "small");
  assert(strcmp(buf, "{\"t\":\"btn\",\"hand\":\"R\",\"b\":\"small\",\"ts\":77}") == 0);
  fmtBat(buf, sizeof buf, 'L', 3.92f, 71);
  assert(strcmp(buf, "{\"t\":\"bat\",\"hand\":\"L\",\"v\":3.92,\"pct\":71}") == 0);
  fmtPing(buf, sizeof buf, 3, 2000, -1);
  assert(strcmp(buf, "{\"t\":\"ping\",\"id\":3,\"ts\":2000}") == 0);
  fmtPing(buf, sizeof buf, 4, 4000, 42);
  assert(strcmp(buf, "{\"t\":\"ping\",\"id\":4,\"ts\":4000,\"rtt\":42}") == 0);
  // truncation never overflows
  char tiny[8];
  fmtHello(tiny, sizeof tiny, 'L');
  assert(strlen(tiny) < sizeof tiny);
}

static void parse() {
  assert(strcmp(parseBuzz("{\"t\":\"buzz\",\"pattern\":\"hit\"}"), "hit") == 0);
  assert(strcmp(parseBuzz("{\"pattern\":\"pack\",\"t\":\"buzz\"}"), "pack") == 0);
  assert(parseBuzz("{\"t\":\"buzz\",\"pattern\":\"hitx\"}") == nullptr);
  assert(parseBuzz("{\"t\":\"buzz\",\"pattern\":\"boom\"}") == nullptr);
  assert(parseBuzz("{\"t\":\"pong\",\"pattern\":\"hit\"}") == nullptr);
  assert(parseBuzz("") == nullptr);
  assert(parseBuzz(nullptr) == nullptr);
  uint32_t ts = 0;
  assert(parsePongTs("{\"t\":\"pong\",\"id\":3,\"ts\":2000}", &ts) && ts == 2000);
  assert(!parsePongTs("{\"t\":\"buzz\",\"pattern\":\"hit\"}", &ts));
}

int main() {
  debounce(); buzz(); led(); battery(); format(); parse();
  std::puts("OK");
  return 0;
}
