// Everything that moves: the kid, the ghost, obstacles and coins, kept in sync
// with the sim. Meshes are keyed by sim id and pooled per kind.
import * as THREE from 'three';
import config from '../config.js';
import { animationFor, loadModel, makeStandIn } from './models.js';

const KINDS = ['dog', 'jar', 'cart', 'tuktuk'];
const COIN_Y = 0.85;
/** Stride: one full leg cycle (two steps) per this many metres. */
const STRIDE = 2.6;
const GHOST_SCALE = 0.8;

function padTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * @param {THREE.Scene} scene
 * @param {typeof config} cfg
 */
export function createActors(scene, cfg = config) {
  const root = new THREE.Group();
  scene.add(root);

  // Floor pads say what an obstacle wants: yellow = jump over, red = change lane.
  const padTex = padTexture();
  const padGeo = new THREE.PlaneGeometry(2.3, 1.8).rotateX(-Math.PI / 2);
  const padMat = {
    jump: new THREE.MeshBasicMaterial({ map: padTex, color: 0xffc23a, transparent: true, depthWrite: false }),
    block: new THREE.MeshBasicMaterial({ map: padTex, color: 0xff3048, transparent: true, depthWrite: false }),
  };
  const blobMat = new THREE.MeshBasicMaterial({ map: padTex, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });
  const blob = (size) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), blobMat); m.position.y = 0.02; return m; };

  // ---- templates: stand-ins now, swapped for GLBs if they load
  /** @type {Record<string, THREE.Object3D>} */
  const templates = {};
  for (const name of [...KINDS, 'coin']) {
    templates[name] = makeStandIn(/** @type {any} */ (name));
    loadModel(name).then((m) => { if (!m.userData.standIn) templates[name] = m; });
  }

  // ---- kid
  const kidHolder = new THREE.Group();
  root.add(kidHolder);
  kidHolder.add(blob(1.1));
  let kid = makeStandIn('kid');
  let kidMixer = null;
  /** @type {Record<string, THREE.AnimationAction>} */
  let kidClips = {};
  let kidClip = '';
  const kidModel = new THREE.Group(); // faces -Z (forward); models face +Z
  kidModel.rotation.y = Math.PI;
  kidHolder.add(kidModel);
  kidModel.add(kid);
  loadModel('kid').then((m) => {
    if (m.userData.standIn) return;
    kidModel.remove(kid);
    kid = m;
    kidModel.add(kid);
    const clips = m.userData.animations || [];
    if (clips.length) {
      kidMixer = new THREE.AnimationMixer(kid);
      kidClips = Object.fromEntries(clips.map((c) => [c.name, kidMixer.clipAction(c)]));
    }
  });

  // ---- ghost
  const ghostHolder = new THREE.Group();
  ghostHolder.visible = false;
  root.add(ghostHolder);
  ghostHolder.add(blob(1.4));
  const ghostModel = new THREE.Group();
  ghostModel.rotation.y = Math.PI;
  ghostHolder.add(ghostModel);
  let ghost = makeStandIn('ghost');
  ghostModel.add(ghost);
  loadModel('ghost').then((m) => { if (!m.userData.standIn) { ghostModel.remove(ghost); ghost = m; ghostModel.add(ghost); } });
  const calm = new THREE.Color(0xf4f4ff), angry = new THREE.Color(0xff3a4a);
  const calmGlow = new THREE.Color(0x8a7cff), angryGlow = new THREE.Color(0xff2030);
  let anger = 0;

  // ---- obstacles and coins, by sim id
  /** @type {Map<number, { obj: THREE.Object3D, pad?: THREE.Mesh, kind: string, hitT: number, side: number }>} */
  const live = new Map();
  /** @type {Record<string, THREE.Object3D[]>} */
  const pool = Object.fromEntries([...KINDS, 'coin'].map((k) => [k, []]));
  const take = (kind) => {
    const obj = pool[kind].pop() || templates[kind].clone();
    obj.visible = true;
    root.add(obj);
    return obj;
  };
  const give = (kind, obj) => { root.remove(obj); pool[kind].push(obj); };

  // ---- animation state
  let phase = 0;
  let stepKick = 0;
  let time = 0;
  let ghostX = 0;
  let caughtT = 0;
  const seen = new Set();

  let lastX = 0, lean = 0, jumpT = 1, landT = 1;
  function syncKid(world, interp, dt) {
    const p = world.player;
    kidHolder.position.set(interp.x, 0, -interp.z);
    kidModel.position.y = interp.y;
    // lean into lane changes (roll toward the direction of travel)
    const vx = dt > 0 ? (interp.x - lastX) / dt : 0;
    lastX = interp.x;
    lean += (Math.max(-0.35, Math.min(0.35, -vx * 0.025)) - lean) * Math.min(1, dt * 14);
    kidHolder.rotation.z = lean;
    jumpT += dt; landT += dt;
    const clip = world.phase === 'title' || world.phase === 'caught' ? 'idle' : animationFor(p);

    if (kidMixer) {
      const want = kidClips[clip] ? clip : 'run';
      if (want !== kidClip && kidClips[want]) {
        kidClips[want].reset().fadeIn(0.15).play();
        if (kidClips[kidClip]) kidClips[kidClip].fadeOut(0.15);
        kidClip = want;
      }
      kidMixer.update(dt);
      return;
    }
    const rig = kid.userData.rig;
    if (!rig) return;
    const speed = world.phase === 'running' ? p.speedMps : 0;
    phase += (speed / STRIDE) * Math.PI * 2 * dt * 0.5;
    stepKick = Math.max(0, stepKick - dt * 6);
    const amp = clip === 'idle' ? 0 : Math.min(1, 0.25 + speed / cfg.player.maxSpeed);
    const s = Math.sin(phase);
    // blend toward the pose instead of snapping: run <-> jump eases over ~0.1 s
    const ease = (obj, key, to) => { obj[key] += (to - obj[key]) * Math.min(1, dt * 20); };
    if (clip === 'jump') {
      // tuck legs on the way up, reach down for the ground on the way down
      const rise = Math.max(-1, Math.min(1, p.vy / cfg.player.jumpVelocity));
      ease(rig.legs[0].rotation, 'x', 0.4 + 0.5 * rise); ease(rig.legs[1].rotation, 'x', -0.2 - 0.3 * rise);
      ease(rig.arms[0].rotation, 'x', -2.4); ease(rig.arms[1].rotation, 'x', -2.0);
      ease(rig.arms[0].rotation, 'z', -0.3); ease(rig.arms[1].rotation, 'z', 0.3);
      ease(rig.body.position, 'y', 0);
    } else {
      ease(rig.legs[0].rotation, 'x', s * 1.0 * amp); ease(rig.legs[1].rotation, 'x', -s * 1.0 * amp);
      ease(rig.arms[0].rotation, 'x', -s * 1.2 * amp); ease(rig.arms[1].rotation, 'x', s * 1.2 * amp);
      ease(rig.arms[0].rotation, 'z', 0); ease(rig.arms[1].rotation, 'z', 0);
      rig.body.position.y = Math.abs(s) * 0.09 * amp + (clip === 'idle' ? Math.sin(time * 2.5) * 0.01 : 0);
    }
    // squash on each foot plant, stretch between; crouch at take-off, stretch rising, squash on landing
    let squash = clip === 'run' ? 0.05 * Math.cos(phase * 2) * amp - stepKick * 0.06 : 0;
    if (jumpT < 0.08) squash = -0.22 * (1 - jumpT / 0.08);
    else if (clip === 'jump') squash = 0.04 + 0.1 * Math.max(0, p.vy / cfg.player.jumpVelocity);
    if (landT < 0.12) squash = -0.18 * (1 - landT / 0.12);
    rig.body.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
    rig.body.rotation.x = clip === 'stumble' ? 0.35 + Math.sin(time * 30) * 0.08 : clip === 'run' ? 0.12 * amp : 0;
    rig.head.rotation.x = clip === 'stumble' ? -0.3 : 0;
    if (world.phase === 'caught') {
      rig.arms[0].rotation.x = -2.8; rig.arms[1].rotation.x = -2.8; // hands up!
      rig.arms[0].rotation.z = -0.4; rig.arms[1].rotation.z = 0.4;
      rig.body.position.y = Math.abs(Math.sin(time * 18)) * 0.05;
    }
  }

  function syncGhost(world, interp, dt) {
    const ch = world.chaser;
    const show = ch.visible || world.phase === 'caught';
    ghostHolder.visible = show;
    anger += ((ch.angry ? 1 : 0) - anger) * Math.min(1, dt * 5);
    const robe = ghost.userData.robe;
    if (robe) {
      robe.color.copy(calm).lerp(angry, anger);
      robe.emissive.copy(calmGlow).lerp(angryGlow, anger);
      robe.emissiveIntensity = 0.3 + anger * 0.5;
    }
    if (!show) return;
    // Visible gap 0..visibleGap is drawn 0.9..3.2 m behind the kid so the ghost stays
    // framed between the camera and the kid (a literal 12 m would put it behind the camera).
    const k = Math.min(1, Math.max(0, ch.gap / cfg.chaser.visibleGap));
    const caught = world.phase === 'caught';
    caughtT = caught ? caughtT + dt : 0;
    const back = caught ? 0.7 : 0.9 + k * 2.3;
    const side = interp.x > 0.1 ? -1 : 1; // drift toward the road centre so it doesn't hide the kid
    const targetX = interp.x + (caught ? 0.3 * side : side * (0.6 + k * 0.6));
    ghostX += (targetX - ghostX) * Math.min(1, dt * 4);
    ghostHolder.position.set(ghostX, 0, -interp.z + back);
    const float = ghost.userData.float ?? ghost;
    float.position.y = 0.35 + Math.sin(time * 2.2) * 0.15;
    float.rotation.z = Math.sin(time * 1.7) * 0.08;
    // caught: the ghost spins round to face the camera, "boo"
    // chasing: turned 3/4 toward the camera so its face reads; caught: full turn, "boo"
    const turn = caught ? Math.min(1, caughtT / 0.45) : 0;
    const chaseYaw = Math.PI + side * 1.1; // face turns toward the road centre: profile to the camera
    ghostModel.rotation.y = chaseYaw + turn * (2 * Math.PI - chaseYaw);
    const pop = caught ? 1 + Math.sin(Math.min(1, caughtT / 0.3) * Math.PI) * 0.25 : 1;
    ghostModel.scale.setScalar(GHOST_SCALE * pop);
  }

  let lastTrack = null;
  function release(id, a) {
    give(a.kind, a.obj);
    if (a.pad) root.remove(a.pad);
    live.delete(id);
  }

  function syncTrack(world, dt) {
    const laneW = cfg.player.laneWidth;
    // ids restart with every run's new track: drop the old run's meshes
    if (world.track !== lastTrack) {
      for (const [id, a] of live) release(id, a);
      lastTrack = world.track;
    }
    seen.clear();
    for (const o of world.track.obstacles) {
      seen.add(o.id);
      let a = live.get(o.id);
      if (!a) {
        const obj = take(o.kind);
        const pad = new THREE.Mesh(padGeo, padMat[o.type]);
        root.add(pad);
        a = { obj, pad, kind: o.kind, hitT: 0, side: o.lane === 0 ? (o.id % 2 ? 1 : -1) : Math.sign(o.lane) };
        live.set(o.id, a);
      }
      const x = o.lane * laneW, z = -o.z;
      a.pad.position.set(x, 0.015, z);
      a.pad.visible = !o.hit;
      if (o.hit) a.hitT += dt;
      // hit: shoved aside and tipped over (the run goes on)
      const h = Math.min(1, a.hitT / 0.35);
      const ease = 1 - (1 - h) * (1 - h);
      a.obj.position.set(x + a.side * ease * 1.3, o.kind === 'dog' ? Math.sin(h * Math.PI) * 0.8 : 0, z);
      a.obj.rotation.set(0, 0, -a.side * ease * (o.kind === 'dog' ? 0 : 0.5));
    }
    for (const c of world.track.coins) {
      seen.add(c.id);
      let a = live.get(c.id);
      if (!a) {
        a = { obj: take('coin'), kind: 'coin', hitT: 0, side: 0 };
        live.set(c.id, a);
      }
      if (c.taken) a.hitT += dt;
      const h = Math.min(1, a.hitT / 0.2);
      a.obj.visible = h < 1;
      a.obj.position.set(c.lane * laneW, COIN_Y + h * 0.7, -c.z);
      a.obj.scale.setScalar(1 + h * 0.6);
      a.obj.rotation.y = time * 3.5 + c.id * 0.7;
    }
    for (const [id, a] of live) if (!seen.has(id)) release(id, a);
  }

  return {
    /**
     * @param {any} world
     * @param {number} alpha unused: positions come pre-interpolated in interp
     * @param {{ z: number, x: number, y: number }} interp player position between sim steps
     * @param {number} dt render seconds since the last sync
     */
    sync(world, alpha, interp, dt) {
      time += dt;
      syncKid(world, interp, dt);
      syncGhost(world, interp, dt);
      syncTrack(world, dt);
    },
    onEvent(name) {
      if (name === 'run-start') { phase = 0; }
      else if (name === 'jump') jumpT = 0;
      else if (name === 'land') landT = 0;
    },
    onSteps(n) {
      if (n <= 0) return;
      stepKick = 1;
      // pull the leg cycle toward the next foot plant so feet land with real steps
      const next = (Math.floor(phase / Math.PI) + 1) * Math.PI;
      phase += (next - phase) * 0.35;
    },
    kidHolder,
    ghostHolder,
  };
}
