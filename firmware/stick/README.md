# RoomRun stick firmware

One sketch for both sticks (Seeed XIAO ESP32-C3 + MPU6050). The stick joins WiFi,
finds the laptop relay by its UDP beacon (port 8788), and talks the phone protocol
on `ws://<laptop>:8787/ws` with `dev:"stick"`.

Plain logic (debounce, buzz patterns, LED, battery %, message format) lives in
`rr_logic.h` and is tested on the laptop; the `.ino`/`.cpp` files are hardware glue.

## Setup (once)

1. `cp firmware/stick/secrets.example.h firmware/stick/secrets.h`, fill in both WiFi networks.
   `secrets.h` is gitignored: never commit it.
2. Library: `"$ARDUINO_CLI" lib install WebSockets` (links2004, tested with 2.7.2). Other libs: none (MPU6050 read by raw registers).
3. Board core: esp32 by Espressif 3.3.x, board `XIAO_ESP32C3`.

Tool paths used below (Git Bash):

```
ARDUINO_CLI="/c/Users/Admin/AppData/Local/Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe"
FQBN=esp32:esp32:XIAO_ESP32C3:CDCOnBoot=cdc
```

## Host tests

```
PATH=/c/msys64/ucrt64/bin:$PATH g++ -std=c++17 -Wall -I firmware/stick firmware/stick/test/test_logic.cpp -o firmware/build/test_logic.exe && firmware/build/test_logic.exe
```

Prints `OK`.

## Compile / flash

Hand is a build flag (default `L`, `-DHAND_R=1` = right). Fake motion (no MPU6050 needed) is `-DFAKE_MOTION=1`; combine both in one `extra_flags` string. Flash use ~90%.

```
# left stick, real sensor
"$ARDUINO_CLI" compile --fqbn $FQBN --build-path firmware/build/L firmware/stick
# right stick
"$ARDUINO_CLI" compile --fqbn $FQBN --build-path firmware/build/R --build-property "compiler.cpp.extra_flags=-DHAND_R=1" firmware/stick
# bare XIAO, fake motion
"$ARDUINO_CLI" compile --fqbn $FQBN --build-path firmware/build/fake --build-property "compiler.cpp.extra_flags=-DFAKE_MOTION=1" firmware/stick

# flash (COMx from: "$ARDUINO_CLI" board list)
"$ARDUINO_CLI" upload -p COMx --fqbn $FQBN --input-dir firmware/build/L firmware/stick
"$ARDUINO_CLI" monitor -p COMx -c baudrate=115200
```

## What the stick does

- LED: slow blink (500/500 ms) = searching WiFi/relay, solid = connected, fast blink (100/100 ms) = battery under 3.50 V.
- Big button = lane (L stick left, R stick right). Small button = start/restart on title and caught screens.
- Motor buzzes on `hit` (120 ms), `caught` (600 ms), `pack` (3 pulses), `jump` (40 ms tick).
- Connect order: WIFI1 then WIFI2 (10 s each, loop). Relay: beacon (wait 3 s), then the last good IP, then `192.168.137.1`.

## Bring-up log

(fill in during Task 9: WiFi, beacon, firewall, RTT median/worst, buzz)
