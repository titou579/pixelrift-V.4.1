// ============================================================
// NOUVELLES CARTES (v5) — données pures (sans Three.js), identiques chez tous les joueurs
// ET lues par le serveur (bots : obstacles, points d'apparition, coffres, collines).
//
// Même format que generateMap() de mapLayout.js, plus :
//   half        : demi-largeur de la carte (m)
//   chests      : [{x, y, z}]  emplacements des coffres
//   hills       : [{x, z, r}]  zones du mode « Roi de la colline »
//   groundColor : couleur du sol de base
//
//  • entrepot : Entrepôt 17 — conteneurs, rayonnages, chariots, bureaux (120 m)
//  • survie   : Camp de survie — forêt, tentes, palissades, miradors (150 m)
//  • toon     : Zone Toon — tranchées, barrières, épaves (110 m)
// ============================================================
import { ASSETS } from './assetCatalog.js';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeBuilder(seed, half) {
  const rand = mulberry32(seed);
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const out = {
    half, roads: [], slabs: [], ground: [], water: [], boxes: [], props: [],
    spawns: [], zones: [], pads: [], chests: [], hills: [], groundColor: null,
  };
  const occ = [];
  const reserve = (x, z, r) => occ.push({ x, z, r });
  const hitsOcc = (x, z, r) => occ.some((o) => (x - o.x) ** 2 + (z - o.z) ** 2 < (r + o.r) ** 2);
  const inBounds = (x, z, m = 4) => Math.abs(x) < half - m && Math.abs(z) < half - m;
  const nearSpawn = (x, z, r) => out.spawns.some((s) => Math.hypot(x - s.x, z - s.z) < 4.5 + r);
  const onRoad = (x, z, margin) => out.roads.some((r) => Math.abs(x - r.x) < r.w / 2 + margin && Math.abs(z - r.z) < r.d / 2 + margin);

  function put(key, x, z, rot = 0, o = {}) {
    const a = ASSETS[key];
    if (!a) return false;
    const s = o.s ?? 1;
    out.props.push({ key, x, y: o.y ?? 0, z, rot, s, sy: o.sy ?? 1 });
    if (!o.noOcc) reserve(x, z, (a.r || 1) * s * 0.9);
    return true;
  }
  function tryPut(key, x, z, rot = 0, o = {}) {
    const a = ASSETS[key];
    if (!a) return false;
    const r = (a.r || 1) * (o.s ?? 1) * 0.9;
    if (!inBounds(x, z) || nearSpawn(x, z, r) || hitsOcc(x, z, r)) return false;
    if (!o.road && onRoad(x, z, r * 0.6)) return false;
    return put(key, x, z, rot, o);
  }
  function scatter(keys, rect, n, o = {}) {
    let placed = 0;
    for (let i = 0; i < n * 6 && placed < n; i++) {
      const x = rnd(rect[0], rect[2]);
      const z = rnd(rect[1], rect[3]);
      if (o.avoid && o.avoid(x, z)) continue;
      const key = Array.isArray(keys) ? pick(keys) : keys;
      const s = o.sMin ? rnd(o.sMin, o.sMax) : 1;
      if (tryPut(key, x, z, rand() * Math.PI * 2, { s, road: o.road })) placed++;
    }
    return placed;
  }
  const box = (x, y, z, w, h, d, color, extra = {}) => {
    out.boxes.push({ x, y, z, w, h, d, color, emissive: !!extra.emissive, collide: extra.collide !== false });
  };
  // Escalier plein : monte le long de `dir` ('+x' '-x' '+z' '-z'), marches de 42 cm (le joueur enjambe 50 cm)
  function stairs(x0, z0, dir, steps, width, color = 0x8a6a3f) {
    const run = 0.9, rise = 0.42;
    for (let i = 0; i < steps; i++) {
      const c = (i + 0.5) * run;
      const dx = dir === '+x' ? c : dir === '-x' ? -c : 0;
      const dz = dir === '+z' ? c : dir === '-z' ? -c : 0;
      const alongX = dir === '+x' || dir === '-x';
      box(x0 + dx, 0, z0 + dz, alongX ? run : width, (i + 1) * rise, alongX ? width : run, color);
    }
    return steps * run;
  }
  const spawnRing = (list) => { out.spawns = list.map(([x, z]) => ({ x, y: 1.7, z })); };
  const addChest = (x, z, y = 0) => { out.chests.push({ x, y, z }); reserve(x, z, 2); };
  const addHill = (x, z, r = 7, keep = 5) => { out.hills.push({ x, z, r }); reserve(x, z, keep); };
  const wall = (x, z, w, d, h, color, y = 0) => box(x, y, z, w, h, d, color);

  return { rand, rnd, pick, out, reserve, put, tryPut, scatter, box, stairs, spawnRing, addChest, addHill, wall, inBounds };
}

// =====================================================================
//  ENTREPÔT 17
// =====================================================================
function entrepot() {
  const B = makeBuilder(170717, 60);
  const { out, put, tryPut, scatter, box, stairs, spawnRing, addChest, addHill, wall, rnd, pick } = B;
  out.name = 'Entrepôt 17';
  out.groundColor = 0x6c6f75;
  out.slabs.push({ x: 0, z: 0, w: 116, d: 116, color: 0x8d8f94 });

  spawnRing([
    [24, 24], [-24, 24], [24, -24], [-24, -24],
    [48, 0], [-48, 0], [0, 48], [0, -48],
    [48, 24], [-48, 24], [48, -24], [-48, -24],
    [24, 0], [-24, 0], [0, 24], [0, -24],
  ]);

  // Enceinte : murs de béton + bandeaux lumineux
  const H = 60;
  wall(0, -(H - 1), 2 * H, 2, 9, 0x7b7f86);
  wall(0, H - 1, 2 * H, 2, 9, 0x7b7f86);
  wall(-(H - 1), 0, 2, 2 * H - 4, 9, 0x7b7f86);
  wall(H - 1, 0, 2, 2 * H - 4, 9, 0x7b7f86);
  for (const [x, z, w, d] of [[0, -(H - 2.05), 2 * H - 6, 0.12], [0, H - 2.05, 2 * H - 6, 0.12], [-(H - 2.05), 0, 0.12, 2 * H - 10], [H - 2.05, 0, 0.12, 2 * H - 10]]) {
    box(x, 6.4, z, w, 0.35, d, 0xffc861, { emissive: true, collide: false });
  }

  // Coffres, collines
  for (const [x, z] of [[12, 24], [-12, -24], [12, -24], [-12, 24], [24, 12], [-24, -12], [24, -12], [-24, 12], [0, 36], [0, -36], [36, 0], [-36, 0]]) addChest(x, z);
  for (const [x, z] of [[0, 0], [24, -24], [-24, 24], [0, 48], [0, -48], [48, 0], [-48, 0]]) addHill(x, z, 7, 4);

  // Conteneurs : 16 en damier ; 2 sont empilés, 2 ont un escalier jusqu'au toit
  const CH = 2.93;
  const stairBoxes = new Set(['12,36', '-12,-36']);
  const stacked = new Set(['36,12', '-36,-12']);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const a of [12, 36]) {
        for (const b of [12, 36]) {
          const x = sx * a, z = sz * b;
          const rot = a === b ? 0 : Math.PI / 2;
          put('wh_container', x, z, rot);
          if (stacked.has(`${x},${z}`)) put('wh_container', x, z, rot + 0.04, { y: CH, noOcc: true });
        }
      }
    }
  }
  void stairBoxes;
  // Escaliers vers le toit des conteneurs (12,36) et (-12,-36), qui sont orientés selon z
  stairs(12, 26.7, '+z', 7, 2.4, 0x6a6e75);
  stairs(-12, -26.7, '-z', 7, 2.4, 0x6a6e75);

  // Rayonnages au fond de l'entrepôt
  for (let x = -46; x <= 46; x += 4.6) {
    put('wh_shelves', x, -52.5, Math.PI / 2);
    put('wh_shelves', x, 52.5, Math.PI / 2);
  }
  // Chariots élévateurs, convoyeurs, groupes électrogènes
  put('wh_forklift', -30, 20, 0.4); put('wh_forklift', 30, -20, 2.0);
  put('wh_forklift', -6, 30, 1.2); put('wh_forklift', 6, -30, -0.7);
  put('wh_conveyor', 24, 36, Math.PI / 2); put('wh_conveyor', -24, -36, Math.PI / 2);
  put('wh_generator', 48, 40, 0); put('wh_generator', -48, -40, 0);
  put('wh_generator', -48, 42, 0.3); put('wh_generator', 48, -36, 3.1);

  // Bureaux (angle nord-est) : 12 × 10 m, deux portes, toit
  const OX0 = 43, OX1 = 55, OZ0 = -57, OZ1 = -47, WH = 3.2, WC = 0xb8b2a6;
  wall(OX0, (OZ0 + OZ1) / 2 - 3.6, 0.3, 2.8, WH, WC); wall(OX0, (OZ0 + OZ1) / 2 + 3.6, 0.3, 2.8, WH, WC);   // mur ouest + porte
  wall((OX0 + OX1) / 2 - 4, OZ1, 4, 0.3, WH, WC); wall((OX0 + OX1) / 2 + 4, OZ1, 4, 0.3, WH, WC);           // mur sud + porte
  wall((OX0 + OX1) / 2, OZ0, OX1 - OX0, 0.3, WH, WC); wall(OX1, (OZ0 + OZ1) / 2, 0.3, OZ1 - OZ0, WH, WC);
  box((OX0 + OX1) / 2, WH, (OZ0 + OZ1) / 2, OX1 - OX0 + 0.4, 0.3, OZ1 - OZ0 + 0.4, 0x6f6b63);
  put('wh_desk', 47, -54, 0); put('wh_desk', 52, -54, 0);
  put('wh_chair', 47, -52.6, 3.1, { noOcc: true }); put('wh_chair', 52, -52.6, 3.3, { noOcc: true });
  put('wh_whiteboard', 49.5, -56.6, 0); put('wh_cooler', 54.3, -50, 0); put('wh_printer', 44.4, -50, 1.57); put('wh_trash', 54.3, -55.5, 0);
  addChest(49.5, -50);

  // Petit mobilier de stockage
  scatter(['wh_pallet', 'wh_box', 'tn_crate', 'tn_boxes'], [-54, -54, 54, 54], 46);
  scatter(['tn_barrel', 'tn_gastank'], [-54, -54, 54, 54], 16);
  scatter(['wh_trash', 'tn_dumpster'], [-54, -54, 54, 54], 5);

  out.pads.push({ x: 24, z: 0, y: 0, r: 2.4 }, { x: -24, z: 0, y: 0, r: 2.4 }, { x: 0, z: 36, y: 0, r: 2.4 });
  void rnd; void pick; void tryPut;
  return out;
}

// =====================================================================
//  CAMP DE SURVIE
// =====================================================================
function survie() {
  const B = makeBuilder(750115, 75);
  const { out, put, tryPut, scatter, box, stairs, spawnRing, addChest, addHill, rnd, pick, rand } = B;
  out.name = 'Camp de survie';
  out.groundColor = 0x4f7d3a;
  out.ground.push({ x: 0, z: 0, w: 46, d: 46, color: 0x7a6a47 });         // terre battue du camp

  const sp = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; sp.push([Math.cos(a) * 30, Math.sin(a) * 30]); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.6; sp.push([Math.cos(a) * 55, Math.sin(a) * 55]); }
  spawnRing(sp);

  // Coffres : anneau du camp, pieds des miradors, rochers
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.55; addChest(Math.cos(a) * 14, Math.sin(a) * 14); }
  for (const [x, z] of [[42, 30], [-42, -30], [46, -52], [-46, 52], [60, 0], [-60, 0], [0, 62], [0, -62]]) addChest(x, z);
  // Collines
  for (const [x, z] of [[0, 0], [40, 0], [-40, 0], [0, 40], [0, -40]]) addHill(x, z, 7, 5);

  // Camp central : tentes, feu, établis, tonneaux
  put('sv_campfire', 0, 0, 0);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; put(i % 2 ? 'sv_tent_half' : 'sv_tent', Math.cos(a) * 9, Math.sin(a) * 9, -a + Math.PI / 2); }
  put('sv_workbench', 4, -3, 0.3); put('sv_workbench', -4, 3.5, 2.8);
  put('sv_barrel', 3, 4, 0, { noOcc: false }); put('sv_barrel', 4.1, 3.4, 0); put('sv_box', -3, -4, 0.5); put('sv_box', -4.2, -4.4, 1.1);
  for (let i = 0; i < 6; i++) put('sv_bedroll', Math.cos(i * 1.05) * 5.5, Math.sin(i * 1.05) * 5.5, i, { noOcc: true });

  // Palissade (anneau de rayon 20) avec 4 portes
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    const gate = Math.abs(Math.sin(a * 2)) < 0.14;      // portes N/E/S/O
    if (gate) continue;
    put('sv_fence', Math.cos(a) * 20, Math.sin(a) * 20, -a + Math.PI / 2, { noOcc: true });
  }

  // Miradors : plateformes de bois avec escalier et garde-corps
  for (const [cx, cz, dir] of [[42, 42, '-x'], [-42, -42, '+x'], [42, -42, '-z'], [-42, 42, '+z']]) {
    box(cx, 0, cz, 5, 3.36, 5, 0x8a6a3f);
    box(cx, 3.36, cz - 2.4, 5, 0.9, 0.25, 0x6e5230); box(cx, 3.36, cz + 2.4, 5, 0.9, 0.25, 0x6e5230);
    box(cx - 2.4, 3.36, cz, 0.25, 0.9, 5, 0x6e5230); box(cx + 2.4, 3.36, cz, 0.25, 0.9, 5, 0x6e5230);
    const sx = dir === '-x' ? cx - 2.5 : dir === '+x' ? cx + 2.5 : cx;
    const sz = dir === '-z' ? cz - 2.5 : dir === '+z' ? cz + 2.5 : cz;
    stairs(sx, sz, dir, 8, 2.2);
    B.reserve(cx, cz, 5);
  }

  // Rochers, troncs, panneaux
  const notCamp = (x, z) => Math.hypot(x, z) < 24;
  scatter(['sv_rock', 'sv_rock_flat'], [-70, -70, 70, 70], 36, { avoid: notCamp, sMin: 0.9, sMax: 1.7 });
  scatter(['sv_log', 'sv_log_l'], [-70, -70, 70, 70], 16, { avoid: notCamp });
  scatter(['sv_sign', 'sv_barrel', 'sv_box'], [-70, -70, 70, 70], 12, { avoid: notCamp });
  // Forêt dense
  scatter(['sv_tree', 'sv_tree_l'], [-72, -72, 72, 72], 170, { avoid: (x, z) => Math.hypot(x, z) < 25, sMin: 0.85, sMax: 1.3 });
  scatter(['sv_grass'], [-72, -72, 72, 72], 130, { avoid: notCamp, sMin: 0.8, sMax: 1.4 });
  // Ceinture d'arbres
  for (let i = 0; i < 160; i++) {
    const side = Math.floor(rand() * 4), t = rnd(-72, 72), d = rnd(61, 70);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -d : d;
    const z = side === 0 ? -d : side === 1 ? d : t;
    tryPut(pick(['sv_tree_l', 'sv_tree']), x, z, rand() * 6, { s: rnd(0.95, 1.35) });
  }
  out.pads.push({ x: 0, z: 30, y: 0, r: 2.4 }, { x: 0, z: -30, y: 0, r: 2.4 }, { x: 42, z: 42, y: 3.36, r: 2.0 });
  return out;
}

// =====================================================================
//  ZONE TOON
// =====================================================================
function toon() {
  const B = makeBuilder(551203, 55);
  const { out, put, tryPut, scatter, box, spawnRing, addChest, addHill, rnd, pick, rand } = B;
  out.name = 'Zone Toon';
  out.groundColor = 0xb8a26c;
  out.roads.push({ x: 0, z: 0, w: 100, d: 12, dir: 'x' });

  spawnRing([
    [36, 40], [-36, 40], [36, -40], [-36, -40],
    [45, 0], [-45, 0], [0, 45], [0, -45],
    [25, 35], [-25, 35], [25, -35], [-25, -35],
    [35, 14], [-35, 14], [35, -14], [-35, -14],
  ]);
  for (const [x, z] of [[20, 10], [-20, -10], [20, -10], [-20, 10], [36, 28], [-36, -28], [36, -28], [-36, 28], [0, 28], [0, -28]]) addChest(x, z);
  for (const [x, z] of [[0, 0], [30, -14], [-30, 14], [0, 36], [0, -36]]) addHill(x, z, 7, 4);

  // Fort central : 4 conteneurs avec 4 passages
  put('tn_container', -7.5, -7.5, 0); put('tn_container', 7.5, -7.5, Math.PI / 2);
  put('tn_container', 7.5, 7.5, 0); put('tn_container', -7.5, 7.5, Math.PI / 2);
  put('tn_watertank', 0, 0, 0);
  // Tranchées de sacs de sable (avec trous pour passer)
  for (const z of [-22, 22]) {
    for (let x = -40; x <= 40; x += 3.4) {
      if (Math.abs(x) < 9 || Math.abs(Math.abs(x) - 24) < 3) continue;
      put('tn_sack', x, z, 0, { noOcc: true });
    }
  }
  // Barrières décalées
  for (const x of [-32, 32]) for (let z = -30; z <= 30; z += 15) put('tn_barrier_l', x, z + (x > 0 ? 4 : -4), Math.PI / 2);
  // Épaves de voitures sur la route
  for (const [x, z, r] of [[-30, 2, 0.2], [-14, -3, 1.4], [12, 3, -0.3], [28, -2, 1.2], [-4, 4.5, 0.1], [40, 3, 3.0]]) put('tn_car', x, z, r, { road: true });
  // Clôtures en L aux coins
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let i = 0; i < 3; i++) { put('tn_fence', sx * (38 + i * 4.2), sz * 50, 0, { noOcc: true }); put('tn_fence', sx * 50, sz * (38 + i * 4.2), Math.PI / 2, { noOcc: true }); }
    put('tn_watertank', sx * 44, sz * 44, 0);
  }
  // Lampadaires
  for (const [x, z] of [[-16, 8], [16, -8], [-16, -8], [16, 8]]) put('tn_light', x, z, 0, { road: true });

  scatter(['tn_crate', 'tn_boxes', 'tn_pallet', 'tn_tires'], [-52, -52, 52, 52], 40);
  scatter(['tn_barrel', 'tn_gastank'], [-52, -52, 52, 52], 16);
  scatter(['tn_dumpster'], [-52, -52, 52, 52], 4);
  // Arbres sur le pourtour
  for (let i = 0; i < 80; i++) {
    const side = Math.floor(rand() * 4), t = rnd(-52, 52), d = rnd(46, 52);
    const x = side === 0 ? t : side === 1 ? t : side === 2 ? -d : d;
    const z = side === 0 ? -d : side === 1 ? d : t;
    tryPut('tn_tree', x, z, rand() * 6, { s: rnd(0.9, 1.3) });
  }
  out.pads.push({ x: 0, z: 18, y: 0, r: 2.4 }, { x: 0, z: -18, y: 0, r: 2.4 });
  void box; void pick;
  return out;
}

export const ARENA_BUILDERS = { entrepot, survie, toon };
export function generateArena(id) {
  const fn = ARENA_BUILDERS[id];
  if (!fn) throw new Error(`Carte inconnue : ${id}`);
  return fn();
}
