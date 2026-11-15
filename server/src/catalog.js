// ============================================================
// CATALOGUE : skins de personnage (modèles 3D) et traînées de balles.
// Les skins intégrés sont définis ici ; l'administrateur peut modifier leurs prix,
// les désactiver, et importer de nouveaux skins (fichiers .glb) ou des variantes de couleur.
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { jsonStore, UPLOAD_DIR } from './store.js';
import { RARITIES } from './economy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const proc = (palette) => ({ kind: 'procedural', palette });

// Skins intégrés
const BUILTIN_SKINS = [
  { id: 'recrue', name: 'Recrue', desc: 'Tenue de base de tout opérateur.', rarity: 'common', price: 0, minLevel: 1,
    model: proc({ suit: 0x4b5a3a, vest: 0x2f3a28, helmet: 0x2b3322, skin: 0xd9a77a, accent: 0xff9d1c }) },
  { id: 'recrue_noir', name: 'Ombre', desc: 'Noir mat, accents rouges. Discret.', rarity: 'common', price: 400, minLevel: 1,
    model: proc({ suit: 0x1f2023, vest: 0x0f1012, helmet: 0x151618, skin: 0xc99a72, accent: 0xe4412f }) },
  { id: 'recrue_desert', name: 'Désert', desc: 'Camouflage sable des opérations lointaines.', rarity: 'common', price: 400, minLevel: 1,
    model: proc({ suit: 0xb99a68, vest: 0x8c7447, helmet: 0x7a6540, skin: 0xd9a77a, accent: 0x3b3a30 }) },
  { id: 'recrue_polaire', name: 'Polaire', desc: 'Blanc arctique, visière glacée.', rarity: 'rare', price: 900, minLevel: 3,
    model: proc({ suit: 0xdfe5ea, vest: 0xaeb8c1, helmet: 0x95a1ab, skin: 0xe0b794, accent: 0x4fc3ff }) },
  { id: 'recrue_rouge', name: 'Écarlate', desc: 'Rouge sang, finitions or.', rarity: 'rare', price: 900, minLevel: 3,
    model: proc({ suit: 0x7a1f1a, vest: 0x3b0f0d, helmet: 0x4a1511, skin: 0xd9a77a, accent: 0xffd27a }) },
  { id: 'recrue_neon', name: 'Néon', desc: 'Combinaison sombre, visière rose fluo.', rarity: 'epic', price: 1800, minLevel: 5,
    model: proc({ suit: 0x15151f, vest: 0x0b0b12, helmet: 0x0b0b12, skin: 0xc99a72, accent: 0xff2fb9, glow: true }) },

  { id: 'recrue_urbain', name: 'Urbain', desc: 'Gris béton et bleu acier, pour la ville.', rarity: 'rare', price: 900, minLevel: 3,
    model: proc({ suit: 0x5b636b, vest: 0x2e343a, helmet: 0x24292e, skin: 0xd9a77a, accent: 0x4aa3ff }) },
  { id: 'recrue_or', name: 'Doré', desc: 'Noir et or, visière dorée. Réservé aux vétérans.', rarity: 'legendary', price: 3500, minLevel: 10,
    model: proc({ suit: 0x2a2418, vest: 0x14110b, helmet: 0xd4a82a, skin: 0xc99a72, accent: 0xffd93d, glow: true }) },
  { id: 'recrue_spectre', name: 'Spectre', desc: 'Combinaison nocturne, visière cyan lumineuse.', rarity: 'legendary', price: 3500, minLevel: 10,
    model: proc({ suit: 0x0d1b24, vest: 0x061016, helmet: 0x0a2230, skin: 0xc99a72, accent: 0x4fe3ff, glow: true }) },

  // ---- v6 : nouveaux skins ----
  { id: 'recrue_foret', name: 'Forêt', desc: 'Camouflage vert mousse pour les sous-bois.', rarity: 'common', price: 400, minLevel: 1,
    model: proc({ suit: 0x3f5b2e, vest: 0x2a3d1f, helmet: 0x22331a, skin: 0xd9a77a, accent: 0xb6d36a }) },
  { id: 'recrue_marine', name: 'Marine', desc: 'Bleu nuit des forces navales.', rarity: 'common', price: 400, minLevel: 1,
    model: proc({ suit: 0x1f3552, vest: 0x142238, helmet: 0x101b2c, skin: 0xd9a77a, accent: 0xe8eef5 }) },
  { id: 'recrue_rouille', name: 'Rouille', desc: 'Tenue de chantier, orange usé.', rarity: 'common', price: 400, minLevel: 1,
    model: proc({ suit: 0x8a4a22, vest: 0x5a2f14, helmet: 0xd98a2b, skin: 0xc99a72, accent: 0xffd27a }) },
  { id: 'recrue_violet', name: 'Améthyste', desc: 'Violet profond, visière lilas.', rarity: 'rare', price: 900, minLevel: 3,
    model: proc({ suit: 0x3b2a5a, vest: 0x251a3b, helmet: 0x1d1530, skin: 0xd9a77a, accent: 0xc79bff }) },
  { id: 'recrue_cuivre', name: 'Cuivre', desc: 'Brun cuivré et rivets dorés.', rarity: 'rare', price: 900, minLevel: 3,
    model: proc({ suit: 0x6b3f25, vest: 0x40251a, helmet: 0x331c12, skin: 0xd9a77a, accent: 0xff9d5c }) },
  { id: 'recrue_glace', name: 'Banquise', desc: 'Bleu glacier, finitions argentées.', rarity: 'rare', price: 900, minLevel: 4,
    model: proc({ suit: 0x9cc7e0, vest: 0x6a98b5, helmet: 0x4d7690, skin: 0xe0b794, accent: 0xffffff }) },
  { id: 'recrue_toxique', name: 'Toxique', desc: 'Noir et vert acide qui brille dans le noir.', rarity: 'epic', price: 1800, minLevel: 6,
    model: proc({ suit: 0x10160f, vest: 0x080b07, helmet: 0x0c120b, skin: 0xb8c49a, accent: 0x7dff3a, glow: true }) },
  { id: 'recrue_magma', name: 'Magma', desc: 'Roche noire traversée de lave.', rarity: 'epic', price: 1800, minLevel: 6,
    model: proc({ suit: 0x1c1210, vest: 0x0f0908, helmet: 0x150d0b, skin: 0xc99a72, accent: 0xff5a1f, glow: true }) },
  { id: 'recrue_cyber', name: 'Cyberpunk', desc: 'Magenta et cyan sur fond sombre.', rarity: 'epic', price: 1800, minLevel: 7,
    model: proc({ suit: 0x1a1030, vest: 0x0d0820, helmet: 0x120a26, skin: 0xc99a72, accent: 0x20f0ff, glow: true }) },
  { id: 'recrue_sakura', name: 'Sakura', desc: 'Rose pâle et blanc, élégance silencieuse.', rarity: 'epic', price: 1800, minLevel: 8,
    model: proc({ suit: 0xf0d3dc, vest: 0xd9a9b8, helmet: 0xb77f93, skin: 0xe8c3a4, accent: 0xff7aa8 }) },
  { id: 'recrue_platine', name: 'Platine', desc: 'Chrome poli, reflets de platine.', rarity: 'legendary', price: 3500, minLevel: 12,
    model: proc({ suit: 0xc9cfd6, vest: 0x8f979f, helmet: 0xe7ecf1, skin: 0xd9b69a, accent: 0x9fd8ff, glow: true }) },
  { id: 'recrue_eclipse', name: 'Éclipse', desc: 'Noir absolu, anneau solaire doré.', rarity: 'legendary', price: 3500, minLevel: 12,
    model: proc({ suit: 0x050507, vest: 0x020203, helmet: 0x050507, skin: 0xb88f6a, accent: 0xffb62e, glow: true }) },
  { id: 'recrue_dragon', name: 'Dragon', desc: 'Rouge laqué et or impérial.', rarity: 'legendary', price: 3500, minLevel: 14,
    model: proc({ suit: 0x8e1414, vest: 0x520b0b, helmet: 0xd4a82a, skin: 0xd9a77a, accent: 0xffd93d, glow: true }) },
  { id: 'recrue_aurore', name: 'Aurore', desc: 'Violet profond et visière menthe lumineuse.', rarity: 'epic', price: 1800, minLevel: 8,
    model: proc({ suit: 0x30214f, vest: 0x17112d, helmet: 0x241744, skin: 0xd9a77a, accent: 0x79f2d0, glow: true }) },
];

// Traînées de balles (anciens « skins » de la boutique, conservés)
const BUILTIN_TRACERS = [
  { id: 'default',     name: 'Standard',    desc: 'Traînée par défaut de chaque arme', rarity: 'common',    price: 0,    color: null },
  { id: 'pink_demon',  name: 'Pink Demon',  desc: 'Rose néon agressif',                rarity: 'rare',      price: 500,  color: 0xff2fb9 },
  { id: 'violet_void', name: 'Violet Void', desc: 'Violet profond cosmique',           rarity: 'epic',      price: 1000, color: 0x8b5cf6 },
  { id: 'gold_legend', name: 'Gold Legend', desc: 'Or massif étincelant',              rarity: 'legendary', price: 2500, color: 0xffd93d },
  { id: 'rainbow',     name: 'Rainbow',     desc: 'Arc-en-ciel animé',                 rarity: 'legendary', price: 5000, color: 'rainbow' },
];

// Réglages modifiables par l'admin + skins importés
const store = jsonStore('catalog.json', () => ({ overrides: {}, imported: [] }));

function applyOverride(item) {
  const o = store.data.overrides[item.id];
  return o ? { ...item, ...o } : item;
}

export function allSkins() {
  const base = BUILTIN_SKINS.map((s) => ({ type: 'skin', builtin: true, enabled: true, passOnly: false, ...applyOverride(s) }));
  const imp = store.data.imported.map((s) => ({ type: 'skin', builtin: false, enabled: true, passOnly: false, ...applyOverride(s) }));
  return [...base, ...imp];
}
export function allTracers() {
  return BUILTIN_TRACERS.map((t) => ({ type: 'tracer', builtin: true, enabled: true, passOnly: false, minLevel: 1, ...applyOverride(t) }));
}
export function allItems() { return [...allSkins(), ...allTracers()]; }
export function getItem(id) { return allItems().find((i) => i.id === id) || null; }
export function getSkin(id) { return allSkins().find((i) => i.id === id) || null; }
export function getTracer(id) { return allTracers().find((i) => i.id === id) || null; }

export function updateItem(id, patch) {
  const item = getItem(id);
  if (!item) return { error: 'Objet introuvable' };
  const o = store.data.overrides[id] || {};
  if (patch.price !== undefined) o.price = Math.max(0, Math.min(1000000, Math.round(Number(patch.price) || 0)));
  if (patch.rarity !== undefined && RARITIES[patch.rarity]) o.rarity = patch.rarity;
  if (patch.enabled !== undefined) o.enabled = !!patch.enabled;
  if (patch.passOnly !== undefined) o.passOnly = !!patch.passOnly;
  if (patch.minLevel !== undefined) o.minLevel = Math.max(1, Math.min(100, Math.round(Number(patch.minLevel) || 1)));
  if (patch.name !== undefined) o.name = String(patch.name).slice(0, 40);
  if (patch.desc !== undefined) o.desc = String(patch.desc).slice(0, 120);
  store.data.overrides[id] = o;
  store.save();
  return { ok: true, item: getItem(id) };
}

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'skin';
}
function uniqueId(base) {
  let id = base, n = 2;
  while (getItem(id)) id = `${base}_${n++}`;
  return id;
}

// Nouveau skin : variante de couleur (sans fichier) ou modèle .glb importé
export function addSkin({ name, desc, rarity, price, minLevel, palette, glbBuffer, fit, credit }) {
  if (!name || String(name).trim().length < 2) return { error: 'Nom requis (2 caractères minimum)' };
  const id = uniqueId(slug(name));
  const def = {
    id, name: String(name).trim().slice(0, 40), desc: String(desc || '').slice(0, 120),
    rarity: RARITIES[rarity] ? rarity : 'common',
    price: Math.max(0, Math.min(1000000, Math.round(Number(price) || 0))),
    minLevel: Math.max(1, Math.min(100, Math.round(Number(minLevel) || 1))),
  };
  if (glbBuffer) {
    if (glbBuffer.length < 20 || glbBuffer.readUInt32LE(0) !== 0x46546c67) return { error: 'Ce fichier n’est pas un .glb valide' };
    fs.mkdirSync(path.join(UPLOAD_DIR, 'skins'), { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, 'skins', `${id}.glb`), glbBuffer);
    def.model = {
      kind: 'glb', url: `/uploads/skins/${id}.glb`, rig: 'none',
      fit: { auto: fit?.auto !== false, height: clampNum(fit?.height, 0.5, 3, 1.8), yaw: clampNum(fit?.yaw, -360, 360, 0) },
    };
    if (credit && (credit.title || credit.author)) {
      def.credit = {
        title: String(credit.title || '').slice(0, 80), author: String(credit.author || '').slice(0, 60),
        license: String(credit.license || 'CC BY').slice(0, 30), url: String(credit.url || '').slice(0, 200),
      };
    }
  } else {
    const p = palette || {};
    const hex = (v, d) => (typeof v === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v) ? parseInt(v.replace('#', ''), 16) : d);
    def.model = proc({
      suit: hex(p.suit, 0x4b5a3a), vest: hex(p.vest, 0x2f3a28), helmet: hex(p.helmet, 0x2b3322),
      skin: hex(p.skin, 0xd9a77a), accent: hex(p.accent, 0xff9d1c), glow: !!p.glow,
    });
  }
  store.data.imported.push(def);
  store.saveNow();
  return { ok: true, item: getItem(id) };
}

export function deleteImportedSkin(id) {
  const i = store.data.imported.findIndex((s) => s.id === id);
  if (i < 0) return { error: 'Seuls les skins importés peuvent être supprimés (désactive les autres).' };
  const [def] = store.data.imported.splice(i, 1);
  delete store.data.overrides[id];
  if (def.model?.kind === 'glb') {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, 'skins', `${id}.glb`)); } catch { /* déjà supprimé */ }
  }
  store.saveNow();
  return { ok: true };
}

function clampNum(v, a, b, d) { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : d; }
