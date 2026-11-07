# Testing the sticks with the game

For the hardware team. The firmware has never run on a real board yet, so whatever you hit, tell Pong what you saw (LED, Serial Monitor output, what the game shows).

## What you need

- A laptop (Windows) with **Node.js 20+** (https://nodejs.org, LTS installer).
- The game folder (`roomrun-game.zip` from Pong). Unzip it anywhere.
- The flashed stick(s) and one WiFi network that both the laptop and the stick join.

How it connects: the stick joins WiFi, hears the laptop's "I'm here" signal (UDP 8788), then connects to the game server on the laptop (port 8787). Like a walkie-talkie: both must be on the same channel (same WiFi).

## 1. Flash the stick

1. Arduino IDE: Boards Manager -> install **esp32 by Espressif** (3.3.x). Library Manager -> install **WebSockets** by Markus Sattler / links2004.
2. Open `stick/stick.ino`.
3. Copy `secrets.example.h` to `secrets.h` (same folder) and fill in the WiFi name and password. Put the network you will test on as `WIFI1`.
4. Check the pins in `config.h` against your wiring:

   | Part | Pin in code |
   |---|---|
   | MPU6050 SDA / SCL | D4 / D5 |
   | Big button (lane) | D2 (to GND when pressed) |
   | Small button (start) | D3 (to GND when pressed) |
   | LED | D10 |
   | Motor MOSFET gate | D7 |
   | Battery divider | D1 |

   If your wiring is different, change the number in `config.h` and **tell Pong which pin you used**.
5. Left stick: flash as-is. Right stick: add `#define HAND_R 1` as the first line of `config.h`, then flash.
6. Board: **XIAO_ESP32C3**, Tools -> USB CDC On Boot: **Enabled** (so Serial Monitor works). Upload.
7. Open Serial Monitor at **115200** to watch what it does.

No MPU6050 wired yet? Add `#define FAKE_MOTION 1` at the top of `config.h`: the stick sends fake running motion so you can still test WiFi and buttons.

## 2. Start the game on the laptop

Open a terminal in the unzipped game folder:

```
npm install
npm run phone
```

- First time only, `npm install` downloads stuff (needs internet).
- When Windows Firewall asks about Node.js, tick **both Private and Public** and Allow. If you missed the popup: Windows Security -> Firewall -> Allow an app -> Node.js -> tick both.
- A line saying `cloudflared failed to start` is fine. That is only for the phone controllers.
- Open **http://localhost:8787** in Chrome. Click the page once (this unlocks sound).

## 3. Connect

1. Power the stick (or plug USB).
2. LED: **slow blink** = looking for WiFi / the laptop. **Solid** = connected. **Fast blink** = battery low.
3. On the title screen the game shows `L รอไม้…` / `R รอไม้…` (waiting). When a stick connects it changes to `L พร้อม` (ready), with battery %.

## 4. Play

- **Small button** = start (and restart after you get caught).
- **Big button** = change lane (L stick = left, R stick = right).
- **Run in place** holding the sticks = the kid runs. **Push both hands up** = jump.
- Motor buzzes when you hit something, get caught, when the dog pack comes, and a tiny tick on jump.
- Keyboard still works as a backup: tap A / D alternating = run, arrows = lane, space = jump, R = restart.

If a stick drops mid-run, the game pauses and shows `ไม้หลุด กำลังต่อใหม่…` until it comes back.

## If it doesn't connect

- LED keeps slow-blinking: check the WiFi name/password in `secrets.h`. The ESP32-C3 only does **2.4 GHz** WiFi: on an iPhone hotspot turn on "Maximize Compatibility".
- Stick is on WiFi but the game still says waiting: almost always the firewall (step 2). Second most likely: the WiFi blocks devices from seeing each other (school/guest WiFi does this). Fix: use the **laptop's own hotspot** (Windows Settings -> Mobile hotspot, set to 2.4 GHz, put that name in `secrets.h`). The stick tries that laptop address (192.168.137.1) automatically.
- Copy the Serial Monitor output and send it to Pong.

## Tell Pong

- Which pin is the big button and which is the small one.
- Did it connect? How long did it take?
- Do lanes / start / buzz work? Does the run feel laggy?
