// Screen and particle juice: red danger edges, white hit flash, speed lines at
// sprint, coin sparkles. Reads the world, reacts to events.
import * as THREE from 'three';
import config from '../config.js';
import { meterFill } from '../hud/format.js';

const SPARKS = 48;

function sparkTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,240,180,0.9)');
  grd.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {THREE.Scene} scene
 * @param {HTMLElement} overlayEl full-screen element above the canvas, below the HUD
 * @param {typeof config} cfg
 */
export function createEffects(scene, overlayEl, cfg = config) {
  overlayEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4';
  overlayEl.innerHTML = `
    <canvas style="position:absolute;inset:0;width:100%;height:100%"></canvas>
    <div class="edges" style="position:absolute;inset:0;opacity:0;
      background:radial-gradient(ellipse at center, rgba(255,0,30,0) 52%, rgba(255,0,30,0.35) 75%, rgba(200,0,20,0.85) 100%)"></div>
    <div class="flash" style="position:absolute;inset:0;background:#fff;opacity:0"></div>`;
  const lines = /** @type {HTMLCanvasElement} */ (overlayEl.querySelector('canvas'));
  const edges = /** @type {HTMLElement} */ (overlayEl.querySelector('.edges'));
  const flash = /** @type {HTMLElement} */ (overlayEl.querySelector('.flash'));
  const g = lines.getContext('2d');

  // speed lines: streaks flying out from the vanishing point
  const streaks = Array.from({ length: 40 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.8 + Math.random() }));
  let linesOn = false;

  // coin sparkles: a pool of additive sprites
  const sparkMat = new THREE.SpriteMaterial({ map: sparkTexture(), color: 0xffe070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
  const sparks = Array.from({ length: SPARKS }, () => {
    const s = new THREE.Sprite(sparkMat.clone());
    s.visible = false;
    scene.add(s);
    return { s, life: 0, vx: 0, vy: 0, vz: 0 };
  });
  let nextSpark = 0;
  let flashA = 0;
  let edgeA = 0;
  let time = 0;
  let pendingCoins = 0;

  function burst(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const p = sparks[nextSpark++ % SPARKS];
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 3;
      p.s.position.set(x, y, z);
      p.vx = Math.cos(a) * sp; p.vy = 2 + Math.random() * 3; p.vz = Math.sin(a) * sp * 0.5;
      p.life = 0.45 + Math.random() * 0.2;
      p.s.visible = true;
    }
  }

  return {
    /** @param {any} world @param {number} dt render seconds (time-scaled) @param {{ z: number, x: number, y: number }} interp */
    update(world, dt, interp) {
      time += dt;
      const running = world.phase === 'running';

      // coin sparkles where the kid is
      if (pendingCoins > 0) {
        burst(interp.x, 1.1 + interp.y, -interp.z - 0.6, 6 * pendingCoins);
        pendingCoins = 0;
      }
      for (const p of sparks) {
        if (!p.s.visible) continue;
        p.life -= dt;
        if (p.life <= 0) { p.s.visible = false; continue; }
        p.vy -= 9 * dt;
        p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
        p.s.scale.setScalar(0.35 * Math.min(1, p.life * 3));
        p.s.material.opacity = Math.min(1, p.life * 3);
      }

      // red edges: danger meter strength, pulsing during the chase event
      const fill = running || world.phase === 'caught' ? meterFill(world.chaser.gap, cfg.chaser) : 0;
      const chase = running && world.chase.phase === 'active';
      const target = Math.max(Math.pow(fill, 1.6), chase ? 0.5 + 0.2 * Math.sin(time * 6) : 0);
      edgeA += (target - edgeA) * (1 - Math.exp(-6 * dt));
      edges.style.opacity = edgeA.toFixed(3);

      flashA = Math.max(0, flashA - dt * 4);
      flash.style.opacity = (flashA * 0.55).toFixed(3);

      // speed lines above 80% speed
      const speed = running ? world.player.speedMps / cfg.player.maxSpeed : 0;
      const k = Math.max(0, (speed - 0.8) / 0.2);
      const w = lines.clientWidth, h = lines.clientHeight;
      if (k > 0.01 || linesOn) {
        if (lines.width !== w || lines.height !== h) { lines.width = w; lines.height = h; }
        g.clearRect(0, 0, w, h);
        linesOn = k > 0.01;
        if (linesOn) {
          const cx = w / 2, cy = h * 0.42, maxR = Math.hypot(w, h) * 0.6;
          g.strokeStyle = `rgba(255,255,255,${(0.35 * k).toFixed(3)})`;
          g.lineCap = 'round';
          for (const st of streaks) {
            st.r += st.v * dt * 1.6;
            if (st.r > 1) { st.r = 0.35; st.a = Math.random() * Math.PI * 2; }
            const r0 = maxR * st.r, r1 = r0 + maxR * 0.12 * st.v;
            g.lineWidth = 1.5 + 2.5 * st.r;
            g.beginPath();
            g.moveTo(cx + Math.cos(st.a) * r0, cy + Math.sin(st.a) * r0);
            g.lineTo(cx + Math.cos(st.a) * r1, cy + Math.sin(st.a) * r1);
            g.stroke();
          }
        }
      }
    },
    onEvent(name) {
      if (name === 'hit') flashA = 1;
      else if (name === 'caught') flashA = 0.7;
      else if (name === 'coin') pendingCoins++;
    },
  };
}
