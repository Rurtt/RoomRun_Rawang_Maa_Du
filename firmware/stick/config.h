// Build-time settings. Hand and fake motion can be set from the command line:
//   --build-property "compiler.cpp.extra_flags=-DHAND_R=1 -DFAKE_MOTION=1"
#pragma once

#ifndef HAND
#if defined(HAND_R) && HAND_R
#define HAND 'R'
#else
#define HAND 'L'
#endif
#endif
#ifndef FAKE_MOTION
#define FAKE_MOTION 0  // 1: synthetic running motion, no MPU6050 needed (bare XIAO bring-up)
#endif

// Seeed XIAO ESP32-C3 pins (spec section 4). Big/small button pins: confirm with the wiring.
#define PIN_SDA 6      // D4
#define PIN_SCL 7      // D5
#define PIN_BIG 4      // D2, INPUT_PULLUP, active low
#define PIN_SMALL 5    // D3, INPUT_PULLUP, active low
#define PIN_LED 10     // D10
#define PIN_MOTOR 20   // D7, AO3400A gate
#define PIN_VBAT 3     // D1, 2 x 220k divider: VBAT = 2 x pin voltage

#define SAMPLE_HZ 60
#define RELAY_PORT 8787
#define BEACON_PORT 8788
#define FALLBACK_IP "192.168.137.1"  // laptop Windows Mobile Hotspot
#define LOW_BATTERY_V 3.50f
#define NO_BATTERY_V 2.50f           // below this the divider reads nothing (USB only, no cell): not "low"
