import {
  applyMatchRewards,
  registerRiftUse,
  getOrCreateProfile,
  setLoadout as saveLoadout,
} from './dataManager.js';
import { getTracer, getSkin } from './catalog.js';
import { levelInfo } from './economy.js';
import {
  WEAPONS,
  DEFAULT_LOADOUT,
  REGEN,
  PLAYER_MAX_HP,
  pickSpawn,
  isValidLoadout,
  computeDamage,
  MODES,
  GG_LADDER,
  rollLoot,
  START_INVENTORY,
  INVENTORY_SLOTS,
} from './weapons.js';
import { getMap, MAPS, DEFAULT_MAP, MAP_IDS } from './maps.js';
import { BOT_LEVELS, MAX_BOTS, createBot, equipBot, resetBot, tickBots } from './bots.js';
import { validatePlayerState } from './validation.js';


function blockedByPlayerBuilds(builds, position) {
  const feet = position.y - 1.7;
  const head = position.y + 0.15;
  for (const b of builds || []) {
    if (b.type === 'ramp') continue; // la rampe est franchissable ; les marches client assurent l'ascension
    const dx = position.x - b.x, dz = position.z - b.z;
    const c = Math.cos(b.rotation || 0), s = Math.sin(b.rotation || 0);
    const localX = dx * c - dz * s;
    const localZ = dx * s + dz * c;
    if (Math.abs(localZ) > 0.65 || Math.abs(localX) > 2.45) continue;
    if (b.type === 'wall') {
      if (head <= b.y || feet >= b.y + 3.1) continue;
      if (b.variant === 'door' && Math.abs(localX) < 1.18 && feet >= b.y && head <= b.y + 2.52) continue;
      return true;
    }
    if (b.type === 'floor' || b.type === 'roof') {
      if (Math.abs(localX) > 2.1 || Math.abs(localZ) > 2.1) continue;
      if (feet < b.y + 0.26 && head > b.y + 0.02) return true;
    }
  }
  return false;
}

const rooms = new Map();
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MATCH_DURATION = 5 * 60 * 1000;
const END_SCREEN_DURATION = 10000;
const GHOST_TIMEOUT = 5000;
const CHEST_RESPAWN_MS = 75 * 1000;
const CHEST_REACH = 6;            // distance max (m) pour ouvrir un coffre (marge pour la latence)
const HILL_DURATION_MS = 45 * 1000;
const BOT_RESPAWN_MS = 3000;
const PROP_RESPAWN_MS = 120 * 1000;
export const KILL_TARGETS = MODES.ffa.targets;
export const TEAM_NAMES = ['Alpha', 'Bravo'];

function generateCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 4; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  } while (rooms.has(code));
  return code;
}

function createRoom(hostId) {
  return {
    players: new Map(),
    scores: new Map(),
    deaths: new Map(),
    teamKills: [0, 0],
    matchStatus: 'waiting',
    matchStartTime: 0,
    host: hostId,
    mode: 'ffa',
    killTarget: MODES.ffa.defaultTarget,
    map: DEFAULT_MAP,
    botsCount: 0,
    botsLevel: 2,
    botSeq: 0,
    chestsOn: true,
    chests: [],
    medkits: [],
    builds: [],
    buildSeq: 0,
    koth: null,
    kothPts: new Map(),
    props: new Map(),      // id de décor détruit -> { respawnAt }
    propHp: new Map(),     // id -> coups restants
  };
}

const humans = (room) => Array.from(room.players.values()).filter((p) => !p.isBot);

// Ce que les autres joueurs ont le droit de voir
function lobbyView(p, room) {
  return {
    id: p.id, login: p.isBot ? undefined : p.login, username: p.username, skin: p.skin, tracer: p.tracer,
    team: p.team, weaponId: p.weaponId, level: p.level, inGame: p.inGame, isHost: room.host === p.id,
    isBot: !!p.isBot, botLevel: p.isBot ? p.botLevel : undefined,
  };
}
function gameView(p) {
  return {
    id: p.id, login: p.isBot ? undefined : p.login, username: p.username, position: p.position, rotation: p.rotation,
    skin: p.skin, team: p.team, weaponId: p.weaponId, hp: p.hp, alive: p.alive, isBot: !!p.isBot,
  };
}
function tracerColor(id) {
  const t = getTracer(id);
  if (!t || t.color === null || t.color === undefined) return null;
  return t.color;
}
// Une arme est utilisable si elle est dans l'arsenal du joueur ou si c'est son arme de butin
const canUse = (p, id) => (p.isBot ? true : (p.inventory || []).includes(id));
const invPayload = (p, extra = {}) => ({ inventory: p.inventory, select: Math.max(0, p.inventory.indexOf(p.weaponId)), ...extra });

export function setupGameServer(io) {
  const roomState = (code) => {
    const room = rooms.get(code);
    if (!room) return null;
    const mode = MODES[room.mode];
    return {
      code, host: room.host, mode: room.mode, killTarget: room.killTarget,
      status: room.matchStatus, teamNames: TEAM_NAMES, targets: mode.targets,
      modes: Object.values(MODES).map((m) => ({ id: m.id, name: m.name, desc: m.desc })),
      map: room.map, maps: MAPS,
      bots: { count: room.botsCount, level: room.botsLevel, max: MAX_BOTS, levels: Object.values(BOT_LEVELS).map((l) => ({ id: l.id, label: l.label })) },
      chestsOn: room.chestsOn && room.mode !== 'gungame',
      players: Array.from(room.players.values()).map((p) => lobbyView(p, room)),
    };
  };
  const broadcastRoom = (code) => {
    const st = roomState(code);
    if (st) io.to(code).emit('room:state', st);
  };

  const scoreRows = (room) => Array.from(room.players.values()).map((p) => ({
    id: p.id, username: p.username, team: p.team, isBot: !!p.isBot,
    kills: room.scores.get(p.id) || 0, deaths: room.deaths.get(p.id) || 0,
    points: room.kothPts.get(p.id) || 0, gg: p.ggLevel || 0,
  }));

  function broadcastScores(code) {
    const room = rooms.get(code);
    if (!room) return;
    io.to(code).emit('scores:update', scoreRows(room));
    io.to(code).emit('teams:update', {
      teamKills: room.teamKills, mode: room.mode, killTarget: room.killTarget, ladder: GG_LADDER.length,
    });
  }

  // ---------- Coffres ----------
  const chestsPublic = (room) => room.chests.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, opened: c.opened }));
  const medkitsPublic = (room) => room.medkits.map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z, collected: m.collected }));
  function resetChests(room) {
    const map = getMap(room.map);
    room.chests = room.chestsOn && room.mode !== 'gungame'
      ? map.chests.map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, opened: false, respawnAt: 0 }))
      : [];
  }
  function resetMedkits(room) {
    const map = getMap(room.map);
    room.medkits = (map.medkits || []).map((m) => ({ id: m.id, x: m.x, y: m.y, z: m.z, collected: false, respawnAt: 0 }));
  }
  function resetBuilds(room) {
    room.builds = []; room.buildSeq = 0;
    for (const p of room.players.values()) if (!p.isBot) p.materials = 100;
  }
  function openChest(code, room, p, chest) {
    if (!chest || chest.opened || !p.alive) return false;
    chest.opened = true;
    chest.respawnAt = Date.now() + CHEST_RESPAWN_MS;
    const loot = rollLoot();
    if (!p.isBot) {
      // 1er emplacement libre ; sinon remplace l'arme en main (jamais en double)
      if (!p.inventory.includes(loot.weaponId)) {
        if (p.inventory.length < INVENTORY_SLOTS) p.inventory.push(loot.weaponId);
        else p.inventory[Math.max(0, p.inventory.indexOf(p.weaponId))] = loot.weaponId;
      }
      p.weaponId = loot.weaponId;
    } else p.lootWeapon = loot.weaponId;
    p.hp = Math.min(PLAYER_MAX_HP, p.hp + loot.heal);
    io.to(code).emit('player:hp', { id: p.id, hp: Math.round(p.hp), regen: true });
    io.to(code).emit('chest:opened', { id: chest.id, by: p.id, byName: p.username, weaponId: loot.weaponId, rarity: loot.rarity });
    if (p.isBot) equipBot(p, room, { io, code }, true);
    else {
      io.to(p.id).emit('inv:update', invPayload(p));
      io.to(p.id).emit('loot:granted', { weaponId: loot.weaponId, rarity: loot.rarity, heal: loot.heal });
      io.to(code).emit('player:weapon', { id: p.id, weaponId: loot.weaponId });
    }
    return true;
  }
  function nearestChest(room, p, maxDist) {
    let best = null, bd = maxDist;
    for (const c of room.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.position.x, c.z - p.position.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // ---------- Roi de la colline ----------
  function rotateHill(room) {
    const map = getMap(room.map);
    if (!map.hills.length) { room.koth = null; return; }
    let idx;
    do { idx = Math.floor(Math.random() * map.hills.length); } while (map.hills.length > 1 && room.koth && idx === room.koth.idx);
    const h = map.hills[idx];
    room.koth = { idx, x: h.x, z: h.z, r: h.r, endsAt: Date.now() + HILL_DURATION_MS };
  }
  const kothPublic = (room) => room.koth && {
    x: room.koth.x, z: room.koth.z, r: room.koth.r, timeLeft: Math.max(0, room.koth.endsAt - Date.now()),
    target: room.killTarget, points: Object.fromEntries(room.kothPts),
  };

  // ---------- Course aux armes ----------
  function giveGungameWeapon(room, code, p) {
    const w = GG_LADDER[Math.min(p.ggLevel, GG_LADDER.length - 1)];
    p.loadout = [w];
    p.weaponId = w;
    p.lootWeapon = null;
    p.inventory = [w];
    if (p.isBot) equipBot(p, room, { io, code }, true);
    else io.to(p.id).emit('inv:update', invPayload(p, { gg: { level: p.ggLevel, ladder: GG_LADDER.length } }));
    if (!p.isBot) io.to(code).emit('player:weapon', { id: p.id, weaponId: w });
  }

  function resetInventory(code, p) {
    if (p.isBot) return;
    p.inventory = [...START_INVENTORY];
    p.weaponId = START_INVENTORY[0];
    p.loadout = [...START_INVENTORY];
    io.to(p.id).emit('inv:update', invPayload(p, { gg: null }));
    io.to(code).emit('player:weapon', { id: p.id, weaponId: p.weaponId });
  }

  // ---------- Décors destructibles ----------
  const destroyedList = (room) => Array.from(room.props.keys());
  function destroyProp(code, room, id, shooter, delay = 0) {
    const map = getMap(room.map);
    const d = map.destructibles.get(id);
    if (!d || room.props.has(id)) return;
    room.props.set(id, { respawnAt: Date.now() + PROP_RESPAWN_MS });
    io.to(code).emit('prop:destroyed', { id, type: d.type, x: d.x, y: d.y, z: d.z });
    if (d.type === 'breakable') {
      if (shooter && shooter.alive && shooter.hp < PLAYER_MAX_HP) {
        shooter.hp = Math.min(PLAYER_MAX_HP, shooter.hp + 6);
        io.to(code).emit('player:hp', { id: shooter.id, hp: Math.round(shooter.hp), regen: true });
      }
      return;
    }
    // Explosion : dégâts de zone décroissants, réaction en chaîne
    const R = d.radius || 7;
    for (const t of room.players.values()) {
      if (!t.alive || !t.inGame) continue;
      const dist = Math.hypot(t.position.x - d.x, t.position.z - d.z, (t.position.y - 1.2) - d.y);
      if (dist > R) continue;
      const dmg = Math.max(8, Math.round((d.dmg || 80) * (1 - dist / R)));
      if (shooter && t.id === shooter.id) {
        // l'auteur ne peut pas se tuer avec son propre décor
        t.hp = Math.max(1, t.hp - Math.round(dmg * 0.4));
        t.lastCombat = Date.now();
        io.to(code).emit('player:hit', { targetId: t.id, hp: Math.round(t.hp), shooterId: t.id, shooterName: t.username, damage: Math.round(dmg * 0.4), head: false });
      } else if (shooter) {
        if (room.mode === 'team' && shooter.team === t.team) continue;
        if (applyDamage(code, room, shooter, t, dmg, 'explosion', false)) return;
      }
    }
    for (const o of map.destructibles.values()) {
      if (room.props.has(o.id) || o.id === id) continue;
      const od = Math.hypot(o.x - d.x, o.z - d.z);
      if (od < (o.type === 'explosive' ? 6 : 5)) setTimeout(() => { if (rooms.get(code) === room && room.matchStatus === 'playing') destroyProp(code, room, o.id, shooter); }, 150 + Math.random() * 250);
    }
  }

  // ---------- Bots ----------
  function syncBots(code) {
    const room = rooms.get(code);
    if (!room || room.matchStatus === 'playing') return;
    const map = getMap(room.map);
    const want = Math.max(0, Math.min(MAX_BOTS, room.botsCount));
    const bots = Array.from(room.players.values()).filter((p) => p.isBot);
    while (bots.length > want) {
      const b = bots.pop();
      room.players.delete(b.id); room.scores.delete(b.id); room.deaths.delete(b.id);
      io.to(code).emit('player:left', { id: b.id });
    }
    while (bots.length < want) {
      const c = [0, 0];
      for (const q of room.players.values()) c[q.team]++;
      const team = c[0] <= c[1] ? 0 : 1;
      const taken = Array.from(room.players.values()).map((q) => q.position);
      const sp = pickSpawn(taken, room.mode === 'team' ? team : null, map.spawns);
      const b = createBot(room, code, room.botSeq++, room.botsLevel, team, sp);
      equipBot(b, room, null, false);
      room.players.set(b.id, b); room.scores.set(b.id, 0); room.deaths.set(b.id, 0);
      io.to(code).emit('player:joined', gameView(b));
      bots.push(b);
    }
    for (const b of bots) { b.botLevel = room.botsLevel; b.level = room.botsLevel * 8; }
    broadcastScores(code);
    broadcastRoom(code);
  }

  function scheduleBotRespawn(code, room, bot) {
    setTimeout(() => {
      if (!rooms.has(code) || room.matchStatus !== 'playing' || bot.alive || !room.players.has(bot.id)) return;
      const map = getMap(room.map);
      const others = Array.from(room.players.values()).filter((o) => o.id !== bot.id && o.alive).map((o) => o.position);
      const sp = pickSpawn(others, room.mode === 'team' ? bot.team : null, map.spawns);
      resetBot(bot, room, { io, code }, sp);
      io.to(code).emit('player:respawned', { id: bot.id, position: bot.position });
    }, BOT_RESPAWN_MS);
  }

  // Un match peut-il démarrer ? (2 participants en jeu, bots compris ; en équipes : au moins un par équipe)
  function canStart(room) {
    const inGame = Array.from(room.players.values()).filter((x) => x.inGame);
    if (inGame.length < 2) return false;
    if (!inGame.some((x) => !x.isBot)) return false;
    if (room.mode === 'team') return inGame.some((x) => x.team === 0) && inGame.some((x) => x.team === 1);
    return true;
  }

  function startMatch(code) {
    const room = rooms.get(code);
    if (!room) return;
    const map = getMap(room.map);
    room.matchStatus = 'playing';
    room.matchStartTime = Date.now();
    room.scores.clear();
    room.deaths.clear();
    room.kothPts.clear();
    room.teamKills = [0, 0];
    resetChests(room);
    resetMedkits(room);
    resetBuilds(room);
    room.koth = null;
    room.props.clear(); room.propHp.clear();
    if (room.mode === 'koth') rotateHill(room);
    const taken = [];
    for (const p of room.players.values()) {
      room.scores.set(p.id, 0);
      room.deaths.set(p.id, 0);
      p.hp = PLAYER_MAX_HP;
      p.alive = true;
      p.lastCombat = 0;
      p.matchHeadshots = 0;
      p.matchJoinedAt = Date.now();
      p.ggLevel = 0;
      p.lootWeapon = null;
      p.position = pickSpawn(taken, room.mode === 'team' ? p.team : null, map.spawns);
      taken.push(p.position);
      if (room.mode === 'gungame') giveGungameWeapon(room, code, p);
      else if (p.isBot) resetBot(p, room, { io, code }, p.position);
      else resetInventory(code, p);
      if (!p.isBot) io.to(p.id).emit('player:respawned', { id: p.id, position: p.position });
    }
    const teams = {};
    for (const p of room.players.values()) teams[p.id] = p.team;
    io.to(code).emit('match:started', {
      duration: MATCH_DURATION, killTarget: room.killTarget, mode: room.mode, teams, map: room.map,
      ladder: GG_LADDER.length,
    });
    io.to(code).emit('chests:state', { chests: chestsPublic(room) });
    io.to(code).emit('medkits:state', { medkits: medkitsPublic(room) });
    io.to(code).emit('build:state', { builds: room.builds });
    for (const p of room.players.values()) if (!p.isBot) io.to(p.id).emit('build:materials', { materials: p.materials || 0 });
    io.to(code).emit('props:state', { destroyed: [] });
    if (room.koth) io.to(code).emit('koth:state', kothPublic(room));
    broadcastScores(code);
    broadcastRoom(code);
    console.log(`🎮 Match démarré dans ${code} (${room.mode}, ${map.name}, ${Array.from(room.players.values()).filter((p) => p.isBot).length} bots)`);
  }

  function endMatch(code, forcedWinnerId = null) {
    const room = rooms.get(code);
    if (!room || room.matchStatus !== 'playing') return;
    room.matchStatus = 'ended';
    const teamMode = room.mode === 'team';

    const rows = scoreRows(room);
    const sortKey = (r) => (room.mode === 'koth' ? r.points * 1000 + r.kills : room.mode === 'gungame' ? r.gg * 1000 + r.kills : r.kills);
    const list = rows.sort((a, b) => sortKey(b) - sortKey(a));

    // Vainqueur : équipe ayant le plus d'éliminations, ou joueur en tête (égalité = pas de vainqueur)
    let winnerTeam = null;
    let winnerId = null;
    if (teamMode) {
      if (room.teamKills[0] !== room.teamKills[1]) winnerTeam = room.teamKills[0] > room.teamKills[1] ? 0 : 1;
    } else if (forcedWinnerId) {
      winnerId = forcedWinnerId;
    } else if (list.length && (list.length === 1 || sortKey(list[0]) > sortKey(list[1]))) {
      winnerId = list[0].id;
    }

    for (const p of room.players.values()) {
      if (!p.inGame || p.isBot) continue;
      const isWinner = teamMode ? p.team === winnerTeam : p.id === winnerId;
      const rewards = applyMatchRewards(p.login, {
        kills: room.scores.get(p.id) || 0,
        deaths: room.deaths.get(p.id) || 0,
        headshots: p.matchHeadshots || 0,
        isWinner,
        teamMode,
        playedMs: Date.now() - Math.max(p.matchJoinedAt || 0, room.matchStartTime),
      });
      p.level = rewards.levelAfter;
      io.to(p.id).emit('match:rewards', {
        xpGain: rewards.xpGain, coinGain: rewards.coinGain, lines: rewards.lines,
        levelBefore: rewards.levelBefore, levelAfter: rewards.levelAfter,
        tierBefore: rewards.tierBefore, tierAfter: rewards.tierAfter,
        isWinner,
      });
    }

    io.to(code).emit('match:ended', {
      results: list, mode: room.mode, winnerTeam, winnerId, teamKills: room.teamKills, teamNames: TEAM_NAMES,
    });
    const who = teamMode
      ? (winnerTeam === null ? '—' : `équipe ${TEAM_NAMES[winnerTeam]}`)
      : (room.players.get(winnerId)?.username || '—');
    console.log(`🏆 Match terminé dans ${code} — ${who}`);

    setTimeout(() => {
      if (!rooms.has(code)) return;
      room.matchStatus = 'waiting';
      room.koth = null;
      resetChests(room);
      resetMedkits(room);
      resetBuilds(room);
      const map = getMap(room.map);
      const taken = [];
      for (const p of room.players.values()) {
        p.hp = PLAYER_MAX_HP;
        p.alive = true;
        p.lastCombat = 0;
        p.lootWeapon = null;
        p.ggLevel = 0;
        p.position = pickSpawn(taken, teamMode ? p.team : null, map.spawns);
        taken.push(p.position);
        resetInventory(code, p);
      }
      io.to(code).emit('match:reset');
      io.to(code).emit('medkits:state', { medkits: medkitsPublic(room) });
      io.to(code).emit('build:state', { builds: room.builds });
      for (const p of room.players.values()) if (!p.isBot) io.to(p.id).emit('build:materials', { materials: p.materials || 0 });
      broadcastRoom(code);
      if (canStart(room)) startMatch(code);
    }, END_SCREEN_DURATION);
  }

  // Fin de match par temps écoulé
  setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.matchStatus === 'playing' && Date.now() - room.matchStartTime >= MATCH_DURATION) endMatch(code);
    }
  }, 1000);

  // Roi de la colline : points chaque seconde, rotation de la zone ; réapparition des coffres
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (room.matchStatus !== 'playing') continue;
      for (const c of room.chests) {
        if (c.opened && now >= c.respawnAt) { c.opened = false; io.to(code).emit('chest:respawn', { id: c.id }); }
      }
      for (const m of room.medkits) {
        if (m.collected && now >= m.respawnAt) { m.collected = false; io.to(code).emit('medkit:respawn', { id: m.id }); }
      }
      for (const [pid, st] of Array.from(room.props)) {
        if (now >= st.respawnAt) { room.props.delete(pid); room.propHp.delete(pid); io.to(code).emit('prop:respawn', { id: pid }); }
      }
      if (room.mode === 'koth' && room.koth) {
        if (now >= room.koth.endsAt) rotateHill(room);
        const inside = Array.from(room.players.values()).filter((p) => p.alive && p.inGame
          && Math.hypot(p.position.x - room.koth.x, p.position.z - room.koth.z) < room.koth.r);
        let winner = null;
        if (inside.length === 1) {
          const p = inside[0];
          const pts = (room.kothPts.get(p.id) || 0) + 1;
          room.kothPts.set(p.id, pts);
          if (pts >= room.killTarget) winner = p.id;
        }
        io.to(code).emit('koth:state', { ...kothPublic(room), occupant: inside.length === 1 ? inside[0].id : null, contested: inside.length > 1 });
        if (inside.length === 1) broadcastScores(code);
        if (winner) endMatch(code, winner);
      }
    }
  }, 1000);

  // 💚 Régénération : après REGEN.delayMs sans tirer ni être touché
  setInterval(() => {
    const now = Date.now();
    const gain = (REGEN.ratePerSec * REGEN.tickMs) / 1000;
    for (const [code, room] of rooms) {
      if (room.matchStatus !== 'playing') continue;
      for (const p of room.players.values()) {
        if (!p.alive || !p.inGame || p.hp >= PLAYER_MAX_HP) continue;
        if (now - (p.lastCombat || 0) < REGEN.delayMs) continue;
        p.hp = Math.min(PLAYER_MAX_HP, p.hp + gain);
        io.to(code).emit('player:hp', { id: p.id, hp: Math.round(p.hp), regen: true });
      }
    }
  }, REGEN.tickMs);

  // ---------- Dégâts et éliminations (joueurs ET bots) ----------
  // Retourne true si le match vient de se terminer.
  function applyDamage(code, room, shooter, target, damage, weaponId, head) {
    if (!target.alive || room.matchStatus !== 'playing') return false;
    const now = Date.now();
    target.hp -= damage;
    target.lastCombat = now;
    io.to(code).emit('player:hit', {
      targetId: target.id,
      hp: Math.max(0, Math.round(target.hp)),
      shooterId: shooter.id,
      shooterName: shooter.username,
      damage,
      head,
    });
    if (target.hp > 0) return false;

    target.alive = false;
    target.hp = 0;
    target.lootWeapon = null;
    room.scores.set(shooter.id, (room.scores.get(shooter.id) || 0) + 1);
    room.deaths.set(target.id, (room.deaths.get(target.id) || 0) + 1);
    if (head) shooter.matchHeadshots = (shooter.matchHeadshots || 0) + 1;
    if (room.mode === 'team') room.teamKills[shooter.team]++;

    io.to(code).emit('player:died', {
      id: target.id,
      username: target.username,
      killerName: shooter.username,
      killerId: shooter.id,
      killerTeam: shooter.team,
      victimTeam: target.team,
      weaponId,
      head,
    });
    if (target.isBot) scheduleBotRespawn(code, room, target);

    // Course aux armes : arme suivante, ou victoire si c'était la dernière
    let ggWin = false;
    if (room.mode === 'gungame') {
      if (shooter.ggLevel >= GG_LADDER.length - 1) ggWin = true;
      else { shooter.ggLevel++; giveGungameWeapon(room, code, shooter); }
    }
    broadcastScores(code);

    const reached = room.mode === 'team'
      ? room.teamKills[shooter.team] >= room.killTarget
      : room.mode === 'ffa' && (room.scores.get(shooter.id) || 0) >= room.killTarget;
    if (ggWin) { endMatch(code, shooter.id); return true; }
    if (reached) { endMatch(code); return true; }
    return false;
  }

  function removePlayer(code, socketId) {
    const room = rooms.get(code);
    if (!room) return;
    room.players.delete(socketId);
    room.scores.delete(socketId);
    room.deaths.delete(socketId);
    room.kothPts.delete(socketId);
    io.to(code).emit('player:left', { id: socketId });
    if (humans(room).length === 0) { rooms.delete(code); return; } // plus d'humains : le salon (et ses bots) disparaît
    if (room.host === socketId) room.host = humans(room)[0].id;     // nouvel hôte
    broadcastScores(code);
    broadcastRoom(code);
  }

  // 🧹 Watchdog : supprime les joueurs inactifs (fantômes)
  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      for (const [socketId, p] of Array.from(room.players)) {
        if (p.isBot) continue;
        if (p.inGame && p.lastSeen && now - p.lastSeen > GHOST_TIMEOUT) {
          console.log(`🧹 Fantôme supprimé : ${p.login} (${socketId})`);
          removePlayer(code, socketId);
        }
      }
    }
  }, 3000);

  // 🤖 Intelligence des bots : 20 fois par seconde dans les salles en match
  const botCtx = { io, applyDamage, openChest, nearestChest };
  setInterval(() => {
    for (const [code, room] of rooms) {
      if (room.matchStatus !== 'playing') continue;
      let hasBot = false;
      for (const p of room.players.values()) if (p.isBot) { hasBot = true; break; }
      if (!hasBot) continue;
      try { tickBots(code, room, getMap(room.map), botCtx); } catch (e) { console.error('Erreur bots', e); }
    }
  }, 50);

  // ---------- Identité : le serveur ne croit que la session (cookie) ----------
  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) { socket.disconnect(true); return; }
    let currentRoom = null;

    function refreshFromProfile(p) {
      const prof = getOrCreateProfile(p.login);
      p.username = prof.displayName;
      p.skin = prof.equippedSkin;
      p.tracer = prof.equippedTracer;
      p.level = levelInfo(prof.xp).level;
    }

    function autoTeam(room) {
      const c = [0, 0];
      for (const q of room.players.values()) c[q.team]++;
      return c[0] <= c[1] ? 0 : 1;
    }

    function joinRoom(code, cb) {
      // Déjà dans ce salon (retour d'une partie) : on renvoie simplement l'état
      if (currentRoom === code && rooms.get(code)?.players.has(socket.id)) {
        const r = rooms.get(code);
        cb({
          ok: true, code, state: roomState(code),
          players: Array.from(r.players.values()).map(gameView), matchStatus: r.matchStatus,
        });
        return;
      }
      if (currentRoom) leaveRoom();
      if (!rooms.has(code)) rooms.set(code, createRoom(socket.id));

      // Même compte déjà présent (reconnexion) → on remplace
      for (const [oldId, oldP] of Array.from(rooms.get(code).players)) {
        if (!oldP.isBot && oldP.login === user.username) removePlayer(code, oldId);
      }
      if (!rooms.has(code)) rooms.set(code, createRoom(socket.id));
      const room = rooms.get(code);

      const prof = getOrCreateProfile(user.username);
      const saved = Array.isArray(prof.loadout) && isValidLoadout(prof.loadout) ? prof.loadout : DEFAULT_LOADOUT;
      const playerData = {
        id: socket.id,
        login: user.username,
        username: prof.displayName,
        position: pickSpawn(Array.from(room.players.values()).map((x) => x.position), null, getMap(room.map).spawns),
        rotation: { yaw: 0, pitch: 0 },
        hp: PLAYER_MAX_HP,
        alive: true,
        inGame: false,
        skin: prof.equippedSkin,
        tracer: prof.equippedTracer,
        level: levelInfo(prof.xp).level,
        team: autoTeam(room),
        lastSeen: Date.now(),
        lastCombat: 0,
        loadout: [...START_INVENTORY],
        baseLoadout: [...saved],
        inventory: [...START_INVENTORY],
        weaponId: START_INVENTORY[0],
        lootWeapon: null,
        ggLevel: 0,
        shotTokens: 3, lastTokenAt: Date.now(),
        fireTokens: 3, lastFireAt: Date.now(),
        lastStateAt: 0, lastStatePacketAt: 0, riftCooldownUntil: 0, riftMoveUntil: 0,
        matchHeadshots: 0, matchJoinedAt: 0,
      };
      if (humans(room).length === 0) room.host = socket.id;
      room.players.set(socket.id, playerData);
      room.scores.set(socket.id, 0);
      room.deaths.set(socket.id, 0);
      socket.join(code);
      currentRoom = code;

      cb({
        ok: true, code,
        state: roomState(code),
        players: Array.from(room.players.values()).map(gameView),
        matchStatus: room.matchStatus,
      });
      socket.to(code).emit('player:joined', gameView(playerData));
      broadcastScores(code);
      broadcastRoom(code);
    }

    function leaveRoom() {
      if (!currentRoom) return;
      const code = currentRoom;
      socket.leave(code);
      currentRoom = null;
      removePlayer(code, socket.id);
    }

    const me = () => {
      if (!currentRoom) return {};
      const room = rooms.get(currentRoom);
      return { room, p: room?.players.get(socket.id), code: currentRoom };
    };

    socket.on('room:create', (_d, cb) => {
      if (typeof cb !== 'function') return;
      const code = generateCode();
      rooms.set(code, createRoom(socket.id));
      joinRoom(code, cb);
    });

    socket.on('room:join', ({ code } = {}, cb) => {
      if (typeof cb !== 'function') return;
      const c = String(code || '').toUpperCase();
      if (!rooms.has(c)) return cb({ error: 'Salon introuvable.' });
      joinRoom(c, cb);
    });

    socket.on('room:leave', () => leaveRoom());

    // --- Réglages du salon (hôte uniquement, hors match) ---
    const hostWaiting = () => {
      const { room, code } = me();
      if (!room || room.host !== socket.id || room.matchStatus !== 'waiting') return null;
      return { room, code };
    };

    socket.on('room:setMode', ({ mode } = {}) => {
      const ctx = hostWaiting();
      if (!ctx || !MODES[mode]) return;
      const { room, code } = ctx;
      room.mode = mode;
      room.killTarget = MODES[mode].defaultTarget;
      if (mode === 'team') { // répartit équitablement les équipes
        let i = 0;
        for (const q of room.players.values()) q.team = i++ % 2;
      }
      resetChests(room);
      broadcastRoom(code);
    });
    socket.on('room:setTarget', ({ target } = {}) => {
      const ctx = hostWaiting();
      if (!ctx) return;
      const { room, code } = ctx;
      if (!MODES[room.mode].targets.includes(target)) return;
      room.killTarget = target;
      broadcastRoom(code);
    });
    socket.on('room:setMap', ({ map } = {}) => {
      const ctx = hostWaiting();
      if (!ctx || !MAP_IDS.includes(map)) return;
      const { room, code } = ctx;
      // la carte ne change que si personne n'est déjà dans la partie (le client construit la carte à l'entrée)
      if (Array.from(room.players.values()).some((p) => !p.isBot && p.inGame)) return;
      room.map = map;
      resetChests(room);
      const spawns = getMap(map).spawns;
      for (const p of room.players.values()) p.position = { ...pickSpawn([], null, spawns) };
      broadcastRoom(code);
    });
    socket.on('room:setBots', ({ count, level } = {}) => {
      const ctx = hostWaiting();
      if (!ctx) return;
      const { room, code } = ctx;
      if (Number.isInteger(count)) room.botsCount = Math.max(0, Math.min(MAX_BOTS, count));
      if (Number.isInteger(level) && BOT_LEVELS[level]) room.botsLevel = level;
      syncBots(code);
    });
    socket.on('room:setChests', ({ on } = {}) => {
      const ctx = hostWaiting();
      if (!ctx) return;
      ctx.room.chestsOn = !!on;
      resetChests(ctx.room);
      broadcastRoom(ctx.code);
    });
    socket.on('room:kick', ({ id } = {}) => {
      const { room, code } = me();
      if (!room || room.host !== socket.id || id === socket.id || !room.players.has(id)) return;
      const target = room.players.get(id);
      if (target.isBot) {
        room.botsCount = Math.max(0, room.botsCount - 1);
        room.players.delete(id); room.scores.delete(id); room.deaths.delete(id);
        io.to(code).emit('player:left', { id });
        broadcastScores(code); broadcastRoom(code);
        return;
      }
      io.to(id).emit('room:kicked');
      io.sockets.sockets.get(id)?.leave(code);
      removePlayer(code, id);
    });
    socket.on('room:setTeam', ({ team } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || p.inGame || (team !== 0 && team !== 1)) return;
      p.team = team;
      broadcastRoom(code);
    });

    // Le joueur a changé de skin / pseudo / traînée via l'API : on relit son profil
    socket.on('profile:changed', () => {
      const { room, p, code } = me();
      if (!room || !p) return;
      refreshFromProfile(p);
      broadcastRoom(code);
      if (p.inGame) io.to(code).emit('player:look', { id: p.id, skin: p.skin, username: p.username, team: p.team });
    });

    socket.on('match:enter', () => {
      const { room, p, code } = me();
      if (!room || !p) return;
      p.inGame = true;
      p.hp = PLAYER_MAX_HP;
      p.alive = true;
      p.lastCombat = 0;
      p.lastSeen = Date.now();
      p.matchJoinedAt = Date.now();

      const others = Array.from(room.players.values()).filter((x) => x.id !== socket.id);
      socket.emit('match:entered', { players: others.map(gameView), me: gameView(p), mode: room.mode, map: room.map });
      broadcastRoom(code);

      if (room.matchStatus === 'waiting' && canStart(room)) {
        startMatch(code);
      } else if (room.matchStatus === 'playing') {
        const teams = {};
        for (const q of room.players.values()) teams[q.id] = q.team;
        socket.emit('match:started', {
          duration: MATCH_DURATION, killTarget: room.killTarget, mode: room.mode, teams, map: room.map,
          timeLeft: MATCH_DURATION - (Date.now() - room.matchStartTime), ladder: GG_LADDER.length,
        });
        socket.emit('chests:state', { chests: chestsPublic(room) });
        socket.emit('medkits:state', { medkits: medkitsPublic(room) });
        socket.emit('build:state', { builds: room.builds });
        socket.emit('build:materials', { materials: p.materials || 0 });
        socket.emit('props:state', { destroyed: destroyedList(room) });
        if (room.koth) socket.emit('koth:state', kothPublic(room));
        if (room.mode === 'gungame') giveGungameWeapon(room, code, p); else resetInventory(code, p);
        broadcastScores(code);
      }
    });

    socket.on('match:leave', () => {
      const { p, code } = me();
      if (!p) return;
      p.inGame = false;
      broadcastRoom(code);
    });

    socket.on('player:state', ({ position, rotation } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.alive) return;
      const now = Date.now();
      // Le client envoie 20 états/s ; on ignore les rafales anormales.
      if (p.lastStatePacketAt && now - p.lastStatePacketAt < 20) return;
      p.lastStatePacketAt = now;
      const elapsed = p.lastStateAt ? now - p.lastStateAt : now - (p.lastSeen || now);
      const riftAllowance = p.riftMoveUntil >= now ? 9.5 : 0;
      const state = validatePlayerState(getMap(room.map), p.position, position, rotation, elapsed, riftAllowance);
      if (!state || blockedByPlayerBuilds(room.builds, state.position)) return;
      p.position = state.position;
      p.rotation = state.rotation;
      p.lastStateAt = now;
      p.lastSeen = now;
      p.riftMoveUntil = 0;
      socket.to(code).emit('player:state', { id: socket.id, position: p.position, rotation: p.rotation });
    });

    // (v6) Plus d'arsenal : les armes viennent des coffres. Message conservé pour les anciens clients.
    socket.on('player:loadout', () => {});

    // Arme en main (visible par les autres joueurs)
    socket.on('player:weapon', ({ weaponId } = {}) => {
      const { p, code } = me();
      if (!p || !canUse(p, weaponId)) return;
      p.weaponId = weaponId;
      socket.to(code).emit('player:weapon', { id: socket.id, weaponId });
    });

    // Chaque tir est diffusé aux autres joueurs (traînée + son), qu'il touche ou non.
    socket.on('player:fire', ({ weaponId, dir } = {}) => {
      const { room, p, code } = me();
      if (!room || room.matchStatus !== 'playing') return;
      const def = WEAPONS[weaponId];
      if (!p || !p.inGame || !p.alive || !def || p.weaponId !== weaponId || !canUse(p, weaponId)) return;
      if (!Array.isArray(dir) || dir.length !== 3 || !dir.every((n) => Number.isFinite(n))) return;
      const now = Date.now();
      p.fireTokens = Math.min(3, p.fireTokens + ((now - p.lastFireAt) / 1000) * def.fireRate * 1.4);
      p.lastFireAt = now;
      if (p.fireTokens < 1) return;
      p.fireTokens -= 1;
      p.lastCombat = now; // tirer = être au combat (pas de régénération)
      const l = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      socket.to(code).emit('player:fired', {
        id: socket.id, weaponId, dir: [dir[0] / l, dir[1] / l, dir[2] / l], tracer: tracerColor(p.tracer),
      });
    });

    // Ouverture d'un coffre (le serveur tire le butin et vérifie la distance)
    socket.on('chest:open', ({ id } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing') return;
      const chest = room.chests.find((c) => c.id === id);
      if (!chest || chest.opened) return;
      if (Math.hypot(chest.x - p.position.x, chest.z - p.position.z) > CHEST_REACH) return;
      openChest(code, room, p, chest);
    });

    // Trousse de soin : collecte serveur, réapparition temporisée et santé plafonnée.
    socket.on('medkit:use', ({ id } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing' || !Number.isInteger(id)) return;
      if (p.hp >= PLAYER_MAX_HP - 1) return;
      const item = room.medkits.find((m) => m.id === id);
      if (!item || item.collected || Math.hypot(item.x - p.position.x, item.z - p.position.z) > 5) return;
      item.collected = true;
      item.respawnAt = Date.now() + 55000;
      p.hp = Math.min(PLAYER_MAX_HP, p.hp + 35);
      io.to(code).emit('medkit:collected', { id: item.id, by: p.id });
      io.to(code).emit('player:hp', { id: p.id, hp: Math.round(p.hp), regen: true });
      if (!p.isBot) io.to(p.id).emit('medkit:granted', { heal: 35, hp: Math.round(p.hp) });
    });

    // Construction légère : plans validés par le serveur, ressources et édition réservée au propriétaire.
    socket.on('build:place', (payload = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing') return;
      const allowed = new Set(['wall', 'floor', 'ramp', 'roof']);
      const { type, x, y, z, rotation } = payload;
      if (!allowed.has(type) || ![x, y, z, rotation].every(Number.isFinite)) return;
      if ((p.materials || 0) < 10) { io.to(p.id).emit('build:rejected', { reason: 'materials' }); return; }
      if (room.builds.length >= 120 || room.builds.filter((b) => b.ownerId === p.id).length >= 24) { io.to(p.id).emit('build:rejected', { reason: 'limit' }); return; }
      const map = getMap(room.map);
      const px = Math.round(x / 2) * 2, pz = Math.round(z / 2) * 2;
      const py = Math.max(0, Math.min(18, Math.round(y / 3) * 3));
      if (Math.hypot(px - p.position.x, pz - p.position.z) > 13.5) { io.to(p.id).emit('build:rejected', { reason: 'range' }); return; }
      if (Math.abs(px) > map.half - 4 || Math.abs(pz) > map.half - 4) { io.to(p.id).emit('build:rejected', { reason: 'bounds' }); return; }
      if (py > 0 && type === 'wall' && p.position.y < py + 1.5) { io.to(p.id).emit('build:rejected', { reason: 'height' }); return; }
      if (!map.isFree(px, pz, type === 'wall' ? 1.6 : 1.8)) { io.to(p.id).emit('build:rejected', { reason: 'blocked' }); return; }
      const overlap = room.builds.some((b) => Math.abs(b.y - py) < 2.4 && Math.hypot(b.x - px, b.z - pz) < 3.2);
      if (overlap) { io.to(p.id).emit('build:rejected', { reason: 'overlap' }); return; }
      const build = {
        id: ++room.buildSeq, ownerId: p.id, ownerName: p.username,
        type, variant: type === 'wall' ? 'solid' : 'default',
        x: px, y: py, z: pz, rotation: Math.round(rotation / (Math.PI / 2)) * (Math.PI / 2),
        health: type === 'wall' ? 260 : 220,
      };
      p.materials -= 10;
      room.builds.push(build);
      io.to(code).emit('build:added', { build });
      io.to(p.id).emit('build:materials', { materials: p.materials });
    });

    socket.on('build:edit', ({ id } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing' || !Number.isInteger(id)) return;
      const b = room.builds.find((item) => item.id === id && item.ownerId === p.id);
      if (!b || Math.hypot(b.x - p.position.x, b.z - p.position.z) > 8) return;
      if (b.type === 'wall') {
        const variants = ['solid', 'window', 'door'];
        b.variant = variants[(variants.indexOf(b.variant) + 1) % variants.length];
      } else {
        b.rotation = (b.rotation + Math.PI / 2) % (Math.PI * 2);
      }
      io.to(code).emit('build:updated', { build: b });
    });

    socket.on('build:remove', ({ id } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing' || !Number.isInteger(id)) return;
      const index = room.builds.findIndex((item) => item.id === id && item.ownerId === p.id);
      if (index < 0) return;
      const b = room.builds[index];
      if (Math.hypot(b.x - p.position.x, b.z - p.position.z) > 8) return;
      room.builds.splice(index, 1);
      p.materials = Math.min(150, (p.materials || 0) + 5);
      io.to(code).emit('build:removed', { id });
      io.to(p.id).emit('build:materials', { materials: p.materials });
    });

    // Tir sur un décor destructible (le client détecte l'impact, le serveur compte les coups)
    socket.on('prop:hit', ({ id } = {}) => {
      const { room, p, code } = me();
      if (!room || !p || !p.inGame || !p.alive || room.matchStatus !== 'playing' || !Number.isInteger(id)) return;
      const now = Date.now();
      p.propTokens = Math.min(10, (p.propTokens ?? 10) + ((now - (p.propAt || now)) / 1000) * 10);
      p.propAt = now;
      if (p.propTokens < 1) return;
      p.propTokens -= 1;
      const d = getMap(room.map).destructibles.get(id);
      if (!d || room.props.has(id)) return;
      if (Math.hypot(d.x - p.position.x, d.z - p.position.z) > 85) return;
      const hp = (room.propHp.has(id) ? room.propHp.get(id) : d.hp) - 1;
      room.propHp.set(id, hp);
      if (hp <= 0) destroyProp(code, room, id, p);
    });

    // Chat vocal : relais de la signalisation WebRTC entre deux joueurs du salon
    socket.on('voice:signal', ({ to, data } = {}) => {
      const { room } = me();
      if (!room || typeof to !== 'string' || !data || !room.players.has(to) || room.players.get(to).isBot) return;
      io.to(to).emit('voice:signal', { from: socket.id, data });
    });

    // Un message = une pression de gâchette (tous les plombs d'un tir de fusil à pompe).
    // hits : [{ id, n, head }] → n plombs touchés sur la cible, dont head à la tête.
    socket.on('player:shoot', ({ weaponId, hits } = {}) => {
      const { room, p: shooter, code } = me();
      if (!room || room.matchStatus !== 'playing') return;
      if (!shooter || !shooter.inGame || !shooter.alive) return;
      const def = WEAPONS[weaponId];
      if (!def || shooter.weaponId !== weaponId || !canUse(shooter, weaponId)) return;
      if (!Array.isArray(hits) || hits.length === 0 || hits.length > 8) return;

      // Anti-triche léger : limite de cadence (jetons qui se rechargent)
      const now = Date.now();
      const rate = def.fireRate * 1.4;
      shooter.shotTokens = Math.min(3, shooter.shotTokens + ((now - shooter.lastTokenAt) / 1000) * rate);
      shooter.lastTokenAt = now;
      if (shooter.shotTokens < 1) return;
      shooter.shotTokens -= 1;

      let pelletsLeft = def.pellets;
      shooter.lastCombat = now;

      for (const h of hits) {
        if (pelletsLeft <= 0) break;
        const target = room.players.get(h?.id);
        if (!target || !target.inGame || !target.alive || target.id === shooter.id) continue;
        if (room.mode === 'team' && target.team === shooter.team) continue; // pas de tir allié

        const dist = Math.hypot(
          target.position.x - shooter.position.x,
          target.position.y - shooter.position.y,
          target.position.z - shooter.position.z
        );
        if (dist > def.range[1] * 1.6 + 8) continue; // trop loin pour cette arme
        // Le client effectue aussi le raycast ; cette vérification serveur empêche les tirs à travers les grands obstacles.
        const map = getMap(room.map);
        if (dist > 2 && !map.hasLOS(shooter.position.x, shooter.position.z, target.position.x, target.position.z)) continue;

        const n = Math.max(1, Math.min(pelletsLeft, Math.floor(h.n) || 1));
        pelletsLeft -= n;
        const heads = Math.max(0, Math.min(n, Math.floor(h.head) || 0));
        const damage = computeDamage(def, dist, n, heads);
        if (applyDamage(code, room, shooter, target, damage, weaponId, heads > 0)) return;
      }
    });

    socket.on('player:respawn', () => {
      const { room, p, code } = me();
      if (!room || !p || p.alive) return;
      p.alive = true;
      p.hp = PLAYER_MAX_HP;
      p.lastCombat = 0;
      p.lootWeapon = null;
      p.position = pickSpawn(
        Array.from(room.players.values()).filter((o) => o.id !== p.id && o.alive).map((o) => o.position),
        room.mode === 'team' ? p.team : null,
        getMap(room.map).spawns
      );
      p.lastSeen = Date.now();
      io.to(code).emit('player:respawned', { id: socket.id, position: p.position });
      if (room.mode === 'gungame') giveGungameWeapon(room, code, p); // l'arme du niveau est restituée
      else resetInventory(code, p);                                  // le butin est perdu à la mort
    });

    socket.on('player:rift', () => {
      const { room, p } = me();
      if (!room || !p || !p.inGame || !p.alive) return;
      const now = Date.now();
      if (now < (p.riftCooldownUntil || 0)) return;
      p.riftCooldownUntil = now + 4000;
      p.riftMoveUntil = now + 700;
      registerRiftUse(p.login);
    });

    socket.on('chat:message', ({ text } = {}) => {
      const { p, code } = me();
      if (!p || typeof text !== 'string' || !text.trim() || text.length > 200) return;
      io.to(code).emit('chat:message', { username: p.username, team: p.team, text: text.trim(), time: Date.now() });
    });

    socket.on('disconnect', () => leaveRoom());
  });

  // ---------- Fonctions utilisées par le panneau administrateur ----------
  return {
    getRoomsSnapshot() {
      return Array.from(rooms.entries()).map(([code, room]) => ({
        code, mode: room.mode, map: room.map, status: room.matchStatus, killTarget: room.killTarget,
        players: Array.from(room.players.values()).map((p) => ({
          id: p.id, login: p.login, username: p.username, team: p.team, inGame: p.inGame, isBot: !!p.isBot,
          kills: room.scores.get(p.id) || 0, deaths: room.deaths.get(p.id) || 0,
        })),
      }));
    },
    kickLogin(login) {
      let n = 0;
      for (const [code, room] of Array.from(rooms)) {
        for (const p of Array.from(room.players.values())) {
          if (!p.isBot && p.login === login) {
            io.to(p.id).emit('room:kicked');
            io.sockets.sockets.get(p.id)?.leave(code);
            removePlayer(code, p.id);
            n++;
          }
        }
      }
      return n;
    },
    closeRoom(code) {
      const room = rooms.get(code);
      if (!room) return false;
      for (const p of Array.from(room.players.values())) {
        if (p.isBot) continue;
        io.to(p.id).emit('room:kicked');
        io.sockets.sockets.get(p.id)?.leave(code);
      }
      rooms.delete(code);
      return true;
    },
    refreshLogin(login) {
      for (const [code, room] of rooms) {
        for (const p of room.players.values()) {
          if (p.isBot || p.login !== login) continue;
          const prof = getOrCreateProfile(login);
          p.username = prof.displayName; p.skin = prof.equippedSkin; p.tracer = prof.equippedTracer;
          p.level = levelInfo(prof.xp).level;
          broadcastRoom(code);
          if (p.inGame) io.to(code).emit('player:look', { id: p.id, skin: p.skin, username: p.username, team: p.team });
        }
      }
    },
    isOnline(login) {
      for (const room of rooms.values()) for (const p of room.players.values()) if (!p.isBot && p.login === login) return true;
      return false;
    },
    announce(text) { io.emit('announce', { text, time: Date.now() }); },
    skinKnown: (id) => !!getSkin(id),
  };
}
