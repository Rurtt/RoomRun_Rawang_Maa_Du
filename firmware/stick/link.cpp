#include <Arduino.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include "config.h"
#include "secrets.h"
#include "rr_logic.h"
#include "link.h"

// WiFi: WIFI1 then WIFI2, 10 s each, loop.
// Relay: beacon (wait 3 s), then last good IP, then FALLBACK_IP; 5 s per try.
static const char* SSIDS[] = {WIFI1_SSID, WIFI2_SSID};
static const char* PASSES[] = {WIFI1_PASS, WIFI2_PASS};
static const uint32_t WIFI_TRY_MS = 10000, BEACON_WAIT_MS = 3000, RELAY_TRY_MS = 5000;
static const uint32_t LOST_MS = 6000;  // connected relay gone this long: rediscover (laptop IP may have changed)

enum class St { WifiStart, WifiWait, Beacon, RelayTry, Online };
static St st = St::WifiStart;
static int net = 0;
static uint32_t stSince = 0;
static int candidate = 0;  // 0 beacon result, 1 last good IP, 2 fallback IP
static String lastGoodIp, tryingIp;
static uint16_t relayPort = RELAY_PORT;

static WebSocketsClient ws;
static WiFiUDP udp;
static Preferences prefs;
static bool wsUp = false, wsStarted = false;
static uint32_t wsDownSince = 0, nextPing = 0, pingId = 0;
static long rttMs = -1;
static void (*onBuzz)(const char*) = nullptr;

static void go(St s, uint32_t now) { st = s; stSince = now; }

static void wsEvent(WStype_t type, uint8_t* payload, size_t len) {
  if (type == WStype_CONNECTED) {
    wsUp = true;
    char buf[128];
    fmtHello(buf, sizeof buf, HAND);
    ws.sendTXT(buf);
    Serial.printf("relay connected %s:%u\n", tryingIp.c_str(), relayPort);
    if (tryingIp != lastGoodIp) { lastGoodIp = tryingIp; prefs.putString("relay", lastGoodIp); }
  } else if (type == WStype_DISCONNECTED) {
    if (wsUp) Serial.println("relay disconnected");
    wsUp = false;
    wsDownSince = millis();
  } else if (type == WStype_TEXT && len < 256) {
    char msg[256];
    memcpy(msg, payload, len);
    msg[len] = 0;
    const char* p = parseBuzz(msg);
    if (p && onBuzz) onBuzz(p);
    uint32_t ts;
    if (parsePongTs(msg, &ts)) rttMs = (long)(millis() - ts);
  }
}

static void stopWs() {
  if (wsStarted) ws.disconnect();
  wsStarted = false;
  wsUp = false;
}

static void startWs(const String& ip, uint32_t now) {
  stopWs();
  tryingIp = ip;
  Serial.printf("trying relay %s:%u\n", ip.c_str(), relayPort);
  ws.begin(ip.c_str(), relayPort, "/ws");
  ws.onEvent(wsEvent);
  ws.setReconnectInterval(1000);
  wsStarted = true;
  wsDownSince = now;
  go(St::RelayTry, now);
}

static void listenBeacon(uint32_t now) {
  stopWs();
  udp.begin(BEACON_PORT);
  go(St::Beacon, now);
}

// next relay candidate after the current one; false when all are used
static bool nextCandidate(uint32_t now) {
  while (++candidate <= 2) {
    String ip = candidate == 1 ? lastGoodIp : String(FALLBACK_IP);
    if (ip.length() && ip != tryingIp) { startWs(ip, now); return true; }
  }
  return false;
}

void linkBegin() {
  prefs.begin("roomrun", false);
  lastGoodIp = prefs.getString("relay", "");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // low latency over battery life
  Serial.printf("stick %c, last relay '%s'\n", HAND, lastGoodIp.c_str());
}

void linkLoop(uint32_t now) {
  if (st != St::WifiStart && st != St::WifiWait && WiFi.status() != WL_CONNECTED) {
    Serial.println("wifi lost");
    stopWs();
    udp.stop();
    go(St::WifiStart, now);
  }
  if (wsStarted) ws.loop();

  switch (st) {
    case St::WifiStart:
      Serial.printf("wifi: joining %s\n", SSIDS[net]);
      WiFi.disconnect();
      WiFi.begin(SSIDS[net], PASSES[net]);
      go(St::WifiWait, now);
      break;

    case St::WifiWait:
      if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("wifi: joined %s, ip %s\n", SSIDS[net], WiFi.localIP().toString().c_str());
        listenBeacon(now);
      } else if (now - stSince > WIFI_TRY_MS) {
        net = (net + 1) % 2;
        go(St::WifiStart, now);
      }
      break;

    case St::Beacon: {
      int n = udp.parsePacket();
      if (n > 0) {
        char buf[128];
        int len = udp.read(buf, sizeof buf - 1);
        buf[len > 0 ? len : 0] = 0;
        udp.flush();
        if (strstr(buf, "\"t\":\"beacon\"")) {
          const char* p = strstr(buf, "\"port\":");
          relayPort = RELAY_PORT;
          if (p) { long v = atol(p + 7); if (v > 0 && v < 65536) relayPort = (uint16_t)v; }
          String ip = udp.remoteIP().toString();
          Serial.printf("beacon from %s\n", ip.c_str());
          udp.stop();
          candidate = 0;
          startWs(ip, now);
          break;
        }
      }
      if (now - stSince > BEACON_WAIT_MS) {
        Serial.println("no beacon (hotspot may block broadcast): trying saved / fallback IP");
        udp.stop();
        relayPort = RELAY_PORT;
        candidate = 0;
        tryingIp = "";
        if (!nextCandidate(now)) listenBeacon(now);
      }
      break;
    }

    case St::RelayTry:
      if (wsUp) go(St::Online, now);
      else if (now - stSince > RELAY_TRY_MS && !nextCandidate(now)) listenBeacon(now);  // nothing answered
      break;

    case St::Online:
      if (wsUp) {
        if ((int32_t)(now - nextPing) >= 0) {
          nextPing = now + 2000;
          char buf[96];
          fmtPing(buf, sizeof buf, ++pingId, now, rttMs);
          ws.sendTXT(buf);
        }
      } else if (now - wsDownSince > LOST_MS) {
        Serial.println("relay gone: rediscovering");
        listenBeacon(now);
      }
      break;
  }
}

bool linkReady() { return st == St::Online && wsUp; }

void linkSend(const char* json) {
  if (linkReady()) ws.sendTXT(json);
}

void linkOnBuzz(void (*cb)(const char* pattern)) { onBuzz = cb; }
