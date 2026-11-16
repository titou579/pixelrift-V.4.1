import * as THREE from 'three';

// Trousse médicale stylisée : géométrie procédurale low-poly, aucun modèle distant.
export function createMedkits(scene, { lowPower = false } = {}) {
  const items = new Map();
  let time = 0;
  let reduced = !!lowPower;
  const baseGeo = new THREE.BoxGeometry(0.82, 0.48, 0.62);
  const crossVGeo = new THREE.BoxGeometry(0.16, 0.42, 0.08);
  const crossHGeo = new THREE.BoxGeometry(0.42, 0.16, 0.08);
  const trimGeo = new THREE.BoxGeometry(0.86, 0.08, 0.66);
  const baseMat = new THREE.MeshLambertMaterial({ color: 0xd83d48 });
  const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const trimMat = new THREE.MeshLambertMaterial({ color: 0x8e202a });
  const ringGeo = new THREE.TorusGeometry(0.64, 0.035, 5, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x61e58a, transparent: true, opacity: 0.7 });

  function makeMesh() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(baseGeo, baseMat);
    body.position.y = 0.46;
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.y = 0.68;
    const v = new THREE.Mesh(crossVGeo, whiteMat);
    v.position.set(0, 0.48, 0.34);
    const h = new THREE.Mesh(crossHGeo, whiteMat);
    h.position.set(0, 0.48, 0.34);
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(body, trim, v, h, ring);
    return group;
  }

  function setState(list = []) {
    for (const item of items.values()) scene.remove(item.group);
    items.clear();
    for (const data of list) {
      const group = makeMesh();
      group.position.set(data.x, data.y || 0, data.z);
      group.visible = !data.collected;
      scene.add(group);
      items.set(data.id, { data: { ...data }, group, phase: (data.id || 0) * 0.7 });
    }
  }

  function collect(id) {
    const item = items.get(id);
    if (!item) return;
    item.data.collected = true;
    item.group.visible = false;
  }

  function respawn(id) {
    const item = items.get(id);
    if (!item) return;
    item.data.collected = false;
    item.group.visible = true;
  }

  function nearest(pos, maxDist = 4.5) {
    let found = null;
    let best = maxDist;
    for (const item of items.values()) {
      if (item.data.collected) continue;
      const distance = Math.hypot(item.group.position.x - pos.x, item.group.position.z - pos.z);
      if (distance < best) { best = distance; found = { id: item.data.id, dist: distance }; }
    }
    return found;
  }

  function list() {
    return Array.from(items.values()).map(({ group, data }) => ({
      x: group.position.x, z: group.position.z, opened: !!data.collected,
    }));
  }

  function tick(dt) {
    if (reduced) return;
    time += dt;
    for (const item of items.values()) {
      if (!item.group.visible) continue;
      item.group.position.y = (item.data.y || 0) + 0.045 + Math.sin(time * 2 + item.phase) * 0.08;
      item.group.rotation.y += dt * 0.45;
    }
  }

  function dispose() {
    for (const item of items.values()) scene.remove(item.group);
    items.clear();
    baseGeo.dispose(); crossVGeo.dispose(); crossHGeo.dispose(); trimGeo.dispose(); ringGeo.dispose();
    baseMat.dispose(); whiteMat.dispose(); trimMat.dispose(); ringMat.dispose();
  }

  return { setState, collect, respawn, nearest, list, tick, dispose, setLowPower(value) { reduced = !!value; } };
}
