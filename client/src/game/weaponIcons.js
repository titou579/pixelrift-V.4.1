import * as THREE from 'three';
import { loadModel } from './assetLoader.js';
import { GUN_FILES, GUN_META } from './assetCatalog.js';

// ============================================================
// ICÔNES D'ARMES (façon Fortnite) : chaque arme est photographiée une fois par un petit
// rendu hors écran, puis servie comme image (data URL) à la barre d'inventaire et à l'écran Tab.
// ============================================================
export async function buildWeaponIcons(ids) {
  const icons = {};
  let renderer;
  try {
    const W = 256, H = 112;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x556070, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const cam = new THREE.OrthographicCamera(-1.25, 1.25, 0.547, -0.547, 0.1, 20);
    cam.position.set(0, 0.35, 6);
    cam.lookAt(0, 0, 0);

    for (const id of ids) {
      if (!GUN_FILES[id]) continue;
      try {
        const raw = await loadModel(GUN_FILES[id]);
        const wrap = new THREE.Group();
        const orient = new THREE.Group();
        orient.add(raw.clone(true));
        orient.rotation.y = (GUN_META[id] && GUN_META[id].rotY) || 0;
        wrap.add(orient);
        wrap.rotation.set(0.18, -0.35, 0);       // trois-quarts, pour mieux voir le relief
        scene.add(wrap);
        wrap.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(wrap);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const k = Math.min(2.2 / Math.max(size.x, 1e-6), 0.95 / Math.max(size.y, 1e-6));
        wrap.scale.setScalar(k);
        wrap.position.set(-center.x * k, -center.y * k, -center.z * k);
        renderer.render(scene, cam);
        icons[id] = canvas.toDataURL('image/png');
        scene.remove(wrap);
      } catch { /* modèle introuvable : pas d'icône */ }
    }
  } catch (e) {
    console.warn('Icônes d’armes indisponibles', e);
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); }
  }
  return icons;
}
