// Radio side: WiFi + relay discovery + WebSocket. Only this part changes if the
// link moves to ESP-NOW later.
#pragma once
#include <stdint.h>

void linkBegin();
void linkLoop(uint32_t nowMs);
bool linkReady();
void linkSend(const char* json);
void linkOnBuzz(void (*cb)(const char* pattern));
