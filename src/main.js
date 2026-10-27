import '@fontsource/kanit/400.css';
import '@fontsource/kanit/600.css';
import '@fontsource/kanit/800.css';
import config from './config.js';
import { createFixedLoop } from './loop.js';

document.title = config.title;

const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));

const loop = createFixedLoop({
  step: () => {},
  render: () => {},
  stepDt: config.loop.stepDt,
  maxFrameDt: config.loop.maxFrameDt,
});

let last = performance.now();
function tick(now) {
  loop.frame((now - last) / 1000);
  last = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

export { canvas };
