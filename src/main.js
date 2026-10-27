import '@fontsource/kanit/400.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/800.css';
import config from './config.js';
import { createFixedLoop } from './loop.js';
import { createCadence } from './input/cadence.js';
import { createInputHub } from './input/hub.js';
import { createKeyboardSource } from './input/keyboard.js';
import { createWorld, stepWorld } from './sim/world.js';
import { createRenderer } from './render/renderer.js';
import { createEnvironment } from './render/environment.js';

document.title = config.title;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const view = createRenderer(canvas);
const environment = createEnvironment(view.scene);

const hub = createInputHub();
const keyboard = createKeyboardSource({ cadence: createCadence() });
keyboard.attach(window);
hub.add(keyboard);

const world = createWorld(config);
/** Player state before the latest step, for smooth rendering between steps. */
const prev = { distance: 0, x: 0, y: 0 };

function step(dt) {
  const p = world.player;
  prev.distance = p.distance; prev.x = p.x; prev.y = p.y;
  const input = hub.read(performance.now());
  stepWorld(world, input, dt);
}

function render(alpha) {
  const p = world.player;
  // a restart jumps distance back to 0: don't smear across it
  const fresh = Math.abs(p.distance - prev.distance) > 5;
  const lerp = (a, b) => (fresh ? b : a + (b - a) * alpha);
  const z = lerp(prev.distance, p.distance);
  const x = lerp(prev.x, p.x);
  environment.update(z);
  view.camera.position.set(x * 0.6, 3.1, -z + 5.6);
  view.camera.lookAt(x * 0.4, 1.3, -z - 8);
  view.render();
}

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
if (import.meta.env.DEV) window.soip = { world, view, environment, hub, keyboard, config };
