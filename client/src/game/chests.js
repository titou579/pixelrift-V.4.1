import * as THREE from 'three';
import { loadAsset, cloneModel } from './assetLoader.js';

// ============================================================
// COFFRES À BUTIN (façon Fortnite) : coffre doré posé au sol + faisceau lumineux visible de loin.
// L'état (positions, ouvert / fermé) vient du serveur ; on appuie sur F à côté pour l'ouvrir.
// ============================================================
export function createChests(scene, { lowPower = false } = {}) {
  let reduced = !!lowPower;
  const items = new Map();          // id -> { group, data, baseY }
  const bursts = [];                // faisceaux d'ouverture (couleur de rareté)
  let info = null;
  let infoTried = false;
  let t = 0;

  const beamGeo = new THREE.CylinderGeometry(0.45, 0.45, 16, 14, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xffc94a, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const ringGeo = new THREE.CylinderGeometry(1, 1, 0.06, 28);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc94a, transparent: true, opacity: 0.55 });

  async function ensureModel() {
    if (infoTried) return;
    infoTried = true;
    try { info = await loadAsset('sv_chest'); } catch { info = null; }
  }

  function makeMesh() {
    const g = new THREE.Group();
    if (info) {
      const inner = cloneModel(info.scene);
      inner.position.set(-info.center.x, -info.minY, -info.center.z);
      inner.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      const wrap = new THREE.Group();
      wrap.add(inner);
      wrap.scale.setScalar(info.scale * 1.15);
      g.add(wrap);
    } else {
      // coffre de secours : boîte dorée
      const body = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.65), new THREE.MeshLambertMaterial({ color: 0xb8842a }));
      body.position.y = 0.3;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.22, 0.69), new THREE.MeshLambertMaterial({ color: 0xe0a93a }));
      lid.position.y = 0.7;
      g.add(body, lid);
    }
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.scale.set(1.0, 1, 1.0);
    ring.position.y = 0.04;
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.y = 8;
    beam.visible = !reduced;
    g.add(ring, beam);
    return g;
  }

  async function setState(list) {
    await ensureModel();
    for (const it of items.values()) scene.remove(it.group);
    items.clear();
    for (const c of list) {
      const group = makeMesh();
      group.position.set(c.x, c.y || 0, c.z);
      group.rotation.y = (c.id * 1.7) % (Math.PI * 2);
      group.visible = !c.opened;
      scene.add(group);
      items.set(c.id, { group, data: c, baseRot: group.rotation.y });
    }
  }

  function burst(x, y, z, colorHex) {
    const m = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: colorHex, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      })
    );
    m.position.set(x, y + 8, z);
    m.scale.set(2.2, 1.4, 2.2);
    scene.add(m);
    bursts.push({ mesh: m, life: 1.4 });
  }

  function open(id, colorHex = 0xffc94a) {
    const it = items.get(id);
    if (!it) return;
    it.data.opened = true;
    it.group.visible = false;
    burst(it.group.position.x, it.group.position.y, it.group.position.z, colorHex);
  }
  function respawn(id) {
    const it = items.get(id);
    if (!it) return;
    it.data.opened = false;
    it.group.visible = true;
  }

  // Coffre fermé le plus proche (distance horizontale)
  function nearest(pos, maxDist) {
    let best = null, bd = maxDist;
    for (const it of items.values()) {
      if (it.data.opened) continue;
      const d = Math.hypot(it.group.position.x - pos.x, it.group.position.z - pos.z);
      if (d < bd) { bd = d; best = { id: it.data.id, dist: d }; }
    }
    return best;
  }

  const list = () => Array.from(items.values()).map((it) => ({ x: it.group.position.x, z: it.group.position.z, opened: !!it.data.opened }));

  function tick(dt) {
    t += dt;
    for (const it of items.values()) {
      if (!it.group.visible) continue;
      if (!reduced) it.group.rotation.y = it.baseRot + Math.sin(t * 0.8 + it.data.id) * 0.12;
    }
    if (!reduced) beamMat.opacity = 0.16 + Math.sin(t * 2.2) * 0.05;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      b.mesh.material.opacity = Math.max(0, b.life / 1.4) * 0.7;
      b.mesh.scale.x = b.mesh.scale.z = 2.2 + (1.4 - b.life) * 1.2;
      if (b.life <= 0) { scene.remove(b.mesh); b.mesh.material.dispose(); bursts.splice(i, 1); }
    }
  }

  function dispose() {
    for (const it of items.values()) scene.remove(it.group);
    items.clear();
    for (const b of bursts) { scene.remove(b.mesh); b.mesh.material.dispose(); }
    bursts.length = 0;
  }

  return { setState, open, respawn, nearest, list, tick, dispose, setLowPower(value) { reduced = !!value; for (const it of items.values()) { const beam = it.group.children.find((o) => o.geometry === beamGeo); if (beam) beam.visible = !reduced; } } };
}

// ============================================================
// COLLINE du mode « Roi de la colline » : disque + anneau + faisceau (vert = libre,
// bleu = tu la tiens, orange = quelqu'un d'autre la tient, rouge = contestée).
// ============================================================
export function createHill(scene) {
  const group = new THREE.Group();
  const discMat = new THREE.MeshBasicMaterial({ color: 0x58d68d, transparent: true, opacity: 0.28, depthWrite: false });
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x58d68d });
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x58d68d, transparent: true, opacity: 0.14, side: THREE.DoubleSide,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.08, 40), discMat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 30, 40, 1, true), beamMat);
  beam.position.y = 15;
  group.add(disc, ring, beam);
  group.visible = false;
  scene.add(group);

  function set(state, myId) {
    if (!state) { group.visible = false; return; }
    group.visible = true;
    group.position.set(state.x, 0, state.z);
    group.scale.set(state.r, 1, state.r);
    let color = 0x58d68d;
    if (state.contested) color = 0xe74c3c;
    else if (state.occupant) color = state.occupant === myId ? 0x4fa8ff : 0xff9d1c;
    discMat.color.setHex(color); ringMat.color.setHex(color); beamMat.color.setHex(color);
  }
  function dispose() { scene.remove(group); }
  return { set, dispose, group };
}
