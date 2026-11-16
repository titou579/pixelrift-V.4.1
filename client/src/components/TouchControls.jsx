import { useEffect, useRef, useState, useCallback } from 'react';

// ============================================================
// COMMANDES TACTILES (v6)
//  • joystick gauche (marche ; à fond = course automatique)
//  • glisser n'importe où ailleurs sur l'écran = regarder (ou glisser depuis le bouton de tir)
//  • boutons : tir, viser, saut, glisse, recharger, rift, ouvrir un coffre, carte/inventaire, micro, pause
//  • tout est déplaçable : mode « Personnaliser » (menu pause) → glisse les boutons où tu veux,
//    taille et transparence réglables, sauvegardé sur l'appareil.
//  • la taille s'adapte automatiquement à l'écran (unité = plus petit côté de l'écran).
// ============================================================
const KEY = 'pixelrift.touchLayout.v1';

// Positions par défaut : centre du bouton en % de l'écran ; taille de base en « unités »
// (1 unité ≈ 1 px sur un écran de 420 px de haut, puis mise à l'échelle automatique)
export const DEFAULTS = {
  joystick: { x: 15, y: 72, size: 150 },
  fire:     { x: 89, y: 72, size: 96 },
  ads:      { x: 74, y: 80, size: 64 },
  jump:     { x: 94, y: 48, size: 62 },
  slide:    { x: 81, y: 55, size: 54 },
  reload:   { x: 65, y: 86, size: 54 },
  rift:     { x: 94, y: 28, size: 54 },
  interact: { x: 50, y: 62, size: 72 },
  tab:      { x: 88, y: 9,  size: 46 },
  mic:      { x: 79, y: 9,  size: 42 },
  pause:    { x: 96, y: 9,  size: 40 },
  build:    { x: 53, y: 10, size: 48 },
  buildCycle: { x: 37, y: 10, size: 44 },
  buildPlace: { x: 53, y: 23, size: 54 },
  buildEdit: { x: 69, y: 10, size: 44 },
  buildRemove: { x: 69, y: 23, size: 44 },
};

export function loadLayout() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && typeof raw === 'object') return { scale: raw.scale || 1, opacity: raw.opacity ?? 0.85, pos: raw.pos || {} };
  } catch { /* ignore */ }
  return { scale: 1, opacity: 0.85, pos: {} };
}
const saveLayout = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ } };

export default function TouchControls({ api, nearInteract, buildMode, micMuted, editing, onDone }) {
  const [layout, setLayout] = useState(loadLayout);
  const [unit, setUnit] = useState(() => Math.min(window.innerWidth, window.innerHeight) / 420);
  const [pressed, setPressed] = useState({});
  const stick = useRef({ id: null, cx: 0, cy: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const look = useRef({ id: null, x: 0, y: 0 });
  const fireLook = useRef({ id: null, x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const onResize = () => setUnit(Math.min(window.innerWidth, window.innerHeight) / 420);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, []);
  useEffect(() => { saveLayout(layout); }, [layout]);

  // Quitter le composant (ou le mode édition) relâche tout : plus de bouton « coincé »
  useEffect(() => () => {
    api.move(0, 0); api.fireUp(); api.adsUp(); api.key('Space', false); api.key('KeyC', false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const posOf = (id) => ({ x: DEFAULTS[id].x, y: DEFAULTS[id].y, ...(layout.pos[id] || {}) });
  const px = (id) => DEFAULTS[id].size * unit * layout.scale;
  const setPress = (id, v) => setPressed((p) => (p[id] === v ? p : { ...p, [id]: v }));

  // ---------- Édition : déplacer les boutons ----------
  const startDrag = (id, e) => {
    if (!editing) return false;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id, pid: e.pointerId };
    return true;
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d || d.pid !== e.pointerId) return;
    const x = Math.max(3, Math.min(97, (e.clientX / window.innerWidth) * 100));
    const y = Math.max(5, Math.min(95, (e.clientY / window.innerHeight) * 100));
    setLayout((l) => ({ ...l, pos: { ...l.pos, [d.id]: { x: +x.toFixed(1), y: +y.toFixed(1) } } }));
  };
  const endDrag = (e) => { if (drag.current && drag.current.pid === e.pointerId) drag.current = null; };

  // ---------- Joystick ----------
  const stickMove = (e) => {
    if (editing) { moveDrag(e); return; }
    if (stick.current.id !== e.pointerId) return;
    const R = (px('joystick') / 2) * 0.8;
    let dx = e.clientX - stick.current.cx;
    let dy = e.clientY - stick.current.cy;
    const m = Math.hypot(dx, dy);
    if (m > R) { dx = (dx / m) * R; dy = (dy / m) * R; }
    setKnob({ x: dx, y: dy });
    api.move(dx / R, -dy / R);
  };
  const stickDown = (e) => {
    if (startDrag('joystick', e)) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    stick.current = { id: e.pointerId, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    stickMove(e);
  };
  const stickUp = (e) => {
    if (editing) { endDrag(e); return; }
    if (stick.current.id !== e.pointerId) return;
    stick.current.id = null;
    setKnob({ x: 0, y: 0 });
    api.move(0, 0);
  };

  // ---------- Zone de visée (tout l'écran sauf les boutons) ----------
  const lookDown = (e) => {
    if (editing || look.current.id !== null) return;
    look.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const lookMove = (e) => {
    if (look.current.id !== e.pointerId) return;
    api.look(e.clientX - look.current.x, e.clientY - look.current.y);
    look.current.x = e.clientX; look.current.y = e.clientY;
  };
  const lookUp = (e) => { if (look.current.id === e.pointerId) look.current.id = null; };

  // ---------- Boutons à maintenir (tir, viser, saut, glisse) ----------
  const holdBtn = (id, down, up, withLook = false) => ({
    onPointerDown: (e) => {
      if (startDrag(id, e)) return;
      e.preventDefault(); e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setPress(id, true); down();
      if (withLook) fireLook.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e) => {
      if (editing) { moveDrag(e); return; }
      if (withLook && fireLook.current.id === e.pointerId) {
        api.look(e.clientX - fireLook.current.x, e.clientY - fireLook.current.y);
        fireLook.current.x = e.clientX; fireLook.current.y = e.clientY;
      }
    },
    onPointerUp: (e) => { if (editing) { endDrag(e); return; } setPress(id, false); up(); if (withLook) fireLook.current.id = null; },
    onPointerCancel: (e) => { if (editing) { endDrag(e); return; } setPress(id, false); up(); if (withLook) fireLook.current.id = null; },
  });
  const tapBtn = (id, fn) => ({
    onPointerDown: (e) => {
      if (startDrag(id, e)) return;
      e.preventDefault(); e.stopPropagation();
      setPress(id, true); fn();
    },
    onPointerMove: (e) => { if (editing) moveDrag(e); },
    onPointerUp: (e) => { if (editing) { endDrag(e); return; } setPress(id, false); },
    onPointerCancel: (e) => { if (editing) { endDrag(e); return; } setPress(id, false); },
  });

  const btn = (id, label, handlers, { className = '', hidden = false } = {}) => {
    if (hidden && !editing) return null;
    const p = posOf(id);
    const s = px(id);
    return (
      <div
        key={id}
        className={`tc-btn ${className} ${pressed[id] ? 'down' : ''} ${editing ? 'editing' : ''}`}
        style={{ left: `${p.x}%`, top: `${p.y}%`, width: s, height: s, opacity: layout.opacity, fontSize: Math.max(9, s * 0.22) }}
        {...handlers}
      >
        {label}
      </div>
    );
  };

  const reset = useCallback(() => setLayout({ scale: 1, opacity: 0.85, pos: {} }), []);
  const js = posOf('joystick');
  const jsSize = px('joystick');

  return (
    <div className={`touch-layer ${editing ? 'edit' : ''}`}>
      {!editing && <div className="tc-look" onPointerDown={lookDown} onPointerMove={lookMove} onPointerUp={lookUp} onPointerCancel={lookUp} />}

      <div
        className={`tc-stick ${editing ? 'editing' : ''}`}
        style={{ left: `${js.x}%`, top: `${js.y}%`, width: jsSize, height: jsSize, opacity: layout.opacity }}
        onPointerDown={stickDown} onPointerMove={stickMove} onPointerUp={stickUp} onPointerCancel={stickUp}
      >
        <div className="tc-knob" style={{ width: jsSize * 0.42, height: jsSize * 0.42, transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }} />
        {editing && <span className="tc-label">Joystick</span>}
      </div>

      {btn('fire', 'TIR', holdBtn('fire', api.fireDown, api.fireUp, true), { className: 'fire' })}
      {btn('ads', 'VISER', holdBtn('ads', api.adsDown, api.adsUp))}
      {btn('jump', 'SAUT', holdBtn('jump', () => api.key('Space', true), () => api.key('Space', false)))}
      {btn('slide', 'GLISSE', holdBtn('slide', () => api.key('KeyC', true), () => api.key('KeyC', false)))}
      {btn('reload', 'RECH.', tapBtn('reload', api.reload))}
      {btn('rift', 'RIFT', tapBtn('rift', api.rift))}
      {btn('interact', 'LOOT/SOIN', tapBtn('interact', api.interact), { className: `interact ${nearInteract ? 'pulse' : ''}`, hidden: !nearInteract })}
      {btn('build', buildMode ? 'BUILD ✓' : 'BUILD', tapBtn('build', api.buildToggle), { className: buildMode ? 'build-active' : '' })}
      {buildMode && btn('buildCycle', 'PIÈCE', tapBtn('buildCycle', api.buildCycle))}
      {buildMode && btn('buildPlace', 'POSER', tapBtn('buildPlace', api.buildPlace), { className: 'build-place' })}
      {buildMode && btn('buildEdit', 'ÉDITER', tapBtn('buildEdit', api.buildEdit))}
      {buildMode && btn('buildRemove', 'RETIRER', tapBtn('buildRemove', api.buildRemove))}
      {btn('tab', 'CARTE', tapBtn('tab', api.toggleTab))}
      {btn('mic', micMuted ? 'MUET' : 'MICRO', tapBtn('mic', api.toggleMic), { className: micMuted ? 'muted' : '' })}
      {btn('pause', 'II', tapBtn('pause', api.pause))}

      {editing && (
        <div className="tc-editbar" onPointerDown={(e) => e.stopPropagation()}>
          <b>Personnaliser les touches</b>
          <span>Glisse chaque bouton où tu veux.</span>
          <label>Taille
            <input type="range" min="0.7" max="1.5" step="0.05" value={layout.scale} onChange={(e) => setLayout((l) => ({ ...l, scale: Number(e.target.value) }))} />
          </label>
          <label>Opacité
            <input type="range" min="0.35" max="1" step="0.05" value={layout.opacity} onChange={(e) => setLayout((l) => ({ ...l, opacity: Number(e.target.value) }))} />
          </label>
          <div className="tc-editbtns">
            <button onClick={reset}>Réinitialiser</button>
            <button className="primary" onClick={onDone}>Terminé</button>
          </div>
        </div>
      )}
    </div>
  );
}
