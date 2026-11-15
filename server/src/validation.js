// Validation légère des états envoyés par les clients.
// Le serveur reste l'autorité sur les dégâts, les positions et les limites de la carte.
const PLAYER_MIN_Y = 1.2;
const PLAYER_MAX_Y = 40;
const MAX_MOVE_SPEED = 18; // vitesse de glissade incluse, avec une marge réseau
const MOVE_GRACE = 2.5;
const MAX_ELAPSED_SECONDS = 5;
const MAX_RIFT_ALLOWANCE = 10;

function finiteVector(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z);
}

function wrapAngle(value) {
  const full = Math.PI * 2;
  return ((value + Math.PI) % full + full) % full - Math.PI;
}

export function validatePlayerState(map, previous, position, rotation, elapsedMs, riftAllowance = 0) {
  if (!map || !Number.isFinite(map.half) || !finiteVector(previous) || !finiteVector(position)) return null;
  if (!rotation || !Number.isFinite(rotation.yaw) || !Number.isFinite(rotation.pitch)) return null;

  const limit = map.half - 1.5;
  if (Math.abs(position.x) > limit || Math.abs(position.z) > limit) return null;
  if (position.y < PLAYER_MIN_Y || position.y > PLAYER_MAX_Y) return null;

  const elapsed = Math.max(0.05, Math.min(MAX_ELAPSED_SECONDS, (Number(elapsedMs) || 50) / 1000));
  const allowance = Math.max(0, Math.min(MAX_RIFT_ALLOWANCE, Number(riftAllowance) || 0));
  const maxDistance = MAX_MOVE_SPEED * elapsed + MOVE_GRACE + allowance;
  const distance = Math.hypot(
    position.x - previous.x,
    position.y - previous.y,
    position.z - previous.z
  );
  if (distance > maxDistance) return null;

  return {
    position: { x: position.x, y: position.y, z: position.z },
    rotation: {
      yaw: wrapAngle(rotation.yaw),
      pitch: Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotation.pitch)),
    },
  };
}
