// ============================================================
// ARMES, RÉGÉNÉRATION ET POINTS D'APPARITION — source de vérité côté serveur.
// Le client récupère ces données via GET /api/game-config.
//
//  damage     : dégâts par balle (ou par plomb pour les fusils à pompe)
//  pellets    : nombre de plombs par tir
//  fireRate   : tirs par seconde (en rafale : cadence dans la rafale)
//  mode       : 'auto' | 'semi' | 'burst'
//  burst      : nb de tirs par rafale (mode burst) ; burstDelay = pause entre rafales (s)
//  mag        : taille du chargeur ; reload = durée du rechargement (s)
//  spread     : dispersion en degrés (tir à la hanche) ; adsSpread : en visée (clic droit)
//  range      : [distance sans perte, distance à partir de laquelle on tombe à falloff]
//  falloff    : multiplicateur de dégâts au-delà de la portée max (0..1)
//  headMult   : multiplicateur de dégâts à la tête
//  recoil     : recul vertical (degrés) par tir
//  moveMult   : multiplicateur de vitesse de déplacement quand l'arme est en main
//  zoom       : FOV en visée (null = pas de zoom marqué) ; scope : lunette plein écran
// ============================================================

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'Pistolet', type: 'Pistolet',
    damage: 18, pellets: 1, fireRate: 6.5, mode: 'semi',
    mag: 15, reload: 1.1, spread: 1.3, adsSpread: 0.4,
    range: [30, 80], falloff: 0.55, headMult: 1.8, recoil: 0.9, moveMult: 1.05,
    zoom: 62, scope: false, tracer: '#ffe9a8',
  },
  deagle: {
    id: 'deagle', name: 'Pistolet lourd', type: 'Pistolet',
    damage: 38, pellets: 1, fireRate: 2.6, mode: 'semi',
    mag: 8, reload: 1.7, spread: 1.0, adsSpread: 0.25,
    range: [35, 90], falloff: 0.55, headMult: 1.8, recoil: 3.2, moveMult: 1.0,
    zoom: 62, scope: false, tracer: '#ffd27a',
  },
  revolver: {
    id: 'revolver', name: 'Revolver', type: 'Revolver',
    damage: 55, pellets: 1, fireRate: 1.5, mode: 'semi',
    mag: 6, reload: 2.5, spread: 0.8, adsSpread: 0.1,
    range: [45, 110], falloff: 0.6, headMult: 2.0, recoil: 4.5, moveMult: 1.0,
    zoom: 58, scope: false, tracer: '#ff9b5e',
  },
  smg: {
    id: 'smg', name: 'Pistolet-mitrailleur', type: 'SMG',
    damage: 13, pellets: 1, fireRate: 15, mode: 'auto',
    mag: 32, reload: 1.8, spread: 3.2, adsSpread: 1.6,
    range: [18, 50], falloff: 0.4, headMult: 1.5, recoil: 0.7, moveMult: 1.1,
    zoom: 64, scope: false, tracer: '#7fe3ff',
  },
  assault: {
    id: 'assault', name: "Fusil d'assaut", type: 'Fusil',
    damage: 22, pellets: 1, fireRate: 9.5, mode: 'auto',
    mag: 30, reload: 2.2, spread: 2.2, adsSpread: 0.7,
    range: [40, 95], falloff: 0.5, headMult: 1.7, recoil: 1.2, moveMult: 0.95,
    zoom: 60, scope: false, tracer: '#ffef7a',
  },
  bullpup: {
    id: 'bullpup', name: 'Bullpup (rafale)', type: 'Fusil',
    damage: 24, pellets: 1, fireRate: 14, mode: 'burst', burst: 3, burstDelay: 0.32,
    mag: 30, reload: 2.1, spread: 1.6, adsSpread: 0.45,
    range: [45, 105], falloff: 0.5, headMult: 1.7, recoil: 1.0, moveMult: 0.97,
    zoom: 58, scope: false, tracer: '#b6ff7a',
  },
  shotgun: {
    id: 'shotgun', name: 'Fusil à pompe', type: 'Fusil à pompe',
    damage: 11, pellets: 9, fireRate: 1.1, mode: 'semi',
    mag: 6, reload: 2.8, spread: 5.2, adsSpread: 3.6,
    range: [8, 26], falloff: 0.12, headMult: 1.4, recoil: 5.5, moveMult: 0.92,
    zoom: 66, scope: false, tracer: '#ffb27a',
  },
  sawedoff: {
    id: 'sawedoff', name: 'Double canon', type: 'Fusil à pompe',
    damage: 12, pellets: 12, fireRate: 2.2, mode: 'semi',
    mag: 2, reload: 2.3, spread: 7.0, adsSpread: 5.2,
    range: [5, 18], falloff: 0.08, headMult: 1.3, recoil: 6.5, moveMult: 1.0,
    zoom: 68, scope: false, tracer: '#ff8b5e',
  },
  dmr: {
    id: 'dmr', name: 'Fusil de précision', type: 'Tireur d’élite',
    damage: 46, pellets: 1, fireRate: 3.1, mode: 'semi',
    mag: 10, reload: 2.6, spread: 1.4, adsSpread: 0.1,
    range: [70, 160], falloff: 0.65, headMult: 2.0, recoil: 2.6, moveMult: 0.9,
    zoom: 40, scope: false, tracer: '#7ad0ff',
  },
  sniper: {
    id: 'sniper', name: 'Sniper', type: 'Tireur d’élite',
    damage: 95, pellets: 1, fireRate: 0.85, mode: 'semi',
    mag: 5, reload: 3.4, spread: 6.0, adsSpread: 0.03,
    range: [120, 260], falloff: 0.85, headMult: 2.0, recoil: 7.0, moveMult: 0.85,
    zoom: 18, scope: true, tracer: '#ff6b9a',
  },
};


// ------------------------------------------------------------
// ARMES À BUTIN (v5) — introuvables dans l'arsenal : seulement dans les coffres.
//  loot: true  → exclue du choix des 4 armes (isValidLoadout les refuse)
//  rarity      → commun / rare / épique / légendaire (voir RARITIES)
// ------------------------------------------------------------
const LOOT = {
  // --- Communes ---
  ak47: {
    id: 'ak47', name: 'AK-47', type: 'Fusil', rarity: 'common',
    damage: 21, pellets: 1, fireRate: 9.2, mode: 'auto',
    mag: 30, reload: 2.3, spread: 2.7, adsSpread: 0.9,
    range: [38, 90], falloff: 0.5, headMult: 1.7, recoil: 1.6, moveMult: 0.95,
    zoom: 60, scope: false, tracer: '#ffd36b',
  },
  tsmg: {
    id: 'tsmg', name: 'Mini-SMG', type: 'SMG', rarity: 'common',
    damage: 12, pellets: 1, fireRate: 17, mode: 'auto',
    mag: 35, reload: 1.6, spread: 3.6, adsSpread: 1.8,
    range: [16, 46], falloff: 0.4, headMult: 1.5, recoil: 0.7, moveMult: 1.12,
    zoom: 64, scope: false, tracer: '#8be0ff',
  },
  magnum: {
    id: 'magnum', name: 'Magnum', type: 'Revolver', rarity: 'common',
    damage: 60, pellets: 1, fireRate: 1.7, mode: 'semi',
    mag: 6, reload: 2.4, spread: 0.7, adsSpread: 0.08,
    range: [48, 115], falloff: 0.6, headMult: 2.0, recoil: 4.8, moveMult: 1.0,
    zoom: 58, scope: false, tracer: '#ff9b5e',
  },
  // --- Rares ---
  sci_pistol: {
    id: 'sci_pistol', name: 'Pistolet à plasma', type: 'Pistolet', rarity: 'rare',
    damage: 24, pellets: 1, fireRate: 7.5, mode: 'semi',
    mag: 14, reload: 1.3, spread: 1.0, adsSpread: 0.3,
    range: [34, 85], falloff: 0.55, headMult: 1.8, recoil: 1.0, moveMult: 1.05,
    zoom: 62, scope: false, tracer: '#5cf0ff',
  },
  sci_smg: {
    id: 'sci_smg', name: 'SMG à plasma', type: 'SMG', rarity: 'rare',
    damage: 15, pellets: 1, fireRate: 18, mode: 'auto',
    mag: 40, reload: 1.7, spread: 2.9, adsSpread: 1.3,
    range: [20, 55], falloff: 0.42, headMult: 1.55, recoil: 0.75, moveMult: 1.1,
    zoom: 64, scope: false, tracer: '#4dd2ff',
  },
  combat_shotgun: {
    id: 'combat_shotgun', name: 'Pompe de combat', type: 'Fusil à pompe', rarity: 'rare',
    damage: 13, pellets: 9, fireRate: 1.5, mode: 'semi',
    mag: 8, reload: 2.9, spread: 4.8, adsSpread: 3.2,
    range: [9, 28], falloff: 0.14, headMult: 1.4, recoil: 5.0, moveMult: 0.93,
    zoom: 66, scope: false, tracer: '#ffb27a',
  },
  sci_ar: {
    id: 'sci_ar', name: 'Fusil à plasma', type: 'Fusil', rarity: 'rare',
    damage: 25, pellets: 1, fireRate: 10, mode: 'auto',
    mag: 28, reload: 2.1, spread: 2.0, adsSpread: 0.6,
    range: [44, 100], falloff: 0.5, headMult: 1.75, recoil: 1.1, moveMult: 0.95,
    zoom: 60, scope: false, tracer: '#6bffb0',
  },
  // --- Épiques ---
  battle_rifle: {
    id: 'battle_rifle', name: 'Fusil de bataille', type: 'Fusil', rarity: 'epic',
    damage: 33, pellets: 1, fireRate: 7.2, mode: 'auto',
    mag: 25, reload: 2.4, spread: 1.8, adsSpread: 0.45,
    range: [55, 120], falloff: 0.55, headMult: 1.8, recoil: 1.7, moveMult: 0.93,
    zoom: 56, scope: false, tracer: '#d99bff',
  },
  railgun: {
    id: 'railgun', name: 'Railgun', type: 'Tireur d’élite', rarity: 'epic',
    damage: 120, pellets: 1, fireRate: 0.75, mode: 'semi',
    mag: 3, reload: 3.0, spread: 5.0, adsSpread: 0.02,
    range: [140, 300], falloff: 0.9, headMult: 1.8, recoil: 8.0, moveMult: 0.85,
    zoom: 16, scope: true, tracer: '#c27bff',
  },
  gauss: {
    id: 'gauss', name: 'Fusil Gauss', type: 'Tireur d’élite', rarity: 'epic',
    damage: 68, pellets: 1, fireRate: 1.7, mode: 'semi',
    mag: 5, reload: 2.5, spread: 1.6, adsSpread: 0.06,
    range: [85, 190], falloff: 0.7, headMult: 2.0, recoil: 3.4, moveMult: 0.9,
    zoom: 34, scope: false, tracer: '#b48cff',
  },
  // --- Légendaires ---
  golden_smg: {
    id: 'golden_smg', name: 'SMG Doré', type: 'SMG', rarity: 'legendary',
    damage: 17, pellets: 1, fireRate: 21, mode: 'auto',
    mag: 50, reload: 1.8, spread: 2.2, adsSpread: 0.9,
    range: [26, 62], falloff: 0.48, headMult: 1.7, recoil: 0.7, moveMult: 1.08,
    zoom: 62, scope: false, tracer: '#ffd24a',
  },
  plasma_elite: {
    id: 'plasma_elite', name: 'Fusil à impulsion', type: 'Fusil', rarity: 'legendary',
    damage: 30, pellets: 1, fireRate: 16, mode: 'burst', burst: 4, burstDelay: 0.3,
    mag: 32, reload: 2.0, spread: 1.4, adsSpread: 0.3,
    range: [60, 130], falloff: 0.6, headMult: 1.9, recoil: 1.2, moveMult: 0.97,
    zoom: 56, scope: false, tracer: '#ff6bd0',
  },
  hand_cannon: {
    id: 'hand_cannon', name: 'Canon à main', type: 'Revolver', rarity: 'legendary',
    damage: 92, pellets: 1, fireRate: 2.0, mode: 'semi',
    mag: 5, reload: 2.6, spread: 0.6, adsSpread: 0.04,
    range: [60, 140], falloff: 0.7, headMult: 2.1, recoil: 6.0, moveMult: 1.0,
    zoom: 54, scope: false, tracer: '#ffae2e',
  },
};
for (const w of Object.values(LOOT)) { w.loot = true; WEAPONS[w.id] = w; }

export const RARITIES = {
  common:    { id: 'common',    label: 'Commun',     color: '#b6bcc4', weight: 55, heal: 15 },
  rare:      { id: 'rare',      label: 'Rare',       color: '#4fa8ff', weight: 28, heal: 25 },
  epic:      { id: 'epic',      label: 'Épique',     color: '#b866ff', weight: 13, heal: 35 },
  legendary: { id: 'legendary', label: 'Légendaire', color: '#ffb62e', weight: 4,  heal: 50 },
};

// Tirage du contenu d'un coffre : rareté pondérée, puis arme au hasard de cette rareté
export function rollLoot(rand = Math.random) {
  const total = Object.values(RARITIES).reduce((a, r) => a + r.weight, 0);
  let t = rand() * total;
  let rarity = 'common';
  for (const r of Object.values(RARITIES)) { t -= r.weight; if (t <= 0) { rarity = r.id; break; } }
  const pool = Object.values(LOOT).filter((w) => w.rarity === rarity);
  const w = pool[Math.floor(rand() * pool.length)];
  return { weaponId: w.id, rarity, heal: RARITIES[rarity].heal };
}

// Échelle d'armes du mode « Course aux armes » (une arme par élimination)
export const GG_LADDER = ['pistol', 'deagle', 'revolver', 'smg', 'bullpup', 'assault', 'shotgun', 'dmr', 'sniper'];

export const MODES = {
  ffa:     { id: 'ffa',     name: 'Mêlée générale',   desc: 'Chacun pour soi : premier à atteindre le nombre d’éliminations.', targets: [10, 15, 25, 40], defaultTarget: 15, team: false },
  team:    { id: 'team',    name: 'Équipes',          desc: 'Alpha contre Bravo : l’équipe qui atteint le score gagne.',     targets: [10, 15, 25, 40], defaultTarget: 25, team: true },
  gungame: { id: 'gungame', name: 'Course aux armes', desc: 'Chaque élimination te donne l’arme suivante. Termine l’échelle pour gagner.', targets: [], defaultTarget: GG_LADDER.length, team: false },
  koth:    { id: 'koth',    name: 'Roi de la colline', desc: 'Tiens la zone (seul dedans) pour marquer 1 point par seconde.',   targets: [60, 100, 150], defaultTarget: 100, team: false },
};

export const DEFAULT_LOADOUT = ['pistol', 'smg', 'assault', 'shotgun'];

export const REGEN = {
  delayMs: 5000,       // sans tirer ni être touché pendant ce temps...
  ratePerSec: 12,      // ...on regagne ce nombre de PV par seconde
  tickMs: 500,
};

export const PLAYER_MAX_HP = 100;

// Points d'apparition : au milieu de rues du centre-ville (voir client/src/game/mapLayout.js,
// qui garde ces zones dégagées).
export const SPAWNS = [
  [-18, 0], [18, 0], [0, -18], [0, 18],
  [-54, 0], [54, 0], [0, -54], [0, 54],
  [-18, 36], [18, -36], [-54, -36], [54, 36],
  [-18, -72], [18, 72], [-72, 18], [72, -18],
].map(([x, z]) => ({ x, y: 1.7, z }));

export function pickSpawn(otherPositions = [], team = null, spawns = SPAWNS) {
  // Choisit le point d'apparition le plus éloigné des autres joueurs vivants.
  // En mode équipes : l'équipe 0 apparaît à l'ouest de la carte, l'équipe 1 à l'est.
  let best = null;
  let bestScore = -1;
  const pool = team === null || team === undefined
    ? spawns
    : spawns.filter((s) => (team === 0 ? s.x < 0 || (s.x === 0 && s.z < 0) : s.x > 0 || (s.x === 0 && s.z > 0)));
  for (const s of pool) {
    let minD = Infinity;
    for (const o of otherPositions) {
      const d = Math.hypot(o.x - s.x, o.z - s.z);
      if (d < minD) minD = d;
    }
    const score = otherPositions.length ? minD + Math.random() * 12 : Math.random();
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return { ...best };
}

export function isValidLoadout(ids) {
  return (
    Array.isArray(ids) &&
    ids.length >= 1 && ids.length <= 4 &&
    new Set(ids).size === ids.length &&
    ids.every((id) => WEAPONS[id] && !WEAPONS[id].loot)
  );
}

// Dégâts pour un groupe de plombs touchant la même cible.
export function computeDamage(def, distance, pelletsHit, headHits) {
  const n = Math.max(1, Math.min(def.pellets, Math.floor(pelletsHit) || 1));
  const heads = Math.max(0, Math.min(n, Math.floor(headHits) || 0));
  const [near, far] = def.range;
  let mult = 1;
  if (distance > near) {
    const t = Math.min(1, (distance - near) / Math.max(1, far - near));
    mult = 1 - (1 - def.falloff) * t;
  }
  const body = (n - heads) * def.damage * mult;
  const head = heads * def.damage * def.headMult * mult;
  return Math.max(1, Math.round(body + head));
}
