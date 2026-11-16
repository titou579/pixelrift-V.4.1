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
//  • foret    : Forêt noire — variante forestière du camp, graine et palette dédiées
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

export function makeBuilder(seed, half) {
  const rand = mulberry32(seed);
  const rnd = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const out = {
    half, roads: [], slabs: [], ground: [], water: [], boxes: [], props: [],
    spawns: [], zones: [], pads: [], chests: [], medkits: [], hills: [], groundColor: null,
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
  const addMedkit = (x, z, y = 0) => { out.medkits.push({ x, y, z }); reserve(x, z, 1.5); };
  const addHill = (x, z, r = 7, keep = 5) => { out.hills.push({ x, z, r }); reserve(x, z, keep); };
  const wall = (x, z, w, d, h, color, y = 0) => box(x, y, z, w, h, d, color);

  return { rand, rnd, pick, out, reserve, put, tryPut, scatter, box, stairs, spawnRing, addChest, addMedkit, addHill, wall, inBounds };
}

// =====================================================================
//  ENTREPÔT 17
// =====================================================================
function entrepot(opts = {}) {
  const B = makeBuilder(170717, 60);
  const { out, put, tryPut, scatter, box, stairs, spawnRing, addChest, addMedkit, addHill, wall, rnd, pick } = B;
  out.name = 'Entrepôt 17';
  out.groundColor = 0x6c6f75;
  out.slabs.push({ x: 0, z: 0, w: 116, d: 116, color: 0x8d8f94 });

  spawnRing([
    [24, 24], [-24, 24], [24, -24], [-24, -24],
    [48, 0], [-48, 0], [0, 48], [0, -48],
    [48, 24], [-48, 24], [48, -24], [-48, -24],
    [24, 0], [-24, 0], [0, 24], [0, -24],
  ]);

  // Enceinte : murs de béton + bandeaux lumineux, avec une porte de 9 m au milieu de chaque mur
  const H = 60, G = 4.5;
  for (const z of [-(H - 1), H - 1]) {
    wall(-(H + G) / 2, z, H - G, 2, 9, 0x7b7f86);
    wall((H + G) / 2, z, H - G, 2, 9, 0x7b7f86);
  }
  for (const x of [-(H - 1), H - 1]) {
    wall(x, -((H - 2) + G) / 2, 2, (H - 2) - G, 9, 0x7b7f86);
    wall(x, ((H - 2) + G) / 2, 2, (H - 2) - G, 9, 0x7b7f86);
  }
  for (const z of [-(H - 2.05), H - 2.05]) {
    box(-(H - 3 + G) / 2 - 0.5, 6.4, z, H - G - 3, 0.35, 0.12, 0xffc861, { emissive: true, collide: false });
    box((H - 3 + G) / 2 + 0.5, 6.4, z, H - G - 3, 0.35, 0.12, 0xffc861, { emissive: true, collide: false });
  }
  for (const x of [-(H - 2.05), H - 2.05]) {
    box(x, 6.4, -(H - 6 + G) / 2 - 0.5, 0.12, 0.35, H - G - 6, 0xffc861, { emissive: true, collide: false });
    box(x, 6.4, (H - 6 + G) / 2 + 0.5, 0.12, 0.35, H - G - 6, 0xffc861, { emissive: true, collide: false });
  }
  void opts;

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
  for (const [x, z] of [[0, 0], [48, 22], [-48, -22], [0, 48]]) addMedkit(x, z);

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
function survie(opts = {}) {
  const B = makeBuilder(opts.seed ?? 750115, 75);
  const { out, put, tryPut, scatter, box, stairs, spawnRing, addChest, addMedkit, addHill, rnd, pick, rand } = B;
  out.name = opts.name || 'Camp de survie';
  out.groundColor = opts.groundColor ?? 0x4f7d3a;
  out.ground.push({ x: 0, z: 0, w: 46, d: 46, color: 0x7a6a47 });         // terre battue du camp

  const sp = [];
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.2; sp.push([Math.cos(a) * 30, Math.sin(a) * 30]); }
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.6; sp.push([Math.cos(a) * 55, Math.sin(a) * 55]); }
  spawnRing(sp);

  // Coffres : anneau du camp, pieds des miradors, rochers
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.55; addChest(Math.cos(a) * 14, Math.sin(a) * 14); }
  for (const [x, z] of [[42, 30], [-42, -30], [46, -52], [-46, 52], [60, 0], [-60, 0], [0, 62], [0, -62]]) addChest(x, z);
  for (const [x, z] of [[0, 28], [32, 0], [-32, 0], [0, -48], [58, 48]]) addMedkit(x, z);
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
  // Réserve explosive de terrain : tonneaux rouges et bonbonnes visibles,
  // volontairement à l'écart du feu et du cœur du camp.
  scatter(['tn_barrel', 'tn_gastank'], [-70, -70, 70, 70], 7, { avoid: (x, z) => Math.hypot(x, z) < 28 });
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
  const { out, put, tryPut, scatter, box, spawnRing, addChest, addMedkit, addHill, rnd, pick, rand } = B;
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
  for (const [x, z] of [[-44, 0], [44, 0], [0, 44], [0, -44]]) addMedkit(x, z);

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

// =====================================================================
//  PORT AZUR — zone portuaire originale : quais, entrepôts, pontons et grues.
// =====================================================================
function port() {
  const B = makeBuilder(880214, 86);
  const { out, put, tryPut, scatter, box, spawnRing, addChest, addMedkit, addHill, wall, rand, rnd } = B;
  out.name = 'Port Azur';
  out.groundColor = 0x6f8066;
  out.ground.push({ x: -50, z: -48, w: 66, d: 76, color: 0x7d817d });
  out.ground.push({ x: 45, z: 42, w: 72, d: 64, color: 0x8a816f });
  out.water.push({ x: 57, z: -39, w: 54, d: 102 }, { x: -48, z: 62, w: 102, d: 32 });
  out.roads.push({ x: 0, z: 0, w: 150, d: 10, dir: 'x' }, { x: -15, z: -27, w: 10, d: 88, dir: 'z' });
  spawnRing([[ -64,-62 ],[-20,-65],[30,-64],[67,14],[68,30],[22,65],[8,65],[-68,24],[-58,0],[-25,35],[22,-12],[48,48],[-48,-22],[0,52],[26,-48],[-8,-48]]);

  // Entrepôt principal avec quais de chargement
  wall(-50,-50,34,2,8,0x56616b); wall(-50,-16,34,2,8,0x56616b);
  wall(-67,-33,2,34,8,0x56616b); wall(-33,-33,2,34,8,0x56616b);
  box(-50,8,-33,30,.5,30,0x424c55);
  for (const [x,z] of [[-58,-44],[-43,-44],[-58,-22],[-43,-22]]) put('wh_pallet',x,z,0);
  put('wh_shelves',-58,-30,0); put('wh_shelves',-42,-30,Math.PI);
  put('wh_generator',-50,-7,0); put('wh_forklift',-38,-10,.3);

  // Bassin nord : deux pontons séparés et une rampe de quai
  for (const x of [-30,0,30]) box(x,0,-68,22,.55,4,0x8a7355);
  for (const x of [-30,0,30]) for (const z of [-68,-58]) put('tn_barrel',x+8,z,0);
  box(0,0,-48,8,.7,26,0x987c55);
  // Zone conteneurs à l'est : allées dégagées et hauteurs variées
  for (const [x,z,r] of [[28,-24,0],[43,-24,0],[58,-24,0],[28,-4,Math.PI/2],[43,-4,Math.PI/2],[58,-4,Math.PI/2],[28,16,0],[58,16,0]]) put('wh_container',x,z,r);
  put('tn_container',43,18,Math.PI/2,{y:2.93});
  // Grue stylisée en volume léger
  box(73,0,-34,2,13,2,0x47535e); box(73,12,-20,2,1.2,30,0x47535e);
  box(62,9,-20,1,1,1,0xe9b34c); box(83,9,-20,1,1,1,0xe9b34c);
  box(75,5,-20,.35,8,.35,0x36424c);
  // Marché de pêche et petits abris au sud-ouest
  put('sv_tent',-52,36,.3); put('sv_tent_half',-34,40,-.3); put('wh_desk',-49,45,0);
  put('tn_crate',-38,52,.2); put('tn_boxes',-53,54,0); put('tn_gastank',-30,49,0);
  // Barrières, bouées, caisses et déchets organisés par secteurs
  for (const x of [-72,-58,-44,-30]) put('tn_barrier_l',x,10,Math.PI/2,{noOcc:true});
  for (const z of [-48,-30,-12,6]) put('tn_sack',-72,z,0,{noOcc:true});
  scatter(['wh_box','tn_crate','wh_pallet','tn_tires'],[4,-78,80,72],34,{avoid:(x,z)=>Math.abs(x-43)<18&&Math.abs(z)<35});
  scatter(['tn_barrel','tn_gastank'],[4,-78,80,72],12,{avoid:(x,z)=>Math.abs(x-43)<18&&Math.abs(z)<35});
  scatter(['rock','sv_rock'],[-82,-82,82,82],22,{avoid:(x,z)=>Math.abs(x)<72&&Math.abs(z)<58,sMin:.8,sMax:1.4});

  for (const [x,z] of [[-56,-42],[-35,-23],[30,-39],[60,6],[38,42],[-50,54],[0,25],[72,48],[12,-72],[-78,20]]) addChest(x,z);
  for (const [x,z] of [[-44,-6],[18,-36],[-56,50],[25,48],[0,-40]]) addMedkit(x,z);
  for (const [x,z] of [[-15,-15],[35,35],[-55,55],[60,-55],[0,60]]) addHill(x,z,7,5);
  out.pads.push({x:0,z:0,y:0,r:2.4},{x:60,z:30,y:0,r:2.4});
  void tryPut; void rnd;
  return out;
}

// =====================================================================
//  CRATÈRE 9 — carrière volcanique : anneau de roche, passerelles et bassin chaud.
// =====================================================================
function cratere() {
  const B = makeBuilder(991207, 88);
  const { out, put, tryPut, scatter, box, spawnRing, addChest, addMedkit, addHill, rand, rnd } = B;
  out.name = 'Cratère 9';
  out.groundColor = 0x66564a;
  out.ground.push({x:0,z:0,w:76,d:76,color:0x594a42});
  out.ground.push({x:0,z:0,w:26,d:26,color:0x8d4a32});
  out.ground.push({x:-49,z:42,w:36,d:28,color:0x6f6258});
  out.ground.push({x:48,z:-43,w:42,d:34,color:0x74665a});
  out.roads.push({x:0,z:-6,w:112,d:8,dir:'x'},{x:0,z:18,w:8,d:90,dir:'z'});
  spawnRing([[-68,-58],[-35,-70],[0,-68],[38,-68],[68,-42],[70,0],[68,48],[34,70],[-12,68],[-54,56],[-70,22],[-64,-20],[-30,38],[32,38],[40,-30],[-38,-28]]);

  // Cuvette centrale et trois passerelles franchissant la zone rouge
  box(0,-1,0,25,1.8,25,0x3f3030);
  box(0,.05,0,17,.18,17,0xc14b31,{collide:false});
  for (const a of [0,Math.PI*2/3,Math.PI*4/3]) {
    const x=Math.cos(a)*20,z=Math.sin(a)*20;
    const bridge = box(x,1.15,z,28,.5,4,0x9b8b78);
    // tablier et garde-corps simples, la géométrie reste peu coûteuse
    box(x,2.5,z-1.7,28,.22,.18,0x514941);
    box(x,2.5,z+1.7,28,.22,.18,0x514941);
  }
  // Parois minérales segmentées autour de la cuvette
  for (let i=0;i<24;i++) {
    const a=i/24*Math.PI*2, r=45+(i%3)*3;
    const h=6+(i%4)*2;
    box(Math.cos(a)*r,h/2,Math.sin(a)*r,8,h,4, i%2?0x65564b:0x837364);
  }
  // Site de forage ouest : foreuse stylisée, convoyeurs et stockage
  box(-55,4,8,3,8,3,0x454b50); box(-55,9,8,14,1.1,1.2,0x454b50);
  put('wh_conveyor',-48,20,.2); put('wh_generator',-65,18,0);
  put('tn_container',-62,34,Math.PI/2); put('tn_container',-47,34,Math.PI/2);
  put('tn_gastank',-58,14,0); put('tn_barrel',-64,24,0);
  // Camp de sécurité à l'est et tunnel de maintenance au sud
  put('sv_tent',49,-46,.7); put('sv_workbench',58,-42,0); put('tn_crate',63,-54,0);
  box(48,0,18,20,4,2,0x514a45); box(48,2,20,20,.3,2,0x8c8174);
  for (const x of [-72,-60,-48,48,60,72]) put('tn_barrier_l',x,66,Math.PI/2,{noOcc:true});
  scatter(['sv_rock','sv_rock_flat','rock'],[-82,-82,82,82],48,{avoid:(x,z)=>Math.hypot(x,z)<50,sMin:.9,sMax:1.65});
  scatter(['tn_tires','tn_crate','tn_boxes'],[-76,-76,76,76],24,{avoid:(x,z)=>Math.hypot(x,z)<32});
  for (const [x,z] of [[-58,-42],[-60,48],[-24,-55],[24,-55],[60,-20],[62,40],[0,58],[0,-78],[-78,0],[78,0],[0,-14]]) addChest(x,z);
  for (const [x,z] of [[-50,0],[50,0],[0,-40],[0,42],[-65,60],[65,-60]]) addMedkit(x,z);
  for (const [x,z] of [[0,0],[-45,-40],[45,45],[-60,60],[60,-60]]) addHill(x,z,7,5);
  out.pads.push({x:-28,z:0,y:0,r:2.4},{x:28,z:0,y:0,r:2.4});
  void tryPut; void rnd;
  return out;
}

const foret = (opts = {}) => survie({ seed: 331771, name: 'Forêt noire', groundColor: 0x3f6b30, ...opts });
export const ARENA_BUILDERS = { entrepot, survie, toon, foret, port, cratere };
export function generateArena(id, opts = {}) {
  const fn = ARENA_BUILDERS[id];
  if (!fn) throw new Error(`Carte inconnue : ${id}`);
  return fn(opts);
}
