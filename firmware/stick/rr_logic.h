// RoomRun stick: pure logic (no Arduino includes), so it is tested on the laptop
// with g++ (test/test_logic.cpp). Time always comes in as nowMs.
#pragma once
#include <cstddef>
#include <cstdint>
#include <cstdio>
#include <cstring>

// ---- button debounce: true once per press, after DEBOUNCE_MS stable ----
struct Debounce {
  static constexpr uint32_t DEBOUNCE_MS = 25;
  bool raw = false;      // last raw reading
  bool stable = false;   // debounced state
  uint32_t since = 0;    // when raw last changed

  bool update(bool pressedRaw, uint32_t nowMs) {
    if (pressedRaw != raw) { raw = pressedRaw; since = nowMs; return false; }
    if (raw != stable && nowMs - since >= DEBOUNCE_MS) {
      stable = raw;
      return stable;  // fire on the press edge only
    }
    return false;
  }
};

// ---- buzz patterns: on/off ms, first is on (game sends the name) ----
struct BuzzPattern { const char* name; const uint16_t* steps; uint8_t n; };
static const uint16_t RR_HIT[] = {120};
static const uint16_t RR_CAUGHT[] = {600};
static const uint16_t RR_PACK[] = {150, 100, 150, 100, 150};
static const uint16_t RR_JUMP[] = {40};
static const BuzzPattern RR_PATTERNS[] = {
  {"hit", RR_HIT, 1}, {"caught", RR_CAUGHT, 1}, {"pack", RR_PACK, 5}, {"jump", RR_JUMP, 1},
};

inline const BuzzPattern* findPattern(const char* name) {
  if (!name) return nullptr;
  for (const auto& p : RR_PATTERNS) if (strcmp(p.name, name) == 0) return &p;
  return nullptr;
}

struct BuzzPlayer {
  const BuzzPattern* cur = nullptr;
  uint32_t startMs = 0;

  // unknown pattern ignored; a new known pattern replaces the running one
  void start(const char* pattern, uint32_t nowMs) {
    const BuzzPattern* p = findPattern(pattern);
    if (!p) return;
    cur = p;
    startMs = nowMs;
  }

  bool motorOn(uint32_t nowMs) {
    if (!cur) return false;
    uint32_t t = nowMs - startMs;
    for (uint8_t i = 0; i < cur->n; i++) {
      if (t < cur->steps[i]) return (i % 2) == 0;
      t -= cur->steps[i];
    }
    cur = nullptr;  // pattern finished
    return false;
  }
};

// ---- LED: searching 500/500, connected solid, low battery 100/100 ----
enum class LedMode { Searching, Connected, LowBattery };

inline bool ledOn(LedMode m, uint32_t nowMs) {
  switch (m) {
    case LedMode::Connected: return true;
    case LedMode::LowBattery: return (nowMs % 200) < 100;
    case LedMode::Searching:
    default: return (nowMs % 1000) < 500;
  }
}

// ---- battery %: piecewise linear over a typical 1S LiPo curve (rough, unmeasured) ----
inline int batteryPct(float vbat) {
  static const float V[] = {4.20f, 4.00f, 3.85f, 3.75f, 3.65f, 3.50f, 3.30f};
  static const float P[] = {100, 80, 60, 40, 20, 5, 0};
  const int n = sizeof V / sizeof V[0];
  if (vbat >= V[0]) return 100;
  if (vbat <= V[n - 1]) return 0;
  for (int i = 1; i < n; i++) {
    if (vbat >= V[i]) {
      float f = (vbat - V[i]) / (V[i - 1] - V[i]);
      float pct = P[i] + f * (P[i - 1] - P[i]);
      return (int)(pct + 0.5f);
    }
  }
  return 0;
}

// ---- messages (same shape as the phone protocol; see the plan's Global Constraints) ----
inline int fmtMotion(char* buf, size_t n, char hand, uint32_t ts, const float ag[3], const float r[3]) {
  return snprintf(buf, n,
    "{\"t\":\"m\",\"hand\":\"%c\",\"ts\":%lu,\"ag\":[%.2f,%.2f,%.2f],\"a\":null,\"r\":[%.2f,%.2f,%.2f]}",
    hand, (unsigned long)ts, ag[0], ag[1], ag[2], r[0], r[1], r[2]);
}

inline int fmtHello(char* buf, size_t n, char hand) {
  return snprintf(buf, n, "{\"t\":\"hello\",\"role\":\"phone\",\"hand\":\"%c\",\"dev\":\"stick\",\"fw\":\"0.1\"}", hand);
}

inline int fmtBtn(char* buf, size_t n, char hand, uint32_t ts, const char* which) {
  return snprintf(buf, n, "{\"t\":\"btn\",\"hand\":\"%c\",\"b\":\"%s\",\"ts\":%lu}", hand, which, (unsigned long)ts);
}

inline int fmtBat(char* buf, size_t n, char hand, float v, int pct) {
  return snprintf(buf, n, "{\"t\":\"bat\",\"hand\":\"%c\",\"v\":%.2f,\"pct\":%d}", hand, v, pct);
}

// rttMs < 0: no round trip measured yet
inline int fmtPing(char* buf, size_t n, uint32_t id, uint32_t ts, long rttMs) {
  if (rttMs < 0) return snprintf(buf, n, "{\"t\":\"ping\",\"id\":%lu,\"ts\":%lu}", (unsigned long)id, (unsigned long)ts);
  return snprintf(buf, n, "{\"t\":\"ping\",\"id\":%lu,\"ts\":%lu,\"rtt\":%ld}", (unsigned long)id, (unsigned long)ts, rttMs);
}

// ---- parsing: tiny and strict, only the two messages a stick receives ----
inline bool rrIsType(const char* json, const char* type) {
  if (!json) return false;
  char want[32];
  snprintf(want, sizeof want, "\"t\":\"%s\"", type);
  return strstr(json, want) != nullptr;
}

// static pattern name for a buzz message with a known pattern, else nullptr
inline const char* parseBuzz(const char* json) {
  if (!rrIsType(json, "buzz")) return nullptr;
  const char* p = strstr(json, "\"pattern\":\"");
  if (!p) return nullptr;
  p += strlen("\"pattern\":\"");
  for (const auto& bp : RR_PATTERNS) {
    size_t len = strlen(bp.name);
    if (strncmp(p, bp.name, len) == 0 && p[len] == '"') return bp.name;
  }
  return nullptr;
}

// ts echoed back in a pong (our own millis at send), for RTT
inline bool parsePongTs(const char* json, uint32_t* ts) {
  if (!rrIsType(json, "pong")) return false;
  const char* p = strstr(json, "\"ts\":");
  if (!p) return false;
  p += 5;
  unsigned long v = 0;
  bool any = false;
  while (*p >= '0' && *p <= '9') { v = v * 10 + (unsigned long)(*p - '0'); p++; any = true; }
  if (!any) return false;
  *ts = (uint32_t)v;
  return true;
}
