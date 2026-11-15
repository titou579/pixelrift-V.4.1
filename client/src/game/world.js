// ============================================================
// MONDE RIFT (v6) — une seule grande carte qui réunit plusieurs « régions », comme Fortnite :
//   • au centre : la Ville Rift (340 m) avec sa base militaire, sa ferme, son camping et son lac
//   • nord-est  : Entrepôt 17        • sud-est  : Zone Toon
//   • sud-ouest : Camp de survie     • nord-ouest : Forêt noire
//   • 4 avant-postes (Nord, Sud, Est, Ouest) et deux routes de ceinture qui relient le tout.
// Données pures : le serveur (bots, coffres, collines) et le client lisent exactement la même carte.
// ============================================================
import { generateMap } from './mapLayout.js';
import { generateArena, makeBuilder } from './arenas.js';

export const WORLD_HALF = 345;
const OFF = 262;           // distance du centre des régions de coin
const RING = 182;          // routes de ceinture (|x| ou |z|)

const SITES = [
  { id: 'entrepot', sx: 1, sz: -1, half: 60, ground: null },
  { id: 'toon', sx: 1, sz: 1, half: 55, ground: 0xb8a26c },
  { id: 'survie', sx: -1, sz: 1, half: 75, ground: 0x4f7d3a },
  { id: 'foret', sx: -1, sz: -1, half: 75, ground: 0x3f6b30 },
];

function merge(dst, src, dx, dz) {
  const mv = (o) => ({ ...o, x: o.x + dx, z: o.z + dz });
  for (const k of ['roads', 'slabs', 'ground', 'water', 'boxes', 'props', 'zones']) {
    for (const o of src[k] || []) dst[k].push(k === 'zones' ? { ...o, rect: o.rect && [o.rect[0] + dx, o.rect[1] + dz, o.rect[2] + dx, o.rect[3] + dz] } : mv(o));
  }
  for (const o of src.spawns || []) dst.spawns.push({ ...o, x: o.x + dx, z: o.z + dz });
  for (const o of src.pads || []) dst.pads.push(mv(o));
  for (const o of src.chests || []) dst.chests.push(mv(o));
  for (const o of src.hills || []) dst.hills.push(mv(o));
}

export function generateWorld() {
  const out = {
    half: WORLD_HALF, name: 'Monde Rift', groundColor: null,
    roads: [], slabs: [], ground: [], water: [], boxes: [], props: [], spawns: [], zones: [], pads: [], chests: [], hills: [],
  };

  // 1. Ville au centre
  merge(out, generateMap(), 0, 0);

  // 2. Régions de coin
  for (const site of SITES) {
    const cx = site.sx * OFF, cz = site.sz * OFF;
    const a = generateArena(site.id);
    if (site.ground !== null) out.ground.push({ x: cx, z: cz, w: site.half * 2 + 6, d: site.half * 2 + 6, color: site.ground });
    merge(out, a, cx, cz);
    site.cx = cx; site.cz = cz;
  }

  // 3. Routes : prolongement des autoroutes de la ville, ceinture, et branches vers chaque région
  const road = (x, z, w, d, dir) => out.roads.push({ x, z, w, d, dir });
  const ringRoads = [];
  const ringRoad = (x, z, w, d, dir) => { road(x, z, w, d, dir); ringRoads.push({ x, z, w, d, dir }); };
  for (const s of [-1, 1]) {
    road(0, s * (166 + RING - 5) / 2 + 0, 10, RING - 166 + 5, 'z');                // autoroute N/S → ceinture
    road(s * (166 + RING - 5) / 2, 0, RING - 166 + 5, 10, 'x');                     // autoroute E/O → ceinture
    ringRoad(s * RING, 0, 10, 2 * OFF, 'z');                                        // ceinture verticale
    ringRoad(0, s * RING, 2 * OFF, 10, 'x');                                        // ceinture horizontale
  }
  for (const site of SITES) {
    // branche horizontale (de la ceinture verticale vers la porte ouest/est de la région)
    const wallX = site.cx - site.sx * site.half;
    const fromX = site.sx * (RING + 5);
    if (Math.abs(wallX - fromX) > 2) road((wallX + fromX) / 2, site.cz, Math.abs(wallX - fromX), 10, 'x');
    const wallZ = site.cz - site.sz * site.half;
    const fromZ = site.sz * (RING + 5);
    if (Math.abs(wallZ - fromZ) > 2) road(site.cx, (wallZ + fromZ) / 2, 10, Math.abs(wallZ - fromZ), 'z');
  }
  // routes entre régions voisines, le long du bord extérieur de la ceinture (axes x = ±262 et z = ±262 entre les coins)
  // (la ceinture ci-dessus s'étend déjà jusqu'à ±262, donc les régions de coin sont toutes reliées)

  // 4. Remplissage : forêts, rochers, avant-postes
  const B = makeBuilder(990001, WORLD_HALF);
  B.out.roads = ringRoads.concat(out.roads.filter((r) => Math.abs(r.x) > 150 || Math.abs(r.z) > 150));
  const insideCity = (x, z) => Math.abs(x) < 178 && Math.abs(z) < 178;
  const insideSite = (x, z) => SITES.some((s) => Math.abs(x - s.cx) < s.half + 8 && Math.abs(z - s.cz) < s.half + 8);
  const nearOutpost = (x, z) => [[OFF, 0], [-OFF, 0], [0, OFF], [0, -OFF]].some(([ox, oz]) => Math.abs(x - ox) < 26 && Math.abs(z - oz) < 26);
  const skip = (x, z) => insideCity(x, z) || insideSite(x, z) || nearOutpost(x, z);

  // Avant-postes : un petit campement de fortune sur chaque route de ceinture
  const outposts = [[OFF, 0, 'toon'], [-OFF, 0, 'camp'], [0, OFF, 'camp'], [0, -OFF, 'toon']];
  for (const [ox, oz, kind] of outposts) {
    const { put, addChest, addHill } = B;
    if (kind === 'toon') {
      put('tn_container', ox - 8, oz - 7, 0); put('tn_container', ox + 8, oz - 7, 0.2); put('tn_container', ox, oz + 9, Math.PI / 2);
      for (let i = -2; i <= 2; i++) put('tn_sack', ox + i * 3.4, oz + 15, 0, { noOcc: true });
      put('tn_barrel', ox + 3, oz - 2, 0); put('tn_gastank', ox - 3, oz + 3, 0); put('tn_crate', ox + 5, oz + 3, 0.3); put('tn_crate', ox + 6.2, oz + 3.4, 1.1);
      put('tn_light', ox - 12, oz + 2, 0);
    } else {
      put('sv_tent', ox - 7, oz - 5, 0.4); put('sv_tent_half', ox + 7, oz - 6, -0.5); put('sv_campfire', ox, oz, 0);
      put('sv_workbench', ox + 3, oz + 6, 0.2); put('sv_barrel', ox - 4, oz + 5, 0); put('sv_box', ox - 5.3, oz + 5.6, 0.7);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; if (i % 4) put('sv_fence', ox + Math.cos(a) * 14, oz + Math.sin(a) * 14, -a + Math.PI / 2, { noOcc: true }); }
    }
    addChest(ox + 1.5, oz + 1.5); addChest(ox - 6, oz + 9);
    addHill(ox, oz, 7, 6);
    out.spawns.push({ x: ox + 12, y: 1.7, z: oz + 12 }, { x: ox - 12, y: 1.7, z: oz - 12 });
  }
  // Forêts et rochers hors zones aménagées
  B.scatter(['tree_c', 'tree_long', 'tree_camp'], [-338, -338, 338, 338], 520, { avoid: skip, sMin: 0.85, sMax: 1.35 });
  B.scatter(['bush_long', 'bush_small', 'rock'], [-338, -338, 338, 338], 240, { avoid: skip });
  B.scatter(['sv_rock', 'sv_log'], [-338, -338, 338, 338], 70, { avoid: skip, sMin: 0.9, sMax: 1.5 });
  // Coffres cachés dans la nature
  for (let i = 0, n = 0; i < 400 && n < 14; i++) {
    const x = B.rnd(-320, 320), z = B.rnd(-320, 320);
    if (skip(x, z) || !B.inBounds(x, z, 20)) continue;
    if (B.out.roads.some((r) => Math.abs(x - r.x) < r.w / 2 + 6 && Math.abs(z - r.z) < r.d / 2 + 6)) continue;
    B.addChest(x, z); n++;
  }
  merge(out, B.out, 0, 0);

  // Disque de sol clair sous les routes de ceinture : rien à ajouter (les routes sont dessinées par le moteur)
  return out;
}
