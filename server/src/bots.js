// ============================================================
// BOTS (v5) — joueurs simulés par le serveur, 4 niveaux de difficulté.
//
// Un bot est un « joueur » comme les autres dans room.players (isBot: true) : les clients le
// voient comme un adversaire (position, arme, tirs, barre de vie). Il se déplace en 2D sur la
// carte en évitant les obstacles (maps.js), vise avec une erreur qui dépend du niveau, et ses
// dégâts passent par la même fonction que ceux des joueurs (ctx.applyDamage).
//
//  Réglages d'un niveau :
//   speed    vitesse de déplacement (m/s) — le joueur marche à 6
//   react    délai avant le premier tir après avoir repéré un adversaire (s) [min, max]
//   aim      erreur de visée de base (degrés, 1 écart-type) — grandit avec la distance
//   fireMul  fraction de la cadence théorique de l'arme réellement utilisée
//   view     distance de vision (m)
//   headBias probabilité qu'un tir qui touche soit à la tête
//   reloadMul multiplicateur du temps de rechargement
//   strafe   probabilité de faire des pas latéraux en combat
// ============================================================
import { WEAPONS, computeDamage, GG_LADDER, PLAYER_MAX_HP } from './weapons.js';

export const BOT_LEVELS = {
  1: { id: 1, label: 'Recrue',  speed: 3.4, react: [0.9, 1.5],  aim: 9.0, fireMul: 0.55, view: 50,  headBias: 0.04, reloadMul: 1.4,  strafe: 0.15 },
  2: { id: 2, label: 'Soldat',  speed: 4.2, react: [0.55, 0.95], aim: 5.5, fireMul: 0.72, view: 65,  headBias: 0.08, reloadMul: 1.2,  strafe: 0.45 },
  3: { id: 3, label: 'Vétéran', speed: 5.0, react: [0.3, 0.55],  aim: 3.2, fireMul: 0.9,  view: 85,  headBias: 0.14, reloadMul: 1.05, strafe: 0.7 },
  4: { id: 4, label: 'Élite',   speed: 5.8, react: [0.15, 0.3],  aim: 1.7, fireMul: 1.0,  view: 110, headBias: 0.22, reloadMul: 1.0,  strafe: 0.9 },
};
export const MAX_BOTS = 7;

const POOLS = {
  1: ['pistol', 'deagle', 'smg'],
  2: ['smg', 'assault', 'shotgun', 'bullpup', 'pistol'],
  3: ['assault', 'bullpup', 'dmr', 'shotgun', 'smg', 'revolver'],
  4: ['assault', 'bullpup', 'dmr', 'sniper', 'revolver', 'sawedoff', 'smg'],
};
const NAMES = ['Viper', 'Ghost', 'Nova', 'Rex', 'Echo', 'Blaze', 'Orion', 'Pixel', 'Titan', 'Lynx', 'Raptor', 'Mako', 'Sable', 'Zephyr'];
const SKINS = ['recrue', 'recrue_noir', 'recrue_desert'];
const R = 0.5;       // rayon du bot pour les collisions
const EYE = 1.7;

const rnd = (a, b) => a + Math.random() * (b - a);
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ---------- Création ----------
export function createBot(room, code, index, level, team, spawn) {
  const lvl = BOT_LEVELS[level] || BOT_LEVELS[2];
  const used = new Set(Array.from(room.players.values()).map((p) => p.username));
  let name;
  do { name = `${pickOne(NAMES)}${Math.random() < 0.3 ? Math.floor(rnd(2, 99)) : ''}`; } while (used.has(`[BOT] ${name}`));
  const id = `bot_${code}_${index}_${Math.floor(Math.random() * 1e4)}`;
  const p = {
    id, login: `bot:${id}`, username: `[BOT] ${name}`, isBot: true, botLevel: lvl.id,
    position: { x: spawn.x, y: EYE, z: spawn.z }, rotation: { yaw: 0, pitch: 0 },
    hp: PLAYER_MAX_HP, alive: true, inGame: true,
    skin: pickOne(SKINS), tracer: null, level: lvl.id * 8, team,
    lastSeen: Date.now(), lastCombat: 0,
    loadout: ['pistol'], weaponId: 'pistol', lootWeapon: null, ggLevel: 0,
    shotTokens: 3, lastTokenAt: Date.now(), fireTokens: 3, lastFireAt: Date.now(),
    matchHeadshots: 0, matchJoinedAt: 0,
    ai: newAi(),
  };
  return p;
}

function newAi() {
  return {
    target: null, seenAt: 0, reactAt: 0, lastSeenPos: null, lastSeenAt: 0, scanAt: 0,
    ammo: 0, reloadEnd: 0, nextShot: 0, burstLeft: 0,
    wp: null, wpUntil: 0, strafeDir: 1, strafeUntil: 0,
    lastCheckAt: 0, lastCheckPos: null, detourUntil: 0, detourSign: 1,
    lootChest: null, lootCheckAt: 0, deathAt: 0,
  };
}

// Choisit l'arme du bot (échelle en Course aux armes, butin, sinon selon le niveau)
export function equipBot(p, room, ctx, announce = true) {
  let id;
  if (room.mode === 'gungame') id = GG_LADDER[Math.min(p.ggLevel, GG_LADDER.length - 1)];
  else if (p.lootWeapon && WEAPONS[p.lootWeapon]) id = p.lootWeapon;
  else id = p.baseWeapon && POOLS[p.botLevel].includes(p.baseWeapon) ? p.baseWeapon : pickOne(POOLS[p.botLevel] || POOLS[2]);
  if (!p.lootWeapon && room.mode !== 'gungame') p.baseWeapon = id;
  p.weaponId = id;
  p.loadout = [id];
  p.ai.ammo = WEAPONS[id].mag;
  p.ai.reloadEnd = 0;
  p.ai.burstLeft = 0;
  if (announce && ctx) ctx.io.to(ctx.code).emit('player:weapon', { id: p.id, weaponId: id });
}

export function resetBot(p, room, ctx, spawn) {
  p.hp = PLAYER_MAX_HP;
  p.alive = true;
  p.lastCombat = 0;
  p.lootWeapon = null;
  p.position = { x: spawn.x, y: EYE, z: spawn.z };
  p.ai = Object.assign(newAi(), { strafeDir: Math.random() < 0.5 ? 1 : -1 });
  equipBot(p, room, ctx, true);
}

// ---------- Utilitaires ----------
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const yawTo = (dx, dz) => Math.atan2(-dx, -dz);       // même convention que le joueur : avant = (-sin yaw, -cos yaw)

function isEnemy(room, me, o) {
  if (o.id === me.id || !o.alive || !o.inGame) return false;
  if (room.mode === 'team' && o.team === me.team) return false;
  return true;
}

function randomWaypoint(room, map, me, lvl) {
  // Les bots plus forts chassent : un point près d'un adversaire vivant
  if (lvl.id >= 2 && Math.random() < 0.35 + lvl.id * 0.1) {
    const enemies = Array.from(room.players.values()).filter((o) => isEnemy(room, me, o));
    if (enemies.length) {
      const e = pickOne(enemies);
      for (let i = 0; i < 8; i++) {
        const x = e.position.x + rnd(-16, 16), z = e.position.z + rnd(-16, 16);
        if (map.isFree(x, z, R + 0.3)) return { x, z };
      }
    }
  }
  const m = map.half - 8;
  for (let i = 0; i < 14; i++) {
    const x = rnd(-m, m), z = rnd(-m, m);
    if (map.isFree(x, z, R + 0.3)) return { x, z };
  }
  return { x: 0, z: 0 };
}

// ---------- Tir ----------
function fireAt(p, t, def, lvl, map, now, ctx, moving) {
  const ai = p.ai;
  ai.ammo--;
  p.lastCombat = now;
  const dx = t.position.x - p.position.x, dy = (t.position.y - 0.25) - p.position.y, dz = t.position.z - p.position.z;
  const dist = Math.max(1, Math.hypot(dx, dz));
  const L = Math.hypot(dx, dy, dz) || 1;

  // Erreur de visée (degrés) : grandit avec la distance, un peu plus quand le bot bouge
  const sigma = Math.hypot(lvl.aim * 0.6 * (1 + dist / 80) * (moving ? 1.25 : 1), def.spread * 0.35);
  const err = () => (Math.random() + Math.random() + Math.random() - 1.5) * (2 / 1.5) * sigma * (Math.PI / 180); // ~gaussienne
  const dir = [dx / L + err(), dy / L + err() * 0.5, dz / L + err()];
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  ctx.io.to(ctx.code).emit('player:fired', {
    id: p.id, weaponId: def.id, dir: [dir[0] / dl, dir[1] / dl, dir[2] / dl], tracer: null,
  });

  // Résultat : chaque plomb touche avec une probabilité liée à la taille angulaire de la cible
  const half = (Math.atan(0.6 / dist) * 180) / Math.PI;   // cible ≈ torse + tête
  const pHit = 1 - Math.exp(-(half * half) / (2 * sigma * sigma));
  let hits = 0, heads = 0;
  for (let i = 0; i < def.pellets; i++) {
    if (Math.random() < pHit) {
      hits++;
      if (Math.random() < lvl.headBias * (def.headMult >= 1.7 ? 1 : 0.6)) heads++;
    }
  }
  if (hits > 0) ctx.applyDamage(ctx.code, ctx.room, p, t, computeDamage(def, dist, hits, heads), def.id, heads > 0);
}

// ---------- Boucle d'un bot (appelée 20 fois par seconde) ----------
function tickBot(p, room, map, now, dt, ctx) {
  const lvl = BOT_LEVELS[p.botLevel] || BOT_LEVELS[2];
  const ai = p.ai;
  const def = WEAPONS[p.weaponId] || WEAPONS.pistol;

  // Rechargement terminé
  if (ai.reloadEnd && now >= ai.reloadEnd) { ai.ammo = def.mag; ai.reloadEnd = 0; }

  // 1) Repérage (4 fois par seconde)
  if (now >= ai.scanAt) {
    ai.scanAt = now + 0.25;
    let best = null, bestD = Infinity;
    for (const o of room.players.values()) {
      if (!isEnemy(room, p, o)) continue;
      const d = dist2d(p.position, o.position);
      if (d > lvl.view || d >= bestD) continue;
      if (!map.hasLOS(p.position.x, p.position.z, o.position.x, o.position.z)) continue;
      best = o; bestD = d;
    }
    if (best) {
      if (ai.target !== best.id) { ai.target = best.id; ai.reactAt = now + rnd(lvl.react[0], lvl.react[1]); }
      ai.seenAt = now;
      ai.lastSeenPos = { x: best.position.x, z: best.position.z };
      ai.lastSeenAt = now;
    } else if (now - ai.seenAt > 1.5) {
      ai.target = null;
    }
  }
  const target = ai.target ? room.players.get(ai.target) : null;
  const tgt = target && target.alive && target.inGame ? target : null;
  if (!tgt) ai.target = null;
  const visible = !!tgt && now - ai.seenAt < 0.6;

  // 2) Où aller ?
  let goal = null;
  let speedMul = 1;
  let faceDir = null;
  let moving = true;

  if (visible) {
    const d = dist2d(p.position, tgt.position);
    const pref = Math.max(6, Math.min(34, def.range[0] * 0.75));
    const dx = tgt.position.x - p.position.x, dz = tgt.position.z - p.position.z;
    const nx = dx / (d || 1), nz = dz / (d || 1);
    if (now >= ai.strafeUntil) {
      ai.strafeUntil = now + rnd(0.7, 2.0);
      ai.strafeDir = Math.random() < 0.5 ? -1 : 1;
      ai.doStrafe = Math.random() < lvl.strafe;
    }
    let mx = 0, mz = 0;
    if (d > pref + 5) { mx += nx; mz += nz; }
    else if (d < pref - 5) { mx -= nx * 0.8; mz -= nz * 0.8; }
    if (ai.doStrafe) { mx += -nz * ai.strafeDir * 0.9; mz += nx * ai.strafeDir * 0.9; speedMul = 0.8; }
    goal = { dirx: mx, dirz: mz };
    faceDir = { x: dx, z: dz };
    moving = Math.hypot(mx, mz) > 0.1;
  } else {
    // Objectif : colline > coffre > dernière position connue > errance
    if (room.mode === 'koth' && room.koth) {
      const h = room.koth;
      const d = dist2d(p.position, h);
      if (d > h.r * 0.55) goal = { x: h.x, z: h.z };
      else if (!ai.wp || now > ai.wpUntil) {
        ai.wp = { x: h.x + rnd(-h.r * 0.5, h.r * 0.5), z: h.z + rnd(-h.r * 0.5, h.r * 0.5) };
        ai.wpUntil = now + rnd(1.5, 3.5);
        goal = ai.wp;
      } else goal = ai.wp;
    } else if (ai.lastSeenPos && now - ai.lastSeenAt < 4 && lvl.id >= 2) {
      goal = ai.lastSeenPos;
      if (dist2d(p.position, goal) < 2) ai.lastSeenPos = null;
    } else {
      // coffre proche ?
      if (room.chestsOn && now >= ai.lootCheckAt) {
        ai.lootCheckAt = now + 2;
        if (!ai.lootChest && (!p.lootWeapon || Math.random() < 0.15)) {
          const c = ctx.nearestChest(room, p, 45);
          if (c) ai.lootChest = c.id;
        }
      }
      const chest = ai.lootChest !== null ? room.chests.find((c) => c.id === ai.lootChest && !c.opened) : null;
      if (chest) {
        const d = dist2d(p.position, chest);
        if (d < 2.6) { ctx.openChest(ctx.code, room, p, chest); ai.lootChest = null; }
        else goal = { x: chest.x, z: chest.z };
      } else {
        ai.lootChest = null;
        if (!ai.wp || now > ai.wpUntil || dist2d(p.position, ai.wp) < 2) {
          ai.wp = randomWaypoint(room, map, p, lvl);
          ai.wpUntil = now + rnd(8, 18);
        }
        goal = ai.wp;
      }
    }
  }

  // 3) Déplacement
  let vx = 0, vz = 0;
  if (goal) {
    let gx, gz;
    if (goal.dirx !== undefined) { gx = goal.dirx; gz = goal.dirz; }
    else { gx = goal.x - p.position.x; gz = goal.z - p.position.z; }
    const gl = Math.hypot(gx, gz);
    if (gl > 0.05) {
      gx /= gl; gz /= gl;
      // contournement : si on est coincé, on tourne autour de l'obstacle
      if (now < ai.detourUntil) {
        const a = ai.detourSign * 1.2;
        const c = Math.cos(a), s = Math.sin(a);
        const rx = gx * c - gz * s, rz = gx * s + gz * c;
        gx = rx; gz = rz;
      }
      vx = gx * lvl.speed * speedMul * (def.moveMult || 1);
      vz = gz * lvl.speed * speedMul * (def.moveMult || 1);
    }
  }
  const before = { x: p.position.x, z: p.position.z };
  if (vx || vz) {
    const next = map.resolve(p.position.x + vx * dt, p.position.z + vz * dt, R);
    p.position.x = next.x; p.position.z = next.z;
  }

  // Détection de blocage (toutes les 0.8 s)
  if (now - ai.lastCheckAt > 0.8) {
    if (ai.lastCheckPos && (vx || vz)) {
      const moved = dist2d(p.position, ai.lastCheckPos);
      const expected = Math.hypot(vx, vz) * (now - ai.lastCheckAt);
      if (moved < expected * 0.3) {
        ai.detourSign = Math.random() < 0.5 ? -1 : 1;
        ai.detourUntil = now + rnd(0.6, 1.4);
        ai.stuck = (ai.stuck || 0) + 1;
        if (ai.stuck >= 3) { ai.wp = null; ai.lootChest = null; ai.stuck = 0; }
      } else ai.stuck = 0;
    }
    ai.lastCheckAt = now;
    ai.lastCheckPos = { x: p.position.x, z: p.position.z };
  }

  // 4) Orientation
  let wantYaw = p.rotation.yaw;
  if (faceDir) wantYaw = yawTo(faceDir.x, faceDir.z);
  else if (vx || vz) wantYaw = yawTo(vx, vz);
  let dYaw = ((wantYaw - p.rotation.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  const maxTurn = (4 + lvl.id * 3) * dt;
  dYaw = Math.max(-maxTurn, Math.min(maxTurn, dYaw));
  p.rotation = { yaw: p.rotation.yaw + dYaw, pitch: 0 };

  // 5) Tir
  if (visible && now >= ai.reactAt && !ai.reloadEnd) {
    const d = dist2d(p.position, tgt.position);
    if (d <= def.range[1] * 1.15 && now >= ai.nextShot) {
      if (ai.ammo <= 0) {
        ai.reloadEnd = now + def.reload * lvl.reloadMul;
      } else if (Math.abs(dYaw) < 0.5 || lvl.id >= 3) {
        fireAt(p, tgt, def, lvl, map, now, ctx, moving);
        let gap = 1 / (def.fireRate * lvl.fireMul);
        if (def.mode === 'burst') {
          if (ai.burstLeft <= 0) ai.burstLeft = def.burst;
          ai.burstLeft--;
          gap = ai.burstLeft > 0 ? 1 / def.fireRate : def.burstDelay + 0.12 / lvl.fireMul;
        }
        ai.nextShot = now + gap + (def.mode === 'semi' ? rnd(0, 0.12 / lvl.fireMul) : 0);
      }
    }
  }
  void before;
}

// Boucle d'une salle : appelée toutes les 50 ms
export function tickBots(code, room, map, ctx) {
  const now = Date.now() / 1000;
  const dt = 0.05;
  const c = { ...ctx, code, room };
  for (const p of room.players.values()) {
    if (!p.isBot || !p.alive || !p.inGame) continue;
    tickBot(p, room, map, now, dt, c);
    ctx.io.to(code).emit('player:state', { id: p.id, position: p.position, rotation: p.rotation });
  }
}
