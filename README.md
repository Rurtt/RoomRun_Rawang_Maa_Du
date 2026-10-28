# ระวังหมาดุ (Rawang Maa Du): "Beware of the Fierce Dog"

**English** | [ภาษาไทย](README.th.md)

A browser runner game you play by running in place. A big stray soi dog chases a kid down a Thai soi at night. Run faster in real life and the kid gets away; slow down and the dog catches up.

It is the demo game for **RoomRun**, a pair of wireless handheld motion controllers (one stick per hand). The product is the controllers. Their pitch is making cardio more fun with exercise games you control by moving your body, and this game shows what that feels like.

> **Status: proof of concept.** The real sticks (ESP32-C3 + MPU6050) are not built yet. For now, **two phones, one in each hand, stand in for the sticks**, and a keyboard works for testing. Motion detection is still being tuned.

## How to play

You are the kid. The boss dog runs at a steady speed behind you. Your speed comes from how fast you run in place (or tap the keys), so the only way to stay ahead is to keep moving.

- **Obstacles** cost you distance, they don't end the run:
  - **Sleeping dog / water jar**: jump over. A sleeping dog you hit wakes up and chases at your heels for a while.
  - **Food cart / tuk-tuk**: change lane. A cart knocks coins out of your pocket; a tuk-tuk stuns you a bit longer.
  - Floor pads warn you: **yellow = jump**, **red = change lane**.
- **Coins** along the lanes.
- **Dog pack chase**: about a minute in, and then every ~90 seconds, a pack joins in for 30 seconds and everything speeds up. Survive it for bonus coins and a bigger lead on the boss dog. It's an interval sprint in disguise.
- The run ends **only when the boss dog catches you**. The bar at the top shows how close it is.

### Controls

| Action | Phones (one in each hand) | Keyboard |
|---|---|---|
| Run | Swing your arms like you're running in place | Tap **A** and **D**, alternating (faster = faster) |
| Change lane | Swing **both** hands left or right together | **← / →** |
| Jump | Flick **both** hands up together | **Space** |
| Restart | | **R** |

Dev keys: **C** starts a dog-pack chase, **`** (backquote) opens the tuning panel.

## Run it

Needs [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
```

**Keyboard only (local):**

```bash
npm run dev
```

Open the link Vite prints (usually http://localhost:5173).

**With phones as controllers (or to let a friend play from anywhere):**

```bash
npm run phone
```

This builds the game, serves it on http://localhost:8787 and opens a free Cloudflare quick tunnel, so you get a public `https://….trycloudflare.com` link.

1. Open the game on a laptop or PC (the local link, or the public link from anywhere).
2. Scan the QR on the title screen with each phone, pick left or right hand, tap start (allow motion access), and hold one phone in each hand.
3. Start running in place.

Things to know:
- Your computer has to stay on with `npm run phone` running. The link changes every time you start it.
- There is **one shared room** for now: if two people connect phones at the same time, their phones control both games. Keyboard players don't have this problem.
- Phone messages travel phone → Cloudflare → host computer → Cloudflare → game, so players far from the host may feel some delay.
- The server logs motion samples to `logs/` (raw data for tuning the real sticks).

## How it works

```
phone / stick (motion sensor) ──WebSocket──► relay (server/relay.mjs) ──► game in the browser
```

- **Game**: Three.js, plain JavaScript, built with Vite. The simulation (`src/sim/`) is separate from rendering (`src/render/`) and runs at a fixed 120 Hz step.
- **Motion detection** (`src/input/motion.js`): turns arm-swing acceleration into steps (running speed), lane swipes and jumps. The same code will read the ESP32 sticks later.
- **Relay** (`server/`): a small Node server that serves the built game and forwards phone messages to the game over one WebSocket.
- **Art**: characters and props are built in Blender from Python scripts (`art/blender/*.py`) and exported as GLB.

```
src/sim       game rules: player, chaser, track, chase events
src/render    3D scene, characters, street, effects, HUD
src/input     keyboard, phones, motion detection, cadence
src/phone     the phone controller page (phone.html)
src/audio     sounds and music
server        relay + Cloudflare tunnel (npm run phone)
art/blender   scripts that build the 3D models
tests         unit tests (npm test)
scripts       replay.mjs: replay motion logs to tune detection
```

## Tests

```bash
npm test
```

## Limits (honest list)

- The real controller sticks are not built yet; phones stand in for them.
- Run, lane and jump detection from handheld motion is still being tuned and is not verified across many players.
- The sensors are in the hands only, so the game can't tell if your legs are really running.
- No health or fitness claims: it's a game that gets you moving, nothing more is measured.

## Credits

Sounds and music are CC0 (Kenney, OpenGameArt). Font: Kanit (SIL OFL). Character animations: Mixamo (kid), Mesh2Motion (boss dog). Sound, music and font details are in [CREDITS.md](CREDITS.md).
