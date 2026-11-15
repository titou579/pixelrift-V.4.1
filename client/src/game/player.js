import * as THREE from 'three';

const PLAYER_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.4;
const SPEED = 6;
const SPRINT = 9.5;
const GRAVITY = 22;
const JUMP_VELOCITY = 8;
const STEP_HEIGHT = 0.5; // on monte seul les marches / bordures de 50 cm

// Glissade : touche C en courant → élan rapide qui ralentit, caméra baissée
const SLIDE_TIME = 0.85;
const SLIDE_SPEED = 13.5;
const SLIDE_END_SPEED = 5;
const SLIDE_COOLDOWN = 0.7;
const SLIDE_EYE_DROP = 0.7;

// Gravité lunaire (zones lumineuses bleues sur la carte) : sauts hauts et longs
const LUNAR_GRAVITY = 0.28;
const LUNAR_JUMP = 1.12;
const LUNAR_DURATION = 9;

export function createPlayer(camera, canvas, world, spawn, half = 170) {
  const state = {
    position: new THREE.Vector3(spawn?.x ?? 0, spawn?.y ?? PLAYER_HEIGHT, spawn?.z ?? 15),
    velocity: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    onGround: false,
    sprinting: false,
    moving: false,
    speedMult: 1,       // modifié par l'arme en main / la visée
    sensitivity: 1,     // réduite quand on vise avec zoom
    sliding: false,
    slideT: 0,
    slideCd: 0,
    slideDirX: 0,
    slideDirZ: 0,
    eyeDrop: 0,
    lunarT: 0,          // secondes restantes de gravité lunaire
    touchMode: false,   // v6 : commandes tactiles (pas de verrouillage du pointeur)
    touchX: 0,          // joystick : -1 gauche … +1 droite
    touchY: 0,          // joystick : -1 arrière … +1 avant
  };
  let pads = [];
  let slideWasDown = false;

  const keys = {};

  const onClick = () => {
    if (state.touchMode) return;
    if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
  };
  canvas.addEventListener('click', onClick);

  const onMouseMove = (e) => {
    if (document.pointerLockElement !== canvas) return;
    const k = 0.002 * state.sensitivity;
    state.yaw -= e.movementX * k;
    state.pitch -= e.movementY * k;
    state.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.pitch));
  };
  document.addEventListener('mousemove', onMouseMove);

  const onKeyDown = (e) => { keys[e.code] = true; };
  const onKeyUp = (e) => { keys[e.code] = false; };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  function inXZ(p, b, r) {
    return (
      p.x > b.min.x - r && p.x < b.max.x + r &&
      p.z > b.min.z - r && p.z < b.max.z + r
    );
  }

  // Bloque-t-on horizontalement à cette position ?
  function blocked(p) {
    const feet = p.y - PLAYER_HEIGHT;
    const head = p.y + 0.15;
    for (const b of world.nearby(p.x, p.z, PLAYER_RADIUS + 0.2)) {
      if (b.max.y <= feet + STEP_HEIGHT) continue; // assez bas pour l'enjamber
      if (b.min.y >= head) continue;               // au-dessus de la tête
      if (inXZ(p, b, PLAYER_RADIUS)) return true;
    }
    return false;
  }

  const tryX = new THREE.Vector3();
  const tryZ = new THREE.Vector3();

  function update(dt) {
    let forward = (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp'] ? 1 : 0) - (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0);
    let right = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft'] ? 1 : 0);
    // Joystick tactile : analogique (petite inclinaison = marche lente), course automatique à fond
    let analog = 1;
    const touchMag = Math.hypot(state.touchX, state.touchY);
    if (state.touchMode && touchMag > 0.08) {
      forward = state.touchY; right = state.touchX;
      analog = Math.min(1, touchMag);
    }
    const autoSprint = state.touchMode && touchMag > 0.88 && forward > 0.5;

    state.moving = Math.abs(forward) > 0.01 || Math.abs(right) > 0.01;
    state.sprinting = (!!(keys['ShiftLeft'] || keys['ShiftRight']) || autoSprint) && forward > 0 && state.speedMult >= 0.95 && !state.sliding;
    const speed = (state.sprinting ? SPRINT : SPEED) * state.speedMult * (analog < 1 ? Math.max(0.35, analog) : 1);

    // Zones de gravité lunaire
    if (state.lunarT > 0) state.lunarT = Math.max(0, state.lunarT - dt);
    for (const pad of pads) {
      if (Math.abs(state.position.x - pad.x) < pad.r && Math.abs(state.position.z - pad.z) < pad.r &&
          Math.hypot(state.position.x - pad.x, state.position.z - pad.z) < pad.r &&
          Math.abs(state.position.y - PLAYER_HEIGHT - (pad.y || 0)) < 1.5) {
        state.lunarT = LUNAR_DURATION;
      }
    }
    const lunar = state.lunarT > 0;

    // Diagonales : on normalise pour ne pas aller plus vite
    const len = Math.max(1, Math.hypot(forward, right));
    const f = forward / len;
    const r = right / len;

    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    let vx = (r * cos - f * sin) * speed;
    let vz = (-r * sin - f * cos) * speed;

    // Glissade
    state.slideCd = Math.max(0, state.slideCd - dt);
    const slideDown = !!keys['KeyC']; // (pas Ctrl : Ctrl+W fermerait l'onglet)
    if (slideDown && !slideWasDown && !state.sliding && state.slideCd <= 0 &&
        state.onGround && state.moving && (state.sprinting || forward > 0)) {
      state.sliding = true;
      state.slideT = SLIDE_TIME;
      const l = Math.hypot(vx, vz) || 1;
      state.slideDirX = vx / l;
      state.slideDirZ = vz / l;
    }
    slideWasDown = slideDown;
    if (state.sliding) {
      state.slideT -= dt;
      const k = Math.max(0, state.slideT / SLIDE_TIME);
      const sp = SLIDE_END_SPEED + (SLIDE_SPEED - SLIDE_END_SPEED) * k;
      vx = state.slideDirX * sp;
      vz = state.slideDirZ * sp;
      if (state.slideT <= 0 || !state.onGround) {
        state.sliding = false;
        state.slideCd = SLIDE_COOLDOWN;
      }
    }
    state.velocity.x = vx;
    state.velocity.z = vz;

    if (keys['Space'] && state.onGround) {
      state.velocity.y = JUMP_VELOCITY * (lunar ? LUNAR_JUMP : 1);
      state.onGround = false;
      if (state.sliding) { state.sliding = false; state.slideCd = SLIDE_COOLDOWN; }
    }
    state.velocity.y -= GRAVITY * (lunar ? LUNAR_GRAVITY : 1) * dt;
    // En lunaire, la chute est plafonnée (descente douce)
    if (lunar && state.velocity.y < -9) state.velocity.y = -9;

    // Collision horizontale (X puis Z séparément pour pouvoir glisser le long des murs)
    tryX.copy(state.position); tryX.x += state.velocity.x * dt;
    if (!blocked(tryX)) state.position.x = tryX.x;
    tryZ.copy(state.position); tryZ.z += state.velocity.z * dt;
    if (!blocked(tryZ)) state.position.z = tryZ.z;

    // Limites de la carte (sécurité)
    const lim = half - 2;
    state.position.x = Math.max(-lim, Math.min(lim, state.position.x));
    state.position.z = Math.max(-lim, Math.min(lim, state.position.z));

    // Vertical
    const prevFeet = state.position.y - PLAYER_HEIGHT;
    state.position.y += state.velocity.y * dt;

    // Plafond (dessous d'une plateforme)
    if (state.velocity.y > 0) {
      const headTop = state.position.y + 0.15;
      const prevHeadTop = prevFeet + PLAYER_HEIGHT + 0.15;
      for (const b of world.nearby(state.position.x, state.position.z, PLAYER_RADIUS + 0.2)) {
        if (!inXZ(state.position, b, PLAYER_RADIUS)) continue;
        if (prevHeadTop <= b.min.y && headTop > b.min.y) {
          state.position.y = b.min.y - 0.16;
          state.velocity.y = 0;
          break;
        }
      }
    }

    // Sol
    state.onGround = false;
    if (state.position.y <= PLAYER_HEIGHT) {
      state.position.y = PLAYER_HEIGHT;
      state.velocity.y = 0;
      state.onGround = true;
    }

    // Atterrir sur le dessus des objets (voitures, caisses, marches, plateformes)
    if (state.velocity.y <= 0) {
      for (const b of world.nearby(state.position.x, state.position.z, PLAYER_RADIUS + 0.2)) {
        if (!inXZ(state.position, b, PLAYER_RADIUS)) continue;
        const top = b.max.y;
        const feet = state.position.y - PLAYER_HEIGHT;
        if (feet <= top + 0.05 && prevFeet >= top - STEP_HEIGHT - 0.01 && top > 0.05) {
          state.position.y = top + PLAYER_HEIGHT;
          state.velocity.y = 0;
          state.onGround = true;
        }
      }
    }

    // Caméra : s'abaisse pendant la glissade
    const wantDrop = state.sliding ? SLIDE_EYE_DROP : 0;
    state.eyeDrop += (wantDrop - state.eyeDrop) * Math.min(1, dt * 14);
    camera.position.copy(state.position);
    camera.position.y -= state.eyeDrop;
    camera.rotation.order = 'YXZ';
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  // Peut-on se tenir ici sans être dans un mur ? (utilisé par le portail)
  function canStandAt(x, y, z) {
    return !blocked({ x, y, z });
  }

  function setPads(list) { pads = list || []; }

  // --- Commandes tactiles (v6) ---
  function setTouchMode(on) { state.touchMode = !!on; if (!on) { state.touchX = 0; state.touchY = 0; } }
  function setTouchMove(x, y) { state.touchX = x; state.touchY = y; }
  function lookBy(dx, dy) {            // dx, dy en pixels d'écran
    const k = 0.0042 * state.sensitivity;
    state.yaw -= dx * k;
    state.pitch -= dy * k;
    state.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, state.pitch));
  }
  function setKey(code, down) { keys[code] = !!down; }

  function teleport(x, y, z) {
    state.position.set(x, y, z);
    state.velocity.set(0, 0, 0);
  }

  function dispose() {
    canvas.removeEventListener('click', onClick);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
  }

  return { state, update, teleport, canStandAt, setPads, dispose, keys, setTouchMode, setTouchMove, lookBy, setKey };
}
