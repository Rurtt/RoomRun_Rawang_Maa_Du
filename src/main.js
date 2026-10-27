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
  }
}

function step(dt) {
  const p = world.player;
  prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
  const input = hub.read(performance.now());
  actors.onSteps(input.steps);
  rig.onSteps(input.steps);
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
  view.render();
}

let timeScale = 1;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.code === 'KeyR') { startRun(world); prev.distance = 0; emit(['run-start']); }
  else if (e.code === 'KeyC') triggerChase(world);
});

const loop = createFixedLoop({ step, render, stepDt: config.loop.stepDt, maxFrameDt: config.loop.maxFrameDt });

// Temporary fps readout (moves into the debug panel in Task 10).
const fpsEl = document.createElement('div');
fpsEl.id = 'fps';
fpsEl.style.cssText = 'position:fixed;left:8px;bottom:8px;color:#fff;font:12px monospace;z-index:10';
document.body.append(fpsEl);
let fps = 0;

let last = performance.now();
function tick(now) {
  const dt = (now - last) / 1000;
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  fpsEl.textContent = `${fps.toFixed(0)} fps`;
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
    world, view, environment, actors, hud, hub, keyboard, config, startRun, triggerChase,
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
