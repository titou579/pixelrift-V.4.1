import * as THREE from 'three';
import { loadModel, cloneModel } from './assetLoader.js';

const MODEL_PATHS = {
  wall: { solid: 'models/build/wall_solid.glb', window: 'models/build/wall_window.glb', door: 'models/build/wall_door.glb' },
  floor: { default: 'models/build/floor.glb' },
  ramp: { default: 'models/build/ramp.glb' },
  roof: { default: 'models/build/roof.glb' },
};

const MODEL_CACHE = new Map();
const WALL_HEIGHT = 3;
const PANEL = 4;
const HALF = PANEL / 2;

function modelKey(data) {
  return `${data.type}:${data.type === 'wall' ? (data.variant || 'solid') : 'default'}`;
}

function buildParts(data) {
  const { type, variant = 'solid', x, y, z, rotation = 0 } = data;
  const parts = [];
  const add = (cx, cy, cz, sx, sy, sz) => {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const wx = x + cx * c + cz * s;
    const wz = z - cx * s + cz * c;
    const hx = (Math.abs(c) * sx + Math.abs(s) * sz) / 2;
    const hz = (Math.abs(s) * sx + Math.abs(c) * sz) / 2;
    parts.push({ min: { x: wx - hx, y: y + cy - sy / 2, z: wz - hz }, max: { x: wx + hx, y: y + cy + sy / 2, z: wz + hz } });
  };

  if (type === 'wall') {
    if (variant === 'window') {
      add(-1.62, 1.5, 0, 0.76, 3, 0.28); add(1.62, 1.5, 0, 0.76, 3, 0.28);
      add(0, 0.36, 0, 2.48, 0.72, 0.28); add(0, 2.54, 0, 2.48, 0.92, 0.28);
    } else if (variant === 'door') {
      add(-1.34, 1.5, 0, 1.32, 3, 0.28); add(1.34, 1.5, 0, 1.32, 3, 0.28);
      add(0, 2.72, 0, 1.36, 0.56, 0.28);
    } else add(0, 1.5, 0, 4, 3, 0.3);
  } else if (type === 'floor' || type === 'roof') {
    add(0, 0.08, 0, 4, 0.26, 4);
  } else if (type === 'ramp') {
    // Une rampe visuelle de 4 m est approximée par huit marches solides.
    for (let i = 0; i < 8; i++) {
      const zz = 1.75 - i * 0.5;
      const hh = 0.32 + i * 0.34;
      add(0, hh / 2, zz, 4, hh, 0.52);
    }
  }
  return parts;
}

function fallbackModel(data) {
  const group = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0xb77a42 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x68442f });
  const trim = new THREE.MeshLambertMaterial({ color: 0xd5a66e });
  const box = (w, h, d, x, y, z, mat = wood) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y, z); group.add(mesh);
  };
  if (data.type === 'wall') {
    if (data.variant === 'window') {
      box(0.76, 3, 0.28, -1.62, 1.5, 0); box(0.76, 3, 0.28, 1.62, 1.5, 0);
      box(2.48, 0.72, 0.28, 0, 0.36, 0); box(2.48, 0.92, 0.28, 0, 2.54, 0);
      box(0.1, 2.1, 0.34, 0, 1.55, 0, trim);
    } else if (data.variant === 'door') {
      box(1.32, 3, 0.28, -1.34, 1.5, 0); box(1.32, 3, 0.28, 1.34, 1.5, 0);
      box(1.36, 0.56, 0.28, 0, 2.72, 0);
      box(1.12, 2.15, 0.08, 0, 1.1, 0.13, dark);
    } else box(4, 3, 0.28, 0, 1.5, 0);
  } else if (data.type === 'floor' || data.type === 'roof') {
    box(4, 0.18, 4, 0, 0.1, 0);
    for (let i = -1; i <= 1; i++) box(0.07, 0.05, 4, i * 1.25, 0.22, 0, trim);
  } else if (data.type === 'ramp') {
    for (let i = 0; i < 8; i++) box(4, 0.3, 0.54, 0, 0.2 + i * 0.34, 1.75 - i * 0.5, i % 2 ? wood : trim);
  }
  group.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return group;
}

async function getTemplate(data) {
  const key = modelKey(data);
  if (!MODEL_CACHE.has(key)) {
    const path = MODEL_PATHS[data.type]?.[data.variant || 'default'];
    MODEL_CACHE.set(key, path ? loadModel(path).catch(() => null) : Promise.resolve(null));
  }
  const model = await MODEL_CACHE.get(key);
  return model ? cloneModel(model) : fallbackModel(data);
}

function cloneForPreview(model) {
  const ghost = cloneModel(model);
  ghost.traverse((obj) => {
    if (!obj.isMesh) return;
    const source = Array.isArray(obj.material) ? obj.material : [obj.material];
    const mats = source.map((m) => {
      const material = m.clone();
      material.transparent = true;
      material.opacity = 0.48;
      material.depthWrite = false;
      material.color?.set(0x64df9a);
      return material;
    });
    obj.material = Array.isArray(obj.material) ? mats : mats[0];
  });
  return ghost;
}

export function createBuildingSystem(scene, world) {
  const items = new Map();
  const previewRoot = new THREE.Group();
  previewRoot.visible = false;
  scene.add(previewRoot);
  let previewKey = '';
  let loadingPreviewKey = '';
  let previewToken = 0;
  let previewData = null;
  let disposed = false;

  function remove(id) {
    const item = items.get(id);
    if (!item) return;
    scene.remove(item.group);
    for (const box of item.colliders) world.remove?.(box);
    items.delete(id);
  }

  async function add(data) {
    if (!data || !Number.isInteger(data.id) || !MODEL_PATHS[data.type]) return;
    remove(data.id);
    const model = await getTemplate(data);
    if (disposed) return;
    const group = new THREE.Group();
    group.add(model);
    group.position.set(data.x, data.y, data.z);
    group.rotation.y = data.rotation || 0;
    group.userData.buildId = data.id;
    scene.add(group);
    const colliders = buildParts(data);
    for (const box of colliders) world.add?.(box);
    items.set(data.id, { data: { ...data }, group, colliders });
  }

  async function setState(list = []) {
    for (const id of Array.from(items.keys())) remove(id);
    await Promise.all(list.map((data) => add(data)));
  }

  async function update(data) { await add(data); }
  function removeMany(id) { remove(id); }

  async function preview(data) {
    if (!data || !MODEL_PATHS[data.type]) { previewRoot.visible = false; previewData = null; return; }
    previewData = data;
    previewRoot.position.set(data.x, data.y, data.z);
    previewRoot.rotation.y = data.rotation || 0;
    previewRoot.visible = true;
    const key = modelKey(data);
    if (key === previewKey && previewRoot.children.length) return;
    if (key === loadingPreviewKey) return;
    loadingPreviewKey = key;
    const token = ++previewToken;
    const model = await getTemplate(data);
    if (disposed || token !== previewToken) return;
    loadingPreviewKey = '';
    while (previewRoot.children.length) {
      const old = previewRoot.children[0];
      old.traverse((o) => { if (o.isMesh && o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; for (const m of mats) if (m.transparent) m.dispose(); } });
      previewRoot.remove(old);
    }
    previewRoot.add(cloneForPreview(model));
    previewKey = key;
  }

  function hidePreview() { previewRoot.visible = false; previewData = null; }
  function nearestOwned(position, ownerId, maxDist = 8) {
    let best = null, distance = maxDist;
    for (const item of items.values()) {
      if (item.data.ownerId !== ownerId) continue;
      const d = Math.hypot(item.data.x - position.x, item.data.z - position.z);
      if (d < distance) { distance = d; best = { ...item.data, dist: d }; }
    }
    return best;
  }
  function dispose() {
    disposed = true;
    previewToken++;
    for (const id of Array.from(items.keys())) remove(id);
    scene.remove(previewRoot);
    previewRoot.traverse((o) => {
      if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) if (m.transparent) m.dispose();
      }
    });
  }
  return { setState, add, update, remove: removeMany, preview, hidePreview, nearestOwned, dispose, get size() { return items.size; } };
}
