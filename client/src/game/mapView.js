import { ASSETS } from './assetCatalog.js';

// ============================================================
// CARTE 2D (écran Tab + mini-carte) : dessinée une seule fois depuis les données de la carte
// (routes, bâtiments, arbres, murs), puis recadrée / complétée avec les marqueurs en direct.
// ============================================================
const hex = (n, fallback = '#5b8c42') => (n === null || n === undefined ? fallback : `#${n.toString(16).padStart(6, '0')}`);

export function createMapView(layout) {
  const half = layout.half;
  const SIZE = Math.min(1400, Math.max(700, Math.round(half * 3.2)));
  const k = SIZE / (2 * half);
  const base = document.createElement('canvas');
  base.width = base.height = SIZE;
  const g = base.getContext('2d');
  const X = (x) => (x + half) * k;
  const Z = (z) => (z + half) * k;

  // fond
  g.fillStyle = hex(layout.groundColor, '#4d7a3a');
  g.fillRect(0, 0, SIZE, SIZE);
  for (const o of layout.ground || []) { g.fillStyle = hex(o.color); g.fillRect(X(o.x - o.w / 2), Z(o.z - o.d / 2), o.w * k, o.d * k); }
  for (const o of layout.water || []) { g.fillStyle = '#3d7fb5'; g.fillRect(X(o.x - o.w / 2), Z(o.z - o.d / 2), o.w * k, o.d * k); }
  for (const o of layout.slabs || []) { g.fillStyle = hex(o.color, '#8d8f94'); g.fillRect(X(o.x - o.w / 2), Z(o.z - o.d / 2), o.w * k, o.d * k); }
  for (const o of layout.roads || []) { g.fillStyle = '#51555b'; g.fillRect(X(o.x - o.w / 2), Z(o.z - o.d / 2), o.w * k, o.d * k); }

  // arbres (petits points verts) d'abord, puis constructions par-dessus
  g.fillStyle = 'rgba(30,80,34,0.75)';
  for (const p of layout.props) {
    const a = ASSETS[p.key];
    if (!a || a.coll !== 'trunk' || !(a.h || 0) || (a.h || 0) < 4) continue;
    g.beginPath(); g.arc(X(p.x), Z(p.z), Math.max(1.2, 2.6 * (p.s || 1) * k), 0, Math.PI * 2); g.fill();
  }
  for (const p of layout.props) {
    const a = ASSETS[p.key];
    if (!a || a.coll === 'none' || a.coll === 'trunk') continue;
    if (a.fp) {
      const sideways = Math.abs(Math.sin(p.rot)) > 0.5;
      const w = (sideways ? a.fp[1] : a.fp[0]) * (p.s || 1), d = (sideways ? a.fp[0] : a.fp[1]) * (p.s || 1);
      g.fillStyle = (a.ht || a.h || 0) >= 6 ? '#b9bcc2' : '#8e9298';
      g.fillRect(X(p.x - w / 2), Z(p.z - d / 2), Math.max(1.2, w * k), Math.max(1.2, d * k));
    } else if ((a.r || 1) >= 1.2) {
      g.fillStyle = '#7d828a';
      g.beginPath(); g.arc(X(p.x), Z(p.z), Math.max(1, a.r * 0.6 * k), 0, Math.PI * 2); g.fill();
    }
  }
  for (const b of layout.boxes || []) {
    if (b.emissive || b.collide === false) continue;
    g.fillStyle = b.h > 4 ? '#6d7178' : '#9a8a6a';
    g.fillRect(X(b.x - b.w / 2), Z(b.z - b.d / 2), Math.max(1, b.w * k), Math.max(1, b.d * k));
  }

  function markers(ctx, toC, st, scale) {
    const s = scale;
    if (st.hill) {
      const [cx, cy] = toC(st.hill.x, st.hill.z);
      ctx.strokeStyle = st.hill.color || '#58d68d'; ctx.fillStyle = 'rgba(88,214,141,0.22)'; ctx.lineWidth = 2 * s;
      ctx.beginPath(); ctx.arc(cx, cy, st.hill.r * st.pxPerM, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    for (const m of st.medkits || []) {
      if (m.opened) continue;
      const [mx, my] = toC(m.x, m.z);
      if (mx < -10 || my < -10 || mx > st.w + 10 || my > st.h + 10) continue;
      ctx.fillStyle = '#53e08b'; ctx.strokeStyle = '#123c24'; ctx.lineWidth = 1.2 * s;
      ctx.fillRect(mx - 3 * s, my - 3 * s, 6 * s, 6 * s);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx - .8 * s, my - 2.2 * s, 1.6 * s, 4.4 * s);
      ctx.fillRect(mx - 2.2 * s, my - .8 * s, 4.4 * s, 1.6 * s);
    }
    for (const c of st.chests || []) {
      if (c.opened) continue;
      const [cx, cy] = toC(c.x, c.z);
      if (cx < -10 || cy < -10 || cx > st.w + 10 || cy > st.h + 10) continue;
      ctx.fillStyle = '#ffc94a'; ctx.strokeStyle = '#3b2a05'; ctx.lineWidth = 1 * s;
      ctx.fillRect(cx - 3.5 * s, cy - 3 * s, 7 * s, 6 * s); ctx.strokeRect(cx - 3.5 * s, cy - 3 * s, 7 * s, 6 * s);
    }
    for (const a of st.allies || []) {
      const [cx, cy] = toC(a.x, a.z);
      ctx.fillStyle = '#4fa8ff'; ctx.beginPath(); ctx.arc(cx, cy, 4 * s, 0, Math.PI * 2); ctx.fill();
    }
    if (st.me) {
      const [cx, cy] = toC(st.me.x, st.me.z);
      const fx = -Math.sin(st.me.yaw), fz = -Math.cos(st.me.yaw);
      const ang = Math.atan2(fz, fx);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
      ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.moveTo(9 * s, 0); ctx.lineTo(-6 * s, 6 * s); ctx.lineTo(-3 * s, 0); ctx.lineTo(-6 * s, -6 * s); ctx.closePath();
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
  }

  // Carte entière dans un canvas (w × h px, carrée)
  function drawFull(canvas, st) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(base, 0, 0, w, h);
    const m = w / (2 * half);
    markers(ctx, (x, z) => [(x + half) * m, (z + half) * m], { ...st, w, h, pxPerM: m }, Math.max(1, w / 700));
  }
  // Mini-carte centrée sur le joueur (rayon R mètres)
  function drawMini(canvas, st, R = 80) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const px = st.me.x, pz = st.me.z;
    const sx = (px + half - R) * k, sy = (pz + half - R) * k, sw = 2 * R * k;
    // zones hors carte en gris sombre
    ctx.fillStyle = '#1b1d20'; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(base, sx, sy, sw, sw, 0, 0, w, h);
    const m = w / (2 * R);
    markers(ctx, (x, z) => [(x - px) * m + w / 2, (z - pz) * m + h / 2], { ...st, w, h, pxPerM: m }, Math.max(0.8, w / 200));
  }
  return { drawFull, drawMini, size: SIZE };
}
