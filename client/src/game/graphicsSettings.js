const STORAGE_KEY = 'pixelrift.graphics.lowPower.v1';

export function readLowPowerPreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch { /* stockage indisponible */ }
  return typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
}

export function writeLowPowerPreference(enabled) {
  try { localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0'); } catch { /* stockage indisponible */ }
}

export function applyGraphicsPreset(renderer, scene, camera, lowPower) {
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const maxRatio = lowPower ? 0.9 : coarse ? 1.15 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.far = lowPower ? 390 : 1200;
  camera.updateProjectionMatrix();
  if (scene.fog) {
    scene.fog.near = lowPower ? 65 : 110;
    scene.fog.far = lowPower ? 155 : 340;
  }
}
