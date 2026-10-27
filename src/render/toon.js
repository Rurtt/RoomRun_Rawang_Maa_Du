// One shared cartoon look: 3-step toon shading plus black inverted-hull
// outlines. Every model (code stand-ins, Blender props, picture-to-3D
// characters) goes through here so they all match.
import * as THREE from 'three';

let gradient = null;
/** 3 flat light bands instead of smooth shading. */
function gradientMap() {
  if (!gradient) {
    gradient = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
    gradient.generateMipmaps = false;
    gradient.needsUpdate = true;
  }
  return gradient;
}

const toonCache = new Map();

/**
 * @param {number} color
 * @param {{ emissive?: number, emissiveIntensity?: number, vertexColors?: boolean, map?: THREE.Texture }} [opts]
 * @returns {THREE.MeshToonMaterial} shared per argument set; clone before changing it per object
 */
export function toonMaterial(color, { emissive = 0, emissiveIntensity = 1, vertexColors = false, map } = {}) {
  const key = `${color}|${emissive}|${emissiveIntensity}|${vertexColors}|${map ? map.uuid : ''}`;
  let m = toonCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity, vertexColors, gradientMap: gradientMap() });
    if (map) m.map = map;
    toonCache.set(key, m);
  }
  return m;
}

const outlineCache = new Map();

/** Black back faces pushed out along smoothed normals by `thickness` metres. */
export function outlineMaterial(thickness = 0.03) {
  let m = outlineCache.get(thickness);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.uniforms.outlineThickness = { value: thickness };
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 outlineNormal;\nuniform float outlineThickness;')
        .replace('#include <begin_vertex>', 'vec3 transformed = position + outlineNormal * outlineThickness;');
    };
    m.customProgramCacheKey = () => `outline-${thickness}`;
    outlineCache.set(thickness, m);
  }
  return m;
}

/**
 * Adds an `outlineNormal` attribute: normals averaged over vertices that share
 * a position, so a box's shell stays closed at the corners.
 * @param {THREE.BufferGeometry} geometry changed in place and returned
 */
export function withOutlineNormals(geometry) {
  if (geometry.getAttribute('outlineNormal')) return geometry;
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const pos = geometry.getAttribute('position');
  const nor = geometry.getAttribute('normal');
  const sums = new Map();
  const keyOf = (i) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = keyOf(i);
    const s = sums.get(k) || [0, 0, 0];
    s[0] += nor.getX(i); s[1] += nor.getY(i); s[2] += nor.getZ(i);
    sums.set(k, s);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const [x, y, z] = sums.get(keyOf(i));
    const len = Math.hypot(x, y, z) || 1;
    out[i * 3] = x / len; out[i * 3 + 1] = y / len; out[i * 3 + 2] = z / len;
  }
  geometry.setAttribute('outlineNormal', new THREE.BufferAttribute(out, 3));
  return geometry;
}

const outlinedGeometries = new WeakMap();

/**
 * Black inverted-hull outline as a child of `mesh` (works for skinned meshes).
 * @param {THREE.Mesh} mesh
 * @returns {THREE.Mesh} the outline mesh
 */
export function addOutline(mesh, thickness = 0.03) {
  let geo = outlinedGeometries.get(mesh.geometry);
  if (!geo) {
    geo = withOutlineNormals(mesh.geometry.clone());
    outlinedGeometries.set(mesh.geometry, geo);
  }
  const mat = outlineMaterial(thickness);
  let outline;
  if (/** @type {any} */ (mesh).isSkinnedMesh) {
    const skinned = /** @type {THREE.SkinnedMesh} */ (mesh);
    outline = new THREE.SkinnedMesh(geo, mat);
    outline.bind(skinned.skeleton, skinned.bindMatrix);
  } else {
    outline = new THREE.Mesh(geo, mat);
  }
  outline.name = `${mesh.name || 'mesh'}-outline`;
  outline.raycast = () => {};
  mesh.add(outline);
  return outline;
}
