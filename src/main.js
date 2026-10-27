import '@fontsource/kanit/400.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/800.css';
import config from './config.js';
import { createFixedLoop } from './loop.js';
import { createCadence } from './input/cadence.js';
import { createInputHub } from './input/hub.js';
import { createKeyboardSource } from './input/keyboard.js';
import { createWorld, startRun, stepWorld, triggerChase } from './sim/world.js';
import { createRenderer } from './render/renderer.js';
import { createEnvironment } from './render/environment.js';
import { createActors } from './render/actors.js';
import { createCameraRig } from './render/cameraRig.js';
import { createEffects } from './render/effects.js';
import { slowMoTarget } from './render/timeScale.js';
import { createHud } from './hud/hud.js';
import { meterFill } from './hud/format.js';
import { createAudio, soundForEvent } from './audio/audio.js';
import { hotkeyAction } from './debug/hotkeys.js';
import { createDebugPanel } from './debug/panel.js';

document.title = config.title;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const view = createRenderer(canvas);
const environment = createEnvironment(view.scene);
const actors = createActors(view.scene);
const rig = createCameraRig(view.camera);
const overlay = document.createElement('div');
document.body.append(overlay);
const effects = createEffects(view.scene, overlay);
const hudRoot = document.createElement('div');
document.body.append(hudRoot);
const hud = createHud(hudRoot);
const audio = createAudio();
// browsers only allow sound after a user gesture
for (const type of ['keydown', 'pointerdown']) window.addEventListener(type, () => audio.unlock(), { once: true });

const hub = createInputHub();
const keyboard = createKeyboardSource({ cadence: createCadence() });
keyboard.attach(window);
hub.add(keyboard);

const world = createWorld(config);
/** Player state before the latest step, for smooth rendering between steps. */
const prev = { distance: 0, x: 0, y: 0 };
const interp = { z: 0, x: 0, y: 0 };
const extra = { phoneLost: false, tunnelUrl: /** @type {string|null} */ (null) };

function emit(events) {
  for (const e of events) {
    actors.onEvent(e);
    rig.onEvent(e);
    effects.onEvent(e);
    hud.onEvent(e);
    const sound = soundForEvent(e);
    if (sound) audio.play(sound);
  }
}

function step(dt) {
  const p = world.player;
  prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
  const input = hub.read(performance.now());
  actors.onSteps(input.steps);
  rig.onSteps(input.steps);
  for (let i = 0; i < Math.min(input.steps, 2); i++) audio.play('step');
  emit(stepWorld(world, input, dt));
}

/** Dev only: Playwright checks freeze the live loop while they drive soip.simulate(). */
let devPaused = false;
/** Render seconds since the last frame, already time-scaled (slow-mo). */
let renderDt = 0;
function render(alpha) {
  const p = world.player;
  // a restart jumps distance back to 0: don't smear across it
  const fresh = Math.abs(p.distance - prev.distance) > 5;
  const lerp = (a, b) => (fresh ? b : a + (b - a) * alpha);
  interp.z = lerp(prev.distance, p.distance);
  interp.x = lerp(prev.x, p.x);
  interp.y = lerp(prev.y, p.y);
  environment.update(interp.z);
  actors.sync(world, alpha, interp, renderDt);
  rig.update(world, renderDt, interp);
  effects.update(world, renderDt, interp);
  hud.update(world, extra);
  const running = world.phase === 'running';
  audio.setDanger(running ? meterFill(world.chaser.gap, config.chaser) : 0);
  audio.setChase(running && world.chase.phase === 'active');
  view.render();
}

let timeScale = 1;

/** Live numbers for the debug panel. rttMs is filled by the phone link (Task 11). */
const stats = { fps: 0, rttMs: /** @type {Record<'L'|'R', number|null>} */ ({ L: null, R: null }) };
const panel = createDebugPanel(config, stats);

window.addEventListener('keydown', (e) => {
  if (e.repeat || /** @type {any} */ (e.target)?.tagName === 'INPUT') return; // typing in the panel
  const action = hotkeyAction(e.code);
  if (action === 'restart') { startRun(world); prev.distance = 0; emit(['run-start']); }
  else if (action === 'chase') triggerChase(world); // no-op unless a run is going
  else if (action === 'panel') panel.toggle();
});

// Tunnel URL for the title-screen QR. Only exists while `npm run phone` runs;
// poll until it shows up (cloudflared takes a few seconds).
async function pollTunnelUrl() {
  try {
    const res = await fetch('/tunnel-url', { cache: 'no-store' });
    if (res.ok && (res.headers.get('content-type') ?? '').includes('json')) extra.tunnelUrl = (await res.json()).url ?? null;
  } catch { /* relay not running: keyboard only */ }
  if (!extra.tunnelUrl) setTimeout(pollTunnelUrl, 2000);
}
pollTunnelUrl();

const loop = createFixedLoop({ step, render, stepDt: config.loop.stepDt, maxFrameDt: config.loop.maxFrameDt });

let last = performance.now();
function tick(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (dt > 0) stats.fps += (1 / dt - stats.fps) * 0.05;
  panel.update();
  timeScale += (slowMoTarget(world) - timeScale) * Math.min(1, Math.max(0, dt) * 12);
  const scaled = Math.min(dt, config.loop.maxFrameDt) * timeScale;
  renderDt = scaled;
  if (!devPaused) loop.frame(scaled);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Dev-only handle for browser checks (Playwright) and console poking.
if (import.meta.env.DEV) {
  window.soip = {
    world, view, environment, actors, hud, audio, panel, stats, hub, keyboard, config, startRun, triggerChase,
    pause(on = true) { devPaused = on; },
    /** Step the sim `seconds` with a fixed input (lane/jump fire once), then draw one frame. */
    simulate(seconds, f = {}) {
      const frame = { speed: 0, laneDelta: 0, jump: false, steps: 0, ...f };
      for (let t = 0; t < seconds; t += config.loop.stepDt) {
        const p = world.player;
        prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
        emit(stepWorld(world, frame, config.loop.stepDt));
        frame.laneDelta = 0; frame.jump = false;
      }
      renderDt = 1 / 60;
      render(1);
    },
  };
}
