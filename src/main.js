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
import { createHud } from './hud/hud.js';

document.title = config.title;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const view = createRenderer(canvas);
const environment = createEnvironment(view.scene);
const actors = createActors(view.scene);
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
    hud.onEvent(e);
  }
}

function step(dt) {
  const p = world.player;
  prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
  const input = hub.read(performance.now());
  actors.onSteps(input.steps);
  emit(stepWorld(world, input, dt));
}

let lastRender = performance.now();
function render(alpha) {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastRender) / 1000);
  lastRender = now;
  const p = world.player;
  // a restart jumps distance back to 0: don't smear across it
  const fresh = Math.abs(p.distance - prev.distance) > 5;
  const lerp = (a, b) => (fresh ? b : a + (b - a) * alpha);
  interp.z = lerp(prev.distance, p.distance);
  interp.x = lerp(prev.x, p.x);
  interp.y = lerp(prev.y, p.y);
  environment.update(interp.z);
  actors.sync(world, alpha, interp, dt);
  hud.update(world, extra);
  view.camera.position.set(interp.x * 0.6, 3.1, -interp.z + 5.6);
  view.camera.lookAt(interp.x * 0.4, 1.3, -interp.z - 8);
  view.render();
}

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
  loop.frame(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// Dev-only handle for browser checks (Playwright) and console poking.
if (import.meta.env.DEV) {
  window.soip = {
    world, view, environment, actors, hud, hub, keyboard, config, startRun, triggerChase,
    /** Step the sim `seconds` with a fixed input (lane/jump fire once), then draw one frame. */
    simulate(seconds, f = {}) {
      const frame = { speed: 0, laneDelta: 0, jump: false, steps: 0, ...f };
      for (let t = 0; t < seconds; t += config.loop.stepDt) {
        const p = world.player;
        prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
        emit(stepWorld(world, frame, config.loop.stepDt));
        frame.laneDelta = 0; frame.jump = false;
      }
      render(1);
    },
  };
}
