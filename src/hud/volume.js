// Volume slider, bottom-left of the HUD. Remembered per browser; H hides it with the rest of the HUD.

const KEY = 'soip.volume';

/** @param {string|null} saved @returns {number} 0..1, default 0.7 */
export function parseVolume(saved) {
  const v = saved === null ? NaN : Number(saved);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.7;
}

/**
 * @param {HTMLElement} root HUD root
 * @param {(v: number) => void} onChange
 */
export function createVolumeSlider(root, onChange) {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* storage blocked: use the default */ }
  const start = parseVolume(saved);

  const wrap = document.createElement('label');
  wrap.className = 'volume';
  wrap.innerHTML = `<span class="txt">เสียง</span><input type="range" min="0" max="100" step="1">`;
  const input = /** @type {HTMLInputElement} */ (wrap.querySelector('input'));
  input.value = String(Math.round(start * 100));
  input.addEventListener('input', () => {
    const v = Number(input.value) / 100;
    onChange(v);
    try { localStorage.setItem(KEY, String(v)); } catch { /* not saved, still works this session */ }
  });
  // drop focus so arrow keys / space go back to the game, not the slider
  input.addEventListener('change', () => input.blur());
  input.addEventListener('pointerup', () => input.blur());
  root.append(wrap);
  onChange(start);
}
