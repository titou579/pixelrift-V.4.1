import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createEngine } from './engine.js';
import { buildMap } from './mapBuilder.js';
import { createPlayer } from './player.js';
import { createWeaponSystem } from './weapon.js';
import { createRift } from './rift.js';
import { createRemotePlayersManager } from './remotePlayers.js';
import { getGameConfig, getLoadout, saveLoadout } from './gameConfig.js';
import { CREDITS } from './credits.js';
import { createVoice, voiceVolume } from './voice.js';
import { createChests, createHill } from './chests.js';
import { createMapView } from './mapView.js';
import { buildWeaponIcons } from './weaponIcons.js';
import { createFx } from './fx.js';
import { createMedkits } from './medkits.js';
import { createBuildingSystem } from './building.js';
import { readLowPowerPreference, writeLowPowerPreference } from './graphicsSettings.js';
import TouchControls from '../components/TouchControls.jsx';
import Tutorial, { tutoSeen } from '../components/Tutorial.jsx';
import { loadCatalog, tracerById } from './catalogStore.js';
import { getProfile } from '../api.js';
import Icon from '../components/Icon.jsx';
import * as sound from './sound.js';
import { getSocket } from '../socket.js';
import '../styles/game.css';

// Boussole : 24 repères de 15°, répétés 3 fois pour un défilement continu
function Compass({ heading }) {
  const items = [];
  for (let i = 0; i < 72; i++) {
    const deg = (i % 24) * 15;
    let cls = 'c-item';
    let label = '';
    if (deg % 90 === 0) { cls += ' cdn'; label = ['N', 'E', 'S', 'O'][deg / 90]; }
    else if (deg % 45 === 0) { cls += ' inter'; label = { 45: 'NE', 135: 'SE', 225: 'SO', 315: 'NO' }[deg]; }
    else if (deg % 30 === 0) label = String(deg);
    items.push(<div key={i} className={cls}>{label}</div>);
  }
  const x = 210 - ((24 + heading / 15) * 40 + 20);
  return (
    <div className="compass">
      <div className="compass-track" style={{ transform: `translateX(${x}px)` }}>{items}</div>
      <div className="compass-mark" />
      <div className="compass-deg">{String(heading).padStart(3, '0')}°</div>
    </div>
  );
}

// Tableau des scores : par joueur, ou par équipe en mode équipes
function ScoreTable({ rows, mode, myId, teamKills, highlightWinner, teamNames = ['Alpha', 'Bravo'] }) {
  const extra = mode === 'koth' ? 'Points' : mode === 'gungame' ? 'Arme' : null;
  const head = <thead><tr><th>#</th><th>Opérateur</th><th>Éliminations</th><th>Morts</th>{extra && <th>{extra}</th>}</tr></thead>;
  const line = (p, i, cls = '') => (
    <tr key={p.id} className={`${p.id === myId ? 'me' : ''} ${cls}`}>
      <td>{i + 1}</td><td>{p.username}</td><td>{p.kills}</td><td>{p.deaths}</td>
      {mode === 'koth' && <td>{p.points || 0}</td>}
      {mode === 'gungame' && <td>{(p.gg || 0) + 1}</td>}
    </tr>
  );
  if (mode === 'team') {
    return (
      <div className="team-tables">
        {[0, 1].map((t) => (
          <div key={t} className={`team-table team-${t === 0 ? 'a' : 'b'}`}>
            <div className="team-head"><b>{teamNames[t]}</b><span>{teamKills ? teamKills[t] : 0}</span></div>
            <table>
              {head}
              <tbody>{rows.filter((p) => p.team === t).sort((a, b) => b.kills - a.kills).map((p, i) => line(p, i))}</tbody>
            </table>
          </div>
        ))}
      </div>
    );
  }
  const sorted = [...rows].sort((a, b) => (mode === 'koth' ? (b.points || 0) - (a.points || 0) : mode === 'gungame' ? (b.gg || 0) - (a.gg || 0) : 0) || b.kills - a.kills);
  return (
    <table>
      {head}
      <tbody>{sorted.map((p, i) => line(p, i, highlightWinner && i === 0 ? 'winner' : ''))}</tbody>
    </table>
  );
}

const MODE_TXT = { auto: 'AUTO', semi: 'SEMI', burst: 'RAFALE' };
const RAR = {
  common: { label: 'Commun', color: '#b6bcc4', hex: 0xb6bcc4 },
  rare: { label: 'Rare', color: '#4fa8ff', hex: 0x4fa8ff },
  epic: { label: 'Épique', color: '#b866ff', hex: 0xb866ff },
  legendary: { label: 'Légendaire', color: '#ffb62e', hex: 0xffb62e },
};
const MODE_NAME = { ffa: 'Mêlée générale', team: 'Équipes', gungame: 'Course aux armes', koth: 'Roi de la colline' };
const BUILD_TYPES = [
  { id: 'wall', label: 'Mur' },
  { id: 'floor', label: 'Sol' },
  { id: 'ramp', label: 'Rampe' },
  { id: 'roof', label: 'Toit' },
];

export default function GameCanvas({ user, roomCode, onExit }) {
  const socket = getSocket();
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const [score, setScore] = useState(0);
  const [locked, setLocked] = useState(false);
  const [riftReady, setRiftReady] = useState(true);
  const [myHp, setMyHp] = useState(100);
  const [regenOn, setRegenOn] = useState(false);
  const [hurt, setHurt] = useState(0);
  const [alive, setAlive] = useState(true);
  const [scores, setScores] = useState([]);
  const [killFeed, setKillFeed] = useState([]);
  const [matchStatus, setMatchStatus] = useState('waiting');
  const [matchEnd, setMatchEnd] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [respawnIn, setRespawnIn] = useState(0);
  const [rewards, setRewards] = useState(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [loadProgress, setLoadProgress] = useState('Initialisation…');
  const [weaponHud, setWeaponHud] = useState(null);
  const [scoped, setScoped] = useState(false);
  const [hitMark, setHitMark] = useState(null);
  const [fps, setFps] = useState({ fps: 0, avg: 0 });
  const [showFps, setShowFps] = useState(true);
  const [showCredits, setShowCredits] = useState(false);
  const [lunar, setLunar] = useState(0);
  const [voiceStatus, setVoiceStatus] = useState({ state: 'idle', msg: '' });
  const [talking, setTalking] = useState(false);
  const [heading, setHeading] = useState(0);
  const [killedBy, setKilledBy] = useState(null);
  const [banner, setBanner] = useState(null);
  const [loadPct, setLoadPct] = useState(5);
  const [mode, setMode] = useState('ffa');
  const [myTeam, setMyTeam] = useState(0);
  const [teamKills, setTeamKills] = useState([0, 0]);
  const [killTarget, setKillTarget] = useState(15);
  const [lootToast, setLootToast] = useState(null);
  const [nearChest, setNearChest] = useState(false);
  const [nearMedkit, setNearMedkit] = useState(false);
  const [buildMode, setBuildMode] = useState(false);
  const [buildTypeIndex, setBuildTypeIndex] = useState(0);
  const [buildMaterials, setBuildMaterials] = useState(100);
  const [buildMessage, setBuildMessage] = useState('');
  const [lowPower, setLowPower] = useState(readLowPowerPreference);
  const [koth, setKoth] = useState(null);
  const [ladder, setLadder] = useState(9);
  const [ggLevel, setGgLevel] = useState(0);
  const [myId, setMyId] = useState(null);
  const [icons, setIcons] = useState({});
  const [weaponDefs, setWeaponDefs] = useState([]);
  const [showTuto, setShowTuto] = useState(false);
  const [touchEdit, setTouchEdit] = useState(false);
  const miniRef = useRef(null);
  const mapRef = useRef(null);
  const scoresRef = useRef([]);
  // Appareil tactile ? (écran principal tactile : téléphone / tablette)
  const isTouch = useRef(typeof window !== 'undefined' && ((window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || false)).current;

  useEffect(() => {
    const canvas = canvasRef.current;
    let cancelled = false;

    const game = {
      renderer: null, scene: null, camera: null, sky: null, applyQuality: null,
      player: null, weapons: null, rift: null, remotes: null, config: null, voice: null,
      chests: null, medkits: null, buildings: null, hill: null, mapBuild: null,
      buildMode: false, buildTypeIndex: 0, buildRotationOffset: 0, lowPower,
      raf: null, sendState: null, timerInt: null, respawnInt: null, hudInt: null, fpsInt: null,
      handlers: {},
    };
    gameRef.current = game;

    // Les états reçus avant la fin du chargement de la carte sont conservés.
    let pendingChests = null, pendingMedkits = null, pendingProps = null, pendingBuilds = [];
    let pendingChestRevision = 0;

    // --- Moteur 3D ---
    const { renderer, scene, camera, sky, applyQuality } = createEngine(canvas, { lowPower });
    game.renderer = renderer;
    game.scene = scene;
    game.camera = camera;
    game.sky = sky;
    game.applyQuality = applyQuality;
    game.lowPower = lowPower;

    let hitTimer = null;
    let regenTimer = null;
    const weaponName = (id) => (id === 'explosion' ? 'Explosion' : game.config?.weapons.find((w) => w.id === id)?.name || '');

    // --- Listeners socket ---
    const sendLoadout = () => {
      if (!socket.connected || !game.config) return;
      socket.emit('player:loadout', { loadout: getLoadout(game.config) });
    };

    const onPlayerJoined = (p) => {
      if (!game.remotes) return;
      if (p.id === socket.id) return;
      game.remotes.add(p.id, p, p.position, p.rotation);
      if (!p.isBot) game.voice?.connect(p.id);
    };
    const onPlayerLeft = ({ id }) => {
      game.remotes?.remove(id);
      game.voice?.closePeer(id);
    };
    const onPlayerState = ({ id, position, rotation }) => game.remotes?.update(id, position, rotation);

    const onMatchEntered = ({ players, me, mode: m }) => {
      if (!game.remotes) return;
      setMode(m); setMyTeam(me.team);
      game.remotes.setContext({ mode: m, myTeam: me.team });
      game.remotes.clear();
      for (const p of players) {
        if (p.id === socket.id) continue;
        game.remotes.add(p.id, p, p.position, p.rotation);
        if (!p.isBot) game.voice?.connect(p.id);
      }
    };
    const onPlayerWeapon = ({ id, weaponId }) => game.remotes?.setWeapon(id, weaponId);
    const onPlayerLook = ({ id, skin, username, team }) => {
      if (id !== socket.id) game.remotes?.setLook(id, { skin, username, team });
    };
    const onTeamsUpdate = ({ teamKills: tk, mode: m, killTarget: kt, ladder: lad }) => { setTeamKills(tk); setMode(m); setKillTarget(kt); if (lad) setLadder(lad); };
    const onKicked = () => onExit();

    // --- Coffres, butin, modes de jeu (v5) ---
    const onChestsState = ({ chests = [] } = {}) => {
      pendingChests = chests; pendingChestRevision++;
      if (game.chestsReady) game.chests?.setState(chests);
    };
    const onChestOpened = ({ id, rarity }) => {
      if (pendingChests) { pendingChests = pendingChests.map((c) => c.id === id ? { ...c, opened: true } : c); pendingChestRevision++; }
      if (game.chestsReady) game.chests?.open(id, (RAR[rarity] || RAR.common).hex);
    };
    const onChestRespawn = ({ id }) => {
      if (pendingChests) { pendingChests = pendingChests.map((c) => c.id === id ? { ...c, opened: false } : c); pendingChestRevision++; }
      if (game.chestsReady) game.chests?.respawn(id);
    };
    const onLootGranted = ({ weaponId, rarity, heal }) => {
      const tid = Date.now() + Math.random();
      setLootToast({ id: tid, name: weaponName(weaponId), rarity, heal });
      setTimeout(() => setLootToast((t) => (t && t.id === tid ? null : t)), 3200);
    };
    const onLoadoutForced = ({ loadout, level, ladder: lad }) => {
      game.weapons?.setLoadout(loadout);
      setGgLevel(level || 0);
      if (lad) setLadder(lad);
    };
    const onLoadoutRestore = () => {
      if (game.config) game.weapons?.setLoadout(getLoadout(game.config));
      setGgLevel(0);
    };
    const onKothState = (st) => { setKoth(st); game.kothState = st; game.hill?.set(st, socket.id); };

    // --- Inventaire (5 emplacements) et décors destructibles (v6) ---
    const onInvUpdate = ({ inventory, select, gg }) => {
      game.weapons?.setInventory(inventory, select);
      if (gg) { setGgLevel(gg.level || 0); if (gg.ladder) setLadder(gg.ladder); } else if (gg === null) setGgLevel(0);
    };
    const distVol = (x, z, ref = 60) => {
      const d = Math.hypot(x - camera.position.x, z - camera.position.z);
      return Math.max(0, 1 - d / ref);
    };
    const onPropDestroyed = ({ id, type, x, y, z }) => {
      if (!game.mapProps) { pendingProps = pendingProps || []; if (!pendingProps.includes(id)) pendingProps.push(id); }
      game.mapProps?.destroy(id);
      if (type === 'explosive') {
        game.fx?.explosion(x, y, z, 7);
        sound.playBoom(Math.min(1, 0.25 + distVol(x, z, 140)));
      } else {
        game.fx?.breakProp(x, y, z);
        sound.playBreak(distVol(x, z, 45));
      }
    };
    const onPropRespawn = ({ id }) => {
      game.mapProps?.restore(id);
      if (pendingProps) pendingProps = pendingProps.filter((value) => value !== id);
    };
    const onPropsState = ({ destroyed = [] } = {}) => {
      pendingProps = destroyed;
      if (!game.mapProps) return;
      game.mapProps.restoreAll();
      for (const id of destroyed) game.mapProps.destroy(id);
    };
    const onMedkitsState = ({ medkits = [] } = {}) => { pendingMedkits = medkits; game.medkits?.setState(medkits); };
    const onMedkitCollected = ({ id }) => {
      game.medkits?.collect(id);
      if (!game.medkits && pendingMedkits) pendingMedkits = pendingMedkits.map((m) => m.id === id ? { ...m, collected: true } : m);
    };
    const onMedkitRespawn = ({ id }) => {
      game.medkits?.respawn(id);
      if (!game.medkits && pendingMedkits) pendingMedkits = pendingMedkits.map((m) => m.id === id ? { ...m, collected: false } : m);
    };
    const onMedkitGranted = ({ heal = 35 } = {}) => {
      const tid = Date.now() + Math.random();
      setLootToast({ id: tid, name: 'Trousse de soin', rarity: 'common', heal });
      setTimeout(() => setLootToast((t) => (t && t.id === tid ? null : t)), 2800);
    };
    const onBuildState = ({ builds = [] } = {}) => { pendingBuilds = builds; game.buildings?.setState(builds); };
    const onBuildAdded = ({ build }) => {
      if (!build) return;
      if (game.buildings) game.buildings.add(build);
      else if (pendingBuilds) pendingBuilds = [...pendingBuilds.filter((b) => b.id !== build.id), build];
    };
    const onBuildUpdated = ({ build }) => {
      if (!build) return;
      if (game.buildings) game.buildings.update(build);
      else pendingBuilds = [...pendingBuilds.filter((b) => b.id !== build.id), build];
    };
    const onBuildRemoved = ({ id }) => {
      if (game.buildings) game.buildings.remove(id);
      else pendingBuilds = pendingBuilds.filter((b) => b.id !== id);
    };
    const onBuildMaterials = ({ materials = 0 } = {}) => setBuildMaterials(materials);
    const onBuildRejected = ({ reason } = {}) => {
      const msg = reason === 'materials' ? 'Pas assez de matériaux' : 'Construction impossible ici';
      setBuildMessage(msg);
      setTimeout(() => setBuildMessage(''), 1800);
    };

    // Tir d'un autre joueur : traînée + son (plus faible avec la distance)
    const onPlayerFired = ({ id, weaponId, dir, tracer }) => {
      const def = game.config?.weapons.find((w) => w.id === weaponId);
      if (!def || !game.remotes || !game.weapons) return;
      const eye = game.remotes.getEyePosition(id, new THREE.Vector3());
      if (!eye) return;
      game.weapons.remoteShot(eye, dir, def, tracer);
      const dist = eye.distanceTo(camera.position);
      sound.playShotAt(def.type, Math.pow(Math.max(0, 1 - dist / 140), 1.5));
    };

    const onScoresUpdate = (list) => { scoresRef.current = list; setScores(list); };
    const onMatchStarted = ({ duration, timeLeft: tl, mode: m, teams, killTarget: kt, ladder: lad }) => {
      if (lad) setLadder(lad);
      if (m !== 'koth') { setKoth(null); game.hill?.set(null); }
      if (m !== 'gungame') setGgLevel(0);
      if (m) {
        const t = teams && teams[socket.id] !== undefined ? teams[socket.id] : 0;
        setMode(m); setMyTeam(t); setKillTarget(kt); setTeamKills([0, 0]);
        game.mode = m; game.myTeam = t;
        game.remotes?.setContext({ mode: m, myTeam: t });
        game.remotes?.setTeams(teams);
      }
      setMatchStatus('playing');
      setMatchEnd(null);
      setRewards(null);
      setTimeLeft(tl != null ? Math.floor(tl / 1000) : Math.floor(duration / 1000));
      game.weapons?.resetAmmo();
    };
    const onMatchEnded = (data) => { setMatchStatus('ended'); setMatchEnd(data); };
    const onMatchReset = () => { setMatchStatus('waiting'); setMatchEnd(null); setRewards(null); };
    const onMatchRewards = (data) => setRewards(data);

    const onPlayerHit = ({ targetId, hp, damage }) => {
      if (targetId === socket.id) {
        setMyHp(hp);
        setRegenOn(false);
        setHurt((h) => h + 1);
        sound.playHurt();
      } else {
        game.remotes?.setHp(targetId, hp);
      }
      void damage;
    };
    // Régénération envoyée par le serveur
    const onPlayerHp = ({ id, hp }) => {
      if (id === socket.id) {
        setMyHp(hp);
        setRegenOn(true);
        clearTimeout(regenTimer);
        regenTimer = setTimeout(() => setRegenOn(false), 900);
      } else {
        game.remotes?.setHp(id, hp);
      }
    };
    const onPlayerDied = ({ id, username, killerName, killerId, killerTeam, victimTeam, weaponId, head }) => {
      const kid = Date.now() + Math.random();
      setKillFeed((prev) => [
        ...prev.slice(-4),
        { id: kid, killer: killerName, victim: username, kTeam: killerTeam, vTeam: victimTeam, head, weapon: weaponId ? weaponName(weaponId) : '' },
      ]);
      setTimeout(() => setKillFeed((prev) => prev.filter((k) => k.id !== kid)), 5000);
      if (killerId === socket.id && id !== socket.id) {
        sound.playKill();
        setBanner({ id: kid, name: username, head });
        setTimeout(() => setBanner((b) => (b && b.id === kid ? null : b)), 2300);
      }
      if (id === socket.id) {
        setKilledBy({ name: killerName, weapon: weaponId ? weaponName(weaponId) : '', head });
        setAlive(false);
        setRespawnIn(3);
        game.weapons?.triggerUp();
        game.weapons?.setAds(false);
      } else {
        game.remotes?.kill(id);
      }
    };
    const onPlayerRespawned = ({ id, position }) => {
      if (id === socket.id) {
        game.player?.teleport(position.x, position.y, position.z);
        game.weapons?.resetAmmo();
        setAlive(true);
        setMyHp(100);
        setRegenOn(false);
        setRespawnIn(0);
      } else {
        game.remotes?.respawn(id, position);
      }
    };

    const rejoinRoom = () => {
      if (!roomCode) return;
      socket.emit('room:join', { code: roomCode }, (res) => {
        if (res?.error) { console.warn('Reconnexion échouée:', res.error); onExit(); return; }
        sendLoadout();
        socket.emit('match:enter');
      });
    };
    const onConnect = () => rejoinRoom();
    const onDisconnect = (reason) => console.warn('⚠️ Socket déconnecté:', reason);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('player:joined', onPlayerJoined);
    socket.on('player:left', onPlayerLeft);
    socket.on('player:state', onPlayerState);
    socket.on('match:entered', onMatchEntered);
    socket.on('scores:update', onScoresUpdate);
    socket.on('match:started', onMatchStarted);
    socket.on('match:ended', onMatchEnded);
    socket.on('match:reset', onMatchReset);
    socket.on('match:rewards', onMatchRewards);
    socket.on('player:hit', onPlayerHit);
    socket.on('player:hp', onPlayerHp);
    socket.on('player:died', onPlayerDied);
    socket.on('player:respawned', onPlayerRespawned);
    socket.on('player:fired', onPlayerFired);
    socket.on('player:weapon', onPlayerWeapon);
    socket.on('player:look', onPlayerLook);
    socket.on('teams:update', onTeamsUpdate);
    socket.on('room:kicked', onKicked);
    socket.on('chests:state', onChestsState);
    socket.on('chest:opened', onChestOpened);
    socket.on('chest:respawn', onChestRespawn);
    socket.on('loot:granted', onLootGranted);
    socket.on('loadout:forced', onLoadoutForced);
    socket.on('loadout:restore', onLoadoutRestore);
    socket.on('koth:state', onKothState);
    socket.on('inv:update', onInvUpdate);
    socket.on('prop:destroyed', onPropDestroyed);
    socket.on('prop:respawn', onPropRespawn);
    socket.on('props:state', onPropsState);
    socket.on('medkits:state', onMedkitsState);
    socket.on('medkit:collected', onMedkitCollected);
    socket.on('medkit:respawn', onMedkitRespawn);
    socket.on('medkit:granted', onMedkitGranted);
    socket.on('build:state', onBuildState);
    socket.on('build:added', onBuildAdded);
    socket.on('build:updated', onBuildUpdated);
    socket.on('build:removed', onBuildRemoved);
    socket.on('build:materials', onBuildMaterials);
    socket.on('build:rejected', onBuildRejected);

    game.handlers = {
      onConnect, onDisconnect, onPlayerJoined, onPlayerLeft, onPlayerState, onMatchEntered,
      onScoresUpdate, onMatchStarted, onMatchEnded, onMatchReset, onMatchRewards,
      onPlayerHit, onPlayerHp, onPlayerDied, onPlayerRespawned, onPlayerFired,
      onPlayerWeapon, onPlayerLook, onTeamsUpdate, onKicked,
      onChestsState, onChestOpened, onChestRespawn, onLootGranted, onLoadoutForced, onLoadoutRestore, onKothState,
      onInvUpdate, onPropDestroyed, onPropRespawn, onPropsState,
      onMedkitsState, onMedkitCollected, onMedkitRespawn, onMedkitGranted,
      onBuildState, onBuildAdded, onBuildUpdated, onBuildRemoved, onBuildMaterials, onBuildRejected,
    };

    // --- Chargement ---
    (async () => {
      try {
        setLoadProgress('Récupération de la configuration…');
        const config = await getGameConfig();
        game.config = config;
        setWeaponDefs(config.weapons);
        try { await loadCatalog(); } catch { /* skins par défaut */ }
        if (cancelled) return;

        // Quelle carte ? (choisie par l'hôte dans le salon)
        const roomInfo = roomCode
          ? await new Promise((resolve) => {
            const to = setTimeout(() => resolve(null), 4000);
            socket.emit('room:join', { code: roomCode }, (r) => { clearTimeout(to); resolve(r && r.ok ? r : null); });
          })
          : null;
        const mapId = (roomInfo && roomInfo.state && roomInfo.state.map) || 'ville';
        setMyId(socket.id);
        if (roomInfo && roomInfo.state) { setMode(roomInfo.state.mode); setKillTarget(roomInfo.state.killTarget); }
        if (cancelled) return;

        const mapBuild = await buildMap(scene, {
          mapId,
          lowPower,
          spawns: config.spawns,
          onProgress: (m) => {
            if (cancelled) return;
            setLoadProgress(m);
            const mm = /(\d+)\/(\d+)/.exec(m);
            if (mm) setLoadPct(Math.max(6, Math.round((Number(mm[1]) / Number(mm[2])) * 80)));
            else if (/terrain/i.test(m)) setLoadPct(86);
            else if (/objets/i.test(m)) setLoadPct(92);
          },
        });
        if (cancelled) return;
        const { world, pads, layout, props: mapProps } = mapBuild;
        game.mapBuild = mapBuild;

        setLoadProgress('Préparation du joueur et des armes…');
        const spawnList = layout.spawns && layout.spawns.length ? layout.spawns : config.spawns;
        const spawn = spawnList[Math.floor(Math.random() * spawnList.length)];
        game.player = createPlayer(camera, canvas, world, spawn, layout.half);
        game.mapProps = mapProps;
        game.mapView = createMapView(layout);
        game.fx = createFx(scene, { lowPower });
        if (isTouch) game.player.setTouchMode(true);
        game.player.setPads(pads);
        game.remotes = createRemotePlayersManager(scene);
        game.rift = createRift(scene, camera, game.player);
        game.chests = createChests(scene, { lowPower });
        let chestRevisionApplied = -1;
        do {
          chestRevisionApplied = pendingChestRevision;
          await game.chests.setState(pendingChests || []);
        } while (chestRevisionApplied !== pendingChestRevision);
        game.chestsReady = true;
        game.medkits = createMedkits(scene, { lowPower });
        await game.medkits.setState(pendingMedkits || layout.medkits.map((m, id) => ({ ...m, id, collected: false })));
        game.buildings = createBuildingSystem(scene, world);
        await game.buildings.setState(pendingBuilds || []);
        if (pendingProps) { game.mapProps.restoreAll(); for (const id of pendingProps) game.mapProps.destroy(id); }
        game.hill = createHill(scene);
        game.weapons = createWeaponSystem({
          scene, camera, player: game.player, world, remotes: game.remotes,
          defs: config.weapons,
          loadout: ['pistol'],
          showTargets: mapId === 'ville',
          onPropHit: (ids) => { if (socket.connected) for (const id of ids) socket.emit('prop:hit', { id }); },
          onShoot: (data) => { if (socket.connected) socket.emit('player:shoot', data); },
          onFired: (data) => { if (socket.connected) socket.emit('player:fire', data); },
          onScope: (v) => setScoped(v),
          onHitFeedback: ({ head }) => {
            sound.playHit(head);
            setHitMark({ head, id: Math.random() });
            clearTimeout(hitTimer);
            hitTimer = setTimeout(() => setHitMark(null), 180);
          },
          onTargetHit: (s) => setScore(s),
          onWeaponChange: (id) => { if (socket.connected) socket.emit('player:weapon', { weaponId: id }); },
        });
        getProfile().then(({ profile }) => {
          const t = tracerById(profile.equippedTracer);
          game.weapons?.setTracer(t && t.color !== null && t.color !== undefined ? t.color : null);
        }).catch(() => {});
        await game.weapons.ready;
        if (cancelled) return;
        buildWeaponIcons(config.weapons.map((w) => w.id)).then((ic) => { if (!cancelled) setIcons(ic); });
        if (!tutoSeen()) setShowTuto(true);

        // Chat vocal (le micro demande l'autorisation ; on écoute même sans micro)
        game.voice = createVoice(socket, { onStatus: (state, msg, info) => setVoiceStatus({ state, msg, ...(info || {}) }) });
        game.voice.start();

        // --- Contrôles ---
        const isLocked = () => (isTouch ? !!game.touchPlaying : document.pointerLockElement === canvas);
        const doRift = () => {
          if (!game.rift || !isLocked()) return;
          if (game.rift.use()) {
            if (socket.connected) socket.emit('player:rift');
            setRiftReady(false);
            setTimeout(() => setRiftReady(true), 4000);
          }
        };
        const doInteract = () => {
          if (!isLocked() || !socket.connected) return;
          const chest = game.chests?.nearest(camera.position, 4.5);
          const medkit = game.medkits?.nearest(camera.position, 4.5);
          if (medkit && (!chest || medkit.dist <= chest.dist)) socket.emit('medkit:use', { id: medkit.id });
          else if (chest) socket.emit('chest:open', { id: chest.id });
        };
        const currentBuildTarget = () => {
          if (!game.player) return null;
          const p = game.player.state.position;
          const yaw = game.player.state.yaw + game.buildRotationOffset;
          const snapped = Math.round(yaw / (Math.PI / 2)) * (Math.PI / 2);
          const x = Math.round((p.x - Math.sin(snapped) * 6) / 2) * 2;
          const z = Math.round((p.z - Math.cos(snapped) * 6) / 2) * 2;
          const y = Math.max(0, Math.min(18, Math.round(Math.max(0, p.y - 1.7) / 3) * 3));
          return { type: BUILD_TYPES[game.buildTypeIndex].id, x, y, z, rotation: snapped };
        };
        const toggleBuild = () => {
          game.buildMode = !game.buildMode;
          setBuildMode(game.buildMode);
          if (!game.buildMode) game.buildings?.hidePreview();
        };
        const cycleBuild = () => {
          game.buildTypeIndex = (game.buildTypeIndex + 1) % BUILD_TYPES.length;
          setBuildTypeIndex(game.buildTypeIndex);
        };
        const placeBuild = () => {
          if (!isLocked() || !game.buildMode || !socket.connected) return;
          const target = currentBuildTarget();
          if (target) socket.emit('build:place', target);
        };
        const editBuild = (remove = false) => {
          if (!game.player || !socket.connected) return;
          const item = game.buildings?.nearestOwned(game.player.state.position, socket.id, 8);
          if (!item) return;
          socket.emit(remove ? 'build:remove' : 'build:edit', { id: item.id });
        };
        game.doRift = doRift;
        game.doOpenChest = doInteract;
        game.toggleBuild = toggleBuild;
        game.cycleBuild = cycleBuild;
        game.placeBuild = placeBuild;
        game.editBuild = () => editBuild(false);
        game.removeBuild = () => editBuild(true);
        game.currentBuildTarget = currentBuildTarget;
        const onMouseDown = (e) => {
          if (isTouch || !isLocked() || !game.weapons) return;
          if (game.buildMode) {
            if (e.button === 0) placeBuild();
            if (e.button === 2) game.buildRotationOffset = (game.buildRotationOffset + Math.PI / 2) % (Math.PI * 2);
            return;
          }
          if (e.button === 0) game.weapons.triggerDown();
          if (e.button === 2) game.weapons.setAds(true);
        };
        const onMouseUp = (e) => {
          if (isTouch || !game.weapons) return;
          if (e.button === 0 && !game.buildMode) game.weapons.triggerUp();
          if (e.button === 2 && !game.buildMode) game.weapons.setAds(false);
        };
        const onWheel = (e) => {
          if (!isLocked() || !game.weapons) return;
          game.weapons.cycle(e.deltaY > 0 ? 1 : -1);
        };
        const onContext = (e) => e.preventDefault();
        document.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mouseup', onMouseUp);
        canvas.addEventListener('wheel', onWheel, { passive: true });
        canvas.addEventListener('contextmenu', onContext);

        const onKeyDown = (e) => {
          if (e.code === 'KeyE' && !e.repeat) doRift();
          if (isLocked() && game.weapons) {
            if (e.code === 'KeyR') game.weapons.reload();
            const m = /^(?:Digit|Numpad)([1-5])$/.exec(e.code);
            if (m) game.weapons.select(Number(m[1]) - 1);
          }
          if (e.code === 'KeyF' && !e.repeat) doInteract();
          if (e.code === 'KeyB' && !e.repeat && isLocked()) toggleBuild();
          if (e.code === 'KeyG' && !e.repeat && isLocked() && game.buildMode) cycleBuild();
          if (e.code === 'KeyX' && !e.repeat && isLocked() && game.buildMode) editBuild(false);
          if (e.code === 'Backspace' && !e.repeat && isLocked() && game.buildMode) { e.preventDefault(); editBuild(true); }
          if (e.code === 'KeyM' && !e.repeat && game.voice?.hasMic()) game.voice.toggleMute();
          if (e.code === 'KeyV' && !e.repeat && game.voice?.hasMic()) {
            game.voice.setTalking(true);
            setTalking(true);
          }
          if (e.code === 'F3') { e.preventDefault(); setShowFps((v) => !v); }
          if (e.code === 'Escape') document.exitPointerLock();
          if (e.code === 'Tab') { e.preventDefault(); setShowScoreboard(true); }
        };
        const onKeyUp = (e) => {
          if (e.code === 'Tab') { e.preventDefault(); setShowScoreboard(false); }
          if (e.code === 'KeyV') { game.voice?.setTalking(false); setTalking(false); }
        };
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);

        const onLockChange = () => {
          const l = isLocked();
          setLocked(l);
          if (!l) { game.weapons?.triggerUp(); game.weapons?.setAds(false); game.buildMode = false; setBuildMode(false); game.buildings?.hidePreview(); }
        };
        document.addEventListener('pointerlockchange', onLockChange);

        const onResize = () => {
          camera.aspect = window.innerWidth / window.innerHeight;
          camera.updateProjectionMatrix();
          game.applyQuality?.(game.lowPower);
        };
        window.addEventListener('resize', onResize);

        Object.assign(game.handlers, {
          onMouseDown, onMouseUp, onWheel, onContext, onKeyDown, onKeyUp, onLockChange, onResize,
        });

        if (socket.connected) rejoinRoom();

        // Position envoyée à 20 Hz
        game.sendState = setInterval(() => {
          if (!game.player || !socket.connected) return;
          const st = game.player.state;
          socket.emit('player:state', {
            position: { x: st.position.x, y: st.position.y, z: st.position.z },
            rotation: { yaw: st.yaw, pitch: st.pitch },
          });
        }, 50);

        game.timerInt = setInterval(() => setTimeLeft((t) => (t > 0 ? t - 1 : 0)), 1000);
        game.respawnInt = setInterval(() => {
          setRespawnIn((r) => {
            if (r <= 1) {
              if (r === 1 && socket.connected) socket.emit('player:respawn');
              return 0;
            }
            return r - 1;
          });
        }, 1000);

        // HUD des armes (10 Hz suffisent)
        const _eye = new THREE.Vector3();
        game.hudInt = setInterval(() => {
          if (game.weapons) setWeaponHud(game.weapons.getHud());
          if (game.chests) setNearChest(!!game.chests.nearest(camera.position, 4.5));
          if (game.medkits) setNearMedkit(!!game.medkits.nearest(camera.position, 4.5));
          if (game.mapView && game.player) {
            const ps = game.player.state;
            const st = {
              me: { x: ps.position.x, z: ps.position.z, yaw: ps.yaw },
              chests: game.chests ? game.chests.list() : [],
              medkits: game.medkits ? game.medkits.list() : [],
              hill: game.kothState ? { x: game.kothState.x, z: game.kothState.z, r: game.kothState.r, color: game.kothState.contested ? '#e74c3c' : game.kothState.occupant ? '#ff9d1c' : '#58d68d' } : null,
              allies: [],
            };
            if (game.mode === 'team' && game.remotes) {
              const teamOf = new Map(scoresRef.current.map((r) => [r.id, r.team]));
              for (const id of game.remotes.ids()) {
                if (teamOf.get(id) === game.myTeam && game.remotes.getEyePosition(id, _eye)) st.allies.push({ x: _eye.x, z: _eye.z });
              }
            }
            if (miniRef.current) game.mapView.drawMini(miniRef.current, st);
            if (game.showTab && mapRef.current) game.mapView.drawFull(mapRef.current, st);
          }
          if (game.player) {
            setLunar(Math.ceil(game.player.state.lunarT));
            setHeading(Math.round((((-game.player.state.yaw * 180) / Math.PI) % 360 + 360) % 360) % 360);
          }
          // Voix : le volume de chaque joueur dépend de sa distance
          if (game.voice && game.remotes && game.player) {
            for (const id of game.remotes.ids()) {
              if (game.remotes.getEyePosition(id, _eye)) {
                game.voice.setVolume(id, voiceVolume(_eye.distanceTo(camera.position)));
              }
            }
          }
        }, 100);

        // Compteur de FPS : instantané + moyenne sur 10 s
        const samples = [];
        let frames = 0;
        let fpsT = performance.now();
        game.fpsInt = setInterval(() => {
          const t = performance.now();
          const cur = Math.round((frames * 1000) / (t - fpsT));
          frames = 0; fpsT = t;
          samples.push(cur);
          if (samples.length > 20) samples.shift();
          const avg = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
          setFps({ fps: cur, avg });
        }, 500);

        // --- Boucle principale ---
        let last = performance.now();
        function loop() {
          if (cancelled) return;
          const now = performance.now();
          const dt = Math.min((now - last) / 1000, 0.05);
          last = now;
          frames++;

          game.player.update(dt);
          game.weapons.update(dt);
          game.rift.update(dt);
          game.remotes.tick(dt);
          game.chests?.tick(dt);
          game.medkits?.tick(dt);
          if (game.buildMode && game.buildings && game.currentBuildTarget) game.buildings.preview(game.currentBuildTarget());
          else game.buildings?.hidePreview();
          game.fx?.tick(dt);
          sky.position.copy(camera.position);

          renderer.render(scene, camera);
          game.raf = requestAnimationFrame(loop);
        }
        loop();

        setLoadPct(100);
        setMapLoading(false);
      } catch (e) {
        console.error('❌ Erreur de chargement :', e);
        setLoadProgress(`Erreur : ${e.message || e}. Le serveur est-il lancé ? (voir README)`);
      }
    })();

    // --- Nettoyage ---
    return () => {
      cancelled = true;
      cancelAnimationFrame(game.raf);
      clearInterval(game.sendState);
      clearInterval(game.timerInt);
      clearInterval(game.respawnInt);
      clearInterval(game.hudInt);
      clearInterval(game.fpsInt);
      clearTimeout(hitTimer);
      clearTimeout(regenTimer);

      socket.emit('match:leave');
      const h = game.handlers;
      socket.off('connect', h.onConnect);
      socket.off('disconnect', h.onDisconnect);
      socket.off('player:joined', h.onPlayerJoined);
      socket.off('player:left', h.onPlayerLeft);
      socket.off('player:state', h.onPlayerState);
      socket.off('match:entered', h.onMatchEntered);
      socket.off('scores:update', h.onScoresUpdate);
      socket.off('match:started', h.onMatchStarted);
      socket.off('match:ended', h.onMatchEnded);
      socket.off('match:reset', h.onMatchReset);
      socket.off('match:rewards', h.onMatchRewards);
      socket.off('player:hit', h.onPlayerHit);
      socket.off('player:hp', h.onPlayerHp);
      socket.off('player:died', h.onPlayerDied);
      socket.off('player:respawned', h.onPlayerRespawned);
      socket.off('player:fired', h.onPlayerFired);
      socket.off('player:weapon', h.onPlayerWeapon);
      socket.off('player:look', h.onPlayerLook);
      socket.off('teams:update', h.onTeamsUpdate);
      socket.off('room:kicked', h.onKicked);
      socket.off('chests:state', h.onChestsState);
      socket.off('chest:opened', h.onChestOpened);
      socket.off('chest:respawn', h.onChestRespawn);
      socket.off('loot:granted', h.onLootGranted);
      socket.off('loadout:forced', h.onLoadoutForced);
      socket.off('loadout:restore', h.onLoadoutRestore);
      socket.off('koth:state', h.onKothState);
      socket.off('inv:update', h.onInvUpdate);
      socket.off('prop:destroyed', h.onPropDestroyed);
      socket.off('prop:respawn', h.onPropRespawn);
      socket.off('props:state', h.onPropsState);
      socket.off('medkits:state', h.onMedkitsState);
      socket.off('medkit:collected', h.onMedkitCollected);
      socket.off('medkit:respawn', h.onMedkitRespawn);
      socket.off('medkit:granted', h.onMedkitGranted);
      socket.off('build:state', h.onBuildState);
      socket.off('build:added', h.onBuildAdded);
      socket.off('build:updated', h.onBuildUpdated);
      socket.off('build:removed', h.onBuildRemoved);
      socket.off('build:materials', h.onBuildMaterials);
      socket.off('build:rejected', h.onBuildRejected);

      if (h.onMouseDown) document.removeEventListener('mousedown', h.onMouseDown);
      if (h.onMouseUp) document.removeEventListener('mouseup', h.onMouseUp);
      if (h.onWheel) canvas.removeEventListener('wheel', h.onWheel);
      if (h.onContext) canvas.removeEventListener('contextmenu', h.onContext);
      if (h.onKeyDown) document.removeEventListener('keydown', h.onKeyDown);
      if (h.onKeyUp) document.removeEventListener('keyup', h.onKeyUp);
      if (h.onLockChange) document.removeEventListener('pointerlockchange', h.onLockChange);
      if (h.onResize) window.removeEventListener('resize', h.onResize);

      game.chests?.dispose();
      game.medkits?.dispose();
      game.buildings?.dispose();
      game.mapBuild?.dispose?.();
      game.hill?.dispose();
      game.fx?.dispose();
      game.voice?.dispose();
      game.weapons?.dispose();
      game.remotes?.clear();
      game.player?.dispose();
      document.exitPointerLock();
      renderer.dispose();
    };
  }, [user.username, roomCode]);

  const enterGame = () => {
    sound.resumeAudio();
    const g = gameRef.current;
    g?.voice?.resume();
    if (isTouch) {
      if (g) g.touchPlaying = true;
      setLocked(true);
      // Plein écran + paysage si le navigateur le permet
      try { document.documentElement.requestFullscreen?.().then(() => screen.orientation?.lock?.('landscape').catch(() => {})).catch(() => {}); } catch { /* ignore */ }
    } else {
      canvasRef.current?.requestPointerLock();
    }
  };

  // API des commandes tactiles
  const touchApi = {
    move: (x, y) => gameRef.current?.player?.setTouchMove(x, y),
    look: (dx, dy) => gameRef.current?.player?.lookBy(dx, dy),
    key: (code, down) => gameRef.current?.player?.setKey(code, down),
    fireDown: () => gameRef.current?.weapons?.triggerDown(),
    fireUp: () => gameRef.current?.weapons?.triggerUp(),
    adsDown: () => gameRef.current?.weapons?.setAds(true),
    adsUp: () => gameRef.current?.weapons?.setAds(false),
    reload: () => gameRef.current?.weapons?.reload(),
    rift: () => gameRef.current?.doRift?.(),
    interact: () => gameRef.current?.doOpenChest?.(),
    buildToggle: () => gameRef.current?.toggleBuild?.(),
    buildCycle: () => gameRef.current?.cycleBuild?.(),
    buildPlace: () => gameRef.current?.placeBuild?.(),
    buildEdit: () => gameRef.current?.editBuild?.(),
    buildRemove: () => gameRef.current?.removeBuild?.(),
    toggleTab: () => setShowScoreboard((v) => !v),
    toggleMic: () => gameRef.current?.voice?.toggleMute(),
    pause: () => {
      const g = gameRef.current;
      if (g) g.touchPlaying = false;
      g?.player?.setTouchMove(0, 0);
      g?.weapons?.triggerUp();
      g?.weapons?.setAds(false);
      setLocked(false);
    },
  };

  const min = Math.floor(timeLeft / 60);
  const sec = String(timeLeft % 60).padStart(2, '0');
  const dead = !alive && matchStatus === 'playing';
  const toggleLowPower = () => {
    const next = !lowPower;
    setLowPower(next);
    writeLowPowerPreference(next);
    const g = gameRef.current;
    if (g) { g.lowPower = next; g.applyQuality?.(next); g.mapBuild?.setLowPower?.(next); g.fx?.setLowPower?.(next); g.chests?.setLowPower?.(next); g.medkits?.setLowPower?.(next); }
  };

  if (mapLoading) {
    return (
      <div className="game-container">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="full-overlay loading">
          <div className="stamp">Déploiement en cours</div>
          <h2 className="logo">PIXEL<span>RIFT</span></h2>
          <div className="loading-bar"><div className="loading-fill" style={{ width: `${loadPct}%` }} /></div>
          <p>{loadProgress}</p>
        </div>
      </div>
    );
  }

  const game_weapon = (id) => weaponDefs.find((w) => w.id === id);
  const gap = weaponHud ? Math.max(5, Math.min(48, 5 + weaponHud.spread * 5)) : 8;
  const hpClass = regenOn ? 'regen' : myHp > 50 ? '' : myHp > 25 ? 'mid' : 'low';
  const ammoClass = !weaponHud ? '' : weaponHud.ammo === 0 ? 'empty' : weaponHud.ammo <= weaponHud.mag * 0.25 ? 'low' : '';

  return (
    <div className="game-container">
      <canvas ref={canvasRef} className={`game-canvas ${dead ? 'dead' : ''}`} />

      <div className="hud">
        {hurt > 0 && <div key={hurt} className="hurt-flash" />}
        {alive && myHp <= 30 && <div className="lowhp" />}
        {lunar > 0 && <div className="lunar-tint" />}
        {scoped && <div className="scope-overlay"><div className="scope-h" /><div className="scope-v" /></div>}

        <Compass heading={heading} />

        {(nearChest || nearMedkit) && alive && locked && !buildMode && (
          <div className="chest-prompt"><span className="keycap">F</span> {nearMedkit && !nearChest ? 'Prendre la trousse de soin' : nearChest && nearMedkit ? 'Interagir avec le plus proche' : nearChest ? 'Ouvrir le coffre' : 'Prendre la trousse de soin'}</div>
        )}
        {buildMode && alive && locked && (
          <div className="build-hud"><b>CONSTRUCTION</b><span>{BUILD_TYPES[buildTypeIndex].label}</span><span>{buildMaterials} matériaux</span><small>Clic poser · G changer · clic droit tourner · X modifier · Retour arrière retirer</small></div>
        )}
        {buildMessage && <div className="build-message">{buildMessage}</div>}
        {lootToast && (
          <div key={lootToast.id} className="loot-toast" style={{ '--rar': (RAR[lootToast.rarity] || RAR.common).color }}>
            <small>{(RAR[lootToast.rarity] || RAR.common).label}</small>
            <b>{lootToast.name}</b>
            <span>+{lootToast.heal} PV · touche 5</span>
          </div>
        )}

        <div className="hud-killfeed">
          {killFeed.map((k) => (
            <div key={k.id} className="kill-line">
              <span className={`k ${mode === 'team' ? (k.kTeam === myTeam ? 'ally' : 'enemy') : ''}`}>{k.killer}</span>
              <span className={`ico ${k.head ? 'head' : ''}`}>{k.head ? '◎' : '✖'}</span>
              <span className={`v ${mode === 'team' ? (k.vTeam === myTeam ? 'ally' : 'enemy') : ''}`}>{k.victim}</span>
              {k.weapon && <em>{k.weapon}</em>}
            </div>
          ))}
        </div>

        <div className="hud-topright">
          <div className="hud-box"><span className="lbl">Temps</span><span className="val">{min}:{sec}</span></div>
          {mode === 'team'
            ? (
              <div className="hud-box small team">
                <span className="lbl">Alpha · Bravo / {killTarget}</span>
                <span className="val"><i className="ta">{teamKills[0]}</i> – <i className="tb">{teamKills[1]}</i></span>
              </div>
            )
            : mode === 'koth'
              ? (
                <div className={`hud-box small koth ${koth && koth.occupant === myId ? 'mine' : ''} ${koth && koth.contested ? 'contested' : ''}`}>
                  <span className="lbl">Colline · objectif {killTarget} pts{koth ? ` · zone ${Math.ceil(koth.timeLeft / 1000)}s` : ''}</span>
                  <span className="val">{(scores.find((r) => r.id === myId) || {}).points || 0}</span>
                </div>
              )
              : mode === 'gungame'
                ? (
                  <div className="hud-box small"><span className="lbl">Course aux armes</span><span className="val">{Math.min(ggLevel + 1, ladder)} / {ladder}</span></div>
                )
                : (
                  <div className="hud-box small"><span className="lbl">Éliminations · objectif {killTarget}</span><span className="val">{(scores.find((r) => r.id === myId) || {}).kills ?? score}</span></div>
                )}
          {showFps && (
            <div className={`hud-fps ${fps.avg && fps.avg < 30 ? 'low' : ''}`}>
              {fps.fps} FPS · MOY {fps.avg}
            </div>
          )}
          {!locked && <button className="hud-exit" onClick={onExit}>Quitter</button>}
        </div>

        {lunar > 0 && <div className="hud-lunar">Gravité lunaire · {lunar}s</div>}

        <div
          className={`crosshair ${weaponHud?.ads ? 'ads' : ''} ${scoped ? 'hidden' : ''}`}
          style={{ '--gap': `${weaponHud?.ads ? Math.max(3, gap * 0.5) : gap}px` }}
        >
          <i className="t" /><i className="b" /><i className="l" /><i className="r" /><b />
        </div>
        {hitMark && (
          <div key={hitMark.id} className={`hitmarker ${hitMark.head ? 'head' : ''}`}>
            <i /><i /><i /><i />
          </div>
        )}
        {banner && (
          <div key={banner.id} className="kill-banner">
            <div className="t">ÉLIMINATION</div>
            <div className="n">{banner.name}{banner.head && <small>TÊTE</small>}</div>
          </div>
        )}

        <div className="hud-bl">
          <div>
            <div className="hp-top">
              <span className="lbl">VITALITÉ</span>
              {regenOn && <span className="regen">RÉGÉNÉRATION</span>}
              <span className="num">{myHp}</span>
            </div>
            <div className="hp-bar"><div className={`hp-fill ${hpClass}`} style={{ width: `${myHp}%` }} /></div>
          </div>
          <div className={`ability ${riftReady ? '' : 'cooling'}`}>
            <span className="keycap">E</span>
            <span className="name">RIFT</span>
            <div className="cool"><i /></div>
            <span className="st">{riftReady ? 'PRÊT' : 'RECHARGE'}</span>
          </div>
          <div className={`hud-voice ${(voiceStatus.mode === 'ptt' ? talking : !voiceStatus.muted) ? 'talking' : ''} ${voiceStatus.muted ? 'muted' : ''} ${voiceStatus.state}`}>
            {voiceStatus.state === 'ready' && (voiceStatus.mode === 'ptt'
              ? (talking ? 'MICRO ACTIF' : 'MAINTIENS V POUR PARLER')
              : (voiceStatus.muted ? 'MICRO COUPÉ · M pour rétablir' : 'MICRO OUVERT · M pour couper'))}
            {(voiceStatus.state === 'denied' || voiceStatus.state === 'unavailable') && voiceStatus.msg}
          </div>
        </div>

        {weaponHud && (
          <div className="hud-br">
            <div className="ammo-panel">
              <div className="wtype">{weaponHud.type}</div>
              <div className="wname">{weaponHud.name}</div>
              <div className="ammo-line">
                <span className={`mag ${ammoClass}`}>{weaponHud.ammo}</span>
                <span className="sep">/</span>
                <span className="res">∞</span>
              </div>
              <div className="firemode">
                <span className="pips">{Array.from({ length: weaponHud.mode === 'burst' ? 3 : 1 }).map((_, k) => <i key={k} />)}</span>
                {MODE_TXT[weaponHud.mode]}
                {weaponHud.ammo === 0 && !weaponHud.reloading && <span style={{ color: 'var(--danger)' }}>· RECHARGE (R)</span>}
              </div>
              {weaponHud.reloading && (
                <div className="reload-wrap">
                  RECHARGEMENT
                  <div className="reload-bar"><i style={{ width: `${weaponHud.reloadPct * 100}%` }} /></div>
                </div>
              )}
            </div>
          </div>
        )}

        {weaponHud && (
          <div className="hotbar" onPointerDown={(e) => e.stopPropagation()}>
            {Array.from({ length: 5 }).map((_, i) => {
              const sl = weaponHud.slots[i];
              const col = sl ? (RAR[sl.rarity || 'common'] || RAR.common).color : null;
              return (
                <div
                  key={i}
                  className={`hb-slot ${sl ? '' : 'empty'} ${sl && i === weaponHud.index ? 'active' : ''}`}
                  style={col ? { '--rar': col } : undefined}
                  onPointerDown={(e) => { if (sl) { e.preventDefault(); gameRef.current?.weapons?.select(i); } }}
                >
                  <b>{i + 1}</b>
                  {sl && (icons[sl.id] ? <img src={icons[sl.id]} alt={sl.name} draggable={false} /> : <span className="hb-name">{sl.name}</span>)}
                </div>
              );
            })}
          </div>
        )}

        {mapRef && <canvas ref={miniRef} className="minimap" width={190} height={190} />}

        <div className="hud-hint">
          Clic tirer · clic droit viser · R recharger · 1-5 armes · F coffre/soin · B construction · G pièce · E rift · Tab carte
        </div>
      </div>

      {showScoreboard && (
        <div className="full-overlay tab-overlay">
          <div className="tab-panel">
            <div className="tab-col tab-inv">
              <h3>Équipement</h3>
              <div className="tab-slots">
                {Array.from({ length: 5 }).map((_, i) => {
                  const sl = weaponHud && weaponHud.slots[i];
                  const w = sl && game_weapon(sl.id);
                  const col = sl ? (RAR[sl.rarity || 'common'] || RAR.common).color : null;
                  return (
                    <div key={i} className={`tab-slot ${sl ? '' : 'empty'} ${sl && weaponHud.index === i ? 'active' : ''}`} style={col ? { '--rar': col } : undefined}>
                      <b>{i + 1}</b>
                      {sl ? (
                        <>
                          {icons[sl.id] ? <img src={icons[sl.id]} alt="" draggable={false} /> : <span />}
                          <div className="ts-info">
                            <strong>{sl.name}</strong>
                            <small style={{ color: col }}>{(RAR[sl.rarity || 'common'] || RAR.common).label}{w ? ` · ${w.damage}${w.pellets > 1 ? `×${w.pellets}` : ''} dégâts · ${w.mag} balles` : ''}</small>
                          </div>
                        </>
                      ) : <em>Vide</em>}
                    </div>
                  );
                })}
              </div>
              <p className="muted small">Trouve des armes dans les coffres dorés (<span className="kbd">F</span>). Tu perds tout à ta mort.</p>
            </div>
            <div className="tab-col tab-map">
              <h3>Carte</h3>
              <canvas ref={mapRef} className="tab-map-canvas" width={620} height={620} />
              <p className="muted small"><span style={{ color: '#ffc94a' }}>■</span> coffre · <span style={{ color: '#fff' }}>➤</span> toi{mode === 'koth' ? <> · <span style={{ color: '#58d68d' }}>●</span> colline</> : null}</p>
            </div>
            <div className="tab-col tab-scores">
              <h3>Classement</h3>
              <ScoreTable rows={scores} mode={mode} myId={socket.id} teamKills={teamKills} />
            </div>
            {isTouch && <button className="tab-close" onPointerDown={(e) => { e.stopPropagation(); setShowScoreboard(false); }}>✕ Fermer</button>}
          </div>
        </div>
      )}

      {dead && (
        <div className="full-overlay death">
          <div className="t">ÉLIMINÉ</div>
          {killedBy && (
            <div className="by">
              par <b>{killedBy.name}</b>
              {killedBy.weapon && <small>{killedBy.weapon}{killedBy.head ? ' · TÊTE' : ''}</small>}
            </div>
          )}
          <div className="re">
            RÉAPPARITION
            <strong>{respawnIn}</strong>
          </div>
        </div>
      )}

      {matchEnd && (
        <div className="full-overlay match-end">
          <div className="big">
            {matchEnd.mode === 'team'
              ? (matchEnd.winnerTeam === null ? 'ÉGALITÉ' : matchEnd.winnerTeam === myTeam ? 'VICTOIRE' : 'DÉFAITE')
              : (matchEnd.winnerId === socket.id ? 'VICTOIRE' : matchEnd.winnerId ? 'FIN DU MATCH' : 'ÉGALITÉ')}
          </div>
          {matchEnd.mode === 'team' && matchEnd.winnerTeam !== null && (
            <p className="match-sub">Équipe {matchEnd.teamNames[matchEnd.winnerTeam]} · {matchEnd.teamKills[0]} – {matchEnd.teamKills[1]}</p>
          )}
          <div className="match-end-cols">
            <div className="score-table-wrap">
              <ScoreTable rows={matchEnd.results} mode={matchEnd.mode} myId={socket.id} teamKills={matchEnd.teamKills} teamNames={matchEnd.teamNames} highlightWinner />
            </div>
            {rewards && (
              <div className="score-table-wrap rewards-box">
                <h3>Récompenses</h3>
                {rewards.lines.map((l, i) => (
                  <div key={i} className="reward-line">
                    <span>{l.label}</span>
                    <span><Icon name="xp" size={14} /> {l.xp} <Icon name="coin" size={14} /> {l.coins}</span>
                  </div>
                ))}
                <div className="reward-total">
                  <span>Total</span>
                  <b><Icon name="xp" size={16} /> +{rewards.xpGain} XP · <Icon name="coin" size={16} /> +{rewards.coinGain}</b>
                </div>
                {rewards.levelAfter > rewards.levelBefore && <p className="levelup"><Icon name="star" size={16} /> Niveau {rewards.levelAfter} atteint !</p>}
                {rewards.tierAfter > rewards.tierBefore && <p className="levelup"><Icon name="ticket" size={16} /> Pass de combat : palier {rewards.tierAfter}</p>}
              </div>
            )}
          </div>
          <p className="muted small">Nouveau match dans quelques secondes…</p>
        </div>
      )}

      {!locked && !matchEnd && alive && !showCredits && !showTuto && !touchEdit && (
        <div className="full-overlay pause" onClick={enterGame}>
          <div className="pause-menu" onClick={(e) => e.stopPropagation()}>
            <h2 className="logo">PIXEL<span>RIFT</span></h2>
            <p className="pause-sub">// EN PAUSE</p>
            <button className="menu-item primary" onClick={enterGame}>Reprendre<small>Clique n'importe où pour jouer</small></button>
            <button className="menu-item" onClick={() => setShowTuto(true)}>Tutoriel<small>Comment jouer (PC et mobile)</small></button>
            <label className="quality-toggle"><input type="checkbox" checked={lowPower} onChange={toggleLowPower} /><span><b>Mode appareil modeste</b><small>Profil léger visé pour iPhone 7, Redmi 9 et appareils proches : distance, résolution et détails réduits.</small></span></label>
            {isTouch && <button className="menu-item" onClick={() => setTouchEdit(true)}>Personnaliser les touches<small>Déplacer, agrandir, rendre transparent</small></button>}
            <button className="menu-item" onClick={() => { const v = gameRef.current?.voice; if (v) v.setMode(voiceStatus.mode === 'ptt' ? 'open' : 'ptt'); }}>
              Micro : {voiceStatus.mode === 'ptt' ? 'appuyer pour parler (V)' : 'toujours ouvert'}<small>Clique pour changer de mode</small>
            </button>
            <button className="menu-item" onClick={() => setShowCredits(true)}>Crédits<small>Modèles 3D</small></button>
            <button className="menu-item dim" onClick={onExit}>Quitter la partie</button>
          </div>
          <div className="controls" onClick={(e) => e.stopPropagation()}>
            <h3>// Commandes</h3>
            <span><span className="kbd">Z Q S D</span></span><span>Se déplacer · <span className="kbd">Shift</span> courir</span>
            <span><span className="kbd">Espace</span></span><span>Sauter</span>
            <span><span className="kbd">C</span></span><span>Glisser (en courant)</span>
            <span><span className="kbd">Clic</span></span><span>Tirer · <span className="kbd">Clic D.</span> viser</span>
            <span><span className="kbd">R</span></span><span>Recharger</span>
            <span><span className="kbd">1-5</span></span><span>Armes de l'inventaire (ou molette)</span>
            <span><span className="kbd">E</span></span><span>Rift (téléportation)</span>
            <span><span className="kbd">F</span></span><span>Ouvrir un coffre / prendre un soin</span>
            <span><span className="kbd">B · G</span></span><span>Activer la construction · changer de pièce</span>
            <span><span className="kbd">Clic</span></span><span>Poser une pièce · clic droit pour la tourner</span>
            <span><span className="kbd">X · Retour</span></span><span>Modifier / retirer sa construction</span>
            <span><span className="kbd">M</span></span><span>Couper / rétablir le micro</span>
            <span><span className="kbd">Tab</span></span><span>Équipement + carte + classement · <span className="kbd">F3</span> FPS</span>
          </div>
        </div>
      )}

      {showTuto && <Tutorial defaultMobile={isTouch} onClose={() => setShowTuto(false)} />}

      {isTouch && (locked || touchEdit) && !matchEnd && !showTuto && (
        <TouchControls api={touchApi} nearInteract={(nearChest || nearMedkit) && alive} buildMode={buildMode} micMuted={!!voiceStatus.muted} editing={touchEdit} onDone={() => setTouchEdit(false)} />
      )}

      {showCredits && (
        <div className="arsenal-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="arsenal credits-box">
            <div className="arsenal-head"><h2>Crédits des modèles 3D</h2></div>
            <p className="muted small">Modèles publiés sous licence CC-BY, via Poly Pizza (poly.pizza).</p>
            <ul className="credits-list">
              {CREDITS.map((c) => (
                <li key={c.pack}>
                  <strong>{c.pack}</strong>
                  {c.author
                    ? <> par <a href={c.url} target="_blank" rel="noreferrer">{c.author}</a> [{c.license}] via {c.via}</>
                    : <span className="muted"> — auteur et licence à confirmer</span>}
                </li>
              ))}
            </ul>
            <div className="arsenal-foot">
              <button onClick={() => setShowCredits(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
