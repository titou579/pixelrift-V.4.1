// ============================================================
// CARTES CÔTÉ SERVEUR — relit les mêmes données pures que le client
// (client/src/game/maps.js) pour connaître : points d'apparition, coffres, collines
// et obstacles (utilisés par les bots pour se déplacer et vérifier la ligne de vue).
//
// Les obstacles sont une approximation : rectangles (empreinte des modèles) et cercles.
// Le client garde ses vraies collisions pour le joueur ; les bots, eux, évitent ces formes.
// ============================================================
import { MAPS, DEFAULT_MAP, MAP_IDS, generateMapById } from '../../client/src/game/maps.js';
import { ASSETS } from '../../client/src/game/assetCatalog.js';
import { SPAWNS } from './weapons.js';

export { MAPS, DEFAULT_MAP, MAP_IDS };

const CELL = 10;
const cache = new Map();

function buildGrid(rects, circles) {
  const grid = new Map();
  const key = (cx, cz) => cx * 4096 + cz;
  const add = (o, x0, x1, z0, z1) => {
    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
        const k = key(cx + 512, cz + 512);
        let a = grid.get(k);
        if (!a) { a = []; grid.set(k, a); }
        a.push(o);
      }
    }
  };
  for (const r of rects) add(r, r.x0, r.x1, r.z0, r.z1);
  for (const c of circles) add(c, c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r);
  return {
    near(x, z, r) {
      const out = new Set();
      for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
        for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
          const a = grid.get(key(cx + 512, cz + 512));
          if (a) for (const o of a) out.add(o);
        }
      }
      return out;
    },
  };
}

export function getMap(id) {
  const mapId = MAP_IDS.includes(id) ? id : DEFAULT_MAP;
  if (cache.has(mapId)) return cache.get(mapId);

  const layout = generateMapById(mapId, SPAWNS);
  const rects = [];    // { x0, x1, z0, z1, h }  solides
  const circles = [];  // { x, z, r, h }
  const losRects = []; // rectangles qui bloquent la vue (hauts)

  // Volumes générés (murs, plateformes, escaliers...)
  for (const b of layout.boxes) {
    if (b.collide === false) continue;
    const r = { x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, h: b.y + b.h };
    rects.push(r);
    if (b.h >= 1.6 && b.y < 1) losRects.push(r);
  }
  // Lacs
  for (const w of layout.water) {
    const r = { x0: w.x - w.w / 2, x1: w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2, h: 4 };
    rects.push(r);
  }
  // Props
  for (const p of layout.props) {
    const a = ASSETS[p.key];
    if (!a) continue;
    const coll = a.coll || 'box';
    if (coll === 'none') continue;
    const s = p.s || 1;
    const ht = (a.ht ?? a.h ?? (a.len ? a.len * 0.4 : 1)) * s * (p.sy || 1);
    if (ht < 0.4) continue;
    if (coll === 'trunk') {
      circles.push({ x: p.x, z: p.z, r: Math.min(0.5 * s, 0.6), h: p.y + ht });
      continue;
    }
    if (a.fp) {
      const sideways = Math.abs(Math.sin(p.rot)) > 0.5;
      const hx = ((sideways ? a.fp[1] : a.fp[0]) * s) / 2;
      const hz = ((sideways ? a.fp[0] : a.fp[1]) * s) / 2;
      const r = { x0: p.x - hx, x1: p.x + hx, z0: p.z - hz, z1: p.z + hz, h: p.y + ht };
      rects.push(r);
      if (ht >= 1.6 && p.y < 1) losRects.push(r);
    } else {
      circles.push({ x: p.x, z: p.z, r: Math.max(0.4, (a.r || 1) * s * 0.75), h: p.y + ht });
    }
  }

  // Décale un point bloqué vers l'endroit libre le plus proche (spirale)
  const nudgeWith = (isFree) => (x, z, r) => {
    if (isFree(x, z, r)) return { x, z };
    for (let ring = 1; ring <= 9; ring++) {
      const d = ring * 1.2;
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const nx = x + Math.cos(a) * d, nz = z + Math.sin(a) * d;
        if (isFree(nx, nz, r)) return { x: nx, z: nz };
      }
    }
    return { x, z };
  };

  const data = {
    id: mapId,
    name: layout.name || (MAPS.find((m) => m.id === mapId) || {}).name || mapId,
    half: layout.half,
    spawns: layout.spawns.map((s) => ({ x: s.x, y: s.y ?? 1.7, z: s.z })),
    chests: layout.chests.map((c, i) => ({ id: i, x: c.x, y: c.y || 0, z: c.z })),
    hills: layout.hills,
    grid: buildGrid(rects, circles),
    losGrid: buildGrid(losRects, []),
    rects, circles, losRects,
  };

  // (les fonctions ci-dessous remplacent les points bloqués après construction)
  // Résout une position (cercle de rayon r) : renvoie la position repoussée hors des obstacles
  data.resolve = (x, z, r) => {
    const lim = data.half - 2.5;
    let px = Math.max(-lim, Math.min(lim, x));
    let pz = Math.max(-lim, Math.min(lim, z));
    for (let pass = 0; pass < 2; pass++) {
      for (const o of data.grid.near(px, pz, r + 1)) {
        if (o.r !== undefined) {
          const dx = px - o.x, dz = pz - o.z;
          const d = Math.hypot(dx, dz), min = r + o.r;
          if (d < min) {
            const k = d > 1e-4 ? min / d : 0;
            if (d > 1e-4) { px = o.x + dx * k; pz = o.z + dz * k; } else { px += min; }
          }
        } else {
          const cx = Math.max(o.x0, Math.min(px, o.x1));
          const cz = Math.max(o.z0, Math.min(pz, o.z1));
          const dx = px - cx, dz = pz - cz;
          const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2);
              px = cx + (dx / d) * r; pz = cz + (dz / d) * r;
            } else {
              // centre à l'intérieur du rectangle : sort par le bord le plus proche
              const l = px - o.x0, rr = o.x1 - px, t = pz - o.z0, b = o.z1 - pz;
              const m = Math.min(l, rr, t, b);
              if (m === l) px = o.x0 - r; else if (m === rr) px = o.x1 + r; else if (m === t) pz = o.z0 - r; else pz = o.z1 + r;
            }
          }
        }
      }
    }
    return { x: Math.max(-lim, Math.min(lim, px)), z: Math.max(-lim, Math.min(lim, pz)) };
  };

  data.isFree = (x, z, r) => {
    if (Math.abs(x) > data.half - 3 || Math.abs(z) > data.half - 3) return false;
    for (const o of data.grid.near(x, z, r + 0.5)) {
      if (o.r !== undefined) { if (Math.hypot(x - o.x, z - o.z) < r + o.r) return false; }
      else {
        const cx = Math.max(o.x0, Math.min(x, o.x1)), cz = Math.max(o.z0, Math.min(z, o.z1));
        if ((x - cx) ** 2 + (z - cz) ** 2 < r * r) return false;
      }
    }
    return true;
  };

  // Ligne de vue 2D (les obstacles hauts bloquent, les caisses basses non)
  data.hasLOS = (x0, z0, x1, z1) => {
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 1e-3) return true;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const r of data.losGrid.near(mx, mz, len / 2 + 1)) {
      // méthode des « slabs » 2D
      let tmin = 0, tmax = 1;
      if (Math.abs(dx) < 1e-9) { if (x0 < r.x0 || x0 > r.x1) continue; }
      else {
        let t1 = (r.x0 - x0) / dx, t2 = (r.x1 - x0) / dx;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (Math.abs(dz) < 1e-9) { if (z0 < r.z0 || z0 > r.z1) continue; }
      else {
        let t1 = (r.z0 - z0) / dz, t2 = (r.z1 - z0) / dz;
        if (t1 > t2) { const tt = t1; t1 = t2; t2 = tt; }
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      return false;
    }
    return true;
  };

  const nudge = nudgeWith(data.isFree);
  data.spawns = data.spawns.map((s) => ({ ...s, ...nudge(s.x, s.z, 0.6) }));
  data.chests = data.chests.map((c) => ({ ...c, ...nudge(c.x, c.z, 0.7) }));
  data.hills = data.hills.map((h) => ({ ...h, ...nudge(h.x, h.z, 0.7) }));

  cache.set(mapId, data);
  return data;
}

export const mapList = () => MAPS.map((m) => ({ ...m }));
