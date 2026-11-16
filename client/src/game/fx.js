import * as THREE from 'three';

// Petits effets visuels : explosion (boule de feu qui gonfle) et éclats de caisse.
export function createFx(scene, { lowPower = false } = {}) {
  const items = [];
  let reduced = lowPower;
  const ballGeo = new THREE.SphereGeometry(1, 16, 12);
  const chunkGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);

  function explosion(x, y, z, radius = 7) {
    const mk = (color, op) => new THREE.Mesh(ballGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    const outer = mk(0xff7a1a, 0.75), inner = mk(0xfff0b0, 0.9);
    outer.position.set(x, y + 0.8, z); inner.position.copy(outer.position);
    scene.add(outer, inner);
    items.push({ kind: 'ball', outer, inner, life: 0.7, max: 0.7, radius });
    // fumée / étincelles
    for (let i = 0; i < (reduced ? 5 : 16); i++) chunk(x, y + 0.8, z, 0x2b2b2b, 9);
  }
  function chunk(x, y, z, color, speed) {
    const m = new THREE.Mesh(chunkGeo, new THREE.MeshLambertMaterial({ color, transparent: true }));
    m.position.set(x, y, z);
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.4 + Math.random() * 0.7);
    scene.add(m);
    items.push({ kind: 'chunk', mesh: m, vx: Math.cos(a) * s, vy: 3 + Math.random() * s * 0.6, vz: Math.sin(a) * s, life: 0.9 });
  }
  function breakProp(x, y, z) {
    for (let i = 0; i < (reduced ? 3 : 10); i++) chunk(x, y + 0.5, z, [0x9b7a4b, 0xc19a5b, 0x6e5230][i % 3], 4.5);
  }

  function tick(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.life -= dt;
      if (it.kind === 'ball') {
        const k = 1 - it.life / it.max;
        const r = it.radius * (0.25 + k * 0.55);
        it.outer.scale.setScalar(r); it.inner.scale.setScalar(r * 0.55);
        it.outer.material.opacity = Math.max(0, 0.75 * (1 - k));
        it.inner.material.opacity = Math.max(0, 0.9 * (1 - k * 1.6));
        if (it.life <= 0) { scene.remove(it.outer, it.inner); it.outer.material.dispose(); it.inner.material.dispose(); items.splice(i, 1); }
      } else {
        it.vy -= 16 * dt;
        it.mesh.position.x += it.vx * dt; it.mesh.position.y = Math.max(0.1, it.mesh.position.y + it.vy * dt); it.mesh.position.z += it.vz * dt;
        it.mesh.rotation.x += dt * 6; it.mesh.rotation.z += dt * 5;
        it.mesh.material.opacity = Math.max(0, it.life / 0.9);
        if (it.life <= 0) { scene.remove(it.mesh); it.mesh.material.dispose(); items.splice(i, 1); }
      }
    }
  }
  function dispose() {
    for (const it of items) { if (it.kind === 'ball') { scene.remove(it.outer, it.inner); } else scene.remove(it.mesh); }
    items.length = 0;
  }
  return { explosion, breakProp, tick, dispose, setLowPower(value) { reduced = !!value; } };
}
